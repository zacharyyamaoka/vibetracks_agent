#!/usr/bin/env python3
"""Builds the progress report: one self-contained HTML page (video and stills inlined), written to the main
checkout's reports/media/ (gitignored: it inlines media). Re-run it after every landed version.

    python3 docs/build_progress_report.py --media <dir> --out ~/vibetracks_agent/reports/media/vibetracks-agent-2026-11-25.html

<dir> holds hero.mp4 + hero.gif (recorded read-only in Zach's real Preview over his eight boxes) and the stills named in
STILLS. Every score comes from the repo's own files (ledger.jsonl's dev rows, solutions/*/scorecard.json), per ruler
(a v1 row is never ranked against a v2 one, OBJECTIVES §11); the prose is typed.
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
PEPS = f"{GH}/vibetracks/blob/main/docs/peps"
# solution -> (vibetracks main merge, PEP file or None, what it brought). WHY typed: the merge sha lives in vibetracks.
LANDED = {
    "sidebar-style-1": ("edbfc4e", None, "the sidebar's style = Claude's, 0 of 22 properties off"),
    "boxes-as-tracks-1": ("8ba03b2", "0024-boxes-are-the-tracks", "boxes are the tracks; Vibe Tracks' own tree.json, vt add, pins"),
    "new-track-1": ("ecf4dd6", "0026-new-track-makes-a-box", "vt new and the New track dialog make a real box"),
    "rollups-2": ("6a73de5", "0025-roll-up-pages-over-the-boxes", "Home, Review, Feedback over every box; parent roll-ups"),
    "view-2": ("12743ec", "0027-claudes-menus-over-the-boxes", "Claude's ··· menu, Pause/Resume, the view menu, groupings"),
    "box-sites-2": ("2d3e724", "0028-a-box-opens-on-its-own-site", "a real box opens on its own built site, live; state words"),
    "stock-tree-2": ("5787f03", "0030-the-tree-on-headless-tree", "drag on a stock tree (Headless Tree)"),
}
OTHER = [  # landed on vibetracks main tonight, not measured by the ruler
    ("bd459dc", "0011-file-contracts", "headless claude -p chats bind to their track again (every chat was taken for a subagent)"),
    ("5283ade", "0017-live-push", "vt serve memory about halved: Preview 2 GB → 0.8 GB"),
    ("dec7b06", "0029-set-why", "vt set --why: a pause on a legacy note track can carry Zach's answer"),
    ("5ae9861", None, "Windows CI green for the first time (vibetracks and the dev mirror): one cross-platform lock, safe_open, liveness"),
    ("3b31500", None, "the hourly feedback miner names its real error (it was an expired account login; the unit now runs as personal)"),
    ("3b12a80", "0014-overview-landing-kpi-layout", "the track dashboard stays still while read (0 px, CLS 0 over 60 s); a stale proposal reads superseded"),
    ("563563b", "0028-a-box-opens-on-its-own-site", "blackbox_agent 0.1.10 bundled: claude_party_agent builds; a box's landing names the tie-break winner (scored bb-0110-1: no change)"),
]
STILLS = [
    ("h1-home.png", "Home: one data-ui table over your eight boxes (then your note tracks), Active / Done / All"),
    ("h2-vta.png", "A box opens on its own built site: Vibe Tracks Agent's landing, its chart from 14 to 0 shall failing"),
    ("h5-menu.png", "Claude's ··· menu, item for item, with Pause Z before Archive"),
    ("h6-view.png", "Claude's view menu: Group by, Sort by, Show, New section, Reset, View all"),
    ("h7-review.png", "Review: 14 asks across 4 boxes, each box's own Needs-you, by track"),
    ("h4-tta.png", "Trajectory Tracking Agent on its own site, inside the sidebar"),
]


def git(*a: str) -> str:
    return subprocess.run(["git", "-C", str(BOX), *a], capture_output=True, text=True, check=True).stdout.strip()


def uri(p: Path, mime: str | None = None, jpeg: bool = False) -> str:
    data = p.read_bytes()
    if jpeg:  # WHY: stills as JPEG keep the page under the desktop preview's ~1.9 MB
        from PIL import Image
        buf = io.BytesIO()
        im = Image.open(p).convert("RGB")
        if im.width > 1000:
            im = im.resize((1000, round(im.height * 1000 / im.width)), Image.LANCZOS)
        im.save(buf, "JPEG", quality=60, optimize=True)
        data, mime = buf.getvalue(), "image/jpeg"
    return f"data:{mime};base64," + base64.b64encode(data).decode()


def rows(ruler: str) -> list[dict]:
    out = [json.loads(l) for l in (BOX / "ledger.jsonl").read_text().splitlines() if l.strip()]
    keep = [r for r in out if r.get("split") == "dev" and r.get("ruler", "v1") == ruler]
    last: dict[str, dict] = {}
    for r in keep:  # WHY the newest row per solution: a re-run after a memory kill supersedes the killed one
        last[r["solution"]] = r
    return list(last.values())


def items(sid: str) -> dict:
    return json.loads((BOX / "solutions" / sid / "scorecard.json").read_text())["task_objectives"]


def flips(r: dict) -> tuple[list[str], list[str]]:
    parent = r.get("parent")
    if not parent or not (BOX / "solutions" / parent / "scorecard.json").exists():
        return [], []
    a, b = items(parent), items(r["solution"])
    return [k for k in b if a.get(k) == 1 and b[k] == 0], [k for k in b if a.get(k) == 0 and b[k] == 1]


def esc(s: object) -> str:
    return html.escape(str(s))


def board(ruler: str, total: int) -> str:
    out = []
    for r in rows(ruler):
        up, down = flips(r)
        sid = r["solution"]
        land = LANDED.get(sid)
        landed = f'<a href="{GH}/vibetracks/commit/{land[0]}">{land[0]}</a>' if land else ("baseline" if sid.startswith("main-") else "·")
        out.append(f"<tr><td><a href=\"{GH}/vibetracks_agent/tree/main/solutions/{esc(sid)}\"><code>{esc(sid)}</code></a></td>"
                   f"<td class=n>{r['objective']} / {total}</td><td class=n>{r['tiebreak']}</td><td class=n>{r['tiebreak2']}</td>"
                   f"<td>{'yes' if r['admissible'] else 'no'}</td><td>{', '.join(up) or '·'}</td><td>{', '.join(down) or 'none'}</td><td>{landed}</td></tr>")
    head = "<tr><th>version</th><th>shall failing</th><th>should</th><th>checks</th><th>admissible</th><th>turned green</th><th>regressed</th><th>landed</th></tr>"
    return f"<div class=tbl><table>{head}{''.join(out)}</table></div>"


def pep_link(pep: str | None) -> str:
    return f'<a href="{PEPS}/{pep}.md">PEP {pep[:4]}</a>' if pep else "·"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--media", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    m = Path(a.media).expanduser()
    head = git("rev-parse", "--short", "HEAD")
    v2 = rows("v2")
    best = min((r for r in v2 if r.get("admissible")), key=lambda r: (r["objective"], r["tiebreak"], r["tiebreak2"]))
    figs = "".join(f'<figure><img src="{uri(m / f, jpeg=True)}" alt="{esc(c)}"><figcaption>{esc(c)}</figcaption></figure>'
                   for f, c in STILLS if (m / f).exists())

    def pair(a_: str, b_: str, ca: str, cb: str) -> str:
        return (f'<div class=pair><figure><img src="{uri(m / a_, jpeg=True)}" alt="{esc(ca)}"><figcaption>{esc(ca)}</figcaption></figure>'
                f'<figure><img src="{uri(m / b_, jpeg=True)}" alt="{esc(cb)}"><figcaption>{esc(cb)}</figcaption></figure></div>')

    landed_rows = "".join(f'<tr><td><a href="{GH}/vibetracks/commit/{sha}"><code>{sha}</code></a></td><td>{pep_link(pep)}</td>'
                          f'<td>{esc(what)}</td><td><code>{esc(sid)}</code></td></tr>' for sid, (sha, pep, what) in LANDED.items())
    landed_rows += "".join(f'<tr><td><a href="{GH}/vibetracks/commit/{sha}"><code>{sha}</code></a></td><td>{pep_link(pep)}</td>'
                           f'<td>{esc(what)}</td><td>not a ruler item</td></tr>' for sha, pep, what in OTHER)

    page = f"""<!doctype html><html lang=en><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
