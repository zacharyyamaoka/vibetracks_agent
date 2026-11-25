"""The score (OBJECTIVES §8): junit XML from the acceptance runs -> per-item results, the objective, tie-breaks, gates.

    parse_junit(text)                  # {check id: Case}, or None when there is no readable junit at all
    case_id(classname, name)           # the viewer's reading: classname dots -> path + ".py", then "::" + name
    matches(check_id, patterns)        # a spec note's `tests:` patterns (fnmatch), or the id without a [parameter]
    expected_checks(checks_json)       # the ruler's own list of every check it runs (ruler/checks.json)
    score(items, expected, runs)       # the scorecard's scored part

Fail closed, everywhere (OBJECTIVES §8): an item is met only when at least one expected check matches it and every
one of those checks passed in every run made; a check that is missing, skipped or crashed (error) is not passed; a
run that did not finish, ran out of time, or left no readable junit passes nothing. `completed` needs the first run
to have finished in time with a pass or fail for every expected check; `deterministic` needs two runs, both
completed, that agree check by check (passed or not).
"""

from __future__ import annotations

import fnmatch
import json
import math
import re
import xml.etree.ElementTree as ET
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from vibetracks_agent.specs import SpecItem

TIME_LIMIT_S = 1200.0  # OBJECTIVES §8 `completed`: within 20 minutes
RESULT_STATES = ("pass", "fail")  # what counts as "returned a result" for `completed`

__all__ = ["Case", "RunResult", "TIME_LIMIT_S", "admissible", "case_id", "expected_checks", "matches", "parse_junit",
           "score"]


@dataclass(frozen=True)
class Case:
    id: str
    name: str
    classname: str
    state: str  # pass | fail | error | skipped
    message: str | None
    time_s: float | None


@dataclass(frozen=True)
class RunResult:
    junit: str | None  # the run's junit XML text, or None when it wrote none
    finished: bool  # the suite exited on its own (not killed)
    timed_out: bool
    wall_s: float | None


def case_id(classname: str, name: str) -> str:
    return f"{classname.replace('.', '/') + '.py' if classname else ''}::{name}"


def _first_line(text: str | None) -> str | None:
    if not text:
        return None
    line = next((x.strip() for x in text.splitlines() if x.strip()), "")
    return line[:300] or None


def parse_junit(text: str | None) -> dict[str, Case] | None:
    """{id: Case} for every testcase; None when the text is missing, blank, not XML, or holds no testcase."""
    if text is None or not str(text).strip():
        return None
    try:
        root = ET.fromstring(text)
    except ET.ParseError:
        return None
    out: dict[str, Case] = {}
    for node in root.iter("testcase"):
        classname, name = node.get("classname", ""), node.get("name", "")
        state, message = "pass", None
        for child in node:
            if child.tag == "failure":
                state, message = "fail", _first_line((child.get("message") or "") + "\n" + (child.text or ""))
            elif child.tag == "error":
                state, message = "error", _first_line((child.get("message") or "") + "\n" + (child.text or ""))
            elif child.tag == "skipped":
                state, message = "skipped", _first_line(child.get("message") or child.text or "skipped")
        try:
            time_s = float(node.get("time")) if node.get("time") is not None else None
        except ValueError:
            time_s = None
        cid = case_id(classname, name)
        out[cid] = Case(id=cid, name=name, classname=classname, state=state, message=message, time_s=time_s)
    return out or None


def matches(check_id: str, patterns: Iterable[str]) -> bool:
    bare = re.sub(r"\[.*\]$", "", check_id)
    return any(fnmatch.fnmatchcase(check_id, p) or fnmatch.fnmatchcase(bare, p) for p in patterns)


def expected_checks(path: Path | str) -> list[str]:
    """Every check id the ruler runs, from ruler/checks.json (frozen with the suite)."""
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    return [str(c["id"]) for c in data["checks"]]


