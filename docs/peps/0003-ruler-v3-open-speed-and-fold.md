# PEP 0003: Ruler v3 times how fast a track opens (S1.6, `open_ms`), makes folding a shall (S2.9) and adds search (S2.11)

- **Status:** accepted 2026-11-25, under Zach's own asks of that day (both quoted below; his ask is the go-ahead for
  the ruler change it needs). Frozen into ruler v3 by [`tools/freeze_ruler.py`](../../tools/freeze_ruler.py). Undo: revert the freeze commit; the v2
  ruler, its rows and its scorecards are all still in git.
- **Date:** 2026-11-25
- **Does not include** [PEP 0001](0001-ruler-v2-use-number.md) (the use number): still his call.

## Why

Zach, 2026-11-25, with a screenshot of his Preview showing a blank white main pane after he clicked "Blackbox Agent
Agent" ([`feedback/2026-11-25-screens-load-too-slowly.md`](../../feedback/2026-11-25-screens-load-too-slowly.md)): *"Please add a KPi which is how fast the screens apper when you
click them right now they take wayyyyy to long to load: Please add this an an objective you track. make like a
repeatable determinstic way to measure it, and then start making some improvements so that this loads faster"*.

The same day ([`feedback/2026-11-25-fold-tracks-like-notion.md`](../../feedback/2026-11-25-fold-tracks-like-notion.md)): *"the vibe tracks side panel we need to be able to collapse
and expand things. just like you can collapse and expand folders this is very important for doing roll up! Our
reference here is notion. we don't have seperate folders per say instead each track it self is a folder. right now
we have the design where when you hover over the dot it should turn into a chvron"*.

And the same day, with a screenshot of the Claude app's "+ New", "🔍 Search  Ctrl+K", "Artifacts"
([`feedback/2026-11-25-search-bar.md`](../../feedback/2026-11-25-search-bar.md)): *"pleae support a search bar … bind it also to the hot keys ctrl K ctrl O and ctrk P
for now … my goal is to be abel to like quickly jump to any section in the app with that text. Priority should be
given to the open vibe track. My use case was that I wanted to see where else it spoke about like ruler v1 so I wanted
to search the files for ruler v1."*

Ruler v2 could see neither. No check timed anything, and its fixture boxes all commit a one-file `site/index.html`,
while every box of his is a *package* box whose site `blackbox build` makes (the dashboard viewer: about 95 module
requests per open). Folding was S2.9, a *should*, held back by the pixel-parity tension (OBJECTIVES §10.1).

## The change (ruler v3)

**S1.6 (new, shall): Opening a track shows its page fast** ([`specs/S1.6-opening-a-track-is-fast.md`](../../specs/S1.6-opening-a-track-is-fast.md)). Two checks per dev
run: `open_ms` within 400 ms, and nineteen opens in twenty within 1000 ms.

**The KPI `open_ms`**, frozen:

