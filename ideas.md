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
- [x] **Live box pages.** Watch each open box's folder and push a reload of the main pane only (the sidebar keeps its
  scroll and selection). Expect: S1.4 → pass; nothing else moves.
  - Rung: boxes
  - Needs: the tree file
  - **Built, still failing** in `boxes-as-tracks-1`: the reload works (it passed before the rebase), but with Claude's
    34 px rows the row S1.4 clicks sits under the account footer in its 420 px window, so the click misses. Next:
    scroll the selected row into view, or less chrome above the tree.
  - **Done: [`live-1`](solutions/live-1/)**, S1.4 met (the list keeps its scroll on redraw; the selected row scrolls back into view).
- [ ] **Swap the sidebar's tree model for Headless Tree's core** (vanilla, rows still drawn by `sidebar.js`): drag to
  reorder, onto a row to reparent, out to the left to un-nest; keyboard moves; refuse a drop into its own subtree.
  Spike the vanilla path for 30 minutes first (its docs are React-first); Pragmatic drag and drop is the fallback.
  Expect: S2.8 → pass. Risk: S2.2 and S2.9 if the rows' markup changes.
  - Rung: sidebar
  - Needs: the tree file
- [x] **Claude's ··· menu**: Open in ›, Pin/Unpin P, Mark as unread U, Rename R, Fork F, Move up/down, Move to section
  ›, Archive A, Delete D (red, removes from Vibe Tracks only), then New sub-track… behind a separator; right-click
  stays the same menu. Expect: S2.3 → pass, S2.4 stays green.
  - Rung: sidebar
  - Needs: the tree file
  - **Done: [`menus-2`](solutions/menus-2/)** (S2.3 met; Fork uses `vt new --from`).