def _finite(value: Any) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def admissible(gates: Mapping[str, Any] | None) -> bool:
    """Both gates present and exactly True; missing, null, NaN or a truthy non-bool is a fail (OBJECTIVES §8)."""
    if not isinstance(gates, Mapping):
        return False
    return all(gates.get(g) is True for g in ("completed", "deterministic"))


def _run_cases(run: RunResult, time_limit_s: float) -> tuple[dict[str, Case] | None, bool]:
    """(cases or None, ran_in_time). A run that did not finish in time passes nothing."""
    wall = _finite(run.wall_s)
    in_time = bool(run.finished) and not run.timed_out and wall is not None and wall <= time_limit_s
    cases = parse_junit(run.junit) if in_time else None
    return cases, in_time


def _completed(cases: dict[str, Case] | None, in_time: bool, expected: Sequence[str]) -> bool:
    if not in_time or cases is None or not expected:
        return False
    return all(cid in cases and cases[cid].state in RESULT_STATES for cid in expected)


def score(items: Sequence[SpecItem], expected: Sequence[str], runs: Sequence[RunResult], *,
          time_limit_s: float = TIME_LIMIT_S) -> dict[str, Any]:
    """The scored part of a scorecard from the runs of one split (the first is the scored run, the second its
    determinism twin)."""
    expected = list(dict.fromkeys(expected))
    parsed = [_run_cases(r, time_limit_s) for r in runs]
    per_run = [cases or {} for cases, _ in parsed]

    def passed_everywhere(cid: str) -> bool:
        return bool(per_run) and all(cid in cases and cases[cid].state == "pass" for cases in per_run)

    completed = bool(parsed) and _completed(parsed[0][0], parsed[0][1], expected)
    deterministic = False
    if len(parsed) >= 2 and completed and _completed(parsed[1][0], parsed[1][1], expected):
        first, second = parsed[0][0], parsed[1][0]
        deterministic = all((first[c].state == "pass") == (second[c].state == "pass") for c in expected)

    tasks, task_objectives = [], {}
    for item in items:
        mine = [c for c in expected if matches(c, item.tests)]
        checks = []
        for cid in mine:
            states = [cases[cid].state if cid in cases else "missing" for cases in per_run] or ["missing"]
            message = next((cases[cid].message for cases in per_run if cid in cases and cases[cid].state != "pass"),
                           None)
            checks.append({"id": cid, "name": cid.split("::", 1)[1], "states": states,
                           "passed": passed_everywhere(cid), "message": message})
        met = bool(mine) and all(c["passed"] for c in checks)
        if not item.tests:
            why = "no check: the spec note lists no test"
        elif not mine:
            why = "no check: no ruler check matches the note's tests pattern"
        elif not per_run:
            why = "no run"
        elif met:
            why = None
        else:
            why = f"{sum(1 for c in checks if not c['passed'])} of {len(checks)} checks not passed"
        tasks.append({"id": item.id, "kind": item.kind, "title": item.title, "met": met, "why": why,
                      "checks": checks, "failed_checks": [c["name"] for c in checks if not c["passed"]]})
        task_objectives[item.id] = 0 if met else 1

    shall = [t for t in tasks if t["kind"] == "shall"]
    should = [t for t in tasks if t["kind"] == "should"]
    gates = {"completed": completed, "deterministic": deterministic}
    return {
        "shall_failing": sum(1 for t in shall if not t["met"]),
        "shall_total": len(shall),
        "should_failing": sum(1 for t in should if not t["met"]),
        "should_total": len(should),
        "checks_failing": sum(1 for c in expected if not passed_everywhere(c)),
        "checks_total": len(expected),
        "gates": gates,
        "failed_gates": {g: 0 if ok else 1 for g, ok in gates.items()},
        "admissible": admissible(gates),
        "gate_pass_rate": sum(1 for ok in gates.values() if ok) / len(gates),
        "tasks": tasks,
        "task_objectives": task_objectives,
    }
