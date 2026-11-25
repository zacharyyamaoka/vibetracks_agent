#!/usr/bin/env python3
"""Freeze the ruler (OBJECTIVES §11): write ruler/checks.json (every check the suite declares) and ruler/manifest.json
(a sha256 for every ruler file, OBJECTIVES.md, each spec note and the Playwright pin, plus the frozen refs).

    uv run --directory ~/vibetracks_agent python tools/freeze_ruler.py --blackbox-ref b25a20c [--force]

Run once per ruler version. It refuses to overwrite an existing manifest without --force: changing the ruler is a new
version (a section in OBJECTIVES.md), and every solution is re-scored on it.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from vibetracks_agent import ruler  # noqa: E402


def git(repo: Path, *args: str) -> str:
    return subprocess.run(["git", "-C", str(repo), *args], capture_output=True, text=True, check=True).stdout.strip()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--blackbox-ref", required=True)
    parser.add_argument("--blackbox-repo", type=Path, default=Path.home() / "blackbox_agent")
    parser.add_argument("--vibetracks-repo", type=Path, default=Path.home() / "vibetracks")
    parser.add_argument("--baseline", default="d0cb827")
    parser.add_argument("--claude-hub", type=Path, default=Path.home() / "claude-hub")
    parser.add_argument("--claude-hub-sha", default="8adddc6faa19796d196a6ab500930cfe5e50120d")
    parser.add_argument("--frozen", default="2026-11-24")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    manifest_path = ROOT / "ruler" / "manifest.json"
    if manifest_path.exists() and not args.force:
        print("ruler/manifest.json exists: the ruler is frozen (--force writes a new version)", file=sys.stderr)
        return 2
    checks = ruler.suite_list(ROOT)
    if checks is None:
        print("node ruler/suite/run.mjs --list failed", file=sys.stderr)
        return 1
    (ROOT / "ruler" / "checks.json").write_text(json.dumps({
        "schema": "vibetracks-agent/checks-1", "ruler": "v1",
        "what": "Every check the acceptance suite runs (node ruler/suite/run.mjs --list), frozen with it: a check missing "
                "from a run's junit counts as failing, and an item none of these match has no check (OBJECTIVES §8).",
        "checks": checks}, indent=1) + "\n")
    lock = json.loads((ROOT / "package-lock.json").read_text())
    pw = lock["packages"]["node_modules/playwright"]["version"]
    browsers = json.loads((ROOT / "node_modules" / "playwright-core" / "browsers.json").read_text())["browsers"]
    shell = next(b for b in browsers if b["name"] == "chromium-headless-shell")
    refs = {
        "frozen": args.frozen,
        "blackbox_agent": {"repo": "~/blackbox_agent", "ref": git(args.blackbox_repo, "rev-parse", f"{args.blackbox_ref}^{{commit}}"),
                           "read": ["README.md", "template/", "tools/apply_template.py",
                                    "viewer/src/components/bb-needs-you.js (ruler/reference/box-components.json)"]},
        "vibetracks": {"repo": "~/vibetracks", "baseline": git(args.vibetracks_repo, "rev-parse", f"{args.baseline}^{{commit}}"),
                       "read": "git archive / rev-parse / show only"},
        "claude_hub": {"repo": "~/claude-hub", "sha": args.claude_hub_sha,
                       "sidebar_controls_blob": git(args.claude_hub, "rev-parse", f"{args.claude_hub_sha}:docs/sidebar-controls.yaml")},
        "playwright": {"npm": "playwright", "version": pw, "chromium_headless_shell_revision": shell["revision"],
                       "browser_version": shell.get("browserVersion")},
        "splits": {"dev": {"seed": 1}, "holdout": {"seed": 2}},
        "time_limit_s": 1200,
        "checks": len(checks),
    }
    manifest_path.write_text(json.dumps(ruler.build(ROOT, refs), indent=1) + "\n")
    print(f"froze {len(checks)} checks and {len(ruler.ruler_files(ROOT))} ruler files")
    return 0


if __name__ == "__main__":
    sys.exit(main())
