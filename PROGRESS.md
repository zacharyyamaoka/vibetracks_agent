# Progress

Ruler v1 ([`OBJECTIVES.md`](OBJECTIVES.md) §8). Generated 2026-11-25T07:01:37Z by `vta progress` from [`ledger.jsonl`](ledger.jsonl); never edit by hand.

## Where it stands

- **Best admissible: [`main-d0cb827`](solutions/main-d0cb827/)**, **18 of 19 shall items failing** (target 0), 3 of 4 should, 85 checks failing.

## Leaderboard (dev)

Admissible versions by shall failing, then should failing, then checks failing; then the rest (§8).

| rank | id | shall failing | should failing | checks failing | admissible | holdout shall | change | model |
|---|---|---|---|---|---|---|---|---|
| 1 | [`main-d0cb827`](solutions/main-d0cb827/) | 18 | 3 | 85 | yes | 18 | vibetracks main as it stood on 2026-11-24 (the baseline: before the Nov 24 desi… | claude-opus-5-5 |

## Open work orders

The spec items [`main-d0cb827`](solutions/main-d0cb827/) does not meet (21); each is Zach's own words, in [`specs/`](specs/).

| item | kind | what | checks failing |
|---|---|---|---|
| [S1.1](specs/S1.1-a-track-is-a-box.md) | shall | A track is a black-box agent repo on this machine, and opening it shows that box's own site | 3 of 3 |
| [S1.2](specs/S1.2-a-box-holds-nothing-for-vibetracks.md) | shall | A box holds nothing for Vibe Tracks, and tree changes never write a box | 3 of 4 |
| [S1.3](specs/S1.3-vibetracks-owns-the-tree.md) | shall | Vibe Tracks owns the tree: parent, child, order, pins and sections | 3 of 3 |
| [S2.1](specs/S2.1-top-rows.md) | shall | Top rows: Home, Review, Feedback, New track | 1 of 3 |
| [S2.2](specs/S2.2-pixel-parity-with-claude.md) | shall | Pixel parity with the Claude desktop app's sidebar | 14 of 22 |
| [S2.3](specs/S2.3-row-menu-has-claudes-items.md) | shall | The ··· menu on a track has Claude's items, in Claude's order, with its shortcut letters | 9 of 9 |
| [S2.5](specs/S2.5-pin-and-the-pinned-section.md) | shall | Pin a track; pinned tracks sit in a Pinned section at the top | 4 of 4 |
| [S2.6](specs/S2.6-the-view-menu.md) | shall | The view menu: Group by, Sort by, Show, New section, Reset to defaults, View all | 8 of 8 |
| [S2.7](specs/S2.7-groupings.md) | shall | Groupings: flat by recent, and the parent tree | 4 of 4 |
| [S2.8](specs/S2.8-drag-to-reorder-on-a-stock-tree.md) | shall | Drag to reorder and to move under another track, on a stock tree component | 8 of 8 |
| [S3.1](specs/S3.1-home-is-a-stock-data-ui-table.md) | shall | Home is a stock data-ui table of tracks, folding by parent, with Active / Done / All tracks presets | 3 of 4 |
| [S3.2](specs/S3.2-review-across-tracks.md) | shall | Review is a box's own review page, over every track's waits | 3 of 3 |
| [S3.3](specs/S3.3-feedback-across-tracks.md) | shall | Feedback is a box's own feedback page, over every track's feedback notes | 3 of 3 |
| [S3.4](specs/S3.4-roll-ups-from-children.md) | shall | A parent rolls up its children: state and number of agents | 3 of 3 |
| [S4.1](specs/S4.1-vt-new-duplicates-the-template.md) | shall | `vt new` makes a new box by duplicating the black-box template | 6 of 6 |
| [S4.2](specs/S4.2-new-track-dialog-writes-the-command.md) | shall | The New track dialog writes the command to copy, and can run it | 2 of 3 |
| [S4.3](specs/S4.3-local-first-publish-optional.md) | shall | Local-only by default; publishing to GitHub is an option that needs `gh` signed in | 3 of 3 |
| [S4.4](specs/S4.4-new-box-lands-in-the-tree.md) | shall | A new box shows in the sidebar under its parent at once | 1 of 1 |
| [S1.4](specs/S1.4-live-local-data.md) | should | A box's data changing on disk shows on its page live | 2 of 2 |
| [S1.5](specs/S1.5-add-an-existing-box.md) | should | Add a box that already exists: a folder, or a GitHub repo to clone | 2 of 2 |
| [S5.1](specs/S5.1-vibetracks-tracks-itself.md) | should | Vibe Tracks tracks itself: this box is a track in Zach's Vibe Tracks | 0 of 0 (no check: the spec note lists no test) |

## Last 10 evaluations

| t | id | split | shall | should | checks | admissible | wall s |
|---|---|---|---|---|---|---|---|
| 2026-11-25T05:20:16Z | [`main-d0cb827`](solutions/main-d0cb827/) | dev | 18 | 3 | 85 | yes | 403 |
| 2026-11-25T05:26:45Z | [`main-d0cb827`](solutions/main-d0cb827/) | holdout | 18 | 3 | 85 | yes | 378 |
