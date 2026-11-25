"""The score (OBJECTIVES §8), red first: every input missing must not pass, and an item with no check is failing.

Written before src/vibetracks_agent/scoring.py existed (it failed on import, then on each rule as the code grew).
"""

from __future__ import annotations

import math
from pathlib import Path

import pytest

from vibetracks_agent import scoring, specs
from vibetracks_agent.specs import SpecItem

REPO = Path(__file__).resolve().parents[1]

ITEMS = [
    SpecItem(id="S1.1", kind="shall", tests=("*::S1.1 *",), title="a", path="specs/S1.1.md"),
    SpecItem(id="S2.3", kind="shall", tests=("*::S2.3 *",), title="b", path="specs/S2.3.md"),
    SpecItem(id="S2.9", kind="should", tests=("*::S2.9 *",), title="c", path="specs/S2.9.md"),
    SpecItem(id="S5.1", kind="should", tests=(), title="d", path="specs/S5.1.md"),
]
EXPECTED = [
    "ruler/suite/open.py::S1.1 each box opens its own site",
    "ruler/suite/open.py::S1.1 the address bar names the track",
    "ruler/suite/menu.py::S2.3 menu items in Claude's order",
    "ruler/suite/anatomy.py::S2.9 the status dot is in the leading slot",
]


def junit(states: dict[str, str]) -> str:
    """A junit XML with one testcase per expected id; `states` maps an id to pass/fail/error/skipped (default pass)."""
    cases = []
    for cid in EXPECTED:
        path, name = cid.split("::", 1)
        classname = path[: -len(".py")].replace("/", ".")
        state = states.get(cid, "pass")
        body = {"pass": "", "fail": '<failure message="no">x</failure>', "error": '<error message="boom">x</error>',
                "skipped": "<skipped/>"}[state]
        cases.append(f'<testcase classname="{classname}" name="{name}" time="0.1">{body}</testcase>')
    return f'<?xml version="1.0"?><testsuites><testsuite name="s">{"".join(cases)}</testsuite></testsuites>'


def run(text: str | None, **kw) -> scoring.RunResult:
    return scoring.RunResult(junit=text, finished=kw.get("finished", True), timed_out=kw.get("timed_out", False),
                             wall_s=kw.get("wall_s", 60.0))


def score(*runs: scoring.RunResult, items=ITEMS, expected=EXPECTED) -> dict:
    return scoring.score(items, expected, list(runs))


# ── every input missing must not pass ──────────────────────────────────────────────────────────────────────────


@pytest.mark.parametrize("text", [None, "", "   ", "<not xml", "<testsuites/>", "<?xml version='1.0'?><testsuites></testsuites>"])
def test_an_empty_or_missing_junit_never_meets_an_item_or_passes_a_gate(text):
    card = score(run(text), run(text))
    assert card["shall_failing"] == 2 and card["should_failing"] == 2
    assert card["checks_failing"] == len(EXPECTED)
    assert card["gates"] == {"completed": False, "deterministic": False}
    assert card["admissible"] is False and card["gate_pass_rate"] == 0.0
    assert set(card["task_objectives"].values()) == {1}


def test_no_runs_at_all_fails_everything():
    card = score()
    assert card["shall_failing"] == 2 and card["should_failing"] == 2 and card["checks_failing"] == len(EXPECTED)
    assert card["admissible"] is False


def test_an_item_with_no_check_counts_as_failing():
    card = score(run(junit({})), run(junit({})))
    assert card["task_objectives"]["S5.1"] == 1
    s51 = next(t for t in card["tasks"] if t["id"] == "S5.1")
    assert s51["met"] is False and s51["checks"] == [] and "no check" in s51["why"]
    assert card["should_failing"] == 1 and card["shall_failing"] == 0


def test_an_item_whose_pattern_matches_no_expected_check_is_failing():
    items = [SpecItem(id="S9.9", kind="shall", tests=("*::S9.9 *",), title="x", path="x")]
    card = score(run(junit({})), run(junit({})), items=items)
    assert card["shall_failing"] == 1 and card["task_objectives"] == {"S9.9": 1}


def test_all_checks_passing_meets_every_item_with_a_check_and_passes_both_gates():
    card = score(run(junit({})), run(junit({})))
    assert card["shall_failing"] == 0 and card["should_failing"] == 1 and card["checks_failing"] == 0
    assert card["gates"] == {"completed": True, "deterministic": True} and card["admissible"] is True
    assert card["task_objectives"] == {"S1.1": 0, "S2.3": 0, "S2.9": 0, "S5.1": 1}


def test_one_failing_check_fails_its_item_only():
    bad = {EXPECTED[1]: "fail"}
    card = score(run(junit(bad)), run(junit(bad)))
    assert card["task_objectives"]["S1.1"] == 1 and card["task_objectives"]["S2.3"] == 0
    assert card["shall_failing"] == 1 and card["checks_failing"] == 1
    assert card["admissible"] is True  # a failing check is a result


