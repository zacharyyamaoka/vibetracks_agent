"""`vta progress`: PROGRESS.md and status.json, from the ledger, the solutions' meta.json + scorecards, ideas.md only.

    write_all(root)   # -> the paths it changed

Deterministic: the same ledger gives the same bytes, except PROGRESS.md's "Generated" line and status.json's
`updated_t`; those two files are left untouched when nothing else in them changed. Shapes follow claude_party_agent
`src/claude_party_agent/progress.py` @ bdd812a (status.json `ai-team-status/1`, PROGRESS.md sections).
"""

from __future__ import annotations

import datetime as dt
import json
import re
import time
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any

from vibetracks_agent import ledger, paths, solutions, specs
from vibetracks_agent.ledger import finite

MEMBER = "Vibe Tracks Agent"
REMIT = ("make Vibe Tracks the sidebar Zach opens his black-box agents from: every item of his spec true, and every "
         f"track's page on screen fast (ruler {ledger.RULER}, OBJECTIVES.md)")
DASH = "—"
OPEN_TARGET_MS = 100  # OBJECTIVES §8: open_ms is driven toward Nielsen's "instantaneous"
named = ledger.named


def fmt(value: Any, digits: int = 0, suffix: str = "") -> str:
    number = finite(value)
    return DASH if number is None else f"{number:,.{digits}f}{suffix}"


def _cell(text: Any) -> str:
    text = DASH if text is None or text == "" else str(text)
    return text.replace("|", "\\|").replace("\n", " ")


def _card(root: Path, sid: str, split: str = "dev") -> dict[str, Any] | None:
    name = "scorecard.json" if split == "dev" else f"scorecard_{split}.json"
    try:
        return json.loads((root / "solutions" / sid / name).read_text())
    except (OSError, ValueError):
        return None


def gather(root: Path | None = None) -> dict[str, Any]:
    root = root or paths.repo_root()
    rows = ledger.read(root / "ledger.jsonl")
    newest = ledger.latest(rows)
    ranked = ledger.rank(rows, "dev")
    holdout = {r["solution"]: r for r in newest if r.get("split") == "holdout" and r.get("ruler") == ledger.RULER}
    metas = solutions.all_meta(root / "solutions")
    top = ledger.best(rows)
    subject = top or (ranked[0] if ranked else None)
    items = {i.id: i for i in specs.load_items(root / "specs")}
    board = []
    for n, row in enumerate(ranked, start=1):
        record = metas.get(row["solution"]) or {}
        held = holdout.get(row["solution"])
        board.append({"rank": n, "solution": row["solution"], "shall_failing": row.get("objective"),
                      "open_ms": named(row, "open_ms"),
                      "should_failing": named(row, "should_failing"), "checks_failing": named(row, "checks_failing"),
                      "admissible": row.get("admissible") is True,
                      "failed_gates": sorted(g for g, v in (row.get("failed_gates") or {}).items() if v),
                      "holdout_shall_failing": None if held is None else held.get("objective"),
                      "change": record.get("change", row.get("change")),
                      "model": (record.get("proposed_by") or row.get("proposed_by") or {}).get("model"),
                      "evaluated": row.get("t")})
    # WHY a separate list (OBJECTIVES §11): an earlier ruler's rows are kept and labelled, never ranked with the
    # current ones (a v1 "13 of 19" is not a v2 "13 of 20")
    earlier = []
    for version in ledger.rulers(rows):
        if version == ledger.RULER:
            continue
        for row in ledger.rank(rows, "dev", ruler=version):
            record = metas.get(row["solution"]) or {}
            earlier.append({"ruler": version, "solution": row["solution"], "shall_failing": row.get("objective"),
                            "should_failing": named(row, "should_failing"), "checks_failing": named(row, "checks_failing"),
                            "admissible": row.get("admissible") is True,
                            "change": record.get("change", row.get("change")), "evaluated": row.get("t")})
    orders = []
    speed = None
    if subject:
        card = _card(root, subject["solution"]) or {}
        runs = [r.get("speed") for r in card.get("runs") or [] if isinstance(r.get("speed"), dict)]
        speed = {"diagnostics": subject.get("diagnostics") or {}, "open_ms": named(subject, "open_ms"),
                 "boxes": (runs[0].get("boxes") if runs else None) or {}}
        tasks = {t["id"]: t for t in card.get("tasks") or []}
        for sid, value in (subject.get("task_objectives") or {}).items():
            if value != 0:
                item = items.get(sid)
                task = tasks.get(sid) or {}
                title = re.sub(rf"^{re.escape(sid)}\s+", "", item.title) if item else sid
                orders.append({"id": sid, "kind": item.kind if item else None, "title": title,
                               "path": item.path if item else None,
                               "failed": len(task.get("failed_checks") or []), "checks": len(task.get("checks") or []),
                               "why": task.get("why")})
    return {"as_of": max((str(r.get("t") or "") for r in rows), default=None) or None, "rows": len(rows),
            "ranked": board, "earlier": earlier, "best": top, "subject": subject, "work_orders": orders, "speed": speed,
            "evaluations": [{**{k: r.get(k) for k in ("t", "solution", "split", "ruler", "objective", "admissible",
                                                       "wall_time_s")},
                             "open_ms": named(r, "open_ms"), "should_failing": named(r, "should_failing"),
                             "checks_failing": named(r, "checks_failing")} for r in rows[-10:]],
            "shall_total": sum(1 for i in items.values() if i.kind == "shall"),
            "should_total": sum(1 for i in items.values() if i.kind == "should")}


