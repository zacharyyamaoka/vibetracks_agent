# Ideas (the queue)

Two lists. Each idea says which spec items it should turn green and what it might break. Cross a line off with the
solution id that tried it and the result; never delete it. Ordered for the critical path: the tree file and box
loading come first because every other item reads them.

## I'll try

- [x] **Boxes as tracks, the tree in Vibe Tracks' own file.** A per-machine tree file outside every box (id, folder,
  parent, order, pinned, section, archived, label); `vt serve` lists each box from it and serves the box's own [`site/`](site/)
  in the main pane (README when it has none). Expect: S1.1, S1.2, S1.3 → pass; S2.1 stays green.
  - Rung: boxes
  - Needs: nothing
  - **Done: [`boxes-as-tracks-1`](solutions/boxes-as-tracks-1/)** with the next item: S1.1, S1.2, S1.3, S1.5 and S2.5
    met, shall 17 → 13, should 3 → 2, checks 71 → 42, no regressions; landed on
    [vibetracks main @ 8ba03b2](https://github.com/zacharyyamaoka/vibetracks/commit/8ba03b2)
    ([PEP 0024](https://github.com/zacharyyamaoka/vibetracks/blob/main/docs/peps/0024-boxes-are-the-tracks.md): `<vt home>/tree.json`, `vt-tree/1`).
- [x] **`vt add <folder | github url> [--parent]` and the page's Add box.** Clone a URL first; refuse a folder that is
  not a box and say what is missing. Expect: S1.5 → pass.
  - Rung: boxes
  - Needs: the tree file
  - **Done in `boxes-as-tracks-1`** (above).
- [ ] **Live box pages.** Watch each open box's folder and push a reload of the main pane only (the sidebar keeps its
  scroll and selection). Expect: S1.4 → pass; nothing else moves.
  - Rung: boxes
  - Needs: the tree file
  - **Built, still failing** in `boxes-as-tracks-1`: the reload works (it passed before the rebase), but with Claude's
    34 px rows the row S1.4 clicks sits under the account footer in its 420 px window, so the click misses. Next:
    scroll the selected row into view, or less chrome above the tree.
- [ ] **Swap the sidebar's tree model for Headless Tree's core** (vanilla, rows still drawn by `sidebar.js`): drag to
  reorder, onto a row to reparent, out to the left to un-nest; keyboard moves; refuse a drop into its own subtree.
  Spike the vanilla path for 30 minutes first (its docs are React-first); Pragmatic drag and drop is the fallback.
  Expect: S2.8 → pass. Risk: S2.2 and S2.9 if the rows' markup changes.
  - Rung: sidebar
  - Needs: the tree file
- [ ] **Claude's ··· menu**: Open in ›, Pin/Unpin P, Mark as unread U, Rename R, Fork F, Move up/down, Move to section
  ›, Archive A, Delete D (red, removes from Vibe Tracks only), then New sub-track… behind a separator; right-click
  stays the same menu. Expect: S2.3 → pass, S2.4 stays green.
  - Rung: sidebar
  - Needs: the tree file
- [ ] **Pinned section and the view menu** (Group by None/Parent/State, Sort by Manual/Last updated/Created/Name,
  Show ›, New section, Reset to defaults, View all), defaults Parent + Manual. Expect: S2.5, S2.6, S2.7 → pass.
  - Rung: sidebar
  - Needs: the tree file
- [x] **Measure Claude's sidebar once more and close the style gaps** the run lists under `sidebar_style_props_off`.
  Expect: S2.2 → pass; `sidebar_style_props_off` → 0.
  - Rung: sidebar
  - Needs: nothing
  - **Done: [`sidebar-style-1`](solutions/sidebar-style-1/)**, S2.2 met, props off 14 → 0 of 22, shall 18 → 17, checks
    85 → 71, no regressions; landed on [vibetracks main @ edbfc4e](https://github.com/zacharyyamaoka/vibetracks/commit/edbfc4e)
    (rows 32/34 px, 14 px titles, radius 8, dark fills 31/48/64, a 13 px "Tracks" list header).
- [ ] **Home as one data-ui `<data-views>`** over one row per box, nested by the tree, presets Active / Done / All
  tracks. Expect: S3.1 → pass.
  - Rung: roll-ups
  - Needs: the tree file
- [ ] **Roll-ups from [`status.json`](status.json)**: a parent's own dot plus a pip when a descendant is worse, and agents summed
  over its subtree, on the sidebar and Home. Expect: S3.4 → pass.
  - Rung: roll-ups
  - Needs: the tree file
- [ ] **Review and Feedback with the viewer's own components** (blackbox_agent's Needs-you and Feedback tabs) over the
  union of every box, plus a Track column and a by-track preset; Add feedback writes one note into the chosen box.
  Expect: S3.2, S3.3 → pass.
  - Rung: roll-ups
  - Needs: the tree file
- [ ] **`vt new "<title>" [--parent] [--dir] [--from] [--publish [--public]]`** copying blackbox_agent's starter box,
  git init + first commit, private GitHub only with `--publish` after `gh auth status`; the New track dialog writes
  the command and gets a Create button running it. Expect: S4.1-S4.4 → pass.
  - Rung: new track
  - Needs: a starter box to copy. Since blackbox_agent 0.1.x, `blackbox new <dir>` writes one (OBJECTIVES, AGENTS,
    an empty ledger, nav.json, the Pages workflow; committed on main): call it rather than copy `template/`.
- [ ] **Pause / Resume** in the ··· and right-click menus, before Archive; a paused row shows a pause glyph and a
  muted title; `vt pause|resume <track>`; an append-only `status` list in the tree file, stamped `by` (person, or
  agent when an agent's session ran it). Zach's words: [`feedback/2026-11-25-pause-a-track.md`](feedback/2026-11-25-pause-a-track.md).
  Expect (ruler v2): S2.10 → pass, and S2.3's `Z` check; S2.3 itself stays red until its v1 misses (Open in, Mark as
  unread, Fork) land. Spec: [PEP 0002](docs/peps/0002-ruler-v2-pause-resume.md).
  - Rung: sidebar
  - Needs: the tree file (boxes-as-tracks, landed) and ruler v2 (frozen 2026-11-25).
  - Seams (lane R's throwaway positive control on 4c7437a passed all 14 S2.10 checks and `Z` with ~45 added lines):
    `pause` / `resume` ops in `core.boxes.apply` appending `{at, status, by[, why]}` to the entry's `status`;
    `boxes.act` stamping `by` with `records.stamp(config, None, "page")`; `vt pause|resume <id> [--why]` stamping with
    `records.agent_session()` and `via "cli"`; `paused` in the tree view; the ··· item (Z) before Archive in
    boxes.js; a pause glyph in the row's lead and a lower-opacity title in sidebar.js. How each is measured:
    [`docs/CONTRACT.md`](docs/CONTRACT.md) §7, items 24-32.
- [ ] **Add this box to Zach's Vibe Tracks** once `vt add` exists. Expect: S5.1 verified by hand.
  - Rung: meta
  - Needs: `vt add`

## Suggestions for Zach

- [ ] **Rule on the hover chevron.** Claude's rows have no hover fold chevron (your Oct 16 Notion ask); Nov 24 says
  pixel-perfect Claude. Default: Claude wins, S2.9 stays a *should*. OBJECTIVES §10.1.
- [ ] **Sync and accounts.** Oct 25 asked for built-in sync and an online account; local boxes travel by their own git
  remotes. Default: the tree file is per machine in v1. OBJECTIVES §10.2.
- [ ] **A use number for ruler v2.** Your W2 retro found Vibe Tracks "not that helpful". Scoring only the spec could
  ship a version that passes and still goes unused; candidate: days you opened it, or boxes opened from it per day,
  read from `vt serve`'s own log. OBJECTIVES §10.3. **Drafted:** [`docs/peps/0001-ruler-v2-use-number.md`](docs/peps/0001-ruler-v2-use-number.md); accept it by
  changing its status line.
- [ ] **A full starter box in blackbox_agent's `template/`**, so `vt new` (and anyone) can copy one: README,
  OBJECTIVES, AGENTS, PROGRESS, ledger.jsonl, ideas.md, REFERENCES.md, status.json, specs/, feedback/, site/. This
  repo is a working example to start it from.
