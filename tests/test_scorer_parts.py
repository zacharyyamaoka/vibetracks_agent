"""The scorer's other parts: the ledger's rank (OBJECTIVES §8), `vta verify` seeing a changed ruler, the fixture's
seeds, the published junit, and the generated files."""

from __future__ import annotations

import json
import math
import os
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

from vibetracks_agent import evaluate, ledger, progress, ruler

REPO = Path(__file__).resolve().parents[1]
BLACKBOX = Path.home() / "blackbox_agent"
# the first three dev boxes' commits as ruler v2's fixture made them (ruler/fixture.py at f4cff77): v3 must not move them
V2_DEV_HEADS = ["4cd90b932a5539498155caf4289b738cbf58de4e", "3f9ee1232d8bce5da423435af88a087b9bec71e5",
                "d0251f342176ceaa66353e2a40b23bf595c1fb5b"]


def row(sid, objective, tiebreak=0, tiebreak2=0, tiebreak3=0, *, admissible=True, rate=1.0, t="2026-11-24T00:00:00Z",
        split="dev", ruler_version=None, open_ms=None):
    """A ledger row. On v3 (the default) the slots are open_ms rounded to 10 ms, should, checks (OBJECTIVES §8); a v1/v2
    row has only two slots, should and checks."""
    version = ruler_version or ledger.RULER
    out = {"t": t, "solution": sid, "parent": None, "split": split, "ruler": version, "objective": objective,
           "tiebreak": tiebreak, "tiebreak2": tiebreak2, "admissible": admissible, "gate_pass_rate": rate,
           "failed_gates": {}, "diagnostics": {}, "wall_time_s": 1.0, "repo_commit": None, "vibetracks_sha": "x",
           "proposed_by": {"agent": "a", "model": "m"}, "change": "c", "task_objectives": {}}
    if version not in ("v1", "v2"):
        out.update(tiebreak3=tiebreak3, open_ms=open_ms if open_ms is not None else tiebreak, should_failing=tiebreak2,
                   checks_failing=tiebreak3)
    return out


def test_rank_is_shall_then_open_ms_then_should_then_checks_admissible_first():
    rows = [row("a", 3, 300, 1, 9), row("b", 3, 300, 1, 5), row("c", 2, 900, 4, 50),
            row("d", 0, 0, 0, admissible=False, rate=0.5), row("e", math.nan, 0, 0), row("f", 3, 300, 0, 99),
            row("g", 3, 290, 2, 99), row("h", 3, None, 0, 0)]
    # c: fewest shall; g: same shall, 10 ms faster; then f, b, a on should and checks; h has no open_ms (last of the 3s)
    assert [r["solution"] for r in ledger.rank(rows)] == ["c", "g", "f", "b", "a", "h", "e", "d"]
    assert ledger.best(rows)["solution"] == "c"
    assert ledger.best([row("d", 0, admissible=False)]) is None


def test_a_v2_rows_rank_is_unchanged_by_the_third_slot():
    """v2 rows have two slots (should, checks) and no third: their order is what it was (OBJECTIVES §11)."""
    rows = [row("a", 3, 1, 9, ruler_version="v2"), row("b", 3, 1, 5, ruler_version="v2"),
            row("c", 2, 4, 50, ruler_version="v2"), row("f", 3, 0, 99, ruler_version="v2")]
    assert [r["solution"] for r in ledger.rank(rows, ruler="v2")] == ["c", "f", "b", "a"]


def test_open_ms_ranks_rounded_to_10_ms_and_named_reads_any_ruler():
    assert [ledger.tenth(x) for x in (284.9, 285.0, 294.9, None, math.nan)] == [280.0, 290.0, 290.0, None, None]
    v2 = row("old", 1, 2, 30, ruler_version="v2")
    v3 = row("new", 1, 290, 2, 30, open_ms=287.4)
    assert [ledger.named(v2, k) for k in ("shall_failing", "should_failing", "checks_failing", "open_ms")] == [1, 2, 30, None]
    assert [ledger.named(v3, k) for k in ("shall_failing", "should_failing", "checks_failing", "open_ms")] == [1, 2, 30, 287.4]


