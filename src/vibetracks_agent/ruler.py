"""The frozen ruler (OBJECTIVES §11): `ruler/manifest.json` holds a sha256 for every file under ruler/, for
OBJECTIVES.md and every spec note, and for the Playwright lockfile, plus the frozen refs.

    manifest()            # the manifest as committed
    problems(root)        # every mismatch, missing or extra file, as sentences ([] = the ruler is intact)
    build(root, refs)     # a fresh manifest dict from the files on disk (tools/freeze_ruler.py writes it, once)
    suite_list(root)      # `node ruler/suite/run.mjs --list`, the checks the suite declares
"""

from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
from pathlib import Path
from typing import Any

from vibetracks_agent import ledger, paths

SCHEMA = "vibetracks-agent/ruler-manifest-1"
SKIP_PARTS = ("__pycache__", "node_modules")


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def ruler_files(root: Path) -> dict[str, str]:
    base = root / "ruler"
    out = {}
    for path in sorted(base.rglob("*")):
        if not path.is_file() or path.name == "manifest.json" or any(p in path.parts for p in SKIP_PARTS):
            continue
        out[path.relative_to(base).as_posix()] = sha256(path)
    return out


def spec_files(root: Path) -> dict[str, str]:
    out = {"OBJECTIVES.md": sha256(root / "OBJECTIVES.md")}
    for path in sorted((root / "specs").glob("*.md")):
        out[f"specs/{path.name}"] = sha256(path)
    return out


def pin_files(root: Path) -> dict[str, str]:
    return {name: sha256(root / name) for name in ("package.json", "package-lock.json") if (root / name).exists()}


def manifest(root: Path | None = None) -> dict[str, Any]:
    return json.loads(((root or paths.repo_root()) / "ruler" / "manifest.json").read_text())


def build(root: Path, refs: dict[str, Any]) -> dict[str, Any]:
    return {"schema": SCHEMA, "ruler": ledger.RULER, "frozen": refs.pop("frozen"), **refs, "files": ruler_files(root),
            "spec_files": spec_files(root), "pins": pin_files(root)}


def _diff(kind: str, want: dict[str, str], have: dict[str, str]) -> list[str]:
    out = []
    for name in sorted(set(want) | set(have)):
        if name not in have:
            out.append(f"{kind} {name}: in the manifest, missing on disk")
        elif name not in want:
            out.append(f"{kind} {name}: on disk, not in the manifest")
        elif want[name] != have[name]:
            out.append(f"{kind} {name}: sha256 {have[name][:12]} on disk, {want[name][:12]} in the manifest")
    return out


def suite_list(root: Path) -> list[dict[str, str]] | None:
    node = "/usr/bin/node" if Path("/usr/bin/node").exists() else shutil.which("node")
    if not node:
        return None
    out = subprocess.run([node, str(root / "ruler" / "suite" / "run.mjs"), "--list"], capture_output=True, text=True,
                         timeout=120, cwd=root)
    return json.loads(out.stdout) if out.returncode == 0 else None


def problems(root: Path | None = None) -> list[str]:
    root = root or paths.repo_root()
    try:
        m = manifest(root)
    except (OSError, ValueError) as error:
        return [f"ruler/manifest.json: {error}"]
    found = []
    if m.get("schema") != SCHEMA:
        found.append(f"ruler/manifest.json: schema {m.get('schema')!r}")
    # WHY: a scorecard and a ledger row say which ruler scored them (ledger.RULER); a manifest or checks.json of
    # another version would label a v2 score v1, or the reverse, and ledger.rank would compare across rulers
    if m.get("ruler") != ledger.RULER:
        found.append(f"ruler/manifest.json names ruler {m.get('ruler')!r}; the scorer scores {ledger.RULER!r}")
    found += _diff("ruler/", m.get("files") or {}, ruler_files(root))
    found += _diff("spec", m.get("spec_files") or {}, spec_files(root))
    found += _diff("pin", m.get("pins") or {}, pin_files(root))
    listed = suite_list(root)
    if listed is None:
        found.append("node ruler/suite/run.mjs --list failed (is node installed?)")
    else:
        try:
            data = json.loads((root / "ruler" / "checks.json").read_text())
            frozen = data["checks"]
        except (OSError, ValueError, KeyError) as error:
            frozen = None
            found.append(f"ruler/checks.json: {error}")
        else:
            if data.get("ruler") != ledger.RULER:
                found.append(f"ruler/checks.json names ruler {data.get('ruler')!r}; the scorer scores {ledger.RULER!r}")
        if frozen is not None and [c["id"] for c in frozen] != [c["id"] for c in listed]:
            found.append("ruler/checks.json differs from the checks the suite declares (node ruler/suite/run.mjs --list)")
    if not (root / "node_modules" / "playwright" / "package.json").exists():
        found.append("node_modules/playwright missing: npm ci")
    return found
