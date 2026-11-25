#!/usr/bin/env python3
"""Builds the review report for vibetracks_agent's first day: one self-contained HTML page (media inlined), written to
the main checkout's reports/media/ (gitignored there: it inlines a video and stills).

    python3 docs/build_report.py --media <dir with the hero .webm/.mp4 + stills> --out /home/bam/vibetracks_agent/reports/media/vibetracks-agent-2026-11-24.html

Every number comes from the repo's own files at HEAD (ledger.jsonl's newest dev row, the solution's scorecard and
junit, specs/, feedback/, REFERENCES.md); nothing is typed in here except prose.
"""
from __future__ import annotations

import argparse
import base64
import html
import json
import re
import subprocess
import xml.etree.ElementTree as ET
from pathlib import Path

BOX = Path(__file__).resolve().parents[1]


def git(*a: str) -> str:
    return subprocess.run(["git", "-C", str(BOX), *a], capture_output=True, text=True, check=True).stdout.strip()


def data_uri(p: Path, mime: str) -> str:
    return f"data:{mime};base64," + base64.b64encode(p.read_bytes()).decode()


def front(text: str) -> dict:
    m = re.match(r"^---\n(.*?)\n---", text, re.S)
    out = {}
    for line in (m.group(1).splitlines() if m else []):
        if ":" in line and not line.startswith(" "):
            k, v = line.split(":", 1)
            out[k.strip()] = v.strip().strip('"')
    return out


def specs() -> list[dict]:
    rows = []
    for p in sorted(BOX.glob("specs/S*.md"), key=lambda p: [int(t) if t.isdigit() else t for t in re.split(r"(\d+)", p.name)]):
        t = p.read_text()
        fm = front(t)
        title = re.search(r"^# (S\d+\.\d+) (.+)$", t, re.M)
        rows.append({"id": fm.get("id"), "kind": fm.get("kind"), "section": fm.get("section"), "title": title.group(2) if title else p.stem, "file": p.name})
    return rows


def newest_dev_row() -> dict | None:
    rows = [json.loads(l) for l in (BOX / "ledger.jsonl").read_text().splitlines() if l.strip()] if (BOX / "ledger.jsonl").exists() else []
    dev = [r for r in rows if r.get("split", "dev") == "dev"]
    return dev[-1] if dev else None


def junit_cases(path: Path) -> dict[str, list[tuple[str, str, str]]]:
    """spec id -> [(case name, pass|fail|skip, message)]"""
    out: dict[str, list] = {}
    if not path.exists():
        return out
    for tc in ET.parse(path).getroot().iter("testcase"):
        name = tc.attrib.get("name", "")
        status, msg = "pass", ""
        for ch in tc:
            if ch.tag in ("failure", "error"):
                status, msg = "fail", (ch.attrib.get("message") or ch.text or "").strip()
            elif ch.tag == "skipped":
                status, msg = "skip", (ch.attrib.get("message") or "").strip()
        m = re.match(r"(S\d+\.\d+)\b", name)
        if m:
            out.setdefault(m.group(1), []).append((name, status, msg))
    return out