@pytest.mark.parametrize("state", ["skipped", "error"])
def test_a_skipped_or_crashed_check_fails_its_item_and_the_completed_gate(state):
    bad = {EXPECTED[2]: state}
    card = score(run(junit(bad)), run(junit(bad)))
    assert card["task_objectives"]["S2.3"] == 1
    assert card["gates"]["completed"] is False and card["admissible"] is False


def test_a_check_missing_from_the_junit_fails_its_item_and_the_completed_gate():
    text = junit({}).replace(f'name="{EXPECTED[0].split("::")[1]}"', 'name="something else"')
    card = score(run(text), run(text))
    assert card["task_objectives"]["S1.1"] == 1 and card["checks_failing"] == 1
    assert card["gates"]["completed"] is False


def test_a_run_that_did_not_finish_fails_everything_even_with_a_green_junit():
    for broken in (run(junit({}), finished=False), run(junit({}), timed_out=True), run(junit({}), wall_s=1201.0)):
        card = score(broken, run(junit({})))
        assert card["shall_failing"] == 2 and card["gates"]["completed"] is False and card["admissible"] is False


@pytest.mark.parametrize("wall", [None, math.nan, math.inf])
def test_a_run_with_no_wall_time_has_not_completed(wall):
    card = score(run(junit({}), wall_s=wall), run(junit({})))
    assert card["gates"]["completed"] is False


def test_deterministic_needs_two_runs_that_agree_check_by_check():
    one = score(run(junit({})))
    assert one["gates"]["deterministic"] is False and one["admissible"] is False
    flip = score(run(junit({})), run(junit({EXPECTED[3]: "fail"})))
    assert flip["gates"]["deterministic"] is False
    # an item is met only when it is met in every run (fail closed): the flipped check's item fails
    assert flip["task_objectives"]["S2.9"] == 1 and flip["checks_failing"] == 1
    missing_second = score(run(junit({})), run(None))
    assert missing_second["gates"]["deterministic"] is False


def test_pattern_needs_the_space_after_the_id():
    assert scoring.matches("ruler/suite/menu.py::S2.3 menu items", ("*::S2.3 *",))
    assert not scoring.matches("ruler/suite/menu.py::S2.30 other", ("*::S2.3 *",))
    assert not scoring.matches("ruler/suite/menu.py::S2.3x other", ("*::S2.3 *",))
    assert not scoring.matches("ruler/suite/menu.py::S2.3 menu items", ())


def test_case_ids_follow_the_viewer_reading():
    cases = scoring.parse_junit(junit({}))
    assert set(cases) == set(EXPECTED)
    assert scoring.case_id("ruler.suite.menu", "S2.3 x") == "ruler/suite/menu.py::S2.3 x"


def test_gates_are_admissible_only_when_both_are_true():
    assert scoring.admissible({"completed": True, "deterministic": True}) is True
    for gates in ({"completed": True, "deterministic": None}, {"completed": True}, {}, None,
                  {"completed": 1, "deterministic": True}, {"completed": True, "deterministic": math.nan}):
        assert scoring.admissible(gates) is False


# ── the real spec notes ──────────────────────────────────────────────────────────────────────────────────────


def test_the_frozen_spec_has_23_shall_and_3_should_and_s5_1_has_no_check():
    """Ruler v2 (PEP 0002) adds S2.10, a shall: 19 -> 20. Ruler v3 (PEP 0003) adds S1.6 and S2.11, shalls, and makes
    S2.9 one: 23 shall, 3 should."""
    items = specs.load_items(REPO / "specs")
    assert len([i for i in items if i.kind == "shall"]) == 23
    assert len([i for i in items if i.kind == "should"]) == 3
    by_id = {i.id: i for i in items}
    assert by_id["S5.1"].tests == ()
    assert by_id["S2.3"].tests == ("*::S2.3 *",)
    assert by_id["S2.10"].kind == "shall" and by_id["S2.10"].tests == ("*::S2.10 *",)
    assert by_id["S1.6"].kind == "shall" and by_id["S1.6"].tests == ("*::S1.6 *",)
    assert by_id["S2.9"].kind == "shall" and by_id["S2.9"].tests == ("*::S2.9 *",)
    assert by_id["S2.11"].kind == "shall" and by_id["S2.11"].tests == ("*::S2.11 *",)


def test_every_spec_item_but_s5_1_has_at_least_one_ruler_check():
    items = specs.load_items(REPO / "specs")
    expected = scoring.expected_checks(REPO / "ruler" / "checks.json")
    unchecked = [i.id for i in items if not [c for c in expected if scoring.matches(c, i.tests)]]
    assert unchecked == ["S5.1"]


