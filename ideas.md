# Ideas (the queue)

Two lists. Each idea says which spec items it should turn green and what it might break. Cross a line off with the
solution id that tried it and the result; never delete it. Ordered for the critical path: the tree file and box
loading come first because every other item reads them.

## I'll try

- [ ] **Boxes as tracks, the tree in Vibe Tracks' own file.** A per-machine tree file outside every box (id, folder,
  parent, order, pinned, section, archived, label); `vt serve` lists each box from it and serves the box's own `site/`
  in the main pane (README when it has none). Expect: S1.1, S1.2, S1.3 → pass; S2.1 stays green.
  - Rung: boxes
  - Needs: nothing
- [ ] **`vt add <folder | github url> [--parent]` and the page's Add box.** Clone a URL first; refuse a folder that is
  not a box and say what is missing. Expect: S1.5 → pass.
  - Rung: boxes
  - Needs: the tree file
- [ ] **Live box pages.** Watch each open box's folder and push a reload of the main pane only (the sidebar keeps its
  scroll and selection). Expect: S1.4 → pass; nothing else moves.
  - Rung: boxes
  - Needs: the tree file
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
- [ ] **Measure Claude's sidebar once more and close the style gaps** the run lists under `sidebar_style_props_off`.
  Expect: S2.2 → pass; `sidebar_style_props_off` → 0.
  - Rung: sidebar
  - Needs: nothing
- [ ] **Home as one data-ui `<data-views>`** over one row per box, nested by the tree, presets Active / Done / All
  tracks. Expect: S3.1 → pass.
  - Rung: roll-ups
  - Needs: the tree file
- [ ] **Roll-ups from `status.json`**: a parent's own dot plus a pip when a descendant is worse, and agents summed
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
  - Needs: a full starter box in blackbox_agent `template/` (today it holds only the README header, nav.json and the Pages test)
- [ ] **Add this box to Zach's Vibe Tracks** once `vt add` exists. Expect: S5.1 verified by hand.
  - Rung: meta
  - Needs: `vt add`

## Suggestions for Zach

- [ ] **Rule on the hover chevron.** Claude's rows have no hover fold chevron (your Oct 16 Notion ask); Nov 24 says
  pixel-perfect Claude. Default: Claude wins, S2.9 stays a *should*. OBJECTIVES §6.1.
- [ ] **Sync and accounts.** Oct 25 asked for built-in sync and an online account; local boxes travel by their own git
  remotes. Default: the tree file is per machine in v1. OBJECTIVES §6.2.
- [ ] **A use number for ruler v2.** Your W2 retro found Vibe Tracks "not that helpful". Scoring only the spec could
  ship a version that passes and still goes unused; candidate: days you opened it, or boxes opened from it per day,
  read from `vt serve`'s own log. OBJECTIVES §6.3.
- [ ] **A full starter box in blackbox_agent's `template/`**, so `vt new` (and anyone) can copy one: README,
  OBJECTIVES, AGENTS, PROGRESS, ledger.jsonl, ideas.md, REFERENCES.md, status.json, specs/, feedback/, site/. This
  repo is a working example to start it from.