def _sol(sid: str) -> str:
    """A solution id as a link to its folder."""
    return f"[`{sid}`](solutions/{sid}/)"


def progress_markdown(data: Mapping[str, Any], generated: str) -> str:
    shall, should = data["shall_total"], data["should_total"]
    # WHY every id is a link (Zach, 2026-11-24: "/rate bad these files should have been linked..."): a reader opens
    # the solution, the spec note or the ledger in one click (tests/test_docs_link_what_they_name.py holds it).
    lines = ["# Progress", "", f"Ruler {ledger.RULER} ([`OBJECTIVES.md`](OBJECTIVES.md) §8, §11). Generated {generated} by "
             "`vta progress` from [`ledger.jsonl`](ledger.jsonl); never edit by hand.", "", "## Where it stands", ""]
    best, subject = data["best"], data["subject"]
    if best:
        lines.append(f"- **Best admissible: {_sol(best['solution'])}**, **{fmt(best.get('objective'))} of {shall} shall "
                     f"items failing** (target 0), {fmt(named(best, 'should_failing'))} of {should} should, "
                     f"{fmt(named(best, 'checks_failing'))} checks failing.")
    elif subject:
        failed = ", ".join(g for g, v in (subject.get("failed_gates") or {}).items() if v) or "none"
        lines.append(f"- **No admissible version yet.** Top of the board: {_sol(subject['solution'])}, "
                     f"{fmt(subject.get('objective'))} of {shall} shall items failing, gates failed: {failed}.")
    else:
        lines.append("- **No version scored yet:** `vta new` then `vta evaluate`.")
    speed = data.get("speed")
    if speed:
        d = speed["diagnostics"]
        runs = " and ".join(fmt(x, 0, " ms") for x in d.get("open_ms_runs") or []) or DASH
        kinds = ", ".join(f"{k} {fmt(v, 0, ' ms')}" for k, v in (d.get("open_p50_by_kind") or {}).items()) or DASH
        mb = lambda b: DASH if finite(b) is None else f"{finite(b) / 1e6:,.2f} MB"  # noqa: E731
        lines.append(f"- **Opening a track: `open_ms` {fmt(speed['open_ms'], 0, ' ms')}** (target {OPEN_TARGET_MS} ms; S1.6 "
                     "wants it within 400 ms and nineteen opens in twenty within 1000 ms): the median of the package "
                     f"boxes' opens over both dev runs (each run: {runs}; spread {fmt(d.get('open_ms_spread'), 0, ' ms')}). "
                     f"A package box's first open {fmt(d.get('open_cold_p50'), 0, ' ms')}, later opens "
                     f"{fmt(d.get('open_warm_p50'), 0, ' ms')}; every kind's median: {kinds}; p95 of all "
                     f"{fmt(d.get('opens'))} opens {fmt(d.get('open_p95'), 0, ' ms')}, slowest {fmt(d.get('open_max'), 0, ' ms')}. "
                     f"Per package open {fmt(d.get('requests_per_open'))} requests, {mb(d.get('bytes_first_open'))} the "
                     f"first time and {mb(d.get('bytes_later_open'))} after; {fmt(d.get('builds_waited'))} builds waited on.")
    lines += ["", "## Leaderboard (dev)", "",
              f"Ruler {ledger.RULER} only. Admissible versions by shall failing, then `open_ms` (rounded to 10 ms), then "
              "should failing, then checks failing; then the rest (§8).", "",
              "| rank | id | shall failing | open ms | should failing | checks failing | admissible | holdout shall | change | model |",
              "|---|---|---|---|---|---|---|---|---|---|"]
    for r in data["ranked"][:15]:
        adm = "yes" if r["admissible"] else "no (" + ", ".join(r["failed_gates"]) + ")"
        change = r["change"] or ""
        change = change if len(change) <= 80 else change[:79] + "…"
        lines.append(f"| {r['rank']} | {_sol(r['solution'])} | {fmt(r['shall_failing'])} | {fmt(r['open_ms'])} | "
                     f"{fmt(r['should_failing'])} | {fmt(r['checks_failing'])} | {adm} | {fmt(r['holdout_shall_failing'])} | "
                     f"{_cell(change)} | {_cell(r['model'])} |")
    if not data["ranked"]:
        lines.append(f"| {DASH} | no version scored yet | | | | | | | | |")
    if data["earlier"]:
        lines += ["", "## Earlier rulers", "",
                  f"Scored on an earlier ruler: kept and labelled, never ranked against ruler {ledger.RULER} "
                  "(OBJECTIVES §11); re-score one with `vta new` + `vta evaluate` to compare it.", "",
                  "| ruler | id | shall failing | should failing | checks failing | admissible | change |",
                  "|---|---|---|---|---|---|---|"]
        for r in data["earlier"]:
            change = r["change"] or ""
            change = change if len(change) <= 80 else change[:79] + "…"
            lines.append(f"| {_cell(r['ruler'])} | {_sol(r['solution'])} | {fmt(r['shall_failing'])} | "
                         f"{fmt(r['should_failing'])} | {fmt(r['checks_failing'])} | {'yes' if r['admissible'] else 'no'} | "
                         f"{_cell(change)} |")
    if speed and speed["boxes"]:
        lines += ["", "## Opening each box (`open_ms`, S1.6)", "",
                  f"{_sol(subject['solution'])}'s first dev run, one row per box of the speed group's click sequence "
                  "(round 1 is a box's first open; [`ruler/suite/groups/speed.mjs`](ruler/suite/groups/speed.mjs)). "
                  "Requests and bytes: what the browser fetched between the press and the page showing.", "",
                  "| box | kind | first open ms | p50 ms | p95 ms | first open: requests, bytes | later: requests, bytes (p50) |",
                  "|---|---|---|---|---|---|---|"]
        kb = lambda b: DASH if finite(b) is None else f"{finite(b) / 1e3:,.0f} kB"  # noqa: E731
        for slug, b in sorted(speed["boxes"].items(), key=lambda kv: -(finite(kv[1].get("p50")) or 0)):
            lines.append(f"| {_cell(slug)} | {_cell(b.get('kind'))} | {fmt(b.get('cold'))} | {fmt(b.get('p50'))} | "
                         f"{fmt(b.get('p95'))} | {fmt(b.get('cold_requests'))}, {kb(b.get('cold_bytes'))} | "
                         f"{fmt(b.get('warm_requests_p50'))}, {kb(b.get('warm_bytes_p50'))} |")
    lines += ["", "## Open work orders", ""]
    if subject:
        lines += [f"The spec items {_sol(subject['solution'])} does not meet ({len(data['work_orders'])}); each is "
                  "Zach's own words, in [`specs/`](specs/).", "", "| item | kind | what | checks failing |", "|---|---|---|---|"]
        for w in sorted(data["work_orders"], key=lambda w: (w["kind"] != "shall", [int(p) for p in w["id"][1:].split(".")])):
            sid = f"[{w['id']}]({w['path']})" if w.get("path") else w["id"]
            lines.append(f"| {sid} | {_cell(w['kind'])} | {_cell(w['title'])} | "
                         f"{w['failed']} of {w['checks']}" + (f" ({_cell(w['why'])})" if not w['checks'] else "") + " |")
    else:
        lines.append("None yet: no version scored.")
    lines += ["", "## Last 10 evaluations", "",
              "| t | id | split | ruler | shall | open ms | should | checks | admissible | wall s |",
              "|---|---|---|---|---|---|---|---|---|---|"]
    for r in data["evaluations"]:
        lines.append(f"| {r['t']} | {_sol(r['solution'])} | {r['split']} | {_cell(r.get('ruler') or 'unknown')} | "
                     f"{fmt(r['objective'])} | {fmt(r['open_ms'])} | {fmt(r['should_failing'])} | {fmt(r['checks_failing'])} | "
                     f"{'yes' if r['admissible'] else 'no'} | {fmt(r['wall_time_s'])} |")
    if not data["evaluations"]:
        lines.append(f"| {DASH} | | | | | | | | | |")
    lines.append("")
    return "\n".join(lines)


