#!/usr/bin/env python3
"""Builds the progress report: one self-contained HTML page (video and stills inlined), written to the main
checkout's reports/media/ (gitignored: it inlines media). Re-run it after every landed version.

    python3 docs/build_progress_report.py --media <dir> --out ~/vibetracks_agent/reports/media/vibetracks-agent-2026-11-25.html

<dir> holds hero.mp4 + hero.gif (recorded from vibetracks main over Zach's real boxes) and the stills named in STILLS.
Every score comes from the repo's own files (ledger.jsonl's dev rows, solutions/*/scorecard.json); the prose is typed.
"""
from __future__ import annotations

import argparse
import base64
import html
import io
import json
import subprocess
from pathlib import Path

BOX = Path(__file__).resolve().parents[1]
GH = "https://github.com/zacharyyamaoka"
LANDED = {"sidebar-style-1": "edbfc4e", "boxes-as-tracks-1": "8ba03b2"}  # vibetracks main merges, per solution


def git(*a: str) -> str:
    return subprocess.run(["git", "-C", str(BOX), *a], capture_output=True, text=True, check=True).stdout.strip()


def uri(p: Path, mime: str | None = None, jpeg: bool = False) -> str:
    data = p.read_bytes()
    if jpeg:  # WHY: stills as JPEG keep the page near the desktop preview's size limit
        from PIL import Image
        buf = io.BytesIO()
        im = Image.open(p).convert("RGB")
        if im.width > 1000:
            im = im.resize((1000, round(im.height * 1000 / im.width)), Image.LANCZOS)
        im.save(buf, "JPEG", quality=64, optimize=True)
        data, mime = buf.getvalue(), "image/jpeg"
    return f"data:{mime};base64," + base64.b64encode(data).decode()


def rows() -> list[dict]:
    out = [json.loads(l) for l in (BOX / "ledger.jsonl").read_text().splitlines() if l.strip()]
    return [r for r in out if r.get("split") == "dev"]


def card(sid: str) -> dict:
    return json.loads((BOX / "solutions" / sid / "scorecard.json").read_text())


def flips(sid: str, parent: str | None) -> tuple[list[str], list[str]]:
    if not parent:
        return [], []
    a, b = card(parent)["task_objectives"], card(sid)["task_objectives"]
    return ([k for k in b if a.get(k) == 1 and b[k] == 0], [k for k in b if a.get(k) == 0 and b[k] == 1])


def esc(s: object) -> str:
    return html.escape(str(s))


