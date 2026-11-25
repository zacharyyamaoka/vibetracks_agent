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
REMIT = ("make Vibe Tracks the sidebar Zach opens his black-box agents from: every item of his Nov 24 spec true "
         "(ruler v1, OBJECTIVES.md)")
DASH = "—"


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
                      "should_failing": row.get("tiebreak"), "checks_failing": row.get("tiebreak2"),
                      "admissible": row.get("admissible") is True,
                      "failed_gates": sorted(g for g, v in (row.get("failed_gates") or {}).items() if v),
                      "holdout_shall_failing": None if held is None else held.get("objective"),
                      "change": record.get("change", row.get("change")),
                      "model": (record.get("proposed_by") or row.get("proposed_by") or {}).get("model"),
                      "evaluated": row.get("t")})
    orders = []
    if subject:
        card = _card(root, subject["solution"]) or {}
        tasks = {t["id"]: t for t in card.get("tasks") or []}
        for sid, value in (subject.get("task_objectives") or {}).items():
            if value != 0:
                item = items.get(sid)
                task = tasks.get(sid) or {}
                orders.append({"id": sid, "kind": item.kind if item else None, "title": item.title if item else sid,
                               "failed": len(task.get("failed_checks") or []), "checks": len(task.get("checks") or []),
                               "why": task.get("why")})
    return {"as_of": max((str(r.get("t") or "") for r in rows), default=None) or None, "rows": len(rows),
            "ranked": board, "best": top, "subject": subject, "work_orders": orders,
            "evaluations": [{k: r.get(k) for k in ("t", "solution", "split", "objective", "tiebreak", "tiebreak2",
                                                    "admissible", "wall_time_s")} for r in rows[-10:]],
            "shall_total": sum(1 for i in items.values() if i.kind == "shall"),
            "should_total": sum(1 for i in items.values() if i.kind == "should")}


def progress_markdown(data: Mapping[str, Any], generated: str) -> str:
    shall, should = data["shall_total"], data["should_total"]
    lines = ["# Progress", "", f"Ruler v1 (`OBJECTIVES.md` §8). Generated {generated} by `vta progress` from "
             "`ledger.jsonl`; never edit by hand.", "", "## Where it stands", ""]
    best, subject = data["best"], data["subject"]
    if best:
        lines.append(f"- **Best admissible: `{best['solution']}`**, **{fmt(best.get('objective'))} of {shall} shall "
                     f"items failing** (target 0), {fmt(best.get('tiebreak'))} of {should} should, "
                     f"{fmt(best.get('tiebreak2'))} checks failing.")
    elif subject:
        failed = ", ".join(g for g, v in (subject.get("failed_gates") or {}).items() if v) or "none"
        lines.append(f"- **No admissible version yet.** Top of the board: `{subject['solution']}`, "
                     f"{fmt(subject.get('objective'))} of {shall} shall items failing, gates failed: {failed}.")
    else:
        lines.append("- **No version scored yet:** `vta new` then `vta evaluate`.")
    lines += ["", "## Leaderboard (dev)", "",
              "Admissible versions by shall failing, then should failing, then checks failing; then the rest (§8).", "",
              "| rank | id | shall failing | should failing | checks failing | admissible | holdout shall | change | model |",
              "|---|---|---|---|---|---|---|---|---|"]
    for r in data["ranked"][:15]:
        adm = "yes" if r["admissible"] else "no (" + ", ".join(r["failed_gates"]) + ")"
        change = r["change"] or ""
        change = change if len(change) <= 80 else change[:79] + "…"
        lines.append(f"| {r['rank']} | `{r['solution']}` | {fmt(r['shall_failing'])} | {fmt(r['should_failing'])} | "
                     f"{fmt(r['checks_failing'])} | {adm} | {fmt(r['holdout_shall_failing'])} | {_cell(change)} | "
                     f"{_cell(r['model'])} |")
    if not data["ranked"]:
        lines.append(f"| {DASH} | no version scored yet | | | | | | | |")
    lines += ["", "## Open work orders", ""]
    if subject:
        lines += [f"The spec items `{subject['solution']}` does not meet ({len(data['work_orders'])}); each is Zach's "
                  "own words, in `specs/`.", "", "| item | kind | what | checks failing |", "|---|---|---|---|"]
        for w in sorted(data["work_orders"], key=lambda w: (w["kind"] != "shall", [int(p) for p in w["id"][1:].split(".")])):
            lines.append(f"| {w['id']} | {_cell(w['kind'])} | {_cell(w['title'])} | "
                         f"{w['failed']} of {w['checks']}" + (f" ({_cell(w['why'])})" if not w['checks'] else "") + " |")
    else:
        lines.append("None yet: no version scored.")
    lines += ["", "## Last 10 evaluations", "", "| t | id | split | shall | should | checks | admissible | wall s |",
              "|---|---|---|---|---|---|---|---|"]
    for r in data["evaluations"]:
        lines.append(f"| {r['t']} | `{r['solution']}` | {r['split']} | {fmt(r['objective'])} | {fmt(r['tiebreak'])} | "
                     f"{fmt(r['tiebreak2'])} | {'yes' if r['admissible'] else 'no'} | {fmt(r['wall_time_s'])} |")
    if not data["evaluations"]:
        lines.append(f"| {DASH} | | | | | | | |")
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
    return {
        "schema": "ai-team-status/1",
        "member": MEMBER,
        "team": "AI Team",
        "remit": REMIT,
        "kpi": {
            "name": f"shall items failing, of {shall} (ruler v1, dev)",
            "value": None if shown is None else finite(shown.get("objective")),
            "unit": "items",
            "direction": "down",
            "target": 0,
            "level": None if shown is None else f"{fmt(shown.get('objective'))} of {shall} shall failing",
            "level_name": "ruler v1, dev" + ("" if shown is None else f", {'best' if best else 'top (not admissible)'} "
                                                                       f"{shown['solution']}"),
            "next_gate": ("an admissible version (completed and deterministic)" if best is None
                          else f"a version with fewer than {fmt(best.get('objective'))} shall items failing"),
            "on_track": None,
        },
        "counter_kpi": {"name": "checks failing (the third tie-break), same version",
                        "value": None if shown is None else finite(shown.get("tiebreak2")), "unit": "checks",
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