# ── open_ms from the runs' speed reports (OBJECTIVES §8): package boxes only, both runs pooled, fail closed ──


def _speed(*opens, **extra):
    return {"opens": [{"kind": k, "phase": ph, "ms": ms, "requests": rq, "bytes": by, "builds": bu}
                      for k, ph, ms, rq, by, bu in opens], **extra}


def test_open_ms_is_the_pooled_median_of_package_opens_and_a_missing_page_counts_as_the_cap():
    one = _speed(("package", "cold", 2000.0, 95, 2.5e6, 1), ("package", "warm", 300.0, 95, 3e3, 0),
                 ("files", "cold", 50.0, 3, 3e3, 0), open_ms=1150.0, p95=2000.0)
    two = _speed(("package", "cold", None, None, None, None), ("package", "warm", 320.0, 95, 3e3, 0),
                 ("files", "warm", 60.0, 3, 3e3, 0), open_ms=5160.0, p95=9000.0)
    out = evaluate.speed_summary([one, two])
    # package opens: 2000, 300, 10000 (never shown: the cap), 320 -> median 1160; the files opens never count
    assert out["open_ms"] == 1160.0
    assert out["open_ms_runs"] == [1150.0, 5160.0] and out["open_ms_spread"] == 4010.0
    assert out["opens"] == 6 and out["opens_failed"] == 1 and out["open_max"] == 10000.0
    assert out["open_cold_p50"] == 6000.0 and out["open_warm_p50"] == 310.0
    assert out["open_p50_by_kind"] == {"files": 55.0, "package": 1160.0}
    assert out["requests_per_open"] == 95.0 and out["builds_waited"] == 1


@pytest.mark.parametrize("speeds", [[], [None, None], [_speed(("package", "warm", 300.0, 1, 1, 0)), None],
                                    [_speed(("package", "warm", 300.0, 1, 1, 0)), {"opens": []}],
                                    [_speed(("files", "warm", 30.0, 1, 1, 0)), _speed(("files", "warm", 30.0, 1, 1, 0))]])
def test_open_ms_is_missing_unless_every_run_timed_package_opens(speeds):
    assert evaluate.speed_summary(speeds)["open_ms"] is None


def test_latest_keeps_the_newest_row_per_solution_and_split():
    rows = [row("a", 5, t="2026-11-24T01:00:00Z"), row("a", 4, t="2026-11-24T02:00:00Z"), row("a", 9, split="holdout")]
    newest = ledger.latest(rows)
    assert [(r["split"], r["objective"]) for r in newest] == [("dev", 4), ("holdout", 9)]


# ── ruler versions (OBJECTIVES §11): rank within the current ruler; an earlier ruler's row is kept and labelled ──


def test_the_code_and_the_frozen_ruler_name_one_version():
    """The scorer, the manifest and checks.json all say v3 (PEP 0003), so a scorecard's `ruler` is the ruler it ran."""
    assert ledger.RULER == "v3"
    assert ruler.manifest(REPO)["ruler"] == ledger.RULER
    assert json.loads((REPO / "ruler" / "checks.json").read_text())["ruler"] == ledger.RULER


def test_rank_and_best_compare_only_rows_of_the_current_ruler():
    old = row("old", 0, 0, 0, ruler_version="v1")  # better on paper, scored on another ruler
    new = row("new", 5, 1, 30)
    assert [r["solution"] for r in ledger.rank([old, new])] == ["new"]
    assert ledger.best([old, new])["solution"] == "new"
    assert ledger.best([old]) is None
    assert [r["solution"] for r in ledger.rank([old, new], ruler="v1")] == ["old"]
    unlabelled = row("bare", 0)
    del unlabelled["ruler"]
    assert ledger.rank([unlabelled]) == []


