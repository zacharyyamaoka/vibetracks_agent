"""`vta`: the Vibe Tracks Agent's command line (docs/CONTRACT.md §4).

    vta verify                                    # ruler sha256s, checks.json = the suite's checks, ledger rows parse
    vta new <id> --ref <ref> --change "…" --agent A --model M [--parent P] [--session S] [--tags a,b]
    vta evaluate <id> [--split dev|holdout] [--runs 2] [--vt-gate]   # the acceptance run -> scorecard + ledger row
    vta progress                                  # PROGRESS.md, status.json
    vta leaderboard [--n N] [--split dev|holdout] [--ruler v1]   # the current ruler's board unless --ruler names another
    vta speed --base <url> [--rounds N] [--json]  # open_ms against any running vt serve, read-only (tools/speed.mjs)

Shapes follow claude_party_agent `src/claude_party_agent/cli.py` @ bdd812a.
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

from vibetracks_agent import ledger, paths, progress, ruler, scoring, solutions
from vibetracks_agent.progress import fmt


def _err(message: str) -> None:
    print(message, file=sys.stderr)


def cmd_verify(_: argparse.Namespace) -> int:
    root = paths.repo_root()
    problems = ruler.problems(root)
    try:
        rows = ledger.read(root / "ledger.jsonl")
    except ValueError as error:
        problems.append(str(error))
        rows = []
    for number, row in enumerate(rows, start=1):
        if row.get("split") not in ledger.SPLITS:
            problems.append(f"ledger row {number}: unknown split {row.get('split')!r}")
        elif not (root / "solutions" / str(row.get("solution")) / "meta.json").exists():
            problems.append(f"ledger row {number}: solution {row.get('solution')!r} has no meta.json")
    if problems:
        print(f"FAIL: {len(problems)} problem(s)")
        for problem in problems:
            print(f"  - {problem}")
        return 1
    m = ruler.manifest(root)
    print(f"OK: {len(m['files'])} ruler files, {len(m['spec_files'])} spec files and {len(m['pins'])} pins match "
          f"ruler/manifest.json; ruler/checks.json = the suite's {len(scoring.expected_checks(root / 'ruler' / 'checks.json'))} "
          f"checks; {len(rows)} ledger rows parse, each with a meta.json")
    return 0


def cmd_new(args: argparse.Namespace) -> int:
    proposed_by = {"agent": args.agent or os.environ.get("VTA_AGENT"),
                   "model": args.model or os.environ.get("VTA_MODEL"),
                   "session": args.session or os.environ.get("VTA_SESSION")}
    tags = [t.strip() for t in (args.tags or "").split(",") if t.strip()]
    try:
        path = solutions.new(args.id, ref=args.ref, change=args.change, proposed_by=proposed_by, parent=args.parent,
                             tags=tags)
    except (ValueError, RuntimeError) as error:
        _err(f"vta new: {error}")
        return 2
    print(f"created {path.relative_to(paths.repo_root())}; next: vta evaluate {args.id}")
    return 0


def cmd_evaluate(args: argparse.Namespace) -> int:
    from vibetracks_agent.evaluate import evaluate

    if not solutions.meta_path(args.id).exists():
        _err(f"vta evaluate: no solution {args.id} (vta new first)")
        return 2
    try:
        card = evaluate(args.id, split=args.split, runs=args.runs, timeout_s=args.timeout, with_vt_gate=args.vt_gate,
                        only=args.only)
    except ValueError as error:
        _err(f"vta evaluate: {error}")
        return 2
    failed = [g for g, n in card["failed_gates"].items() if n]
    met = [t["id"] for t in card["tasks"] if t["met"]]
    print(f"{card['solution']} on {card['split']}: {card['shall_failing']} of {card['shall_total']} shall failing, "
          f"{card['should_failing']} of {card['should_total']} should, {card['checks_failing']} of "
          f"{card['checks_total']} checks; admissible {'yes' if card['admissible'] else 'no'}"
          + (f" (failed: {', '.join(failed)})" if failed else "") + f"; met: {', '.join(met) or 'none'}; "
          f"{fmt(card['wall_time_s'], 0, ' s')} wall")
    if not args.no_progress:
        progress.write_all(paths.repo_root())
    return 0


def cmd_progress(_: argparse.Namespace) -> int:
    root = paths.repo_root()
    changed = progress.write_all(root)
    print("wrote " + (", ".join(str(p.relative_to(root)) for p in changed) if changed else "nothing (up to date)"))
    return 0


def cmd_leaderboard(args: argparse.Namespace) -> int:
    rows = ledger.rank(ledger.read(paths.repo_root() / "ledger.jsonl"), args.split, ruler=args.ruler)
    if not rows:
        print(f"no version scored on ruler {args.ruler} yet")
        return 0
    print(f"ruler {args.ruler}, {args.split}")
    print(f"{'#':>3}  {'version':<24} {'shall':>5} {'open ms':>7} {'should':>6} {'checks':>6} {'adm':>4}  change")
    metas = solutions.all_meta()
    for n, row in enumerate(rows[: args.n], start=1):
        change = str((metas.get(row["solution"]) or {}).get("change") or row.get("change") or "")
        print(f"{n:>3}  {row['solution']:<24} {fmt(row.get('objective')):>5} {fmt(ledger.named(row, 'open_ms')):>7} "
              f"{fmt(ledger.named(row, 'should_failing')):>6} {fmt(ledger.named(row, 'checks_failing')):>6} "
              f"{'yes' if row.get('admissible') else 'no':>4}  {change[:70]}")
    return 0


def cmd_speed(args: argparse.Namespace) -> int:
    """open_ms against a running vt serve: tools/speed.mjs with this repo's Playwright. Read-only: it starts no server
    and clicks track rows only (OBJECTIVES §8's timer, ruler/suite/timer.mjs)."""
    node = "/usr/bin/node" if Path("/usr/bin/node").exists() else shutil.which("node")
    if not node:
        _err("vta speed: node is not installed")
        return 2
    root = paths.repo_root()
    cmd = [node, str(root / "tools" / "speed.mjs"), "--base", args.base, "--rounds", str(args.rounds)]
    if args.json:
        cmd.append("--json")
    if args.vt_home:
        cmd += ["--vt-home", args.vt_home]
    env = {**os.environ, "PLAYWRIGHT_BROWSERS_PATH": str(paths.browsers_dir())}
    return subprocess.run(cmd, cwd=root, env=env).returncode


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="vta", description=f"The Vibe Tracks Agent (ruler {ledger.RULER}, OBJECTIVES.md)")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("verify", help="the ruler is intact; the ledger parses").set_defaults(run=cmd_verify)
    new = commands.add_parser("new", help="a solution for a vibetracks ref")
    new.add_argument("id")
    new.add_argument("--ref", required=True, help="a vibetracks branch, tag or sha")
    new.add_argument("--change", required=True, help="one line: what this version changes")
    new.add_argument("--parent")
    new.add_argument("--agent")
    new.add_argument("--model")
    new.add_argument("--session")
    new.add_argument("--tags", default="")
    new.set_defaults(run=cmd_new)
    ev = commands.add_parser("evaluate", help="score a solution in the acceptance run")
    ev.add_argument("id")
    ev.add_argument("--split", choices=("dev", "holdout"), default="dev")
    ev.add_argument("--runs", type=int, default=2, help="suite runs (the deterministic gate needs 2)")
    ev.add_argument("--timeout", type=float, default=scoring.TIME_LIMIT_S, help="seconds per run (§8: 1200)")
    ev.add_argument("--vt-gate", action="store_true", help="also run vibetracks' own pytest gate (diagnostic)")
    ev.add_argument("--only", default="", help="spec ids, comma separated (a partial run for debugging; it scores as failing)")
    ev.add_argument("--no-progress", action="store_true")
    ev.set_defaults(run=cmd_evaluate)
    commands.add_parser("progress", help="PROGRESS.md, status.json").set_defaults(run=cmd_progress)
    board = commands.add_parser("leaderboard", help="the ranked table")
    board.add_argument("--n", type=int, default=20)
    board.add_argument("--split", choices=("dev", "holdout"), default="dev")
    board.add_argument("--ruler", default=ledger.RULER, help=f"the ruler whose rows to rank (default {ledger.RULER})")
    board.set_defaults(run=cmd_leaderboard)
    speed = commands.add_parser("speed", help="time track opens on a running vt serve (read-only)")
    speed.add_argument("--base", required=True, help="the vt serve to time, e.g. http://127.0.0.1:4396/ (Zach's Preview)")
    speed.add_argument("--rounds", type=int, default=2, help="rounds over every track row (the first is the cold one)")
    speed.add_argument("--vt-home", default=None, help="its vt home, to count the builds it finished (read-only)")
    speed.add_argument("--json", action="store_true", help="the full report as JSON")
    speed.set_defaults(run=cmd_speed)
    args = parser.parse_args(argv)
    started = time.monotonic()
    code = int(args.run(args))
    if os.environ.get("VTA_TIMING"):
        _err(f"vta {args.command}: {time.monotonic() - started:.1f} s")
    return code


if __name__ == "__main__":
    sys.exit(main())
