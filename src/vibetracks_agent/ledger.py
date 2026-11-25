"""The ledger (docs/CONTRACT.md §3): `ledger.jsonl`, one JSON object per evaluation, append-only; the local truth.

    read(path)                 # every row, in file order (a line that is not a JSON object raises ValueError)
    append(row, path)          # one row; only `vta evaluate` calls it
    latest(rows)               # the newest row per (solution, split, ruler)
    rank(rows, split="dev")    # OBJECTIVES §8's order over that split's latest rows of the current ruler (RULER)
    named(row, key)            # shall_failing / should_failing / checks_failing / open_ms of a row of any ruler
    best(rows)                 # the first admissible row in rank order, else None

A row carries the ruler it was scored on (`ruler`). WHY rank only within one ruler (OBJECTIVES §11): a new ruler
changes what is counted (v2 adds S2.10, so the shall total goes 19 -> 20; v3 adds S1.6 and makes S2.9 a shall,
22 shall and 3 should; v4 rewrites S2.9's checks for the chevron at rest, PEP 0004), so a v1 number and a v2 number are not the same quantity; a row is kept, labelled, and never
compared against another ruler's (`rank(rows, ruler="v1")` reads v1's).

The tie-break slots are ordered (`tiebreak`, `tiebreak2`, `tiebreak3`: the blackbox_agent fold ranks equal objectives
by them in that order). Up to v2: should_failing, checks_failing. Since v3 (PEP 0003): `open_ms` rounded to 10 ms,
should_failing, checks_failing, and a v3 row also names each (`open_ms`, `should_failing`, `checks_failing`), which
`named()` reads for any ruler.

Shapes follow claude_party_agent `src/claude_party_agent/ledger.py` @ bdd812a (read, append, latest, rank_key).
"""

from __future__ import annotations

import json
import math
from collections.abc import Iterable, Mapping
from pathlib import Path
from typing import Any

RULER = "v4"  # the ruler this code scores: OBJECTIVES §11, ruler/manifest.json `ruler`
SPLITS = ("dev", "holdout")
ROW_KEYS = (
    "t", "solution", "parent", "split", "ruler", "objective", "tiebreak", "tiebreak2", "admissible", "gate_pass_rate",
    "failed_gates", "diagnostics", "wall_time_s", "repo_commit", "vibetracks_sha", "proposed_by", "change",
    "task_objectives",
)  # fmt: skip
V3_KEYS = ("tiebreak3", "open_ms", "should_failing", "checks_failing")  # a row of ruler v3 or later also names these

__all__ = ["ROW_KEYS", "RULER", "SPLITS", "V3_KEYS", "append", "best", "finite", "latest", "named", "rank", "rank_key", "read",
           "rulers", "tenth"]


def finite(value: Any) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def read(path: Path | str) -> list[dict[str, Any]]:
    path = Path(path)
    if not path.exists():
        return []
    out = []
    with open(path, encoding="utf-8") as handle:
        for number, line in enumerate(handle, start=1):
            if not line.strip():
                continue
            try:
                row = json.loads(line)
            except ValueError as error:
                raise ValueError(f"{path.name}:{number}: not JSON ({error})") from error
            if not isinstance(row, dict):
                raise ValueError(f"{path.name}:{number}: not a JSON object")
            out.append(row)
    return out


def append(row: Mapping[str, Any], path: Path | str) -> None:
    needed = ROW_KEYS + (() if row.get("ruler") in ("v1", "v2") else V3_KEYS)
    missing = [key for key in needed if key not in row]
    if missing:
        raise ValueError(f"a ledger row needs {missing}")
    if row.get("split") not in SPLITS:
        raise ValueError(f"unknown split {row.get('split')!r}")
    line = json.dumps(dict(row), allow_nan=False, separators=(",", ":")) + "\n"
    with open(path, "a", encoding="utf-8") as handle:
        handle.write(line)


def latest(rows: Iterable[Mapping[str, Any]]) -> list[dict[str, Any]]:
    """The newest row per (solution, split, ruler), in file order of those rows; newest = greatest `t`, ties to the
    later line."""
    chosen: dict[tuple, tuple[str, int, dict[str, Any]]] = {}
    for index, row in enumerate(rows):
        key = (row.get("solution"), row.get("split"), row.get("ruler"))
        stamp = str(row.get("t") or "")
        held = chosen.get(key)
        if held is None or (stamp, index) >= (held[0], held[1]):
            chosen[key] = (stamp, index, dict(row))
    return [row for _, _, row in sorted(chosen.values(), key=lambda item: item[1])]


def _num(value: Any) -> float:
    number = finite(value)
    return math.inf if number is None else number


def tenth(ms: Any) -> float | None:
    """open_ms as it ranks (OBJECTIVES §8): rounded to 10 ms, half up; None when missing."""
    number = finite(ms)
    return None if number is None else float(math.floor(number / 10 + 0.5) * 10)


def named(row: Mapping[str, Any], key: str) -> Any:
    """A row's shall_failing, should_failing, checks_failing or open_ms, whichever ruler scored it (a v1/v2 row keeps
    should and checks in its tie-break slots and has no open_ms)."""
    if key == "shall_failing":
        return row.get("objective")
    if key in row:
        return row.get(key)
    if row.get("ruler") in ("v1", "v2", None):
        return {"should_failing": row.get("tiebreak"), "checks_failing": row.get("tiebreak2")}.get(key)
    return None


def rank_key(row: Mapping[str, Any]) -> tuple:
    """OBJECTIVES §8: admissible first, by the objective (shall_failing), then the tie-break slots in order (lower
    first): since v3 open_ms rounded to 10 ms, should_failing, checks_failing; up to v2 should_failing, checks_failing.
    Then the rest by gate pass rate (higher first) and the same. A missing number sorts last."""
    numbers = (_num(row.get("objective")), _num(row.get("tiebreak")), _num(row.get("tiebreak2")),
               _num(row.get("tiebreak3")))
    if row.get("admissible") is True:
        return (0, 0.0, *numbers, str(row.get("solution")))
    return (1, -(finite(row.get("gate_pass_rate")) or 0.0), *numbers, str(row.get("solution")))


def rank(rows: Iterable[Mapping[str, Any]], split: str = "dev", ruler: str = RULER) -> list[dict[str, Any]]:
    """That split's latest rows scored on `ruler` (default: the current one), in OBJECTIVES §8's order; a row of any
    other ruler, or with none, is left out."""
    mine = [row for row in latest(rows) if row.get("split") == split and row.get("ruler") == ruler]
    return sorted(mine, key=rank_key)


def rulers(rows: Iterable[Mapping[str, Any]]) -> list[str]:
    """Every ruler a row names, in the order first seen (a row with none reads as "unknown")."""
    return list(dict.fromkeys(str(row.get("ruler") or "unknown") for row in rows))


def best(rows: Iterable[Mapping[str, Any]], split: str = "dev", ruler: str = RULER) -> dict[str, Any] | None:
    for row in rank(rows, split, ruler):
        if row.get("admissible") is True and finite(row.get("objective")) is not None:
            return row
    return None