def test_latest_keeps_one_row_per_ruler():
    rows = [row("a", 13, ruler_version="v1", t="2026-11-25T01:00:00Z"), row("a", 14, t="2026-11-25T02:00:00Z")]
    assert sorted((r["ruler"], r["objective"]) for r in ledger.latest(rows)) == [("v1", 13), (ledger.RULER, 14)]


def test_append_refuses_a_row_missing_a_key_or_a_bad_split(tmp_path):
    with pytest.raises(ValueError):
        ledger.append({"solution": "a"}, tmp_path / "l.jsonl")
    bad = row("a", 1)
    bad["split"] = "live"
    with pytest.raises(ValueError):
        ledger.append(bad, tmp_path / "l.jsonl")
    with pytest.raises(ValueError):
        ledger.append(row("a", math.nan), tmp_path / "l.jsonl")


def test_a_torn_ledger_line_is_an_error_not_a_dropped_row(tmp_path):
    path = tmp_path / "ledger.jsonl"
    path.write_text(json.dumps(row("a", 1)) + "\n{not json\n")
    with pytest.raises(ValueError):
        ledger.read(path)


@pytest.fixture()
def ruler_copy(tmp_path):
    for name in ("ruler", "specs"):
        shutil.copytree(REPO / name, tmp_path / name, ignore=shutil.ignore_patterns("__pycache__"))
    for name in ("OBJECTIVES.md", "package.json", "package-lock.json"):
        shutil.copy(REPO / name, tmp_path / name)
    os.symlink(REPO / "node_modules", tmp_path / "node_modules")
    return tmp_path


def test_verify_passes_on_the_frozen_ruler_and_names_every_change(ruler_copy):
    assert ruler.problems(ruler_copy) == []
    (ruler_copy / "ruler" / "reference" / "claude-sidebar.json").write_text("{}")
    (ruler_copy / "specs" / "S2.3-row-menu-has-claudes-items.md").write_text("changed")
    (ruler_copy / "ruler" / "extra.py").write_text("")
    found = "\n".join(ruler.problems(ruler_copy))
    assert "reference/claude-sidebar.json" in found and "S2.3-row-menu" in found and "extra.py" in found


def test_verify_fails_when_checks_json_drifts_from_the_suite(ruler_copy):
    path = ruler_copy / "ruler" / "checks.json"
    data = json.loads(path.read_text())
    data["checks"] = data["checks"][:-1]
    path.write_text(json.dumps(data))
    found = "\n".join(ruler.problems(ruler_copy))
    assert "checks.json differs" in found and "checks.json: sha256" in found


@pytest.mark.parametrize("where", ["manifest", "checks"])
def test_verify_fails_when_the_frozen_ruler_names_another_version(ruler_copy, where):
    path = ruler_copy / "ruler" / ("manifest.json" if where == "manifest" else "checks.json")
    data = json.loads(path.read_text())
    data["ruler"] = "v1"
    path.write_text(json.dumps(data))
    found = "\n".join(ruler.problems(ruler_copy))
    assert f"names ruler 'v1'; the scorer scores {ledger.RULER!r}" in found


def test_verify_fails_with_no_manifest(tmp_path):
    assert ruler.problems(tmp_path)


def test_the_published_junit_names_no_run_dir_and_no_home():
    run_dir = Path.home() / ".cache" / "vibetracks_agent" / "x" / "runs" / "dev-1"
    fixture_home = run_dir / "home"
    text = f'<failure message="{fixture_home / "a"} and {Path.home() / "b"}">{run_dir}</failure>'
    out = evaluate.public_junit(text, run_dir)
    assert str(Path.home()) not in out and "&lt;fixture-home&gt;/a" in out and "~/b" in out
    # WHY: the fixture's HOME is <run>/home; "<run>/home/…" reads as a home path to the blackbox package's privacy check
    assert "/home/" not in out
    # WHY: the placeholder lands inside XML; a bare "<run>" made every published junit unparseable (the blackbox_agent
    # fold refused site/data/junit.xml at line 327, 2026-11-24).
    import xml.etree.ElementTree as ET
    root = ET.fromstring(f"<testcase>{out}</testcase>")
    assert root.find("failure").attrib["message"].startswith("<fixture-home>/a")


