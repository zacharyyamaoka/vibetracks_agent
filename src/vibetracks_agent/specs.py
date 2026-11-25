"""The spec items (OBJECTIVES §1-§5): one note per item in `specs/`, its front matter the only thing read.

    load_items(specs_dir) -> [SpecItem]   # sorted by id; kind "shall" | "should"; tests = the junit id patterns

Front matter is the simple subset the notes use (`key: value`, and a `tests:` list of `- "pattern"` lines or `[]`),
read with the standard library so the scorer needs nothing installed.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

__all__ = ["SpecItem", "load_items"]


@dataclass(frozen=True)
class SpecItem:
    id: str
    kind: str  # "shall" | "should"
    tests: tuple[str, ...]
    title: str
    path: str


def _unquote(text: str) -> str:
    text = text.strip()
    if len(text) >= 2 and text[0] == text[-1] and text[0] in "\"'":
        return text[1:-1]
    return text


def _front_matter(text: str) -> tuple[dict, str]:
    if not text.startswith("---"):
        return {}, text
    end = text.find("\n---", 3)
    if end < 0:
        return {}, text
    block, body = text[3:end], text[end + 4:]
    out: dict = {}
    key = None
    for raw in block.splitlines():
        if not raw.strip():
            continue
        item = re.match(r"^\s+-\s+(.*)$", raw)
        if item and key is not None:
            if not isinstance(out.get(key), list):
                out[key] = []
            out[key].append(_unquote(item.group(1)))
            continue
        pair = re.match(r"^([A-Za-z_][\w-]*):\s*(.*)$", raw)
        if pair:
            key, value = pair.group(1), pair.group(2).strip()
            if value == "[]":
                out[key] = []
            elif value.startswith("[") and value.endswith("]"):
                out[key] = [_unquote(v) for v in value[1:-1].split(",") if v.strip()]
            elif value == "":
                out[key] = []
            else:
                out[key] = _unquote(value)
    return out, body


def load_items(specs_dir: Path | str) -> list[SpecItem]:
    """Every `specs/S*.md` note's id, kind, test patterns and title (its first `# ` heading)."""
    items = []
    for path in sorted(Path(specs_dir).glob("S*.md")):
        meta, body = _front_matter(path.read_text(encoding="utf-8"))
        if "id" not in meta or meta.get("kind") not in ("shall", "should"):
            raise ValueError(f"{path.name}: front matter needs id and kind shall|should")
        tests = meta.get("tests") or []
        if isinstance(tests, str):
            tests = [tests]
        heading = next((line[2:].strip() for line in body.splitlines() if line.startswith("# ")), meta["id"])
        items.append(SpecItem(id=str(meta["id"]), kind=str(meta["kind"]), tests=tuple(str(t) for t in tests),
                              title=heading, path=f"specs/{path.name}"))
    key = lambda i: tuple(int(p) if p.isdigit() else p for p in re.split(r"[.]", i.id.lstrip("S")))  # noqa: E731
    return sorted(items, key=key)