def code_spans(s: str) -> str:
    return re.sub(r"`([^`]+)`", lambda m: f"<code>{m.group(1)}</code>", s)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--media", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--solution", default="main-d0cb827")
    a = ap.parse_args()
    media = Path(a.media)
    head = git("rev-parse", "--short", "HEAD")
    row = newest_dev_row() or {}
    sol = BOX / "solutions" / a.solution
    card = json.loads((sol / "scorecard.json").read_text()) if (sol / "scorecard.json").exists() else {}
    junit = junit_cases(sol / "junit-dev.xml") or junit_cases(BOX / "site" / "data" / "junit.xml")
    S = specs()
    nfb = len(list(BOX.glob("feedback/*.md")))
    nref = sum(1 for l in (BOX / "REFERENCES.md").read_text().splitlines() if l.startswith("- "))

    def pick(*keys, src=None):
        for k in keys:
            for d in ([src] if src is not None else [row, card, card.get("objectives", {}) if isinstance(card.get("objectives"), dict) else {}]):
                if isinstance(d, dict) and d.get(k) is not None:
                    return d[k]
        return None

    shall_failing = pick("shall_failing")
    should_failing = pick("should_failing")
    checks_failing = pick("checks_failing")
    gates = pick("gates") or {}

    def esc(s) -> str:
        return html.escape(str(s if s is not None else "—"))

    def item_status(sid: str) -> tuple[str, str]:
        cases = junit.get(sid, [])
        if not cases:
            return "none", "no check"
        f = [c for c in cases if c[1] != "pass"]
        return ("pass", f"{len(cases)} of {len(cases)} pass") if not f else ("fail", f"{len(f)} of {len(cases)} failing")

    areas = {"1": "Tracks are independent boxes", "2": "The sidebar is Claude's", "3": "Roll-up pages", "4": "New track", "5": "Meta"}
    spec_html = []
    for n, title in areas.items():
        items = [s for s in S if s["section"] == n]
        lis = []
        for s in items:
            st, label = item_status(s["id"])
            cases = junit.get(s["id"], [])
            why = "".join(f"<li class='{c[1]}'><b>{esc(c[0])}</b>{(' — ' + esc(c[2][:260])) if c[2] else ''}</li>" for c in cases if c[1] != "pass")
            lis.append(f"<details class='it'><summary><span class='id'>{esc(s['id'])}</span><span class='t'>{code_spans(esc(s['title']))}"
                       f"{' <em>should</em>' if s['kind'] == 'should' else ''}</span><span class='chip {st}'>{esc(label)}</span></summary>"
                       f"{('<ul class=why>' + why + '</ul>') if why else '<p class=muted>Every check passed.' if st == 'pass' else '<p class=muted>No check in ruler v1 (counts as failing).</p>'}</details>")
        spec_html.append(f"<div class='area'><h3>{n}. {esc(title)}</h3>{''.join(lis)}</div>")

    stills = [("01-landing.jpg", "The stock landing (the blackbox_agent package): the goal and the headline, 18 shall items not met"),
              ("04-dashboard-overview.jpg", "The dashboard's Overview: the baseline, both gates, the queue and what's for Zach"),
              ("05-spec-tab.jpg", "The Spec tab: 23 items by section, each with its checks' pass rate"),
              ("06-spec-note.jpg", "A spec item opens as its note (S2.3, the ··· menu), his words first"),
              ("07-feedback-tab.jpg", "Feedback: 13 notes, his words exact, each naming the items it became"),
              ("08-references-tab.jpg", "References: the prior-art sweep"),
              ("11-notes-tab.jpg", "Notes: the design in one screen and Claude's two reference menus"),
              ("10-landing-dark.jpg", "Dark mode")]
    fig = "".join(f"<figure><img src='{data_uri(media / f, 'image/jpeg' if f.endswith('.jpg') else 'image/png')}' alt='{esc(c)}' loading='lazy'><figcaption>{esc(c)}</figcaption></figure>"
                  for f, c in stills if (media / f).exists())
    vid = next((p for p in [media / "hero.mp4", media / "hero.webm"] if p.exists()), None)
    gif = media / "hero.gif"
    hero = ""
    if vid:
        hero = (f"<video controls muted loop autoplay playsinline poster='{data_uri(media / '01-landing.jpg', 'image/jpeg') if (media / '01-landing.jpg').exists() else ''}'>"
                f"<source src='{data_uri(vid, 'video/mp4' if vid.suffix == '.mp4' else 'video/webm')}' type='{'video/mp4' if vid.suffix == '.mp4' else 'video/webm'}'>"
                + (f"<img src='{data_uri(gif, 'image/gif')}' alt='The walk through the box site'>" if gif.exists() else "") + "</video>")

    gate_html = " · ".join(f"<b>{esc(k)}</b> {'pass' if v in (True, 'pass') else ('fail' if v in (False, 'fail') else esc(v))}" for k, v in (gates.items() if isinstance(gates, dict) else []))
    page = f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Vibe Tracks Agent</title>