- [x] **Pinned section and the view menu** (Group by None/Parent/State, Sort by Manual/Last updated/Created/Name,
  Show ›, New section, Reset to defaults, View all), defaults Parent + Manual. Expect: S2.5, S2.6, S2.7 → pass.
  - Rung: sidebar
  - Needs: the tree file
  - **Done: [`view-2`](solutions/view-2/)**, S2.6 and S2.7 met: shall 3 → 1 on ruler v2, checks 13 → 3, no
    regressions; landed with menus-2 on [vibetracks main @ 12743ec](https://github.com/zacharyyamaoka/vibetracks/commit/12743ec)
    ([PEP 0027](https://github.com/zacharyyamaoka/vibetracks/blob/main/docs/peps/0027-claudes-menus-over-the-boxes.md)).
- [x] **Measure Claude's sidebar once more and close the style gaps** the run lists under `sidebar_style_props_off`.
  Expect: S2.2 → pass; `sidebar_style_props_off` → 0.
  - Rung: sidebar
  - Needs: nothing
  - **Done: [`sidebar-style-1`](solutions/sidebar-style-1/)**, S2.2 met, props off 14 → 0 of 22, shall 18 → 17, checks
    85 → 71, no regressions; landed on [vibetracks main @ edbfc4e](https://github.com/zacharyyamaoka/vibetracks/commit/edbfc4e)
    (rows 32/34 px, 14 px titles, radius 8, dark fills 31/48/64, a 13 px "Tracks" list header).
- [x] **Home as one data-ui `<data-views>`** over one row per box, nested by the tree, presets Active / Done / All
  tracks. Expect: S3.1 → pass.
  - Rung: roll-ups
  - Needs: the tree file
  - **Done: [`rollups-2`](solutions/rollups-2/)**, with the two items below it: S3.1-S3.4 and S2.1 met, shall 10 → 5
    (ruler v2), checks 45 → 32, no regressions; landed on
    [vibetracks main @ 6a73de5](https://github.com/zacharyyamaoka/vibetracks/commit/6a73de5)
    ([PEP 0025](https://github.com/zacharyyamaoka/vibetracks/blob/main/docs/peps/0025-roll-up-pages-over-the-boxes.md)).
- [x] **Roll-ups from [`status.json`](status.json)**: a parent's own dot plus a pip when a descendant is worse, and agents summed
  over its subtree, on the sidebar and Home. Expect: S3.4 → pass.
  - Rung: roll-ups
  - Needs: the tree file
  - **Done in `rollups-2`** (above).
- [x] **Review and Feedback with the viewer's own components** (blackbox_agent's Needs-you and Feedback tabs) over the
  union of every box, plus a Track column and a by-track preset; Add feedback writes one note into the chosen box.
  Expect: S3.2, S3.3 → pass.
  - Rung: roll-ups
  - Needs: the tree file
  - **Done in `rollups-2`** (above).
- [x] **`vt new "<title>" [--parent] [--dir] [--from] [--publish [--public]]`** copying blackbox_agent's starter box,
  git init + first commit, private GitHub only with `--publish` after `gh auth status`; the New track dialog writes
  the command and gets a Create button running it. Expect: S4.1-S4.4 → pass.
  - Rung: new track
  - Needs: a starter box to copy. Since blackbox_agent 0.1.x, `blackbox new <dir>` writes one (OBJECTIVES, AGENTS,
    an empty ledger, nav.json, the Pages workflow; committed on main): call it rather than copy `template/`.
  - **Done: [`new-track-1`](solutions/new-track-1/)**, S4.1-S4.4 met, shall 14 → 10 (ruler v2), checks 57 → 45, no
    regressions; landed on [vibetracks main @ ecf4dd6](https://github.com/zacharyyamaoka/vibetracks/commit/ecf4dd6)
    ([PEP 0026](https://github.com/zacharyyamaoka/vibetracks/blob/main/docs/peps/0026-new-track-makes-a-box.md): a pinned
    copy of `blackbox new`, `--publish` private unless `--public`, after `gh auth status`).
- [x] **Pause / Resume** in the ··· and right-click menus, before Archive; a paused row shows a pause glyph and a
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
  - **Done: [`menus-2`](solutions/menus-2/)**, S2.10 met (records exactly PEP 0002's shape; a page request carrying its own `by` is refused).
- [x] **A real box opens on its own page, not its README.** Zach's boxes build their site with the blackbox package
  (no `site/index.html` in the repo), so today a real box shows its README; the ruler's fixture boxes ship a prebuilt
  `site/index.html` (the pre-package layout), which is why S1.1 passes anyway. Build it with
  `blackbox build --box <dir> --out <vt cache>/<id>` (reads git only, never writes the box) and serve that; rebuild on
  a new commit. Ruler v3: fixture boxes in the package format. Seen 2026-11-25 on six real boxes
  ([the report's hero](https://github.com/zacharyyamaoka/vibetracks_agent/blob/main/docs/build_progress_report.py)).
  - Rung: boxes
  - Needs: nothing
  - **Done: [`box-sites-2`](solutions/box-sites-2/)** (not a v2 item: proved on Zach's seven real boxes), landed on
    [vibetracks main @ 2d3e724](https://github.com/zacharyyamaoka/vibetracks/commit/2d3e724)
    ([PEP 0028](https://github.com/zacharyyamaoka/vibetracks/blob/main/docs/peps/0028-a-box-opens-on-its-own-site.md)):
    a box whose workflow builds with blackbox_agent is built by the vendored release into `<vt home>/cache/box-sites`
    (one build per box, ≤ 16 boxes and 512 MiB). claude_party_agent's build fails in blackbox_agent (a zero objective);
    it shows its README with the reason. Ruler v3: one fixture box in the package format.
- [x] **One state vocabulary.** robot_viz_agent's status.json says "watching", agent_activity_agent's "running"; Vibe
  Tracks shows both as Unknown. Map ai-team-status/1's words (or agree one list with the blackbox format).
  - Rung: roll-ups
  - Needs: nothing
  - **Done: [`states-1`](solutions/states-1/)**: `core/box_states.py` maps running/on_track → Working, watching → Idle, waiting_on_zach/blocked → Needs you, keeping the box's own word.
- [ ] **Ruler v3 candidates** (Zach's call, like any ruler change): S2.2 measures row pitch across the section header,
  so a Pinned header above the other tracks fails it (boxes-as-tracks-1 merged the headers to pass; Claude has
  separate ones); S1.4 clicks a row that sits under the account footer at its 420 px window.
  - Rung: meta
  - Needs: Zach
- [ ] **The use number** ([PEP 0001](docs/peps/0001-ruler-v2-use-number.md), accepted): `days_opened` and
  `boxes_opened_per_day` as a live stage, reported beside `shall_failing`, never a gate. A `vta tick` appends one
  `live` row a day from vibetracks' reader file and a per-person box-open counter (a person's click, never an agent's).
  - Rung: meta
  - Needs: ruler v2 frozen
- [x] **Headless `claude -p` chats count as working.** The claude-code adapter never sees a headless chat as live,
  though `state.json.inputs[].adapters[].sees_all` is true. Seen 2026-11-25 by the Agent Activity Agent: a `claude -p`
  chat (cwd ~/bam_ws) ran `vt brief pick-place-r1` and `vt claim pick-place-r1 …` from 08:08Z, its transcript under
  `~/.claude-personal/projects/` kept moving, and the track still read `sessions: {live: 0, working: 0}`, Stale. Expected:
  a chat whose transcript moved in the last few minutes and that `vt brief`/`vt claim` bound to a track counts as live
  and working, whatever its entrypoint. Bears on S3.4's agent counts for real use (the fixture has no chats).
  - Rung: roll-ups
  - Needs: nothing
  - **Done** (not a ruler item): [vibetracks main @ bd459dc](https://github.com/zacharyyamaoka/vibetracks/commit/bd459dc).
    Cause: Claude Code now sets `CLAUDE_CODE_CHILD_SESSION` in every shell, so `vt brief` took every chat for a subagent
    and never bound it; a subagent is now decided on evidence (PEP 0011 §2.4, amended). `vt claim` still doesn't bind
    (decided: binding on claim would move a chat onto any track it only audits).
- [ ] **Add this box to Zach's Vibe Tracks** once `vt add` exists. Expect: S5.1 verified by hand.
  - Rung: meta
  - Needs: `vt add`

## Suggestions for Zach

- [ ] **Rule on the hover chevron.** Claude's rows have no hover fold chevron (your Oct 16 Notion ask); Nov 24 says
  pixel-perfect Claude. Default: Claude wins, S2.9 stays a *should*. OBJECTIVES §10.1.
- [ ] **Sync and accounts.** Oct 25 asked for built-in sync and an online account; local boxes travel by their own git
  remotes. Default: the tree file is per machine in v1. OBJECTIVES §10.2.
- [x] **A use number for ruler v2.** Accepted 2026-11-25 (PEP 0001); queued under I'll try. Your W2 retro found Vibe Tracks "not that helpful". Scoring only the spec could
  ship a version that passes and still goes unused; candidate: days you opened it, or boxes opened from it per day,
  read from `vt serve`'s own log. OBJECTIVES §10.3. **Drafted:** [`docs/peps/0001-ruler-v2-use-number.md`](docs/peps/0001-ruler-v2-use-number.md); accept it by
  changing its status line.
- [ ] **A full starter box in blackbox_agent's `template/`**, so `vt new` (and anyone) can copy one: README,
  OBJECTIVES, AGENTS, PROGRESS, ledger.jsonl, ideas.md, REFERENCES.md, status.json, specs/, feedback/, site/. This
  repo is a working example to start it from.
