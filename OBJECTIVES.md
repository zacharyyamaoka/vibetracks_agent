# Objectives & Gates (ruler v4, frozen 2026-11-25)

The outside of the black box: what Vibe Tracks is for, how a version of it is scored, and where every number comes
from. Nothing here says how Vibe Tracks does it. Changing anything in this file, `specs/` or `ruler/` makes a **new ruler
version** (v4 next): a new entry in §11, and every solution is re-scored on it. A solution (a vibetracks commit) never
edits this file, `specs/` or `ruler/`.

WHY this file exists (Zach, 2026-11-24, Daily Note "# Vibe tracks"): *"Please make a blackbox agent for vibe tracks it
self."* and *"all of this stuff is Spec and context btw that should be relfected on the black box page for
vibetracks!"* The spec he gave that evening is §1-§5; each item has its own note in `specs/` with his words.

**§1-§5 are the spec**: 23 *shall*, 3 *should*, each linking to its note (Zach's words, what it means, why, how
it is checked); a spec id `S<n>.<m>` is item m of §n. **§6-§8 say how a version is scored.**

## 1. Tracks are independent boxes

| Id | Kind | Item |
|---|---|---|
| [S1.1](specs/S1.1-a-track-is-a-box.md) | shall | A track is a black-box agent repo on this machine, and opening it shows that box's own site |
| [S1.2](specs/S1.2-a-box-holds-nothing-for-vibetracks.md) | shall | A box holds nothing for Vibe Tracks, and tree changes never write a box |
| [S1.3](specs/S1.3-vibetracks-owns-the-tree.md) | shall | Vibe Tracks owns the tree: parent, child, order, pins and sections |
| [S1.4](specs/S1.4-live-local-data.md) | should | A box's data changing on disk shows on its page live |
| [S1.5](specs/S1.5-add-an-existing-box.md) | should | Add a box that already exists: a folder, or a GitHub repo to clone |
| [S1.6](specs/S1.6-opening-a-track-is-fast.md) | shall | Opening a track shows its page fast: `open_ms` (§8) within 400 ms, and nineteen opens in twenty within 1000 ms |

## 2. The sidebar is Claude's

| Id | Kind | Item |
|---|---|---|
| [S2.1](specs/S2.1-top-rows.md) | shall | Top rows: Home, Review, Feedback, New track, then Search (S2.11) |
| [S2.2](specs/S2.2-pixel-parity-with-claude.md) | shall | Pixel parity with the Claude desktop app's sidebar |
| [S2.3](specs/S2.3-row-menu-has-claudes-items.md) | shall | The ··· menu has Claude's items, in Claude's order, with its shortcut letters, and Pause / Resume before Archive |
| [S2.4](specs/S2.4-right-click-is-the-row-menu.md) | shall | Right-click on a track opens the same menu as its ··· |
| [S2.5](specs/S2.5-pin-and-the-pinned-section.md) | shall | Pin a track; pinned tracks sit in a Pinned section at the top |
| [S2.6](specs/S2.6-the-view-menu.md) | shall | The view menu: Group by, Sort by, Show, New section, Reset to defaults, View all |
| [S2.7](specs/S2.7-groupings.md) | shall | Groupings: flat by recent, and the parent tree |
| [S2.8](specs/S2.8-drag-to-reorder-on-a-stock-tree.md) | shall | Drag to reorder and to move under another track, on a stock tree component |
| [S2.9](specs/S2.9-row-anatomy.md) | shall | Fold and unfold: a parent's chevron always left of its title (Obsidian), the status dot at the row's right end (Claude); "Fold N sub-tracks (← →)"; click, ← →, kept across a reload, the roll-up kept |
| [S2.10](specs/S2.10-pause-and-resume.md) | shall | Pause a track; a paused track looks paused and stays paused until resumed |
| [S2.11](specs/S2.11-search.md) | shall | Search: a Search row with Ctrl+K and a palette on Ctrl+K, Ctrl+O, Ctrl+P that finds text in the tracks' files (track, file, line), the open track first; Enter opens the hit, Escape closes |

## 3. Roll-up pages

