#!/usr/bin/env python3
"""One acceptance run (OBJECTIVES §7), from a scratch tree of the version under test to a junit XML.

    python3 ruler/stage.py run --tree <git archive of the sha> --run-dir <empty dir> --seed 1|2
                               --blackbox-repo ~/blackbox_agent --blackbox-ref <frozen sha> [--port 4811]

In order, every step logged to <run-dir>/stage.log:
1. the fixture (ruler/fixture.py) into <run-dir>/home, the fake gh into <run-dir>/bin;
2. `vt`: a shim in <run-dir>/bin that runs the tree's own console script (`[project.scripts] vt` in its pyproject),
   with the tree on PYTHONPATH and /usr/bin/python3;
3. the environment every process of the version gets (env.json): nothing from the caller's; HOME, the XDG dirs and
   TMPDIR inside <run-dir>; PATH = <run-dir>/bin, /usr/bin, /bin;
4. the tree handed to the version (registration.json), by the first way its CLI takes:
   a. `vt add <box folder> [--parent <parent's folder name>]` per box, parents first (S1.5's verb), when
      `vt add --help` exits 0;
   b. a version from before the Nov 24 design (`vt new <space> <id> --title …`, no `vt add`): `vt init` and one
      `vt new home <id> --title <box title> [--parent <id>]` per box, so its sidebar holds the same titles in the same
      tree to measure (it has no notion of a box, so every box check still fails on it);
   c. neither: nothing; every check that needs a track row fails saying it found none;
5. a copy of HOME as it stands (pristine/), which the suite restores before each group;
6. the browser suite (ruler/suite/run.mjs) with that environment; it starts and stops `vt serve` itself, by pid.

The evaluator runs this inside a loopback-only network namespace (`unshare -rn`), so nothing reaches the network or
any server outside the run, Zach's Stable and Preview included.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import time
import tomllib
from pathlib import Path

RULER = Path(__file__).resolve().parent
REPO = RULER.parent
PYTHON = "/usr/bin/python3"
NODE = "/usr/bin/node" if Path("/usr/bin/node").exists() else shutil.which("node") or "node"
LEGACY_SPACE = "home"


def log(run_dir: Path, message: str) -> None:
    line = f"[{time.strftime('%H:%M:%S')}] {message}"
    print(line, flush=True)
    with open(run_dir / "stage.log", "a", encoding="utf-8") as fh:
        fh.write(line + "\n")


def vt_entry(tree: Path) -> tuple[str, str]:
    data = tomllib.loads((tree / "pyproject.toml").read_text(encoding="utf-8"))
    target = ((data.get("project") or {}).get("scripts") or {}).get("vt")
    if not target or ":" not in target:
        raise SystemExit(f"stage: {tree}/pyproject.toml names no `vt` console script")
    module, func = target.split(":", 1)
    return module.strip(), func.strip()


def write_shim(bin_dir: Path, tree: Path) -> Path:
    module, func = vt_entry(tree)
    shim = bin_dir / "vt"
    shim.write_text("#!/bin/sh\n"
                    f"exec {PYTHON} -c 'import sys; sys.argv[0] = \"vt\"; from {module} import {func} as main; "
                    "sys.exit(main())' \"$@\"\n")
    shim.chmod(0o755)
    return shim


def environment(run_dir: Path, tree: Path) -> dict[str, str]:
    home = run_dir / "home"
    tmp = run_dir / "tmp"
    tmp.mkdir(parents=True, exist_ok=True)
    return {
        "PATH": f"{run_dir / 'bin'}:/usr/bin:/bin",
        "HOME": str(home),
        "XDG_CONFIG_HOME": str(home / ".config"),
        "XDG_DATA_HOME": str(home / ".local/share"),
        "XDG_STATE_HOME": str(home / ".local/state"),
        "XDG_CACHE_HOME": str(home / ".cache"),
        "TMPDIR": str(tmp),
        "LANG": "C.UTF-8",
        "TZ": "UTC",
        "PYTHONPATH": str(tree),
        "PYTHONDONTWRITEBYTECODE": "1",
        "PYTHONUNBUFFERED": "1",
        "GIT_CONFIG_NOSYSTEM": "1",
        "NO_COLOR": "1",
    }


def run_vt(vt: Path, args: list[str], env: dict, cwd: Path, timeout: float = 120) -> dict:
    started = time.monotonic()
    try:
        out = subprocess.run([str(vt), *args], env=env, cwd=cwd, capture_output=True, text=True, timeout=timeout)
        code, text = out.returncode, (out.stdout + out.stderr)
    except subprocess.TimeoutExpired as error:
        code, text = None, f"timed out after {timeout} s: {error}"
    return {"args": args, "exit": code, "output": text[-2000:], "s": round(time.monotonic() - started, 2)}


def register(vt: Path, fixture: dict, env: dict, home: Path) -> dict:
    boxes = fixture["boxes"]
    probe_add = run_vt(vt, ["add", "--help"], env, home)
    if probe_add["exit"] == 0:
        steps = []
        for box in boxes:
            args = ["add", box["path"]] + (["--parent", box["parent"]] if box["parent"] else [])
            steps.append(run_vt(vt, args, env, home))
        ok = all(s["exit"] == 0 for s in steps)
        return {"method": "vt add", "ok": ok, "steps": steps}
    probe_new = run_vt(vt, ["new", "--help"], env, home)
    text = probe_new["output"]
    if probe_new["exit"] == 0 and "--title" in text and "space" in text:
        steps = [run_vt(vt, ["init", "--person", fixture["person"]["email"], "--no-scan"], env, home)]
        legacy = {b["slug"]: b["slug"].replace("_", "-") for b in boxes}
        for box in boxes:
            args = ["new", LEGACY_SPACE, legacy[box["slug"]], "--title", box["title"]]
            if box["parent"]:
                args += ["--parent", legacy[box["parent"]]]
            steps.append(run_vt(vt, args, env, home))
        ok = all(s["exit"] == 0 for s in steps)
        return {"method": "legacy vt new (no vt add: tracks named after the boxes, not linked to them)", "ok": ok,
                "steps": steps, "legacy_ids": legacy}
    return {"method": "none", "ok": False, "steps": [probe_add, probe_new],
            "why": "the version's CLI has neither `vt add` nor a `vt new <space> <id> --title` to list the boxes"}


def cmd_run(args: argparse.Namespace) -> int:
    run_dir = args.run_dir.resolve()
    tree = args.tree.resolve()
    run_dir.mkdir(parents=True, exist_ok=True)
    home, bin_dir = run_dir / "home", run_dir / "bin"
    log(run_dir, f"stage: seed {args.seed}, tree {tree}, run dir {run_dir}")
    fixture_path = run_dir / "fixture.json"
    out = subprocess.run([PYTHON, str(RULER / "fixture.py"), "--seed", str(args.seed), "--home", str(home),
                          "--bin", str(bin_dir), "--state", str(run_dir / "gh"),
                          "--blackbox-repo", str(args.blackbox_repo), "--blackbox-ref", args.blackbox_ref,
                          "--out", str(fixture_path)], capture_output=True, text=True,
                         env={"PATH": "/usr/bin:/bin", "HOME": str(home), "LANG": "C.UTF-8"})
    log(run_dir, (out.stdout + out.stderr).strip())
    if out.returncode != 0:
        return 3
    fixture = json.loads(fixture_path.read_text())
    vt = write_shim(bin_dir, tree)
    env = environment(run_dir, tree)
    (run_dir / "env.json").write_text(json.dumps(env, indent=1) + "\n")
    registration = register(vt, fixture, env, home)
    (run_dir / "registration.json").write_text(json.dumps(registration, indent=1) + "\n")
    log(run_dir, f"registration: {registration['method']} ({'ok' if registration['ok'] else 'NOT ok'})")
    pristine = run_dir / "pristine"
    subprocess.run(["cp", "-a", str(home), str(pristine)], check=True)
    cmd = [NODE, str(RULER / "suite" / "run.mjs"), "--run-dir", str(run_dir), "--port", str(args.port)]
    if args.only:
        cmd += ["--only", args.only]
    log(run_dir, "suite: " + " ".join(cmd))
    suite_env = {"PATH": "/usr/bin:/bin", "HOME": str(run_dir / "suite-home"), "LANG": "C.UTF-8", "TZ": "UTC",
                 "PLAYWRIGHT_BROWSERS_PATH": args.browsers}
    (run_dir / "suite-home").mkdir(exist_ok=True)
    code = subprocess.run(cmd, env=suite_env, cwd=REPO).returncode
    log(run_dir, f"suite exit {code}")
    return code


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="one acceptance run (OBJECTIVES §7)")
    sub = parser.add_subparsers(dest="cmd", required=True)
    run = sub.add_parser("run")
    run.add_argument("--tree", type=Path, required=True)
    run.add_argument("--run-dir", type=Path, required=True)
    run.add_argument("--seed", type=int, required=True)
    run.add_argument("--blackbox-repo", type=Path, required=True)
    run.add_argument("--blackbox-ref", required=True)
    run.add_argument("--port", type=int, default=4811)
    run.add_argument("--only", default="")
    run.add_argument("--browsers", default=str(Path.home() / ".cache/ms-playwright"))
    run.set_defaults(func=cmd_run)
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