def _ideas(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {"open": 0, "done_7d": 0, "top": []}
    lines, section = [], None
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if line.startswith("## "):
            section = line[3:].strip().lower().replace("’", "'")
            continue
        if section is not None and section.startswith("i'll try"):
            lines.append(line)
    open_items = [line[5:].strip() for line in lines if line.startswith("- [ ]")]
    done = [line for line in lines if line.lower().startswith("- [x]")]

    def title(item: str) -> str:
        bold = re.match(r"^\*\*(.+?)\*\*", item)
        return (bold.group(1) if bold else item)[:200]

    return {"open": len(open_items), "done_7d": len(done), "top": [title(i) for i in open_items[:3]]}


def status_record(data: Mapping[str, Any], root: Path, now_s: float) -> dict[str, Any]:
    best, subject = data["best"], data["subject"]
    shown = best or subject
    try:
        previous = json.loads((root / "status.json").read_text())
    except (OSError, ValueError):
        previous = {}
    shall = data["shall_total"]
    # WHY open_ms is the headline and shall_failing the counter (ruler v3, PEP 0003): Zach asked for the open speed as
    # the objective he tracks ("Please add this an an objective you track", 2026-11-25); shall_failing stays the
    # ranked objective (OBJECTIVES §8) and the counter that must reach and stay 0, so a faster version that breaks one
    # of his items reads as a loss here too
    open_ms = None if shown is None else finite(named(shown, "open_ms"))
    return {
        "schema": "ai-team-status/1",
        "member": MEMBER,
        "team": "AI Team",
        "remit": REMIT,
        "kpi": {
            "name": f"open_ms: ms from a click on a track to its page on screen, package boxes' median (ruler {ledger.RULER}, dev)",
            "value": open_ms,
            "unit": "ms",
            "direction": "down",
            "target": OPEN_TARGET_MS,
            "level": None if open_ms is None else f"{fmt(open_ms)} ms (S1.6: within 400, and 19 opens in 20 within 1000)",
            "level_name": f"ruler {ledger.RULER}, dev" + ("" if shown is None else f", {'best' if best else 'top (not admissible)'} "
                                                                       f"{shown['solution']}"),
            "next_gate": ("a version with an open_ms (the speed group ran on both dev runs)" if open_ms is None
                          else "open_ms at most 400 ms, nineteen opens in twenty within 1000 ms (S1.6)" if open_ms > 400
                          else f"open_ms at most {OPEN_TARGET_MS} ms"),
            "on_track": None,
        },
        "counter_kpi": {"name": f"shall items failing, of {shall}: must be 0 (the ranked objective, same version)",
                        "value": None if shown is None else finite(shown.get("objective")), "unit": "items",
                        "owner": MEMBER},
        "status": previous.get("status", "idle"),
        "blocked_on": previous.get("blocked_on"),
        "todo": _ideas(root / "ideas.md"),
        "links": {"repo": None, "report": "PROGRESS.md", "wandb": None, "vault": "PROJECT - Vibe Tracks"},
        "updated_t": float(now_s),
    }


def _without_volatile(text: str) -> str:
    text = re.sub(r"Generated \S+ by `vta progress`", "Generated <t> by `vta progress`", text)
    return re.sub(r'"updated_t": [0-9.e+-]+', '"updated_t": 0', text)


def write_all(root: Path | None = None, now_s: float | None = None) -> list[Path]:
    root = root or paths.repo_root()
    now_s = time.time() if now_s is None else now_s
    data = gather(root)
    generated = dt.datetime.fromtimestamp(now_s, dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    outputs = {root / "PROGRESS.md": progress_markdown(data, generated),
               root / "status.json": json.dumps(status_record(data, root, now_s), indent=2) + "\n"}
    changed = []
    for path, text in outputs.items():
        old = path.read_text() if path.exists() else None
        if old is not None and _without_volatile(old) == _without_volatile(text):
            continue
        path.write_text(text)
        changed.append(path)
    return changed