| Id | Kind | Item |
|---|---|---|
| [S3.1](specs/S3.1-home-is-a-stock-data-ui-table.md) | shall | Home is a stock data-ui table, folding by parent, with Active / Done / All tracks presets |
| [S3.2](specs/S3.2-review-across-tracks.md) | shall | Review is a box's own review page, over every track's waits |
| [S3.3](specs/S3.3-feedback-across-tracks.md) | shall | Feedback is a box's own feedback page, over every track's feedback notes |
| [S3.4](specs/S3.4-roll-ups-from-children.md) | shall | A parent rolls up its children: state and number of agents |

## 4. New track

| Id | Kind | Item |
|---|---|---|
| [S4.1](specs/S4.1-vt-new-duplicates-the-template.md) | shall | `vt new` makes a new box by duplicating the black-box template |
| [S4.2](specs/S4.2-new-track-dialog-writes-the-command.md) | shall | The New track dialog writes the command to copy, and can run it |
| [S4.3](specs/S4.3-local-first-publish-optional.md) | shall | Local-only by default; publishing to GitHub is an option that needs `gh` signed in |
| [S4.4](specs/S4.4-new-box-lands-in-the-tree.md) | shall | A new box shows in the sidebar under its parent at once |

## 5. Meta

| Id | Kind | Item |
|---|---|---|
| [S5.1](specs/S5.1-vibetracks-tracks-itself.md) | should | Vibe Tracks tracks itself: this box is a track in Zach's Vibe Tracks |

## 6. The black box

Vibe Tracks (code: `~/vibetracks`, served by `vt serve`; Stable on :4394, Preview on :4396) is the sidebar Zach opens
his black-box agents from.

| | What | Examples |
|---|---|---|
| **In** | the boxes on this machine, Vibe Tracks' own tree file, what a person or agent does | a folder in the blackbox_agent format, a drag in the sidebar, a key in the ··· menu, `vt new "Grasping" --parent bam` |
| **Out** | what Vibe Tracks shows and writes | the sidebar, Home, Review, Feedback, a box's own site in the main pane, a new box made by `vt new`, its tree file |
| **A solution** | a vibetracks commit | `solutions/<id>/meta.json` names its sha, its parent and its one-line change |

The north star, in his words: *"All vieb tracks now is though is just a side bar"* and *"Its nice not having to
relearn new UIs."* (both 2026-11-24).

## 7. The stage: the acceptance run

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