1. **t0** = the `pointerdown` on the track's sidebar row, stamped in the top page as `performance.timeOrigin +
   event.timeStamp`.
2. **t1** = the first animation frame in which the box's content marker is visible in the main pane: a text node
   holding it, its element inside its frame's viewport, not hidden up its chain, topmost at its centre, in a frame
   that is shown and topmost there at every level up to the top page, right of the sidebar. Stamped in the frame that
   shows it (`performance.timeOrigin + the rAF timestamp`). Never the "building" page, a README fallback for a box
   that has a site, or the previous box's page: none carries the marker.
3. **open_ms** = the median of t1 − t0 over the package boxes' opens of the fixed click sequence, both dev runs
   pooled. An open not shown within 10 s counts as 10 s.

**How it is stamped** ([`ruler/suite/timer.mjs`](../../ruler/suite/timer.mjs)): one script, installed in every frame before the page's own scripts
(`context.addInitScript` reaches cross-origin frames, and the box's page is framed on Vibe Tracks' other loopback
origin). While an open is armed, each frame scans its own document on each of its animation frames and posts its
parent the epoch time of the first frame it showed a marker; the parent passes it up as max(that, since when the
child frame has been shown and topmost); the top page records t1. Nothing runs while no open is armed. WHY not node
polling: it adds 10-30 ms of jitter at a 100 ms scale, and it cannot see inside a cross-origin frame at paint time.
One trap found building it, now handled and commented: a frame's first page takes over its initial about:blank's
Window when the two share an origin, and no init script runs for it; so a parent re-tells "arm" on each of its frames
and a stalled loop restarts on the page now in the window.

**The stage** ([`ruler/suite/groups/speed.mjs`](../../ruler/suite/groups/speed.mjs)): the fixture gains six package boxes (a parent, two sub-tracks, a grandchild,
two leaves; their own random stream, so every v2 box is byte-identical), whose workflow is the package's own, so the
version under test builds them with its own `blackbox build` and its real dashboard viewer loads. Their marker is
their objective's name, which the built landing and dashboard both print. The speed group runs last: `vt add` the
package boxes and the extra box, a fresh `vt serve`, a fresh browser, the page ready plus 10 s; round 1 opens every
box once (22 in dev: 15 files and README boxes, 6 package, the extra; cold), in a seeded order; a commit lands in one package box and one files box; three warm rounds follow,
each in its own seeded order. Each open: the pointer rests 150 ms on the row, presses 80 ms (a person's click),
releases; 1 s between opens. About 3 minutes a run.

**Diagnostics (reported, never selected on):** each run's `open_ms` and their spread, a package box's first and later
opens, every kind's median, p95 and slowest of all opens, and per open the deterministic counts: requests and bytes
the browser fetched between press and page (from its own network events; the page's polls, seen during the 10 s
quiet, left out) and the builds the version finished meanwhile (its PEP 0028 build records, read-only).

**Ranking (OBJECTIVES §8):** `shall_failing` first, then **`open_ms` rounded to 10 ms**, then `should_failing`, then
`checks_failing`. In a ledger row: `tiebreak` = `open_ms` rounded, `tiebreak2` = should, `tiebreak3` = checks (the
blackbox_agent fold ranks by the slots in that order), plus named `open_ms`, `should_failing`, `checks_failing`.
[`status.json`](../../status.json)'s headline `kpi` is `open_ms` (direction down, target 100 ms); `counter_kpi` is `shall_failing`, which
must be 0. [`PROGRESS.md`](../../PROGRESS.md) shows it in "Where it stands", in a leaderboard column and in a per-box table.

**S2.9, should → shall**, retitled "Fold and unfold like Notion: the status dot turns into the fold chevron on hover"
([`specs/S2.9-row-anatomy.md`](../../specs/S2.9-row-anatomy.md)); OBJECTIVES §10.1 resolved by his words. New fold group ([`ruler/suite/groups/fold.mjs`](../../ruler/suite/groups/fold.mjs)), on the
package parent (sub-tracks two levels deep): the chevron at the dot's own centre on hover and gone after; its labels
"Fold 2 sub-tracks (← →)" and "Unfold 2 sub-tracks"; a chevron click folds both levels with the next row moving up
under the parent, a second click puts every row back, neither opens the track; a title click opens and does not fold;
← folds and → unfolds the focused row; a fold survives a reload; a folded parent still shows the pip for its blocked
sub-track and 3 agents (S3.4). The four v2 S2.9 checks stay in the sidebar group.

**S2.11 (new, shall): Search** ([`specs/S2.11-search.md`](../../specs/S2.11-search.md)), search group ([`ruler/suite/groups/search.mjs`](../../ruler/suite/groups/search.mjs)): Ctrl+K opens a
palette with its input focused, Ctrl+O and Ctrl+P too, Escape closes it; the sidebar shows "Search" with "Ctrl+K"
at its right end, below New track and above the tracks, and a click opens the palette; typing one box's own README
line lists a hit naming that box, its README.md and the line; with a track open, typing **"ruler v1"** (his phrase, on
line 5 of every fixture box's README) lists hits from two or more tracks, the open track's first; Enter on the hit
for the box with no site opens that track with the line on screen. S2.1's list gains Search after New track (Claude's
order); its own checks stay the four rows, so a missing Search row counts once (S2.11), not twice.

**Spec totals:** 23 *shall*, 3 *should* (was 20 and 4). Checks: 135 (was 119).

## Noise: how one number on a busy machine stays repeatable

- **The deterministic half:** the click sequence, the box order, the commits (fixed author and dates: the same shas
  every run) and the per-open counts (requests, bytes, builds) do not depend on load.
- **The repeatable half:** `open_ms` is a median of 48 opens (6 package boxes × 4 rounds × 2 runs), stamped in the
  page. Measured on 940b507 on this machine at load 40+ on 24 threads: (see "Measured" below).
- **The checks' margin:** S1.6's second check is a p95, not the single slowest open: of about a hundred opens on a
  shared machine, the slowest is one stall (a renderer paused under memory pressure, a busy core) and would flip run to
  run, and the deterministic gate would then make an improving version inadmissible. The p95 still fails a kind that
  is slow every time (package boxes are a quarter of the opens; their first opens alone are more than one in twenty).
- **A renderer killed under memory pressure** (Chrome raises its renderers' OOM score on purpose) is reloaded and the
  open retried once; every crash is counted in the report; a second crash fails the open.
- **CPU pinning:** measured, see below.

## Measured

Filled in at the freeze; see the bottom of this file.

## What it costs

- The run grows by the fold group (~40 s) and the speed group (~3-4 min), so a dev run is about 8-10 minutes, two
  runs a version: inside the 20-minute `completed` gate per run.
- `vta speed --base <url> [--rounds N]` ([`tools/speed.mjs`](../../tools/speed.mjs)): the same timer against any running `vt serve`, read-only (its
  own headless browser clicks track rows only; it starts nothing), so his own Preview can be timed the same way. On a
  live server the marker is each track's title inside a frame of the main pane (the box's site bar or heading), so a
  README fallback counts there.
