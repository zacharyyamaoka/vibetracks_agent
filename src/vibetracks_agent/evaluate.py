"""`vta evaluate`: score one solution (a vibetracks commit) on one split (OBJECTIVES §7, §8).

    evaluate(id, split="dev", runs=2, vt_gate=False) -> scorecard dict

1. `git archive` the solution's sha into <work>/<id>/tree (read-only on ~/vibetracks).
2. Run the stage (ruler/stage.py) `runs` times, each in its own run dir and its own loopback-only network namespace
   (`unshare -rn`), on a port outside 4390-4397, killed at the 20-minute limit. The stage builds the split's fixture,
   hands the tree to the version, and runs the browser suite, which starts and stops `vt serve` by pid.
3. After each run, any process it recorded (pids.jsonl) that is still alive is stopped by its process group.
4. Score the runs (scoring.score), write solutions/<id>/scorecard.json (dev) or scorecard_holdout.json, the first
   run's junit to solutions/<id>/junit-<split>.xml and, for dev, site/data/junit.xml (paths made relative), and
   append one ledger row.
"""

from __future__ import annotations

import datetime as dt
import json
import os
import re
import shutil
import signal
import socket
import subprocess
import time
from pathlib import Path
from typing import Any

from vibetracks_agent import ledger, paths, ruler, scoring, solutions, specs

SEEDS = {"dev": 1, "holdout": 2}
FORBIDDEN_PORTS = range(4390, 4398)


def now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def free_port() -> int:
    for _ in range(50):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(("127.0.0.1", 0))
            port = s.getsockname()[1]
        if port not in FORBIDDEN_PORTS:
            return port
    raise RuntimeError("no free port outside 4390-4397")


def netns_ok() -> bool:
    try:
        out = subprocess.run(["unshare", "-rn", "sh", "-c", "ip link set lo up"], capture_output=True, timeout=20)
    except (OSError, subprocess.TimeoutExpired):
        return False
    return out.returncode == 0


def materialize(sha: str, dest: Path) -> Path:
    """<dest>/tree = `git archive <sha>` of vibetracks; reused when it already holds that sha."""
    tree = dest / "tree"
    stamp = tree / ".vta-sha"
    if stamp.exists() and stamp.read_text().strip() == sha:
        return tree
    if tree.exists():
        shutil.rmtree(tree)
    tree.mkdir(parents=True)
    archive = subprocess.run(["git", "-C", str(paths.vibetracks()), "archive", sha], capture_output=True, check=True)
    subprocess.run(["tar", "-x", "-C", str(tree)], input=archive.stdout, check=True)
    stamp.write_text(sha + "\n")
    return tree


def _alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
    except OSError:
        return False
    return True


def reap(run_dir: Path) -> list[int]:
    """Stop every recorded process of this run that is still alive, by its process group (it was started detached,
    so its pid is its group), and only when its command line names this run (a recycled pid is never touched)."""
    stopped = []
    path = run_dir / "pids.jsonl"
    if not path.exists():
        return stopped
    for line in path.read_text().splitlines():
        try:
            pid = int(json.loads(line).get("pid") or 0)
        except (ValueError, TypeError):
            continue
        if pid <= 1 or not _alive(pid):
            continue
        try:
            cmd = Path(f"/proc/{pid}/cmdline").read_bytes().replace(b"\0", b" ").decode(errors="replace")
            environ = Path(f"/proc/{pid}/environ").read_bytes().decode(errors="replace")
        except OSError:
            continue
        if str(run_dir) not in cmd and str(run_dir) not in environ:
            continue
        for sig in (signal.SIGTERM, signal.SIGKILL):
            try:
                os.killpg(pid, sig)
            except OSError:
                try:
                    os.kill(pid, sig)
                except OSError:
                    pass
            time.sleep(1.5)
            if not _alive(pid):
                break
        stopped.append(pid)
    return stopped


