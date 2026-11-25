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


def row(sid, objective, tiebreak=0, tiebreak2=0, admissible=True, rate=1.0, t="2026-11-24T00:00:00Z", split="dev"):
    return {"t": t, "solution": sid, "parent": None, "split": split, "ruler": "v1", "objective": objective,
            "tiebreak": tiebreak, "tiebreak2": tiebreak2, "admissible": admissible, "gate_pass_rate": rate,
            "failed_gates": {}, "diagnostics": {}, "wall_time_s": 1.0, "repo_commit": None, "vibetracks_sha": "x",
            "proposed_by": {"agent": "a", "model": "m"}, "change": "c", "task_objectives": {}}


def test_rank_is_shall_then_should_then_checks_admissible_first():
    rows = [row("a", 3, 1, 9), row("b", 3, 1, 5), row("c", 2, 4, 50), row("d", 0, 0, 0, admissible=False, rate=0.5),
            row("e", math.nan, 0, 0), row("f", 3, 0, 99)]
    assert [r["solution"] for r in ledger.rank(rows)] == ["c", "f", "b", "a", "e", "d"]
    assert ledger.best(rows)["solution"] == "c"
    assert ledger.best([row("d", 0, admissible=False)]) is None


def test_latest_keeps_the_newest_row_per_solution_and_split():
    rows = [row("a", 5, t="2026-11-24T01:00:00Z"), row("a", 4, t="2026-11-24T02:00:00Z"), row("a", 9, split="holdout")]
    newest = ledger.latest(rows)
    assert [(r["split"], r["objective"]) for r in newest] == [("dev", 4), ("holdout", 9)]


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


def test_progress_writes_status_and_progress_from_the_ledger(tmp_path):
    shutil.copytree(REPO / "specs", tmp_path / "specs")
    (tmp_path / "solutions" / "s").mkdir(parents=True)
    (tmp_path / "solutions" / "s" / "meta.json").write_text(json.dumps({"id": "s", "change": "base", "proposed_by": {}}))
    ledger.append(row("s", 17, 4, 90, admissible=True), tmp_path / "ledger.jsonl")
    changed = progress.write_all(tmp_path, now_s=1.0)
    assert {p.name for p in changed} == {"PROGRESS.md", "status.json"}
    status = json.loads((tmp_path / "status.json").read_text())
    assert status["schema"] == "ai-team-status/1" and status["kpi"]["value"] == 17 and status["kpi"]["target"] == 0
    assert "`s`" in (tmp_path / "PROGRESS.md").read_text()
    assert progress.write_all(tmp_path, now_s=2.0) == []


def test_the_published_scorecard_names_no_run_dir_and_no_home():
    run_dir = Path.home() / ".cache" / "vibetracks_agent" / "x" / "runs" / "dev-1"
    card = json.dumps({"message": f"vt add {run_dir / 'home' / 'kestrel_agent'} exited 1", "other": str(run_dir)})
    out = evaluate.public_text(card, [run_dir])
    assert str(Path.home()) not in out and "/home/" not in out
    assert json.loads(out) == {"message": "vt add <fixture-home>/kestrel_agent exited 1", "other": "<run>"}