**Ruler v3 adds to the stage** (every group of v2 runs as it did, first): the fixture also makes six **package
boxes** (a parent, two sub-tracks, a grandchild, two leaves), whose Pages workflow builds the site with the blackbox_agent package
as Zach's boxes do, so the version builds them with its own `blackbox build` and the real dashboard viewer loads;
they are not in the tree handed over. The **fold** group (S2.9), the **search** group (S2.11) and the **speed** group (S1.6) run last; fold and speed each stop
`vt serve`, hands the version the package boxes and then the extra box with `vt add`, and starts a fresh `vt serve`.
The speed group then opens a fresh browser, waits for the page plus 10 s, opens every box once (cold), lands a commit
in two boxes, and opens every box three more times (warm), each round in an order fixed by the seed; each open is a
real click timed in the page (S1.6's note, [`ruler/suite/timer.mjs`](ruler/suite/timer.mjs)).

## 8. The score

**Objective (one number, lower is better): `shall_failing`** = how many of the 20 *shall* items in §1-§5 the version
does not meet on the `dev` run. Target **0**. An item is met only when it has at least one check and every one of
its checks passed. **Fail closed:** an item with no check, a skipped check, a check that crashed or a run that did not
finish counts as failing.

WHY this one: every item is something Zach asked for in his own words; this is "how much of what I asked for is still
not true", the same reading as ClaudeParty's `scenarios_failing`.

**Tie-breaks, in order:** `open_ms` rounded to 10 ms, then `should_failing` (the 3 *should* items, same rule), then
`checks_failing` (single test cases failing).

**The tracked KPI: `open_ms`** (ms, lower is better, target 100) = the median, over the package boxes' opens in the
speed group's fixed click sequence on both `dev` runs, of the time from the `pointerdown` on a track's sidebar row to
the first animation frame in which that box's own content is visible in the main pane, both stamped in the page
(S1.6's note; package boxes because every box of Zach's is one). An open whose
page never shows counts as 10 s; a run with no speed result leaves it missing, and a missing `open_ms` ranks last.
WHY it is the first tie-break and not the objective: S1.6 already counts "too slow" as one shall item not met; among
versions that meet the same number of his items, the faster one is the better one, and speed is what he asked to see
driven down. WHY rounded to 10 ms: the two runs of one version differ by more than 1 ms, so a 1 ms "win" is noise.

**Gates (a solution is *admissible* only if both pass; missing, null or NaN is a fail):**

| Gate | Pass when | Why |
|---|---|---|
| `completed` | the run returned a result for every check within 20 minutes | a crash is not a score |
| `deterministic` | two `dev` runs agree check by check | a UI check that flips run to run can't rank anything |

**Diagnostics (reported, never optimized):** for `open_ms`: each run's value and their spread, a package box's
first (round 1) and later (rounds 2-4) opens, every kind's median, the p95 and slowest of all opens, and per open the
requests and bytes the browser fetched between the press and the page showing and the builds the version finished in
that time (`requests_per_open`, `bytes_first_open`, `bytes_later_open`, `builds_waited`: counts that do not depend on
how busy the machine is); `shall_passing`, `sidebar_style_props_off` (S2.2: properties off their
measured Claude reference, of those measured), `page_ready_ms` (load to the sidebar answering a click),
`vt_gate_failed` (vibetracks' own `pytest tests` failures on that sha, when it was run; null otherwise),
`wall_time_s`, and per item `task_objectives` (`0` met, `1` not met) so the population views show which items each
version fixes or breaks without reading its code.

## 9. Out of scope for this ruler

- **What a box's own page looks like.** That is the blackbox_agent viewer's job and its own ruler; here only "it shows
  that box's site" (S1.1) is scored.
- **Taste beyond what is measured.** S2.2 scores the properties with a measured Claude reference and lists the rest.
- **Sync between machines and online accounts** (the Oct 25 ruling). See §10.

## 10. Open tensions (defaults taken; Zach's to overrule)

Each default is in force for ruler v4 (as it was for v1-v3); overruling one is a new ruler version.

1. **Hover chevron (Oct 16) vs pixel-perfect Claude (Nov 24).** *Resolved by Zach, 2026-11-25, twice.* Ruler v3
   ([`feedback/2026-11-25-fold-tracks-like-notion.md`](feedback/2026-11-25-fold-tracks-like-notion.md)): *"when you hover over the dot it should turn into a chvron"*, a
   *shall*. Ruler v4 ([`feedback/2026-11-25-chevron-left-status-right.md`](feedback/2026-11-25-chevron-left-status-right.md)) overrules the hover: *"Its not clear from the
   outside what has things where you can fold … one option here is to swithc to like obisdan we show the vheron on
   the left side … and then on the right now we put the status icon"*. A parent's chevron shows left of its title at
   rest and the status dot sits at the row's right end, where Claude's own sidebar draws it, so S2.2's pixel parity
   and S2.9 no longer pull apart.
2. **Built-in sync and an account (Oct 25) vs local boxes (Nov 24).** Default: a box travels by its own git remote;
   Vibe Tracks' tree file is per machine in v1, and nothing here scores sync.
3. **"I haven't found the vibetracks thing to be that helpful" (W2 retro, by Nov 21).** v1 scores the spec only.
   Candidate for ruler v2: an observed use number (days Zach opened Vibe Tracks, boxes opened from it per day), so a
   version that meets the spec but goes unused does not read as a win.
4. **Delete** removes the track from Vibe Tracks only; a box's folder and repo are never deleted from the sidebar.
5. **Rename** changes Vibe Tracks' label only; a box's own title stays its README's (S1.2).
6. **Publish is private** unless `--public` (S4.3): a first public push is a step nothing undoes.
7. **How fast is fast (S1.6, ruler v3).** He asked for the number, not a threshold. Defaults: `open_ms` within
   **400 ms** (the Doherty threshold) and nineteen opens in twenty within **1000 ms** (Nielsen's limit for an
   unbroken flow of thought), on each dev run; `open_ms` is driven toward **100 ms** (Nielsen's "instantaneous").
   Also defaults: "the slowest" is read as the p95, since the single slowest of about a hundred opens on a shared
   machine is decided by one stall and would flip run to run; `open_ms` counts package boxes only (his kind); a page
   counts as shown when the box's own content is on screen (not when it has finished loading); the sequence includes
   a box's first open (a package box may still be unbuilt); an open that never shows counts as 10 s.

## 11. Ruler versions

- **v1**, frozen 2026-11-24: §1-§8 and `specs/` at the commit that adds this file; `ruler/` at the commit that adds
  `ruler/manifest.json`.
- **v2**, frozen 2026-11-25: [PEP 0002](docs/peps/0002-ruler-v2-pause-resume.md). What changed: §2 gains **S2.10**
  (shall: pause a track from the ··· menu or `vt pause`; a paused row looks paused, survives a reload and a restart,
  and the tree file records who paused it and, with `--why`, why), so the spec is 20 *shall*, 4 *should*; **S2.3**'s
  list gains **Pause / Resume `Z`** right before Archive, and its letter is checked like the others; `ruler/` gains
  the `pause` group and S2.3's `Z` check, re-pinned in `ruler/manifest.json` (every other check, the fixture and the
  frozen refs are as in v1). Why: Zach, 2026-11-25 ([`feedback/2026-11-25-pause-a-track.md`](feedback/2026-11-25-pause-a-track.md)): *"I should be able to like
  pause a track. I think in the 3 button menu You can give like a pause/resume, archive, delete"*. Every solution is
  re-scored on v2; a v1 row stays in the ledger, labelled v1, and is never ranked against a v2 one.
- **v3**, frozen 2026-11-25: [PEP 0003](docs/peps/0003-ruler-v3-open-speed-and-fold.md). What changed: §1 gains **S1.6** (shall: opening a track shows
  its page fast, `open_ms` within 400 ms and nineteen opens in twenty within 1000 ms), timed by the new KPI **`open_ms`**
  (§8), which becomes the first tie-break; **S2.9** goes from *should* to *shall* (fold and unfold like Notion, the
  dot turning into the chevron on hover), resolving §10.1, with new checks; §2 gains **S2.11** (shall: search, a
  Search row with Ctrl+K and a palette on Ctrl+K, Ctrl+O and Ctrl+P over the tracks' files, the open track's hits
  first), and S2.1's list gains Search after New track; so the spec is **23 *shall*, 3 *should*** (was 20 and 4). `ruler/` gains the package boxes in the fixture, the fold and speed groups (run after
  every v2 group, which run as before), the search group, the in-page timer [`ruler/suite/timer.mjs`](ruler/suite/timer.mjs) and a per-group time budget, re-pinned in
  `ruler/manifest.json`. Why: Zach, 2026-11-25 ([`feedback/2026-11-25-screens-load-too-slowly.md`](feedback/2026-11-25-screens-load-too-slowly.md)): *"Please add a KPi which is how fast the
  screens apper when you click them"*, and the same day ([`feedback/2026-11-25-fold-tracks-like-notion.md`](feedback/2026-11-25-fold-tracks-like-notion.md)): *"we need to be able to collapse
  and expand things. just like you can collapse and expand folders"*, and the same day ([`feedback/2026-11-25-search-bar.md`](feedback/2026-11-25-search-bar.md)): *"pleae
  support a search bar"*. Every solution is re-scored on v3; v1 and v2
  rows stay in the ledger, labelled, never ranked against v3.
- **v4**, frozen 2026-11-25: [PEP 0004](docs/peps/0004-ruler-v4-chevron-left-status-right.md). What changed: **S2.9**'s row anatomy only (folding, its labels,
  keys, reload and roll-up unchanged): a parent's fold chevron shows left of its title **at rest**, not only on hover
  (Obsidian's file explorer), a leaf shows none, and the status dot sits at the **row's right end** (Claude's
  sidebar), not in the leading slot. `ruler/`: the sidebar group's first two S2.9 checks and the fold group's first
  check are rewritten for it and the fold group finds the chevron at rest, re-pinned in `ruler/manifest.json`; every
  other check, the fixture, the KPI `open_ms` and the frozen refs are as in v3, so the spec stays 23 *shall*, 3
  *should*, 135 checks. Why: Zach, Daily Note - Nov 25 2026 ([`feedback/2026-11-25-chevron-left-status-right.md`](feedback/2026-11-25-chevron-left-status-right.md)): *"Its not clear from
  the outside what has things where you can fold … we show the vheron on the left side … and then on the right now we
  put the status icon"*. Every solution is re-scored on v4; v1-v3 rows stay in the ledger, labelled, never ranked
  against v4.
