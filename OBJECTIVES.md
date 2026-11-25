# Objectives & Gates (ruler v1, frozen 2026-11-24)

The outside of the black box: what Vibe Tracks is for, how a version of it is scored, and where every number comes
from. Nothing here says how Vibe Tracks does it. Changing anything in this file, `specs/` or `ruler/` makes **ruler
v2**: a new section at the bottom, and every solution is re-scored on it. A solution (a vibetracks commit) never
edits this file, `specs/` or `ruler/`.

WHY this file exists (Zach, 2026-11-24, Daily Note "# Vibe tracks"): *"Please make a blackbox agent for vibe tracks it
self."* and *"all of this stuff is Spec and context btw that should be relfected on the black box page for
vibetracks!"* The spec he gave that evening is §4; each item has its own note in `specs/` with his words.

## 1. The black box

Vibe Tracks (code: `~/vibetracks`, served by `vt serve`; Stable on :4394, Preview on :4396) is the sidebar Zach opens
his black-box agents from.

| | What | Examples |
|---|---|---|
| **In** | the boxes on this machine, Vibe Tracks' own tree file, what a person or agent does | a folder in the blackbox_agent format, a drag in the sidebar, a key in the ··· menu, `vt new "Grasping" --parent bam` |
| **Out** | what Vibe Tracks shows and writes | the sidebar, Home, Review, Feedback, a box's own site in the main pane, a new box made by `vt new`, its tree file |
| **A solution** | a vibetracks commit | `solutions/<id>/meta.json` names its sha, its parent and its one-line change |

The north star, in his words: *"All vieb tracks now is though is just a side bar"* and *"Its nice not having to
relearn new UIs."* (both 2026-11-24).

## 2. The stage: the acceptance run

| Split | What | Used to choose? |
|---|---|---|
| `dev` | the fixture built from seed 1 | **yes** |
| `holdout` | the fixture built from seed 2: other box names, depths, counts and activity times | never; reported only, so a version that special-cases the dev fixture shows up |

**How a solution is run:** `git archive <sha>` of vibetracks into a scratch tree; a temporary `HOME` holding the
fixture (black-box repos made from the starter box at the frozen blackbox_agent ref named in `ruler/manifest.json`,
with known titles, states, agents, waits, feedback notes and activity times, and a parent tree); that tree's own
`vt serve` on a free port outside 4390-4397; a fake `gh` first on `PATH`; no network. Headless Chromium (Playwright)
drives the page with real pointer and key events and measures what is on screen (bounding boxes, computed styles),
never DOM presence alone. Every check is a junit test case named `S<id> <what>`, so the Spec tab maps it to its note.
Nothing touches Zach's spaces, his Stable or Preview, his Claude app or his GitHub.

## 3. The score

**Objective (one number, lower is better): `shall_failing`** = how many of the 19 *shall* items in §4 the version
does not meet on the `dev` run. Target **0**. An item is met only when it has at least one check and every one of
its checks passed. **Fail closed:** an item with no check, a skipped check, a check that crashed or a run that did not
finish counts as failing.

WHY this one: every item is something Zach asked for in his own words; this is "how much of what I asked for is still
not true", the same reading as ClaudeParty's `scenarios_failing`.

**Tie-breaks, in order:** `should_failing` (the 4 *should* items, same rule), then `checks_failing` (single test
cases failing).

**Gates (a solution is *admissible* only if both pass; missing, null or NaN is a fail):**

| Gate | Pass when | Why |
|---|---|---|
| `completed` | the run returned a result for every check within 20 minutes | a crash is not a score |
| `deterministic` | two `dev` runs agree check by check | a UI check that flips run to run can't rank anything |