def test_s2_1_never_claims_an_s2_10_check():
    assert not scoring.matches("ruler/suite/pause.py::S2.10 a paused row's title is muted", ("*::S2.1 *",))
    assert scoring.matches("ruler/suite/pause.py::S2.10 a paused row's title is muted", ("*::S2.10 *",))


# PEP 0002's check table, row by row: words each row's check name must carry (a dropped row turns this red)
PEP_0002_ROWS = {
    "the menus show Pause on an active track": "menus show Pause",
    "and Resume on a paused one": "menus show Resume",
    "pausing changes nothing in the box": "leave every box untouched",
    "a pause glyph in the status-dot slot": "pause glyph in its status-dot slot",
    "a muted title": "title is muted",
    "it survives a reload": "survives a reload",
    "and a vt serve restart": "survives a vt serve restart",
    "from the page, a person record": "Pause in the ··· menu writes a person record",
    "from vt pause in an agent's session, an agent record": "inside an agent session writes an agent record",
    "vt pause and the menu agree within one tick": "shows on the page within 5 s",
    "--why stored verbatim": "verbatim",
    "without --why no why key": "no why",
    "Resume returns the state colour and Pause": "Resume returns the row to its state colour and the menu to Pause",
}


def test_every_row_of_pep_0002s_check_table_has_an_s2_10_check():
    names = [c.split("::", 1)[1] for c in scoring.expected_checks(REPO / "ruler" / "checks.json")]
    s210 = [n for n in names if n.startswith("S2.10 ")]
    missing = [row for row, words in PEP_0002_ROWS.items() if not any(words in n for n in s210)]
    assert not missing, f"PEP 0002 rows with no S2.10 check: {missing}"
    # S2.3's amended list: Z runs Pause / Resume (the letter is read, as every other letter is)
    assert any(n.startswith("S2.3 Z ") for n in names)


# PEP 0003's fold behaviours (Zach, 2026-11-25), each with a fold-group S2.9 check, and S1.6's two bounds
PEP_0003_FOLD = {
    "the dot turns into the chevron in the same slot": "turns its status dot into the fold chevron, in the same slot",
    "Fold N sub-tracks (← →) / Unfold N sub-tracks": '"Fold N sub-tracks (← →)", and "Unfold N sub-tracks"',
    "a chevron click folds every level and the rows below move up; a second unfolds": "folds every level below and the rows below move up; a second click unfolds",
    "a title click opens without folding": "title click on a parent opens it and leaves it unfolded",
    "← and → fold and unfold a focused row": "← folds a focused row and → unfolds it",
    "the fold survives a reload": "a fold survives a reload",
    "a folded parent keeps its roll-up": "a folded parent still shows its roll-up",
}


def test_every_fold_behaviour_of_pep_0003_has_an_s2_9_check_and_s1_6_has_both_bounds():
    checks = scoring.expected_checks(REPO / "ruler" / "checks.json")
    fold = [c.split("::", 1)[1] for c in checks if c.startswith("ruler/suite/fold.py::S2.9 ")]
    missing = [b for b, words in PEP_0003_FOLD.items() if not any(words in n for n in fold)]
    assert not missing, f"PEP 0003 fold behaviours with no check: {missing}"
    s16 = [c.split("::", 1)[1] for c in checks if c.startswith("ruler/suite/speed.py::S1.6 ")]
    assert any("package box" in n and "400 ms" in n for n in s16) and any("nineteen opens in twenty" in n and "1000 ms" in n for n in s16)


# S2.11's behaviours (Zach, 2026-11-25), each with a search-group check; S2.1 never claims one of them
PEP_0003_SEARCH = {
    "Ctrl+K opens a palette": "Ctrl+K opens the search palette",
    "Ctrl+O and Ctrl+P too": "Ctrl+O and Ctrl+P open the search palette too",
    "Escape closes it": "Escape closes the search palette",
    "a Search row with Ctrl+K at the right end, in the top rows": "the sidebar shows Search with Ctrl+K at its right end",
    "a hit names its track, file and line": "lists that hit with its track, file and line",
    "the open track's hits first": "with a track open, its hits come first",
    "Enter opens the page showing the hit": "Enter on a hit opens its track on the page that shows it",
}


def test_every_search_behaviour_of_pep_0003_has_an_s2_11_check_and_s2_1_claims_none():
    checks = scoring.expected_checks(REPO / "ruler" / "checks.json")
    s211 = [c.split("::", 1)[1] for c in checks if c.startswith("ruler/suite/search.py::S2.11 ")]
    missing = [b for b, words in PEP_0003_SEARCH.items() if not any(words in n for n in s211)]
    assert not missing, f"PEP 0003 search behaviours with no check: {missing}"
    assert not [c for c in checks if "search.py" in c and scoring.matches(c, ("*::S2.1 *",))]