def test_a_port_is_never_one_of_zachs():
    for _ in range(20):
        assert evaluate.free_port() not in range(4390, 4398)


@pytest.mark.skipif(not (BLACKBOX / ".git").exists(), reason="~/blackbox_agent is not on this machine")
def test_the_fixture_is_seeded_dev_and_holdout_differ_and_a_seed_repeats(tmp_path):
    ref = ruler.manifest(REPO)["blackbox_agent"]["ref"]

    def build(seed, name):
        out = tmp_path / f"{name}.json"
        subprocess.run([sys.executable, str(REPO / "ruler" / "fixture.py"), "--seed", str(seed), "--home",
                        str(tmp_path / name / "home"), "--bin", str(tmp_path / name / "bin"), "--state",
                        str(tmp_path / name / "gh"), "--blackbox-repo", str(BLACKBOX), "--blackbox-ref", ref,
                        "--out", str(out)], check=True, capture_output=True)
        return json.loads(out.read_text())

    one, again, two = build(1, "a"), build(1, "b"), build(2, "c")
    assert [b["head"] for b in one["boxes"]] == [b["head"] for b in again["boxes"]]
    assert not {b["title"] for b in one["boxes"]} & {b["title"] for b in two["boxes"]}
    assert [b["activity"] for b in one["boxes"]] != [b["activity"] for b in two["boxes"]]
    for fx in (one, two):
        roles = {r for b in fx["boxes"] for r in b["roles"]}
        assert {"rollup_parent", "rollup_blocked", "rollup_working", "nosite", "top_leaf", "done_box", "chain_top"} <= roles
        blocked = next(b for b in fx["boxes"] if "rollup_blocked" in b["roles"])
        working = next(b for b in fx["boxes"] if "rollup_working" in b["roles"])
        assert (blocked["state"], blocked["agents"], working["state"], working["agents"]) == ("blocked", 2, "working", 1)
        assert sum(len(b["waits"]) for b in fx["boxes"]) == 2
        assert all(not (Path(b["path"]) / "vibetracks.toml").exists() for b in fx["boxes"])
        assert set(fx["starter_files"]) <= {p.relative_to(fx["boxes"][0]["path"]).as_posix()
                                            for p in Path(fx["boxes"][0]["path"]).rglob("*") if p.is_file()}
        # ruler v3: six package boxes, a parent with sub-tracks two levels deep; the package's workflow, no site/
        # index.html, the marker in OBJECTIVES.md (what the built landing and dashboard print) and nowhere in README
        pkg = fx["package_boxes"]
        assert len(pkg) == 6 and all(b["kind"] == "package" for b in pkg)
        parent = next(b for b in pkg if "pkg_parent" in b["roles"])
        kids = [b for b in pkg if b["parent"] == parent["slug"]]
        assert len(kids) == 2 and any(b["parent"] in {k["slug"] for k in kids} for b in pkg)
        assert sorted((b["state"], b["agents"]) for b in pkg if b["agents"]) == [("blocked", 2), ("working", 1)]
        latest = max(b["activity"] for b in fx["boxes"])
        assert all(latest < b["activity"] < fx["extra"]["activity"] for b in pkg)
        for b in pkg:
            folder = Path(b["path"])
            assert "blackbox_agent/.github/workflows/site.yml@" in (folder / ".github" / "workflows" / "pages.yml").read_text()
            assert not (folder / "site" / "index.html").exists()
            assert f"`{b['marker']}`" in (folder / "OBJECTIVES.md").read_text()
            assert b["marker"] not in (folder / "README.md").read_text()
        assert not {b["title"] for b in pkg} & {b["title"] for b in fx["boxes"] + [fx["extra"]]}
    assert [b["head"] for b in one["package_boxes"]] == [b["head"] for b in again["package_boxes"]]
    # the v2 boxes are byte-identical to v2's: the package boxes draw from their own random stream
    assert [b["head"] for b in one["boxes"]][:3] == V2_DEV_HEADS