**Diagnostics (reported, never optimized):** `shall_passing`, `sidebar_style_props_off` (S2.2: properties off their
measured Claude reference, of those measured), `page_ready_ms` (load to the sidebar answering a click),
`vt_gate_failed` (vibetracks' own `pytest tests` failures on that sha, when it was run; null otherwise),
`wall_time_s`, and per item `task_objectives` (`0` met, `1` not met) so the population views show which items each
version fixes or breaks without reading its code.

## 4. The spec

19 *shall*, 4 *should*. Each links to its note: Zach's words, what it means, why, how it is checked.

### 4.1 Tracks are independent boxes

| Id | Kind | Item |
|---|---|---|
| [S1.1](specs/S1.1-a-track-is-a-box.md) | shall | A track is a black-box agent repo on this machine, and opening it shows that box's own site |
| [S1.2](specs/S1.2-a-box-holds-nothing-for-vibetracks.md) | shall | A box holds nothing for Vibe Tracks, and tree changes never write a box |
| [S1.3](specs/S1.3-vibetracks-owns-the-tree.md) | shall | Vibe Tracks owns the tree: parent, child, order, pins and sections |
| [S1.4](specs/S1.4-live-local-data.md) | should | A box's data changing on disk shows on its page live |
| [S1.5](specs/S1.5-add-an-existing-box.md) | should | Add a box that already exists: a folder, or a GitHub repo to clone |

### 4.2 The sidebar is Claude's

| Id | Kind | Item |
|---|---|---|
| [S2.1](specs/S2.1-top-rows.md) | shall | Top rows: Home, Review, Feedback, New track |
| [S2.2](specs/S2.2-pixel-parity-with-claude.md) | shall | Pixel parity with the Claude desktop app's sidebar |
| [S2.3](specs/S2.3-row-menu-has-claudes-items.md) | shall | The ··· menu has Claude's items, in Claude's order, with its shortcut letters |
| [S2.4](specs/S2.4-right-click-is-the-row-menu.md) | shall | Right-click on a track opens the same menu as its ··· |
| [S2.5](specs/S2.5-pin-and-the-pinned-section.md) | shall | Pin a track; pinned tracks sit in a Pinned section at the top |
| [S2.6](specs/S2.6-the-view-menu.md) | shall | The view menu: Group by, Sort by, Show, New section, Reset to defaults, View all |
| [S2.7](specs/S2.7-groupings.md) | shall | Groupings: flat by recent, and the parent tree |
| [S2.8](specs/S2.8-drag-to-reorder-on-a-stock-tree.md) | shall | Drag to reorder and to move under another track, on a stock tree component |
| [S2.9](specs/S2.9-row-anatomy.md) | should | Row anatomy: status dot, badges, fold chevron on hover |

### 4.3 Roll-up pages

| Id | Kind | Item |
|---|---|---|
| [S3.1](specs/S3.1-home-is-a-stock-data-ui-table.md) | shall | Home is a stock data-ui table, folding by parent, with Active / Done / All tracks presets |
| [S3.2](specs/S3.2-review-across-tracks.md) | shall | Review is a box's own review page, over every track's waits |
| [S3.3](specs/S3.3-feedback-across-tracks.md) | shall | Feedback is a box's own feedback page, over every track's feedback notes |
| [S3.4](specs/S3.4-roll-ups-from-children.md) | shall | A parent rolls up its children: state and number of agents |

### 4.4 New track

| Id | Kind | Item |
|---|---|---|
| [S4.1](specs/S4.1-vt-new-duplicates-the-template.md) | shall | `vt new` makes a new box by duplicating the black-box template |
| [S4.2](specs/S4.2-new-track-dialog-writes-the-command.md) | shall | The New track dialog writes the command to copy, and can run it |
| [S4.3](specs/S4.3-local-first-publish-optional.md) | shall | Local-only by default; publishing to GitHub is an option that needs `gh` signed in |
| [S4.4](specs/S4.4-new-box-lands-in-the-tree.md) | shall | A new box shows in the sidebar under its parent at once |

### 4.5 Meta

| Id | Kind | Item |
|---|---|---|
| [S5.1](specs/S5.1-vibetracks-tracks-itself.md) | should | Vibe Tracks tracks itself: this box is a track in Zach's Vibe Tracks |

## 5. Out of scope for this ruler

- **What a box's own page looks like.** That is the blackbox_agent viewer's job and its own ruler; here only "it shows
  that box's site" (S1.1) is scored.
- **Taste beyond what is measured.** S2.2 scores the properties with a measured Claude reference and lists the rest.
- **Sync between machines and online accounts** (the Oct 25 ruling). See §6.

## 6. Open tensions (defaults taken; Zach's to overrule)

Each default is in force for ruler v1; overruling one is a ruler v2.

1. **Hover chevron (Oct 16) vs pixel-perfect Claude (Nov 24).** Claude's rows have no hover fold chevron. Default:
   S2.9 is a *should*, and S2.2 wins where the two clash.
2. **Built-in sync and an account (Oct 25) vs local boxes (Nov 24).** Default: a box travels by its own git remote;
   Vibe Tracks' tree file is per machine in v1, and nothing here scores sync.
3. **"I haven't found the vibetracks thing to be that helpful" (W2 retro, by Nov 21).** v1 scores the spec only.
   Candidate for ruler v2: an observed use number (days Zach opened Vibe Tracks, boxes opened from it per day), so a
   version that meets the spec but goes unused does not read as a win.
4. **Delete** removes the track from Vibe Tracks only; a box's folder and repo are never deleted from the sidebar.
5. **Rename** changes Vibe Tracks' label only; a box's own title stays its README's (S1.2).
6. **Publish is private** unless `--public` (S4.3): a first public push is a step nothing undoes.

## 7. Ruler versions

- **v1**, frozen 2026-11-24: §2-§4 and `specs/` at the commit that adds this file; `ruler/` at the commit that adds
  `ruler/manifest.json`.