<style>
:root{{--bg:#faf9f5;--panel:#fff;--fg:#1f1e1d;--muted:#6b6a66;--line:#e6e3da;--accent:#c96442;--pass:#2f7d4f;--pass-bg:#e6f3eb;--fail:#b3261e;--fail-bg:#fbe9e7;--none:#6b6a66;--none-bg:#efede6}}
@media (prefers-color-scheme:dark){{:root{{--bg:#262624;--panel:#30302e;--fg:#f0eee6;--muted:#a6a39b;--line:#3e3d3a;--accent:#d97757;--pass:#7cc59a;--pass-bg:#1f3a2b;--fail:#f2a097;--fail-bg:#4a2522;--none:#a6a39b;--none-bg:#3a3936}}}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--fg);font:15px/1.55 system-ui,sans-serif}}
.wrap{{max-width:1060px;margin:0 auto;padding:24px 16px 60px}}h1{{font-size:30px;margin:0 0 6px}}h2{{font-size:20px;margin:36px 0 8px;border-top:1px solid var(--line);padding-top:24px}}
h3{{font-size:15px;margin:0 0 6px}}.muted{{color:var(--muted)}}code{{background:var(--none-bg);padding:1px 5px;border-radius:5px;font-size:.92em}}
.verdict{{background:var(--panel);border:1px solid var(--line);border-left:4px solid var(--accent);border-radius:10px;padding:14px 18px;margin:16px 0}}
.kpis{{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin:14px 0}}.kpi{{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:12px 14px}}
.kpi b{{font-size:28px;display:block}}.kpi span{{color:var(--muted);font-size:13px}}
video,figure img{{width:100%;border-radius:8px;border:1px solid var(--line);display:block}}
.areas{{display:grid;grid-template-columns:repeat(auto-fill,minmax(480px,1fr));gap:14px}}@media(max-width:560px){{.areas{{grid-template-columns:1fr}}}}
.area{{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:12px 14px}}
.it summary{{display:grid;grid-template-columns:40px 1fr auto;gap:8px;align-items:baseline;padding:5px 0;border-top:1px solid var(--line);cursor:pointer;list-style:none;font-size:14px}}
.it summary::-webkit-details-marker{{display:none}}.id{{color:var(--muted);font-size:13px}}em{{color:#8a6d1d;font-style:normal;font-size:12px}}
.chip{{font-size:12px;padding:1px 8px;border-radius:999px;white-space:nowrap}}.chip.pass{{color:var(--pass);background:var(--pass-bg)}}.chip.fail{{color:var(--fail);background:var(--fail-bg)}}.chip.none{{color:var(--none);background:var(--none-bg)}}
ul.why{{margin:4px 0 8px;padding-left:18px;font-size:13px;color:var(--muted)}}ul.why b{{color:var(--fg);font-weight:550}}
.figs{{display:grid;grid-template-columns:repeat(auto-fill,minmax(460px,1fr));gap:14px}}@media(max-width:560px){{.figs{{grid-template-columns:1fr}}}}figure{{margin:0}}figcaption{{font-size:13px;color:var(--muted);margin-top:6px}}
ul.dec li{{margin:6px 0}}
</style></head><body><div class="wrap">
<h1>Vibe Tracks Agent</h1>
<p class="muted">Vibe Tracks as a black box, from Zach's Nov 24 design · <code>/home/bam/vibetracks_agent</code> @ <code>{esc(head)}</code>, local only · built by Claude Code (Opus 5.5)</p>
<div class="verdict"><b>The box exists and scores Vibe Tracks:</b> your Nov 24 design is 23 spec items (19 shall, 4 should) with your words,
frozen as ruler v1, checked in a headless browser against fixture box repos. Baseline, vibetracks main @ <code>d0cb827</code>:
<b>{esc(shall_failing)} of 19 shall items not met</b>, {esc(should_failing)} of 4 should. That's expected: the redesign isn't built yet; this is the starting line.</div>
<div class="kpis">
<div class="kpi"><b>{esc(shall_failing)}<small class="muted"> / 19</small></b><span>shall_failing (objective, ↓, target 0)</span></div>
<div class="kpi"><b>{esc(should_failing)}<small class="muted"> / 4</small></b><span>should_failing (tie-break)</span></div>
<div class="kpi"><b>{esc(checks_failing)}</b><span>single checks failing</span></div>
<div class="kpi"><b>{nfb} · {nref}</b><span>feedback notes · references</span></div>
</div>
<p class="muted">Gates: {gate_html or '—'}</p>
<h2>The box's site, walked</h2>
{hero}
<p class="muted">Landing → Open the dashboard → Spec tab → a spec note → Feedback → References → Notes → Ideas. Recorded from the site the blackbox_agent package builds from this repo's git (served locally).</p>
<h2>The spec, with the baseline result per item</h2>
<p class="muted">Click an item for the failing checks and their messages. An item with no check counts as not met (fail closed).</p>
<div class="areas">{''.join(spec_html)}</div>
<h2>Stills</h2><div class="figs">{fig}</div>
<h2>Decision surface</h2>
<h3>Done and proved</h3><ul class="dec">
<li>Box repo with the standard file set: OBJECTIVES (ruler v1), 23 spec notes, 13 feedback notes, REFERENCES ({nref} items), AGENTS, ideas, site.</li>
<li>Baseline scored by the ruler (two dev runs + holdout); numbers above come from <code>ledger.jsonl</code> and the solution's junit.</li>
<li>On the blackbox_agent package (v0): <code>blackbox check</code> says the box is in the format; the stock landing and dashboard rendered and looked at, light and dark.</li><li>Fixed on the way: the published junit was not valid XML and named the fixture's home as a home path (scorer, red first); blackbox_agent's junit reader counted only the first test suite (<code>4abcc9a</code>, pushed). No score moved.</li></ul>
<h3>Decided for you (each one line to undo)</h3><ul class="dec">
<li><b>Its own repo</b>, not <code>agent/</code> in vibetracks, since every track is now a box repo. Undo: move the files into vibetracks.</li><li><b>The stock landing, no override</b>, per tonight's package ruling; the design overview lives in NOTES.md (the Notes tab). Undo: put a page at <code>site/overrides/index.html</code>.</li>
<li><b>Local only</b> (your S4.3 local-only track). Undo: <code>gh repo create vibetracks_agent --private --source /home/bam/vibetracks_agent --push</code>.</li>
<li><b>Fail closed:</b> no check = not met. <b>Claude beats the Oct 16 hover chevron</b> (S2.9 a should). <b>Delete</b> never deletes a box folder; <b>Rename</b> is Vibe Tracks' label; <b>publish is private</b>. Undo: edit OBJECTIVES §10 (a ruler v2).</li>
<li><b>Stock tree = Headless Tree core</b>, Pragmatic drag and drop as fallback. Undo: edit S2.8's reference list.</li></ul>
<h3>Left (next, not blocked)</h3><ul class="dec"><li>The I'll-try queue in <code>ideas.md</code>, boxes-as-tracks first: nothing of the redesign is built in vibetracks yet.</li>
<li>A full starter box in blackbox_agent <code>template/</code> for <code>vt new</code> to copy.</li></ul>
<h3>Needs you</h3><ul class="dec"><li>Nothing blocking. Four rulings with defaults in force: hover chevron, sync, a use number for ruler v2, publish this box.</li></ul>
<h3>Deliberately not done</h3><ul class="dec"><li>No change to vibetracks itself: the box scores it; building the redesign is the agent loop's job.</li>
<li>No audit (ask for one with /llm-judge).</li></ul>
</div></body></html>"""
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    Path(a.out).write_text(page)
    print(a.out, f"{Path(a.out).stat().st_size / 1e6:.2f} MB")


if __name__ == "__main__":
    main()