def run_stage(tree: Path, run_dir: Path, seed: int, *, timeout_s: float, isolate: bool, only: str = "") -> dict:
    manifest = ruler.manifest()
    run_dir.mkdir(parents=True, exist_ok=True)
    port = 4811 if isolate else free_port()
    stage = ["/usr/bin/python3", str(paths.ruler_dir() / "stage.py"), "run",
             "--tree", str(tree), "--run-dir", str(run_dir), "--seed", str(seed),
             "--blackbox-repo", str(paths.blackbox()), "--blackbox-ref", manifest["blackbox_agent"]["ref"],
             "--port", str(port), "--browsers", str(paths.browsers_dir())]
    if only:
        stage += ["--only", only]
    if isolate:
        quoted = " ".join("'" + a.replace("'", "'\\''") + "'" for a in stage)
        cmd = ["unshare", "-rn", "sh", "-c", f"ip link set lo up && exec {quoted}"]
    else:
        cmd = stage
    started = time.monotonic()
    timed_out = False
    with open(run_dir / "stage.out", "w") as out:
        proc = subprocess.Popen(cmd, stdout=out, stderr=subprocess.STDOUT, start_new_session=True,
                                env={"PATH": os.environ.get("PATH", "/usr/bin:/bin"), "HOME": str(Path.home()),
                                     "LANG": "C.UTF-8"})
        try:
            code = proc.wait(timeout=timeout_s)
        except subprocess.TimeoutExpired:
            timed_out = True
            try:
                os.killpg(proc.pid, signal.SIGTERM)
                code = proc.wait(timeout=30)
            except (OSError, subprocess.TimeoutExpired):
                os.killpg(proc.pid, signal.SIGKILL)
                code = proc.wait()
    wall = time.monotonic() - started
    reaped = reap(run_dir)
    junit = (run_dir / "junit.xml").read_text() if (run_dir / "junit.xml").exists() else None
    try:
        diag = json.loads((run_dir / "diagnostics.json").read_text())
    except (OSError, ValueError):
        diag = {}
    return {"run_dir": str(run_dir), "exit": code, "timed_out": timed_out, "wall_s": wall, "junit": junit,
            "diagnostics": diag, "reaped": reaped, "isolated": isolate, "port": port}


def public_junit(text: str, run_dir: Path) -> str:
    """The junit as published (site/ may be public): no run dir, no home path. The placeholders are XML-escaped
    because they land inside attribute values and text (a bare `<run>` made the file unparseable)."""
    # the fixture's HOME first: "<run>/home/..." would read as a home path to the blackbox package's privacy check
    text = text.replace(str(run_dir / "home"), "&lt;fixture-home&gt;")
    text = text.replace(str(run_dir), "&lt;run&gt;")
    text = text.replace(str(paths.work_dir()), "&lt;work&gt;")
    return text.replace(str(Path.home()), "~")


def public_text(text: str, run_dirs: list[Path]) -> str:
    """A scorecard as published: the same redaction as public_junit, with plain placeholders (it is JSON, not XML).
    WHY: a check's failure message quotes the command it ran, which names the run dir under this machine's home; the
    scorecard is committed to a public repo (blackbox check 0.1.7's home-path lint found it, 2026-11-25)."""
    for run_dir in run_dirs:
        text = text.replace(str(run_dir / "home"), "<fixture-home>").replace(str(run_dir), "<run>")
    text = text.replace(str(paths.work_dir()), "<work>")
    return text.replace(str(Path.home()), "~")


def vt_gate(tree: Path, work: Path, isolate: bool, timeout_s: float = 1500) -> int | None:
    """vibetracks' own `pytest tests` on the tree (CLAUDE.md's gate): the number failed, or None if it did not run."""
    tmp = work / "vt-gate-tmp"
    tmp.mkdir(parents=True, exist_ok=True)
    home = work / "vt-gate-home"
    home.mkdir(parents=True, exist_ok=True)
    inner = (f"cd '{tree}' && TMPDIR='{tmp}' HOME='{home}' PYTHONDONTWRITEBYTECODE=1 /usr/bin/python3 -m pytest -q "
             "-p no:cacheprovider tests")
    cmd = ["unshare", "-rn", "sh", "-c", f"ip link set lo up && {inner}"] if isolate else ["sh", "-c", inner]
    try:
        out = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout_s,
                             env={"PATH": "/usr/bin:/bin", "LANG": "C.UTF-8"})
    except subprocess.TimeoutExpired:
        return None
    tail = out.stdout[-4000:]
    (work / "vt-gate.log").write_text(out.stdout[-200000:] + out.stderr[-20000:])
    match = re.search(r"(\d+) failed", tail)
    if match:
        return int(match.group(1))
    return 0 if re.search(r"\d+ passed", tail) else None


def style_off(junit: str | None) -> dict[str, int | None]:
    cases = scoring.parse_junit(junit) or {}
    style = [c for c in cases.values() if c.name.startswith("S2.2 ")]
    if not style:
        return {"off": None, "measured": None}
    return {"off": sum(1 for c in style if c.state != "pass"), "measured": len(style)}


