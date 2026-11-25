"""Where things live (docs/CONTRACT.md §2). Every environment path is read when asked for, never at import.

    VTA_VIBETRACKS   the Vibe Tracks checkout, read by `git archive` / `git rev-parse` only   (default ~/vibetracks)
    VTA_BLACKBOX     blackbox_agent, read by `git archive` / `git show` only                  (default ~/blackbox_agent)
    VTA_WORK         scratch trees and acceptance runs                                      (default ~/.cache/vibetracks_agent)
    VTA_REPO         this repo (default: found from this file, else the current directory)
"""

from __future__ import annotations

import os
import subprocess
from pathlib import Path


def _found_repo() -> Path:
    here = Path(__file__).resolve()
    for parent in here.parents:
        if (parent / "OBJECTIVES.md").exists() and (parent / "ruler").is_dir():
            return parent
    return Path.cwd()


def repo_root() -> Path:
    override = os.environ.get("VTA_REPO")
    return Path(override).expanduser().resolve() if override else _found_repo()


def vibetracks() -> Path:
    return Path(os.environ.get("VTA_VIBETRACKS", Path.home() / "vibetracks")).expanduser()


def blackbox() -> Path:
    return Path(os.environ.get("VTA_BLACKBOX", Path.home() / "blackbox_agent")).expanduser()


def work_dir() -> Path:
    return Path(os.environ.get("VTA_WORK", Path.home() / ".cache/vibetracks_agent")).expanduser()


def browsers_dir() -> Path:
    return Path(os.environ.get("PLAYWRIGHT_BROWSERS_PATH", Path.home() / ".cache/ms-playwright")).expanduser()


def ruler_dir() -> Path:
    return repo_root() / "ruler"


def ledger_path() -> Path:
    return repo_root() / "ledger.jsonl"


def solutions_dir() -> Path:
    return repo_root() / "solutions"


def repo_commit(root: Path | None = None) -> str | None:
    """This repo's HEAD (12 hex), or None outside git."""
    try:
        out = subprocess.run(["git", "-C", str(root or repo_root()), "rev-parse", "--short=12", "HEAD"],
                             capture_output=True, text=True, timeout=30)
    except (OSError, subprocess.TimeoutExpired):
        return None
    return (out.stdout.strip() or None) if out.returncode == 0 else None