STILLS = [
    ("s1-sidebar-real-boxes.png", "The sidebar over Zach's real boxes (vt add of six repos into a scratch home; robot_viz_agent under robot_sdk_agent)"),
    ("s2-box-opened.png", "Opening a track shows that box (here its README: none of the real boxes has a built site/index.html, see Findings)"),
    ("s3-row-menu.png", "The ··· menu: Claude's order and letters so far (Open in, Mark as unread, Fork still to come)"),
    ("s4-pinned.png", "Pin puts the track in a Pinned section at the top (S2.5, met)"),
]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--media", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    m = Path(a.media).expanduser()
    head = git("rev-parse", "--short", "HEAD")
    dev = rows()
    best = min((r for r in dev if r.get("admissible")), key=lambda r: (r["objective"], r["tiebreak"], r["tiebreak2"]))
    base = next(r for r in dev if r["solution"] == "main-d0cb827")

    board = []
    for r in dev:
        up, down = flips(r["solution"], r.get("parent"))
        sha = LANDED.get(r["solution"])
        landed = f'<a href="{GH}/vibetracks/commit/{sha}">{sha}</a>' if sha else "baseline"
        board.append(f"<tr><td><a href=\"{GH}/vibetracks_agent/tree/main/solutions/{esc(r['solution'])}\"><code>{esc(r['solution'])}</code></a></td>"
                     f"<td class=n>{r['objective']}</td><td class=n>{r['tiebreak']}</td><td class=n>{r['tiebreak2']}</td>"
                     f"<td>{'yes' if r['admissible'] else 'no'}</td><td>{', '.join(up) or '·'}</td><td>{', '.join(down) or 'none'}</td><td>{landed}</td></tr>")

    figs = "".join(f'<figure><img src="{uri(m / f, jpeg=True)}" alt="{esc(c)}"><figcaption>{esc(c)}</figcaption></figure>'
                   for f, c in STILLS if (m / f).exists())
    pair = lambda a_, b_, ca, cb: (f'<div class=pair><figure><img src="{uri(m / a_, jpeg=True)}" alt="{esc(ca)}"><figcaption>{esc(ca)}</figcaption></figure>'
                                   f'<figure><img src="{uri(m / b_, jpeg=True)}" alt="{esc(cb)}"><figcaption>{esc(cb)}</figcaption></figure></div>')

    page = f"""<!doctype html><html lang=en><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
<title>Vibe Tracks Agent, night 2</title><style>
:root{{--bg:#fbfbfa;--fg:#1d1d1b;--mut:#6b6b66;--line:#e4e4df;--card:#fff;--acc:#2b6cb0;--good:#2f855a;--warn:#b7791f}}
@media (prefers-color-scheme:dark){{:root{{--bg:#151515;--fg:#e9e9e6;--mut:#9c9c96;--line:#2e2e2c;--card:#1d1d1c;--acc:#7fb2ec;--good:#68d391;--warn:#f6ad55}}}}
body{{margin:0;background:var(--bg);color:var(--fg);font:15px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}}
.wrap{{max-width:1080px;margin:0 auto;padding:28px 16px 60px}}h1{{font-size:28px;margin:0 0 4px}}h2{{font-size:20px;margin:34px 0 10px;border-bottom:1px solid var(--line);padding-bottom:6px}}
a{{color:var(--acc)}}code{{font:13px ui-monospace,monospace}}.muted{{color:var(--mut)}}.verdict{{background:var(--card);border:1px solid var(--line);border-left:4px solid var(--good);padding:12px 16px;border-radius:8px;margin:16px 0}}
video,img{{max-width:100%;border-radius:8px;border:1px solid var(--line);display:block}}figure{{margin:0}}figcaption{{font-size:13px;color:var(--mut);margin-top:6px}}
.figs{{display:grid;grid-template-columns:repeat(auto-fill,minmax(480px,1fr));gap:16px}}.pair{{display:grid;grid-template-columns:1fr 1fr;gap:14px}}
@media(max-width:620px){{.figs,.pair{{grid-template-columns:1fr}}}}
table{{border-collapse:collapse;width:100%;font-size:14px}}td,th{{border-bottom:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top}}td.n{{text-align:right;font-variant-numeric:tabular-nums}}
.tbl{{overflow-x:auto}}ul li{{margin:5px 0}}.k{{font-weight:600}}
</style></head><body><div class=wrap>
<h1>Vibe Tracks Agent · night 2</h1>
<p class=muted><a href="{GH}/vibetracks_agent">vibetracks_agent</a> @ <code>{esc(head)}</code> (public) · Vibe Tracks main @ <a href="{GH}/vibetracks/commit/8ba03b2"><code>8ba03b2</code></a> · built by Claude Code (Opus 5.5) · ruler v1</p>
<div class=verdict><b>Vibe Tracks is now a Claude-style sidebar over your black-box repos: {best['objective']} of 19 shall items failing, down from {base['objective']}</b>, two versions landed on vibetracks main, no check regressed.
vibetracks_agent is public with every file it names linked, and <code>blackbox check</code> now catches unlinked files for every box. Three lanes are still running (ruler v2 with Pause, Home/roll-ups, <code>vt new</code>).</div>

<h2>The sidebar over your real boxes</h2>
<video controls autoplay muted loop playsinline><source src="{uri(m / 'hero.mp4', 'video/mp4')}" type="video/mp4"><img src="{uri(m / 'hero.gif', 'image/gif')}" alt="hero GIF"></video>
<p class=muted>Recorded from vibetracks main @ 8ba03b2 serving a scratch home where <code>vt add</code> registered six of your real repos (it writes only Vibe Tracks' own <code>tree.json</code>; the repos were checked unchanged). Open a track, a child under its parent, the ··· menu, pin and unpin.</p>
<div class=figs>{figs}</div>

<h2>Scoreboard (ruler v1, dev split)</h2>
<div class=tbl><table><tr><th>version</th><th>shall failing</th><th>should</th><th>checks</th><th>admissible</th><th>items turned green</th><th>regressed</th><th>landed</th></tr>{''.join(board)}</table></div>
<p class=muted>From <a href="{GH}/vibetracks_agent/blob/main/ledger.jsonl">ledger.jsonl</a> and each version's scorecard; "regressed" compares item results with the version it was built on. Two dev runs per version must agree check by check (the deterministic gate).</p>

<h2>Sidebar style: 0 of 22 properties off Claude's</h2>
{pair('sidebar-before.png', 'sidebar-after.png', 'Before (d0cb827): 26 px rows, 13 px type, #121212', 'After (edbfc4e): 32 px rows on a 34 px pitch, 14 px type, radius 8, Claude dark fills, a Tracks header')}

<h2>The /rate bad: every file is linked now</h2>
<ul>
<li><span class=k>Fixed in the repo</span> (<a href="{GH}/vibetracks_agent/commit/ef18c13">ef18c13</a>): 127 unlinked paths, repos and notes. GitHub's own render counts links in README 7 → 34, REFERENCES 23 → 53. Vault notes are <code>obsidian://</code> links: they open on your machine and are just a name on GitHub.</li>
<li><span class=k>Held by a test</span> (<code>tests/test_docs_link_what_they_name.py</code>, red first), and <span class=k>for every box</span> by <code>blackbox check</code> 0.1.6 (the blackbox agent ported it): on the commit you rated it prints 127 problems and exits 1; on today's HEAD, "the box is in the format". 0.1.7 added a home-path lint: 11 findings here, fixed in <a href="{GH}/vibetracks_agent/commit/b288ada">b288ada</a>.</li>
</ul>
{pair('readme-files-before.png', 'readme-files-after.png', "README's Files table, before (12bcb3e)", 'After (ef18c13)')}
<p></p>{pair('references-before.png', 'references-after.png', 'REFERENCES.md before', 'After: every item opens')}

<h2>Pause / Resume (your ask via the Agent Activity Agent)</h2>
<ul><li>Filed word for word (<a href="{GH}/vibetracks_agent/blob/main/feedback/2026-11-25-pause-a-track.md">feedback note</a>) and specified in <a href="{GH}/vibetracks_agent/blob/main/docs/peps/0002-ruler-v2-pause-resume.md">PEP 0002</a>: a new shall item S2.10 (Pause/Resume in the ··· and right-click menus before Archive, a paused row looks paused, <code>vt pause|resume &lt;track&gt; [--why]</code>), S2.3's list amended.</li>
<li>The pause is Vibe Tracks' own state (never written into the box), an append-only <code>status</code> list in <code>tree.json</code>, signed by vt: a person's pause is one with no <code>agent</code> in <code>by</code>, which is what the Agent Activity Agent counts.</li></ul>

<h2>Findings from running it on your real boxes</h2>
<ul>
<li><span class=k>A real box opens on its README, not its site.</span> All six of your boxes build their site with the blackbox package (no <code>site/index.html</code> in the repo); the ruler's fixture boxes ship a prebuilt one, so S1.1 passes while this is missed. Next: Vibe Tracks builds the box's page with <code>blackbox build</code> (it reads git, writes only a cache), and the fixture moves to the package format in the next ruler version.</li>
<li><span class=k>State words differ across boxes:</span> robot_viz_agent's status.json says "watching" and agent_activity_agent's says "running"; Vibe Tracks shows both as Unknown (see Home in the video). One vocabulary (ai-team-status/1's) needs mapping, or the boxes need one word list.</li>
<li><span class=k>The ruler shaped one UI choice:</span> pinned rows share one header with the rest because S2.2 measures row pitch across it (a header in between reads 62 px, not 34). Claude has a separate Pinned header; the fix belongs in the ruler, not the UI.</li>
<li><span class=k>S1.4 (live box page) is built but its check misses:</span> at the check's 420 px window the row it clicks sits under the account footer.</li>
</ul>

<h2>Decision surface</h2>
<ul>
<li><span class=k>Done and proved:</span> public + live page; every file linked (test + blackbox check); S2.2 and S1.1-S1.3, S1.5, S2.5 met on the ruler, no regressions (I compared check by check), each landed on vibetracks main with its PEP; the tree file read by the Agent Activity Agent.</li>
<li><span class=k>Decided for you:</span> made the repo public (your ask; history scanned first; undo <code>gh repo edit zacharyyamaoka/vibetracks_agent --visibility private --accept-visibility-change-consequences</code>); accepted PEP 0002 because it is your own ask (undo: its status line back to "proposed" before the freeze); both lanes landed on vibetracks main (undo <code>git revert -m 1 8ba03b2</code>, <code>git revert edbfc4e 210279c</code>); your old note tracks stay as they were (with no box in the tree, the sidebar is unchanged).</li>
<li><span class=k>In flight:</span> ruler v2 (Pause, S2.3's order), Home as a data-ui table with roll-ups and Review/Feedback across boxes (S3.1-S3.4), <code>vt new</code> and the New track dialog (S4.1-S4.4). Then the menus and view menu (S2.3, S2.6, S2.7) with Pause, Headless Tree (S2.8), and the real-box site.</li>
<li><span class=k>Needs you:</span> nothing. PEP 0001 (how often you actually open Vibe Tracks, reported beside the spec, never a gate) is accepted under your default for reversible changes; undo: its status line back to "proposed" (<a href="{GH}/vibetracks_agent/commit/3b1bbc0">3b1bbc0</a>).</li>
<li><span class=k>Not done, on purpose:</span> OBJECTIVES.md and specs/ keep their unlinked names until ruler v2 (they are sha256-frozen); your Stable channel was not promoted (Preview runs main).</li>
</ul>
</div></body></html>"""
    out = Path(a.out).expanduser()
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(page)
    print(f"{out}: {out.stat().st_size / 1e6:.2f} MB")


if __name__ == "__main__":
    main()
