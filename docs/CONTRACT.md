# Contract: files, schemas, CLI, the stage, write sets

The frozen interface of this box. [`OBJECTIVES.md`](../OBJECTIVES.md) says *what* is scored (§7 the stage, §8 the score, §1-§5 the
spec); this file says *how the repo and the acceptance run are shaped*. Changing a schema, a CLI verb or the stage
here is a barrier: land it alone, first; changing anything under [`ruler/`](../ruler/) is a new ruler version (OBJECTIVES §11).

Format: the standard black-box agent repo (blackbox_agent README, reference implementations `claude_party_agent` and
`trajectory_tracking_agent`). As in claude_party_agent, **the product is the solution**: a solution is a Vibe Tracks
commit ([`~/vibetracks`](https://github.com/zacharyyamaoka/vibetracks)), never code in this repo; a winner graduates by landing on vibetracks `main`.

## 1. Files

| Path | Written by | Notes |
|---|---|---|
| [`OBJECTIVES.md`](../OBJECTIVES.md), `specs/*.md` | Zach + dispatcher | the ruler, frozen (v3 since 2026-11-25, v2 and v1 before it; OBJECTIVES §11); sha256s in [`ruler/manifest.json`](../ruler/manifest.json) |
| [`ruler/manifest.json`](../ruler/manifest.json) | [`tools/freeze_ruler.py`](../tools/freeze_ruler.py), once per ruler version | sha256 of every file under [`ruler/`](../ruler/), of [`OBJECTIVES.md`](../OBJECTIVES.md) and each spec note, of [`package.json`](../package.json) + [`package-lock.json`](../package-lock.json); the frozen refs (blackbox_agent, vibetracks baseline, claude-hub, Playwright) |
| [`ruler/checks.json`](../ruler/checks.json) | [`tools/freeze_ruler.py`](../tools/freeze_ruler.py) | every check the suite runs (`node ruler/suite/run.mjs --list`); a check missing from a run counts as failing |
| [`ruler/fixture.py`](../ruler/fixture.py), [`ruler/stage.py`](../ruler/stage.py), `ruler/suite/**` | frozen | the acceptance run (§5 below) |
| [`ruler/reference/claude-sidebar.json`](../ruler/reference/claude-sidebar.json) | frozen | S2.2's reference values, each with where it was measured, and the unmeasured list |
| [`ruler/reference/stock-trees.json`](../ruler/reference/stock-trees.json) | frozen | S2.8's stock tree packages (npm name, URL patterns, content markers) |
| [`ruler/reference/box-components.json`](../ruler/reference/box-components.json) | frozen | S3.2's element a box's own site uses for its waits (`bb-needs-you`) |
| [`package.json`](../package.json), [`package-lock.json`](../package-lock.json) | frozen | Playwright 1.64.1, installed with `npm ci` (its Chromium headless shell 1248 in `~/.cache/ms-playwright`) |
| [`ledger.jsonl`](../ledger.jsonl) | `vta evaluate` only; append-only | |
| [`solutions/<id>/meta.json`](../solutions/) | `vta new` | |
| [`solutions/<id>/scorecard.json`](../solutions/), `scorecard_holdout.json`, `junit-dev.xml`, `junit-holdout.xml` | `vta evaluate` only | junit with run dirs and the home path replaced (`<run>`, `<work>`, `~`) |
| [`site/data/junit.xml`](../site/data/junit.xml) | `vta evaluate --split dev` only | the latest dev run's junit, for the Spec tab |
| [`PROGRESS.md`](../PROGRESS.md), [`status.json`](../status.json) | **generated** by `vta progress` (and after every `vta evaluate`); never hand-edited | |
| `src/vibetracks_agent/**`, `tests/**`, `tools/**`, [`pyproject.toml`](../pyproject.toml), [`uv.lock`](../uv.lock) | the scorer | stdlib only at runtime; pytest for tests |

## 2. Package `vibetracks_agent`

Environment (all optional): `VTA_VIBETRACKS` (default [`~/vibetracks`](https://github.com/zacharyyamaoka/vibetracks); read by `git archive` / `rev-parse` / `show`
only), `VTA_BLACKBOX` (default [`~/blackbox_agent`](https://github.com/zacharyyamaoka/blackbox_agent_lab); `git archive` / `show` only), `VTA_WORK` (default
`~/.cache/vibetracks_agent`: scratch trees and runs), `VTA_REPO`, `PLAYWRIGHT_BROWSERS_PATH`, `VTA_AGENT`,
`VTA_MODEL`, `VTA_SESSION`.

```python
from vibetracks_agent import specs, scoring, ledger, ruler, evaluate

specs.load_items(specs_dir) -> [SpecItem(id, kind, tests, title, path)]     # front matter of specs/S*.md
scoring.parse_junit(text) -> {check id: Case} | None                         # None: no readable junit at all
scoring.case_id(classname, name) -> "ruler/suite/<group>.py::S2.3 …"         # the viewer's reading (dots -> path + .py)
scoring.matches(check_id, patterns) -> bool                                  # a note's tests: patterns, fnmatch
scoring.expected_checks(ruler/checks.json) -> [check id]
scoring.score(items, expected, [RunResult(junit, finished, timed_out, wall_s)]) -> dict   # §3 scorecard fields
ledger.read / append / latest / rank(rows, split, ruler=RULER) / best / rulers   # rank and best: one ruler's rows only
ruler.problems(root) -> [str]                                                # [] = the ruler is intact
evaluate.evaluate(id, split="dev", runs=2, with_vt_gate=False) -> scorecard
```

## 3. Schemas

**The score** (OBJECTIVES §8, `scoring.score`), fail closed everywhere:

- a check passes in a run only when its junit testcase is there with no `failure`, `error` or `skipped`;
- an item is **met** only when at least one check in [`ruler/checks.json`](../ruler/checks.json) matches its note's `tests:` patterns and every
  one of those checks passed in **every** run of the split (both dev runs); an item whose note lists no test (S5.1),
  or whose pattern matches no check, is failing;
- a run that did not exit 0, ran out of time (1200 s), has no wall time, or left no readable junit passes nothing;
- `shall_failing` / `should_failing` = items not met of each kind; `checks_failing` = checks in [`ruler/checks.json`](../ruler/checks.json)
  not passed in every run;
- `completed` = the first run exited 0 within 1200 s and its junit has a pass or a fail for every check (missing,
  `skipped` or `error` = not completed); `deterministic` = a second run, also completed, agrees with the first check by
  check on passed / not passed. `admissible` = both exactly `true`.

**scorecard.json** (`vta evaluate`; `scorecard_holdout.json` for holdout):
`{solution, split, ruler: "v3" (the ruler it ran, ledger.RULER), objective (= shall_failing), objective_name: "shall_failing", tiebreak
(= open_ms rounded to 10 ms, `ledger.tenth`), tiebreak_name, tiebreak2 (= should_failing), tiebreak2_name, tiebreak3
(= checks_failing), tiebreak3_name, open_ms, open_ms_unit: "ms", open_ms_target: 100, shall_failing, shall_total,
should_failing, should_total, checks_failing, checks_total, admissible, gate_pass_rate, gates: {completed,
deterministic}, failed_gates: {completed: 0|1, deterministic: 0|1}, diagnostics: {shall_passing,
sidebar_style_props_off, sidebar_style_props_measured, page_ready_ms, vt_gate_failed, wall_time_s, checks_total,
registration, stock_tree, open_ms_runs, open_ms_spread, open_cold_p50, open_warm_p50, open_p50_by_kind, open_p95,
open_p95_runs, open_max, opens, opens_failed, requests_per_open, bytes_first_open, bytes_later_open, builds_waited,
page_crashes}, tasks: [{id, kind, title, met, why, checks: [{id, name, states: [per run], passed,
message}], failed_checks: [names]}], task_objectives: {spec id: 0 met | 1 not met}, vibetracks_sha,
vibetracks_committed, seed, evaluated, wall_time_s, runs: [{n, exit, timed_out, wall_s, junit, network, reaped_pids,
groups, speed}], code: {ruler, blackbox_agent_ref, playwright, repo_commit}}`. A run's `speed` is the speed group's
report ([`ruler/suite/groups/speed.mjs`](../ruler/suite/groups/speed.mjs)): its definition (thresholds, times, viewport), the `vt add`s, the two commits,
every open `{round, phase: cold|warm, box, kind: package|files|readme, ms (null: not shown within 10 s), requests,
bytes, builds, why}`, its statistics and a per-box table.

- `sidebar_style_props_off` = S2.2 checks not passed in the first run, of `sidebar_style_props_measured` (the measured
  properties × themes in [`ruler/reference/claude-sidebar.json`](../ruler/reference/claude-sidebar.json)); `page_ready_ms` = load to the first click on the
  sidebar's Review row that changes the address (first run); `vt_gate_failed` = failures of vibetracks' own
  `pytest tests` on the tree when `--vt-gate` ran it, else null.
- `open_ms` (ruler v3, OBJECTIVES §8, `evaluate.speed_summary`) = the median of every package box's open of both
  dev runs pooled, an open never shown counting 10 000 ms; null unless every run has a speed report with opens. The
  `open_*` diagnostics pool the runs the same way (`open_ms_runs`: each run's own value; `open_p95` and `open_max`:
  every kind's opens).

**ledger.jsonl row:** `{t, solution, parent, split: "dev"|"holdout", ruler: "v1"|"v2"|"v3", objective, tiebreak,
tiebreak2, tiebreak3, open_ms, should_failing, checks_failing, admissible, gate_pass_rate, failed_gates, diagnostics,
wall_time_s, repo_commit, vibetracks_sha, proposed_by: {agent, model, session}, change, task_objectives}`. Up to v2 a
row has two slots (tiebreak = should_failing, tiebreak2 = checks_failing) and none of the named fields; since v3,
tiebreak = open_ms rounded to 10 ms, tiebreak2 = should, tiebreak3 = checks (the blackbox_agent fold ranks equal
objectives by the slots in this order); `ledger.named(row, key)` reads should, checks and open_ms from a row of any
ruler. Rank (`ledger.rank`): admissible rows first by (objective, tiebreak, tiebreak2, tiebreak3) ascending; then the
rest by gate pass rate descending and the same; a missing number sorts last.
It ranks one ruler's rows (default the current one, `ledger.RULER`): a row scored on another ruler is kept, labelled
with the ruler it names, listed apart in [`PROGRESS.md`](../PROGRESS.md) ("Earlier rulers") and never compared with the current one; `vta verify`
fails when [`ruler/manifest.json`](../ruler/manifest.json) or [`ruler/checks.json`](../ruler/checks.json) names another ruler than the scorer's.

**meta.json:** `{id, parent, change, vibetracks_sha, vibetracks_ref, vibetracks_committed, proposed_by: {agent,
model, session}, created, tags: []}`. `vta new` refuses without `--agent` and `--model`, an existing id, an unknown
parent, or a ref ~/vibetracks cannot resolve.

**status.json:** `ai-team-status/1` (shape as claude_party_agent's), for the best admissible version (else the top of
the board, named "not admissible"): `kpi` = `open_ms` (ruler v3), unit ms, direction down, target 100; `counter_kpi` =
that version's shall items failing of 23, which must be 0. WHY (PEP 0003): Zach asked for the open speed as the
objective he tracks; shall_failing stays the ranked objective. `todo` from [`ideas.md`](../ideas.md)'s `## I'll try`.

**junit:** one XML per run, `<testsuites>` with one `<testsuite name="ruler.suite.<group>">` per group; each
`<testcase classname="ruler.suite.<group>" name="S<id> <what>">` with a `<failure message>` (what it looked for and
what it found) or an `<error message>` (it crashed, its group could not start, ran out of its budget (240 s; the speed
group 420 s), or never reached it). Its id is [`ruler/suite/<group>.py::S<id> <what>`](../ruler/suite/), so a note's `tests: "*::S2.3 *"` matches it.

**fixture.json** ([`ruler/fixture.py`](../ruler/fixture.py), in each run dir): `{schema: "vibetracks-agent/fixture-1", seed, home, person,
boxes: [{title, slug, parent, state, agents, roles, waits, feedback, site, activity, marker, readme_marker, path,
head}] (parents first), extra (S1.5's unlisted box), package_boxes (ruler v3: six boxes like `boxes`' plus
`kind: "package"`, roles `package` and `pkg_parent` / `pkg_child` / `pkg_blocked` / `pkg_grandchild` / `pkg_leaf`, a
marker that is their OBJECTIVES.md objective name; not in the tree handed over), plain_folder, s15_parent, new_titles,
section_name, starter_files, blackbox: {path, ref, head}, gh: {path, log, state, remotes}, track_naming}`.

## 4. CLI `vta`

Run as `uv run --directory ~/vibetracks_agent vta <verb>`.

| Verb | Does |
|---|---|
| `vta verify` | every sha256 in [`ruler/manifest.json`](../ruler/manifest.json) (ruler files, OBJECTIVES.md, spec notes, the Playwright pin); [`ruler/checks.json`](../ruler/checks.json) equals `node ruler/suite/run.mjs --list`; `node_modules/playwright` installed; every ledger row parses and names a solution with a meta.json. Non-zero exit on any problem |
| `vta new <id> --ref <ref> --change "…" --agent A --model M [--parent P] [--session S] [--tags a,b]` | writes [`solutions/<id>/meta.json`](../solutions/) |
| `vta evaluate <id> [--split dev\|holdout] [--runs 2] [--timeout 1200] [--vt-gate] [--only S2.3,…] [--no-progress]` | the acceptance run (§5), `--runs` times; the scorecard, the junit copies, one ledger row, then `vta progress`. Refuses when `vta verify` would fail. `--only` is for debugging a check: its scorecard fails every unselected check (fail closed) |
| `vta progress` | [`PROGRESS.md`](../PROGRESS.md), [`status.json`](../status.json) |
| `vta leaderboard [--n N] [--split dev\|holdout] [--ruler v1]` | the ranked table of one ruler's rows (default the current), with `open_ms` |
| `vta speed --base <url> [--rounds 2] [--vt-home DIR] [--json]` | [`tools/speed.mjs`](../tools/speed.mjs): S1.6's timer against a running `vt serve` (Zach's Preview: `http://127.0.0.1:4396/`). Read-only: it starts nothing, and its own headless browser clicks track rows only; it counts any non-GET request it sees. Prints `open_ms` and a per-track table (first open, p50, p95, requests, bytes). Its marker is each track's title inside a frame of the main pane, so a README fallback counts there |

## 5. The stage (one acceptance run)

`vta evaluate` → `git archive <sha>` of ~/vibetracks into `~/.cache/vibetracks_agent/<id>/tree` → per run, inside a
loopback-only network namespace (`unshare -rn`, `lo` up; nothing reaches the network or any server outside it, Zach's
Stable and Preview included) and killed at 1200 s: `python3 ruler/stage.py run` →

1. **Fixture** (`ruler/fixture.py --seed 1|2`) into `<run>/home`, a temporary HOME holding nothing else. Each box is a
   git repo with one commit dated at its activity time; where each fact lives, all in the box's own format:

   | Fact | Where in the box |
   |---|---|
   | title | [`README.md`](../README.md)'s first heading (and status.json `member`) |
   | state (`working`, `blocked`, `idle`, `done`) | [`status.json`](../status.json) (`ai-team-status/1`) `status` |
   | agents working | `agents/<name>.md` with front matter `status: working` (the format's agents/ folder) |
   | waits | [`ideas.md`](../ideas.md) `## Suggestions for Zach` lines, mirrored in `site/data/state.json` `needs` |
   | feedback | [`feedback/<date>-<token>.md`](../feedback/) (front matter, a `# ` title, a body with `(note <token>)`) |
   | activity time | commit date, [`status.json`](../status.json) `updated_t`, the ledger row's `t`, every file's mtime |
   | site | `site/index.html` with a marker line (one box has no [`site/`](../site/); its README carries its own marker line) |

   Also: [`~/blackbox_agent`](https://github.com/zacharyyamaoka/blackbox_agent_lab) (README.md, template/, tools/apply_template.py at the frozen ref, a git repo), `~/.gitconfig`
   (a fixture person), one box not in the tree (S1.5), a plain folder, and a fake `gh` first on PATH that logs its
   arguments (`<run>/gh/gh-calls.jsonl`), reads signed in/out from `<run>/gh/gh-state`, and for `repo create` makes a
   local bare repo (pushing to it with `--push`).
2. **vt**: `<run>/bin/vt`, a shim running the tree's own `[project.scripts] vt` with the tree on PYTHONPATH and
   `/usr/bin/python3`.
3. **Environment** of every process of the version (`<run>/env.json`): nothing inherited; HOME, XDG_*_HOME and TMPDIR
   inside the run; PATH = `<run>/bin:/usr/bin:/bin`; LANG C.UTF-8; TZ UTC.
4. **The tree handed over**, by the first way the version's CLI takes (`<run>/registration.json`):
   a. `vt add <box folder> [--parent <parent's folder name>]` per box, parents first, when `vt add --help` exits 0;
   b. else, a version from before the Nov 24 design (`vt new <space> <id> --title …`): `vt init --no-scan` and
      `vt new home <id> --title <box title> [--parent <id>]` per box (ids = folder names with `-`), so its sidebar
      holds the boxes' titles in the boxes' tree; it has no notion of a box, so every box check still fails on it;
   c. else nothing, and every check that needs a track row fails saying it found none.
   **A track is named on the command line by its box folder's basename** (`--parent kestrel_grasp_agent`).
5. `<run>/pristine` = HOME as it then stands.
6. **The suite** (`node ruler/suite/run.mjs`, Playwright 1.64.1, headless Chromium 1400×900): 15 groups (v2 adds
   [`pause`](../ruler/suite/groups/pause.mjs), v3 [`fold`](../ruler/suite/groups/fold.mjs), [`search`](../ruler/suite/groups/search.mjs) and [`speed`](../ruler/suite/groups/speed.mjs), each run after every group before it, which run exactly as in
   their own ruler; fold and speed hand the version the six package boxes and the extra box with `vt add` and restart
   `vt serve`, and speed opens its own fresh browser); before each,
   `vt serve` is stopped, HOME is put back from pristine/, `vt serve --port 4811` (inside the namespace; a free port
   outside 4390-4397 when no namespace) is started detached and stopped by its pid's process group, and a new browser
   context opens the page. The page is read as a person sees it: visible text, ARIA roles, measured boxes and computed
   styles; never a class name or test id of one version. Pointer and keys are real Playwright events. After each run
   the evaluator stops any recorded pid still alive whose command line or environment names the run dir.

## 6. Write sets

| Lane | Writes | Never touches |
|---|---|---|
| dispatcher | [`OBJECTIVES.md`](../OBJECTIVES.md), [`specs/`](../specs/), [`README.md`](../README.md), [`AGENTS.md`](../AGENTS.md), [`ideas.md`](../ideas.md), [`REFERENCES.md`](../REFERENCES.md), [`feedback/`](../feedback/), [`site/`](../site/) (except [`site/data/junit.xml`](../site/data/junit.xml)), [`docs/`](./) (except this file) | — |
| ruler + scorer (this lane) | [`ruler/`](../ruler/), [`src/vibetracks_agent/`](../src/vibetracks_agent/), [`tests/`](../tests/), [`tools/`](../tools/), [`pyproject.toml`](../pyproject.toml), [`uv.lock`](../uv.lock), [`package.json`](../package.json), [`package-lock.json`](../package-lock.json), [`docs/CONTRACT.md`](CONTRACT.md) | [`OBJECTIVES.md`](../OBJECTIVES.md), [`specs/`](../specs/) |
| evaluator (the CLI) | [`ledger.jsonl`](../ledger.jsonl), `solutions/*/scorecard*.json`, `solutions/*/junit-*.xml`, [`site/data/junit.xml`](../site/data/junit.xml), [`PROGRESS.md`](../PROGRESS.md), [`status.json`](../status.json) | [`ruler/`](../ruler/), a `meta.json` it did not create |
| Vibe Tracks | nothing here | — (this repo only `git archive`s ~/vibetracks) |

## 7. Deviations from the spec notes

Where a note's "How it is checked" was impossible or ambiguous as written, the closest honest measurement, frozen in v1:

1. **How the version gets the tree (§7 "a parent tree").** Vibe Tracks owns its tree file (S1.3), so the ruler never
   writes one: it hands the tree over through the version's own CLI (§5 step 4). A version with `vt add` gets every box
   that way; the pre-Nov-24 CLI gets tracks with the boxes' titles (not linked to the boxes); a version with neither
   gets no tree.
2. **What names a track on the command line** (`--parent <track>`, `--from <track>`; S1.5, S4.1-S4.4): not said
   anywhere; the ruler uses the box folder's basename. The address bar "names the track" (S1.1) when it contains the
   folder name, its dashed form, or the title (raw or dashed).
3. **S1.1, a box with no [`site/`](../site/) "shows its README's first heading":** the heading *and* a marker line from the same
   README must be on screen right of the sidebar; a page that only names the track shows the title too.
4. **S1.2, "after a scripted run of every sidebar verb":** each verb (drag onto a row, Pin, Rename, Archive, Move to
   section into a section made by New section, Delete with its confirmation) must be found and visibly take effect,
   or the git-status and file-name checks fail on that precondition: with no verbs run, untouched boxes prove
   nothing. The dropped `vibetracks.toml` check stands alone (6 s, sidebar text and tree unchanged; the file is removed
   after).
5. **S1.3, "editing that file by hand (moving one entry under another)":** the file's format is the version's own, so
   the ruler cannot edit an entry. "The file that changed" = every file under HOME that a drag onto a row changed,
   minus those that changed in a 2.5 s quiet window before it; the hand edit = writing those files' bytes from before
   the drag back, which moves the dragged row back from under its new parent. Pass: the row is no longer under it
   within 5 s, with no reload.
6. **S1.4, "the sidebar's scroll position is the same":** the window is 1400×420 so the sidebar can scroll; it is
   scrolled 40 px after the box opens. If it still cannot scroll, that part compares 0 with 0.
7. **S1.5, "names what is missing" / "the tree file is unchanged":** the message names a box file (README.md,
   OBJECTIVES.md, AGENTS.md, ledger.jsonl, status.json, specs/, feedback/); no file outside the boxes changes, other
   than those that change in a 2.5 s quiet window and logs.
8. **S2.1, "Feedback (with its open count)":** the Feedback row shows the number of the fixture's feedback notes (all
   open). "Each one opens its page": Home, Review and Feedback each go to a distinct address; New track opens a
   dialog or a page.
9. **S2.2:** references from Claude Desktop 3.6556.1's stylesheet tokens and measurements (claude-hub
   `docs/sidebar-controls.yaml`) and Zach's Nov 24 screenshots (scale 1.44), all dark; the font family from the B2
   report (Desktop 2.9939.4). Light-theme colours, text colours and weights, header box, dot colours per state and menu
   geometry have no measured value and are not checked (`unmeasured` in the reference). Geometry is checked in both
   themes (density tokens are not theme-scoped), colours in dark only. "Row height" = the hovered row's painted pill;
   "pitch" = two adjacent top-level rows; fills = the composited background at a point inside the pill, off its text.
   The status dot's size is measured wherever it is in a plain row (3.6556.1 draws it at the right end; S2.9 asks for
   the leading slot).
10. **S2.3:** "Mark as unread / read" either spelling (it depends on the row's state); Fork passes when a new row naming
    the source appears or a dialog opens within 10 s (its confirmation); Delete's confirmation dialog is confirmed
    with its Delete button. Separators, red Delete and the shortcut letters' display are in the note's meaning, not in
    its "How it is checked", so are not checked beyond the letters running their items. The first row and a middle
    row are taken from the sidebar as shown.
11. **S2.4, "at the pointer (within 4 px)":** the menu's nearest corner within 4 px of the right-click; "never the
    browser's own menu" = the contextmenu event is default-prevented.
12. **S2.5, "in pin order":** the first pinned sits on top.
13. **S2.6 / S2.7:** the view button is the sidebar control above the tracks named filter/view/group/sort/display/
    options (after hovering the list header). Flat by recent: every track not done must be listed (Show may hide done
    ones); State grouping: each row's nearest header above reads its state word (working also as running/active).
    "Switching back and forth keeps the selection" = the selected row keeps its fill and the address its value through
    Group by None then Parent.
14. **S2.8:** drags are real pointer drags in 14 steps; the reorder drops the last top-level leaf (as shown) between the
    first two; the drop indicator = a new bar ≤ 4 px tall and ≥ 40 px wide within 12 px of the drop point mid-drag;
    "refused" and "survives a restart" require that drags work at all (else no drag reads as a refusal). The keyboard
    path tries Alt+↑, Ctrl+Shift+↑, Meta+↑, Headless Tree's Ctrl+Shift+D ↑ ↑ Enter, and the row menu's Move up from
    Shift+F10; one is enough. The stock tree = a package of [`ruler/reference/stock-trees.json`](../ruler/reference/stock-trees.json) named in the URL of a
    script the page loaded, or ≥ its `min_markers` string literals in one.
15. **S3.1, "its presets":** Active, Done, All tracks must sit inside the `data-views` element, left to right on one line.
16. **S3.2, "the component's element is the same one the box's own site uses":** the waits sit inside
    `<bb-needs-you>` (the blackbox_agent viewer at the frozen ref). "Opening an item opens it in its box's page" = the
    address names the track or the box's marker shows.
17. **S3.3, adding feedback:** a New/Add button in the main pane, a select or combobox offering the target box, a text
    field, a submit button (or Ctrl+Enter); then exactly one new file under that box's [`feedback/`](../feedback/) and no other change
    in any box.
18. **S3.4:** "agents working" are the box format's `agents/<name>.md` with `status: working` (ai-team-status/1 has no
    agent count). The pip = a label in the parent's row naming "blocked", or more round dots than a leaf row of the
    parent's own state; "3 agents" = a "3" badge in the parent's sidebar row or "3 (agents)" in its Home row.
19. **S4.1:** `--dir` is not exercised (it could name the box folder or the folder that holds it). "The folder" = the
    one new git repo under HOME (two levels deep). The blackbox_agent ref has no single starter folder, so "the starter
    box's file set" = its README format table's files (README.md, OBJECTIVES.md, AGENTS.md, PROGRESS.md, ledger.jsonl,
    ideas.md, REFERENCES.md, status.json) plus template/'s files a box copies (.github/workflows/pages.yml,
    site/nav.json, tests/test_readme_landing_link.py).
20. **S4.2, "the command text equals the expected string":** `vt new "<name>"`, then `… --parent <folder name>`, then
    `… --publish`, whitespace normalised. Create is pressed with Publish off; "the same box the command makes" = a git
    repo whose README heading is the name, with one commit.
21. **S4.3, signed out "no folder made":** no new git repo and no new folder in HOME whose name contains the title.
22. **Holdout:** run twice like dev; its `deterministic` gate is its own two runs; [`site/data/junit.xml`](../site/data/junit.xml) is written
    from dev runs only.
23. **S5.1** lists no test, so it is failing in every v1 and v2 score: `should_failing` is at least 1 until a ruler
    version gives it a check.

Added in ruler v2 ([PEP 0002](peps/0002-ruler-v2-pause-resume.md); S2.10's checks are in
[`ruler/suite/groups/pause.mjs`](../ruler/suite/groups/pause.mjs), S2.3's `Z` in [`ruler/suite/groups/menu.mjs`](../ruler/suite/groups/menu.mjs)). Where PEP 0002's table
leaves a measurement open, the closest honest one, frozen in v2:

24. **S2.3, Pause / Resume in the list:** either spelling passes the order check (the row's state decides; S2.10
    checks which one shows). `Z` runs on a track no other letter touched (else U's): with the menu open, `Z`, then the
    menu reads Resume; `Z` again, then it reads Pause.
25. **S2.10, the tree file and the record:** the file is `$VT_HOME/tree.json`, else `~/.vibetracks/tree.json` under the
    run's HOME ([vibetracks PEP 0024](https://github.com/zacharyyamaoka/vibetracks-dev/tree/main/docs/peps) §2); the entry
    is the one whose `id` is the box folder's basename or whose `path` is the box's folder; no `status` key reads as an
    empty list. A record passes with `status`, an `at` that parses as a time within an hour of the run, `by.person` =
    the machine's person (the fixture person), `by.via` = `page` from the page and `cli` from `vt`; a person's record
    has none of `agent`, `model`, `sid`, `account`; `why` only from `--why`, byte for byte (the texts carry quotes, a
    colon and a non-ASCII letter). Each verb must add exactly one record. Resume's record reads `active`, the value
    PEP 0024 §2 names (PEP 0002's examples show only `paused`). A track never paused passes when its latest record, if
    any, is not `paused` (PEP 0002 does not forbid an initial `active` record).
26. **S2.10, "`vt pause` run inside an agent's session":** the stage runs in no agent session (§5 step 3), so for that
    one run the ruler sets Claude Code's own session variable `CLAUDE_CODE_SESSION_ID` (what vibetracks'
    `core/records.py` `agent_session()` reads through its claude-code adapter, the way a real session is seen). Pass =
    `by.agent` set and `by.sid` naming that id. No transcript is staged, so `model` is not required. "The caller
    can't" (stamp it) is not measured: no generic forgery to try.
27. **S2.10, "a pause glyph in the status-dot slot":** the slot = the centre of the row's status dot while active
    (S2.9's reading: round, painted, 3-12 px, left of the title), measured before the pause; with no dot, anywhere left
    of the title. A glyph = a visible element at most 24 px, centred within 8 px of the slot and left of the title,
    that is (a) a pause character (⏸ ‖ ❚ ▮ `||`, as text or a `::before`/`::after` content) in a colour that is not
    transparent, (b) an icon whose `aria-label`, `title` or SVG `<title>` says paused, or (c) two painted vertical bars
    (each 1-6 px wide, 4-16 px tall and at least 1.6× as tall as wide, level within 1.5 px, 0.5-6 px apart). A glyph the
    active row already shows there marks no pause, and fails.
28. **S2.10, "a muted title":** the title's WCAG contrast with what is painted behind it (its colour's alpha and every
    `opacity` and `filter: opacity()` above it applied) is at most 85 % of the same row's contrast while active, both
    measured with the pointer off the row. **Resume returns the state colour:** the dot at the slot again with its
    colour within 3 per channel of before, no pause glyph, the title's contrast within 5 % of before.
29. **S2.10, "survives a reload and a `vt serve` restart":** after `page.goto`, and after `vt serve` is stopped and
    started: the glyph, the muted title, the ··· menu reading Resume and the latest record `paused`.
30. **S2.10, "CLI then page agree within one tick":** 5 s with no reload (the window S1.3 and S4.4 give a file change;
    a reload = a marker set on `window` before the verb is gone): after `vt pause`, the row's pause glyph and its ···
    menu reading Resume; after `vt resume --why`, no glyph and the menu reading Pause.
31. **S2.10, "pausing changes nothing in the box":** every fixture box's files (each one's sha256, `.git` aside),
    `git status --porcelain` and HEAD, before the group's first verb and after its last; it needs a `paused` record to
    have been written, else nothing was proved (as S1.2's deviation 4).
32. **S2.10's tracks:** the page's is the fixture's `rollup_working` box; the shell's and the agent's are the first two
    other open leaf boxes with a site, in fixture order.

Added in ruler v3 ([PEP 0003](peps/0003-ruler-v3-open-speed-and-fold.md); S1.6's checks are in [`ruler/suite/groups/speed.mjs`](../ruler/suite/groups/speed.mjs) with the timer
in [`ruler/suite/timer.mjs`](../ruler/suite/timer.mjs), S2.9's new ones in [`ruler/suite/groups/fold.mjs`](../ruler/suite/groups/fold.mjs)). The closest honest measurement where his words or
the PEP leave one open, frozen in v3:

33. **S1.6, "the box's own page":** a files box's site marker, a package box's objective name (its built landing and
    dashboard both print it near the top), the README marker for the box with no site. The marker must be visible
    inside the frame's viewport (1400×900 page), so a version that shows the box's page scrolled away from its top
    reads as not shown.
34. **S1.6, "the slowest open":** read as the p95 of each run's opens (about a hundred), the slowest reported; the
    single maximum is one stall away from flipping run to run, which the deterministic gate would turn into an
    inadmissible version. `open_ms` counts the package boxes' opens only, the kind every box of Zach's is.
35. **S1.6, a crashed page:** under memory pressure the kernel or fleet-throttle kills a Chrome renderer first; the
    speed group then loads a fresh page and retries that open once, and counts every crash (`page_crashes`).
36. **S1.6, requests and bytes:** what the browser's own network events record from the press to the page showing,
    by each request's start time, the URLs the page fetched during the 10 s quiet before round 1 (its polls) left out;
    bytes are response bodies as received (a 304 revalidation is 0). Builds = the version's PEP 0028 build records
    (`<vt home>/cache/box-sites/*/build.json` `at`) inside that window; null for a version that keeps none there.
37. **S2.9, "the dot turns into a chevron in the same slot":** the slot = the centre of the parent's status dot before
    hover (S2.9's dot reading); on hover the topmost element there, or its nearest button-like ancestor (a `button`, a
    `role="button"`, or an `aria-label`/`title` naming fold, unfold, collapse or expand), must be visible with its
    centre within 6 px of the dot's, and invisible again once the pointer leaves the row.
38. **S2.9, "Fold N sub-tracks (← →)":** the chevron's `aria-label` and `title` (and those of its ancestors up to the
    row, and any visible `role="tooltip"`), read together, must hold "Fold N sub-tracks" (N the direct sub-tracks, 2)
    and "← →"; folded, "Unfold N sub-tracks". A native tooltip is not in the page, so the attribute is what is read.
39. **S2.9, "the rows below move up":** the first row below the parent's subtree on screen (the extra box, added after
    the package boxes) moves up by at least two row heights and sits within 0.6 of a row height under the parent;
    after the second click it is back within 2 px.
40. **S2.9, "a focused row":** focused by a real click on its title (which also opens it), then real ← and → keys.
41. **S2.11, "the palette is open":** a visible text input (an `input` of a text type, a `textarea`, a contenteditable,
    or a `combobox`/`searchbox`/`textbox` role) holds the focus in the page itself (not in a box's frame), within
    1.5 s of the key or click, starting with nothing focused; "closed" = that input no longer visible.
42. **S2.11, a hit:** a row on screen (at most 72 px tall) holding README.md once (the box's file); its track is a fixture title or
    folder name in the row, else the nearest title above it within 240 px (a group heading); its line reads as
    `README.md:7`, `README.md #7`, `README.md (7`, `README.md, line 7`, `README.md L7` or `line 7`. "First" = the
    topmost hit row naming a track. Enter is pressed once the hit shows; if the address does not move within 2 s, ↓
    then Enter (a palette that highlights nothing until an arrow key).
43. **S2.11, "the open track first":** the track opened by a click on its title just before; the phrase is "ruler v1",
    which every fixture box's README holds on line 5; at least two tracks' hits must show within 6 s.