def test_progress_writes_status_and_progress_from_the_ledger(tmp_path):
    """status.json's headline kpi is open_ms (down, target 100 ms) and its counter_kpi shall_failing (PEP 0003)."""
    shutil.copytree(REPO / "specs", tmp_path / "specs")
    (tmp_path / "solutions" / "s").mkdir(parents=True)
    (tmp_path / "solutions" / "s" / "meta.json").write_text(json.dumps({"id": "s", "change": "base", "proposed_by": {}}))
    ledger.append(row("s", 17, 1290, 4, 90, admissible=True, open_ms=1287.5), tmp_path / "ledger.jsonl")
    changed = progress.write_all(tmp_path, now_s=1.0)
    assert {p.name for p in changed} == {"PROGRESS.md", "status.json"}
    status = json.loads((tmp_path / "status.json").read_text())
    assert status["schema"] == "ai-team-status/1"
    assert (status["kpi"]["value"], status["kpi"]["unit"], status["kpi"]["direction"], status["kpi"]["target"]) == (1287.5, "ms", "down", 100)
    assert status["kpi"]["name"].startswith("open_ms")
    assert status["counter_kpi"]["value"] == 17 and "must be 0" in status["counter_kpi"]["name"]
    text = (tmp_path / "PROGRESS.md").read_text()
    assert "`s`" in text and "| open ms |" in text and "`open_ms` 1,288 ms" in text
    assert progress.write_all(tmp_path, now_s=2.0) == []


def test_the_published_scorecard_names_no_run_dir_and_no_home():
    run_dir = Path.home() / ".cache" / "vibetracks_agent" / "x" / "runs" / "dev-1"
    card = json.dumps({"message": f"vt add {run_dir / 'home' / 'kestrel_agent'} exited 1", "other": str(run_dir)})
    out = evaluate.public_text(card, [run_dir])
    assert str(Path.home()) not in out and "/home/" not in out
    assert json.loads(out) == {"message": "vt add <fixture-home>/kestrel_agent exited 1", "other": "<run>"}


def test_progress_ranks_the_current_ruler_and_lists_an_earlier_one_apart(tmp_path):
    """A v1 row is kept and labelled, never compared against v2 (OBJECTIVES §11): it is on no leaderboard, it is not
    the KPI, and the evaluations table says which ruler each row ran."""
    shutil.copytree(REPO / "specs", tmp_path / "specs")
    for sid in ("old", "new"):
        (tmp_path / "solutions" / sid).mkdir(parents=True)
        (tmp_path / "solutions" / sid / "meta.json").write_text(json.dumps({"id": sid, "change": sid, "proposed_by": {}}))
    ledger.append(row("old", 13, 2, 42, ruler_version="v1", t="2026-11-25T01:00:00Z"), tmp_path / "ledger.jsonl")
    ledger.append(row("new", 14, 2, 50, t="2026-11-25T02:00:00Z"), tmp_path / "ledger.jsonl")
    progress.write_all(tmp_path, now_s=1.0)
    text = (tmp_path / "PROGRESS.md").read_text()
    status = json.loads((tmp_path / "status.json").read_text())
    assert status["counter_kpi"]["value"] == 14 and f"ruler {ledger.RULER}" in status["kpi"]["name"]
    assert "of 23" in status["counter_kpi"]["name"]
    board = text.split("## Leaderboard (dev)", 1)[1].split("\n## ", 1)[0]
    assert "`new`" in board and "`old`" not in board
    earlier = text.split("## Earlier rulers", 1)[1].split("\n## ", 1)[0]
    assert "`old`" in earlier and "v1" in earlier and "`new`" not in earlier
    last = text.split("## Last 10 evaluations", 1)[1]
    assert "| ruler |" in last and "| v1 |" in last and f"| {ledger.RULER} |" in last
    assert f"Ruler {ledger.RULER}" in text
