"""Solutions (docs/CONTRACT.md §3 meta.json): one vibetracks commit each, `solutions/<id>/meta.json`.

    new(id, ref=..., change=..., proposed_by=..., parent=None)   # `vta new`: resolves the ref to a sha, refuses
                                                                # without agent and model, an unknown parent, a bad id
    meta(id) / all_meta()

Shapes follow claude_party_agent `src/claude_party_agent/solutions.py` @ bdd812a.
"""

from __future__ import annotations

import datetime as dt
import json
import re
import subprocess
from collections.abc import Mapping
from pathlib import Path
from typing import Any

from vibetracks_agent import paths

ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._+-]{0,79}$")


def now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def meta_path(sid: str, root: Path | None = None) -> Path:
    return (root or paths.solutions_dir()) / sid / "meta.json"


def meta(sid: str, root: Path | None = None) -> dict[str, Any]:
    return json.loads(meta_path(sid, root).read_text())


def all_meta(root: Path | None = None) -> dict[str, dict[str, Any]]:
    root = root or paths.solutions_dir()
    out = {}
    for path in sorted(root.glob("*/meta.json")):
        try:
            out[path.parent.name] = json.loads(path.read_text())
        except (OSError, ValueError):
            continue
    return out


def write_meta(record: Mapping[str, Any], root: Path | None = None) -> Path:
    path = meta_path(record["id"], root)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(dict(record), indent=2) + "\n")
    tmp.replace(path)
    return path


def resolve(ref: str, repo: Path | None = None) -> str:
    """A vibetracks ref (branch, tag, sha) -> its full commit sha (read-only git)."""
    out = subprocess.run(["git", "-C", str(repo or paths.vibetracks()), "rev-parse", "--verify", f"{ref}^{{commit}}"],
                         capture_output=True, text=True, timeout=60)
    if out.returncode != 0:
        raise ValueError(f"no such vibetracks ref {ref!r}: {out.stderr.strip()}")
    return out.stdout.strip()


def committed_iso(sha: str, repo: Path | None = None) -> str | None:
    out = subprocess.run(["git", "-C", str(repo or paths.vibetracks()), "show", "-s", "--format=%ct", sha],
                         capture_output=True, text=True, timeout=60)
    try:
        return dt.datetime.fromtimestamp(int(out.stdout.strip()), dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    except ValueError:
        return None


def new(sid: str, *, ref: str, change: str, proposed_by: Mapping[str, Any], parent: str | None = None,
        tags: list[str] | None = None, root: Path | None = None, repo: Path | None = None) -> Path:
    if not ID_RE.match(sid):
        raise ValueError(f"bad solution id {sid!r}: letters, digits, . _ + - (up to 80)")
    missing = [key for key in ("agent", "model") if not proposed_by.get(key)]
    if missing:
        raise ValueError(f"say who proposes it: --{' --'.join(missing)} (or VTA_AGENT / VTA_MODEL)")
    if meta_path(sid, root).exists():
        raise ValueError(f"solution {sid} exists")
    if parent and not meta_path(parent, root).exists():
        raise ValueError(f"no such parent solution: {parent}")
    sha = resolve(ref, repo)
    record = {"id": sid, "parent": parent, "change": change, "vibetracks_sha": sha, "vibetracks_ref": ref,
              "vibetracks_committed": committed_iso(sha, repo),
              "proposed_by": {"agent": proposed_by.get("agent"), "model": proposed_by.get("model"),
                              "session": proposed_by.get("session")},
              "created": now_iso(), "tags": list(tags or [])}
    return write_meta(record, root)