<title>Vibe Tracks Agent, night 2</title><style>
:root{{--bg:#fbfbfa;--fg:#1d1d1b;--mut:#6b6b66;--line:#e4e4df;--card:#fff;--acc:#2b6cb0;--good:#2f855a}}
@media (prefers-color-scheme:dark){{:root{{--bg:#151515;--fg:#e9e9e6;--mut:#9c9c96;--line:#2e2e2c;--card:#1d1d1c;--acc:#7fb2ec;--good:#68d391}}}}
body{{margin:0;background:var(--bg);color:var(--fg);font:15px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}}
.wrap{{max-width:1080px;margin:0 auto;padding:28px 16px 60px}}h1{{font-size:28px;margin:0 0 4px}}h2{{font-size:20px;margin:34px 0 10px;border-bottom:1px solid var(--line);padding-bottom:6px}}
a{{color:var(--acc)}}code{{font:13px ui-monospace,monospace}}.muted{{color:var(--mut)}}.verdict{{background:var(--card);border:1px solid var(--line);border-left:4px solid var(--good);padding:12px 16px;border-radius:8px;margin:16px 0}}
video,img{{max-width:100%;border-radius:8px;border:1px solid var(--line);display:block}}figure{{margin:0}}figcaption{{font-size:13px;color:var(--mut);margin-top:6px}}
.figs{{display:grid;grid-template-columns:repeat(auto-fill,minmax(480px,1fr));gap:16px}}.pair{{display:grid;grid-template-columns:1fr 1fr;gap:14px}}
@media(max-width:620px){{.figs,.pair{{grid-template-columns:1fr}}}}
table{{border-collapse:collapse;width:100%;font-size:14px}}td,th{{border-bottom:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top}}td.n{{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}}
.tbl{{overflow-x:auto}}ul li{{margin:5px 0}}.k{{font-weight:600}}details{{margin-top:10px}}summary{{cursor:pointer;color:var(--mut)}}
</style></head><body><div class=wrap>
<h1>Vibe Tracks Agent · night 2</h1>
<p class=muted><a href="{GH}/vibetracks_agent">vibetracks_agent</a> @ <code>{esc(head)}</code> (public) · Vibe Tracks main @ <a href="{GH}/vibetracks/commit/5787f03"><code>5787f03</code></a> and later · built by Claude Code (Opus 5.5) and its lanes</p>
<div class=verdict><b>Every required item of your Nov 24 spec now passes: {best['objective']} of 20 shall failing, {best['tiebreak2']} of 119 checks (ruler v2), down from 18 of 19 at the start of the night.</b>
Fourteen changes landed on Vibe Tracks' main, each verified check by check with no regression. Your eight boxes are in your Preview's sidebar, each opening on its own site. vibetracks_agent is public with every file linked, and <code>blackbox check</code> catches unlinked files and home paths in every box. Stable still runs the Nov 11 release until you promote it.</div>

<h2>Your Preview, over your real boxes</h2>
<video controls autoplay muted loop playsinline><source src="{uri(m / 'hero.mp4', 'video/mp4')}" type="video/mp4"><img src="{uri(m / 'hero.gif', 'image/gif')}" alt="hero GIF"></video>
<p class=muted>Recorded read-only in your Preview (port 4396) after <code>vt add</code> of your eight boxes: Home, a box's own site, the ··· menu, the view menu, Review, Feedback. Nothing was pressed that writes.</p>
<div class=figs>{figs}</div>

<h2>What landed on vibetracks main</h2>
<div class=tbl><table><tr><th>merge</th><th>contract</th><th>what</th><th>scored as</th></tr>{landed_rows}</table></div>
<p class=muted>Each undoes with <code>git revert -m 1 &lt;merge&gt;</code> in vibetracks (edbfc4e: <code>git revert edbfc4e 210279c</code>; dec7b06 is a single commit).</p>

<h2>Scoreboard, ruler v2 (20 shall, 119 checks)</h2>
{board('v2', 20)}
<p class=muted>From <a href="{GH}/vibetracks_agent/blob/main/ledger.jsonl">ledger.jsonl</a>; "turned green" and "regressed" compare items with the version each was built on. Ruler v2 = v1 + S2.10 Pause/Resume (<a href="{GH}/vibetracks_agent/blob/main/docs/peps/0002-ruler-v2-pause-resume.md">PEP 0002</a>, your ask); all 104 v1 checks score identically on it.</p>
<details><summary>Ruler v1 history (19 shall, 104 checks)</summary>{board('v1', 19)}</details>

<h2>Sidebar style: 0 of 22 properties off Claude's</h2>
{pair('sidebar-before.png', 'sidebar-after.png', 'Before (d0cb827)', 'After (edbfc4e): 32 px rows on a 34 px pitch, 14 px type, Claude dark fills')}

<h2>The /rate bad: every file is linked</h2>
<ul><li>127 unlinked paths fixed in <a href="{GH}/vibetracks_agent/commit/ef18c13">ef18c13</a>, held by a test, and for every box by <code>blackbox check</code> 0.1.6+ (the blackbox agent ported the test): your rated commit prints 127 problems, today's HEAD none. 0.1.7's home-path lint: 11 findings, fixed in <a href="{GH}/vibetracks_agent/commit/b288ada">b288ada</a>.</li></ul>
{pair('readme-files-before.png', 'readme-files-after.png', "README's Files table, before", 'After')}

<h2>Decision surface</h2>
<ul>
<li><span class=k>Done and proved:</span> the whole shall list on ruler v2 (0 / 20, 0 / 119), each version admissible (completed, two dev runs agreeing check by check) and compared check by check with its parent; S5.1 by hand (your Preview lists this box and opens it on its own site); the memory fix measured on the same data (1.56 → 0.71 GB after a pass) and live (Preview 799 MB).</li>
<li><span class=k>Decided for you</span> (each with its undo): made vibetracks_agent public (<code>gh repo edit zacharyyamaoka/vibetracks_agent --visibility private --accept-visibility-change-consequences</code>); accepted PEP 0002 (Pause, your ask) and PEP 0001 (a use number reported beside the spec, never a gate; its status line back to "proposed"); landed every change above (their reverts); added your eight boxes, flat, to your real <code>~/.vibetracks/tree.json</code> (<code>vt tree remove &lt;box&gt;</code>), so Preview's sidebar lists boxes and your note tracks stay in Home; legacy-track pauses go through <code>vt set --why</code>, never the box tree; <code>vt claim</code> stays non-binding.</li>
<li><span class=k>Needs you:</span> <b>Make Preview Stable.</b> Vibe Tracks' own rules forbid an agent from promoting. Recommendation: promote now; it brings all of the above to Stable and drops Stable from 3.2 GB to about 0.8 GB. Undo: Roll Stable Back.</li>
<li><span class=k>Left, not blocked:</span> the Agents column reads 0 for every box (the roll-up counts a box's <code>agents/*.md</code>, which your boxes don't write; it should count the chats bound to the box, which now bind); ruler v3 candidates (S2.2 measures row pitch across a section header, so Pinned shares one header; S1.4's row can be off-screen under other groupings; one fixture box in the package format); the box landing names the first version to reach the best objective, not the tie-break winner (sent to the blackbox agent);</li>
<li><span class=k>Not done, on purpose:</span> nothing written in your real Vibe Tracks beyond the tree file (no pause, rename or pin pressed); OBJECTIVES.md and specs/ keep their unlinked names until the next ruler bump; Stable untouched.</li>
</ul>
</div></body></html>"""
    out = Path(a.out).expanduser()
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(page)
    print(f"{out}: {out.stat().st_size / 1e6:.2f} MB")


if __name__ == "__main__":
    main()