def evaluate(sid: str, *, split: str = "dev", runs: int = 2, timeout_s: float = scoring.TIME_LIMIT_S,
             with_vt_gate: bool = False, only: str = "") -> dict[str, Any]:
    if split not in SEEDS:
        raise ValueError(f"split must be dev or holdout, not {split!r}")
    root = paths.repo_root()
    problems = ruler.problems(root)
    if problems:
        raise ValueError("the ruler does not verify: " + "; ".join(problems[:5]))
    record = solutions.meta(sid)
    sha = record["vibetracks_sha"]
    work = paths.work_dir() / sid
    started = time.monotonic()
    tree = materialize(sha, work)
    isolate = netns_ok()
    stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%S")
    results = []
    for n in range(1, runs + 1):
        results.append(run_stage(tree, work / "runs" / f"{split}-{stamp}-{n}", SEEDS[split], timeout_s=timeout_s,
                                 isolate=isolate, only=only))
    gate_failed = vt_gate(tree, work, isolate) if with_vt_gate else None
    items = specs.load_items(root / "specs")
    expected = scoring.expected_checks(root / "ruler" / "checks.json")
    scored = scoring.score(items, expected, [scoring.RunResult(junit=r["junit"], finished=r["exit"] == 0 and not r["timed_out"],
                                                               timed_out=r["timed_out"], wall_s=r["wall_s"]) for r in results])
    wall = time.monotonic() - started
    first = results[0] if results else {}
    off = style_off(first.get("junit"))
    diagnostics = {
        "shall_passing": scored["shall_total"] - scored["shall_failing"],
        "sidebar_style_props_off": off["off"],
        "sidebar_style_props_measured": off["measured"],
        "page_ready_ms": (first.get("diagnostics") or {}).get("page_ready_ms"),
        "vt_gate_failed": gate_failed,
        "wall_time_s": wall,
        "checks_total": scored["checks_total"],
        "registration": (first.get("diagnostics") or {}).get("registration"),
        "stock_tree": (first.get("diagnostics") or {}).get("stock_tree"),
    }
    manifest = ruler.manifest(root)
    card = {
        "solution": sid, "split": split, "ruler": ledger.RULER,
        "objective": scored["shall_failing"], "objective_name": "shall_failing",
        "tiebreak": scored["should_failing"], "tiebreak_name": "should_failing",
        "tiebreak2": scored["checks_failing"], "tiebreak2_name": "checks_failing",
        "shall_failing": scored["shall_failing"], "shall_total": scored["shall_total"],
        "should_failing": scored["should_failing"], "should_total": scored["should_total"],
        "checks_failing": scored["checks_failing"], "checks_total": scored["checks_total"],
        "admissible": scored["admissible"], "gate_pass_rate": scored["gate_pass_rate"],
        "gates": scored["gates"], "failed_gates": scored["failed_gates"],
        "diagnostics": diagnostics, "tasks": scored["tasks"], "task_objectives": scored["task_objectives"],
        "vibetracks_sha": sha, "vibetracks_committed": record.get("vibetracks_committed"), "seed": SEEDS[split],
        "evaluated": now_iso(), "wall_time_s": wall,
        "runs": [{"n": i + 1, "exit": r["exit"], "timed_out": r["timed_out"], "wall_s": round(r["wall_s"], 1),
                  "junit": r["junit"] is not None, "network": "loopback-only namespace" if r["isolated"] else "not isolated",
                  "reaped_pids": r["reaped"], "groups": (r.get("diagnostics") or {}).get("groups")} for i, r in enumerate(results)],
        "code": {"ruler": ledger.RULER, "blackbox_agent_ref": manifest["blackbox_agent"]["ref"],
                 "playwright": manifest.get("playwright", {}).get("version"), "repo_commit": paths.repo_commit(root)},
    }
    folder = root / "solutions" / sid
    name = "scorecard.json" if split == "dev" else f"scorecard_{split}.json"
    run_dirs = [Path(r["run_dir"]) for r in results if r.get("run_dir")]
    (folder / name).write_text(public_text(json.dumps(card, indent=1, allow_nan=False), run_dirs) + "\n")
    if first.get("junit"):
        published = public_junit(first["junit"], Path(first["run_dir"]))
        (folder / f"junit-{split}.xml").write_text(published)
        if split == "dev":
            (root / "site" / "data").mkdir(parents=True, exist_ok=True)
            (root / "site" / "data" / "junit.xml").write_text(published)
    row = {"t": now_iso(), "solution": sid, "parent": record.get("parent"), "split": split, "ruler": ledger.RULER,
           "objective": card["objective"], "tiebreak": card["tiebreak"], "tiebreak2": card["tiebreak2"],
           "admissible": card["admissible"], "gate_pass_rate": card["gate_pass_rate"],
           "failed_gates": card["failed_gates"], "diagnostics": diagnostics, "wall_time_s": wall,
           "repo_commit": paths.repo_commit(root), "vibetracks_sha": sha, "proposed_by": record.get("proposed_by"),
           "change": record.get("change"), "task_objectives": card["task_objectives"]}
    ledger.append(row, root / "ledger.jsonl")
    return card
