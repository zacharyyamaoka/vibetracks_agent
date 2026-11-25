# Progress

Ruler v2 ([`OBJECTIVES.md`](OBJECTIVES.md) §8, §11). Generated 2026-11-25T09:13:43Z by `vta progress` from [`ledger.jsonl`](ledger.jsonl); never edit by hand.

## Where it stands

- **Best admissible: [`rollups-2`](solutions/rollups-2/)**, **5 of 20 shall items failing** (target 0), 2 of 4 should, 32 checks failing.

## Leaderboard (dev)

Ruler v2 only. Admissible versions by shall failing, then should failing, then checks failing; then the rest (§8).

| rank | id | shall failing | should failing | checks failing | admissible | holdout shall | change | model |
|---|---|---|---|---|---|---|---|---|
| 1 | [`rollups-2`](solutions/rollups-2/) | 5 | 2 | 32 | yes | — | rollups-1 rebased on vibetracks main ecf4dd6 (vt new, PEP 0026): the roll-up pa… | claude-opus-5-5 |
| 2 | [`menus-1`](solutions/menus-1/) | 8 | 2 | 26 | yes | — | Claude's ··· menu over the boxes and Pause / Resume (PEP 0027 §2-§3): Open in ›… | claude-opus-5-5 |
| 3 | [`rollups-1`](solutions/rollups-1/) | 9 | 2 | 44 | yes | — | Roll-up pages over the boxes (PEP 0025): Home a data-ui <data-views> nested by … | claude-opus-5-5 |
| 4 | [`new-track-1`](solutions/new-track-1/) | 10 | 2 | 45 | yes | — | New track (PEP 0026): vt new "<title>" [--parent] [--dir] [--from] [--publish [… | claude-opus-5-5 |
| 5 | [`boxes-as-tracks-1-v2`](solutions/boxes-as-tracks-1-v2/) | 14 | 2 | 57 | yes | — | re-score on ruler v2 | claude-opus-5-5 |

## Earlier rulers

Scored on an earlier ruler: kept and labelled, never ranked against ruler v2 (OBJECTIVES §11); re-score one with `vta new` + `vta evaluate` to compare it.

| ruler | id | shall failing | should failing | checks failing | admissible | change |
|---|---|---|---|---|---|---|
| v1 | [`boxes-as-tracks-1`](solutions/boxes-as-tracks-1/) | 13 | 2 | 42 | yes | Boxes are the tracks (PEP 0024): Vibe Tracks' own tree file <vt home>/tree.json… |
| v1 | [`sidebar-style-1`](solutions/sidebar-style-1/) | 17 | 3 | 71 | yes | Sidebar style tokens to Claude 3.6556.1 (row 32/pitch 34, 14 px, radius 8, 24 p… |
| v1 | [`main-d0cb827`](solutions/main-d0cb827/) | 18 | 3 | 85 | yes | vibetracks main as it stood on 2026-11-24 (the baseline: before the Nov 24 desi… |

## Open work orders

The spec items [`rollups-2`](solutions/rollups-2/) does not meet (7); each is Zach's own words, in [`specs/`](specs/).

| item | kind | what | checks failing |
|---|---|---|---|
| [S2.3](specs/S2.3-row-menu-has-claudes-items.md) | shall | The ··· menu on a track has Claude's items, in Claude's order, with its shortcut letters | 5 of 10 |
| [S2.6](specs/S2.6-the-view-menu.md) | shall | The view menu: Group by, Sort by, Show, New section, Reset to defaults, View all | 7 of 8 |
| [S2.7](specs/S2.7-groupings.md) | shall | Groupings: flat by recent, and the parent tree | 3 of 4 |
| [S2.8](specs/S2.8-drag-to-reorder-on-a-stock-tree.md) | shall | Drag to reorder and to move under another track, on a stock tree component | 1 of 8 |
| [S2.10](specs/S2.10-pause-and-resume.md) | shall | Pause a track; a paused track looks paused and stays paused until resumed | 14 of 14 |
| [S1.4](specs/S1.4-live-local-data.md) | should | A box's data changing on disk shows on its page live | 2 of 2 |
| [S5.1](specs/S5.1-vibetracks-tracks-itself.md) | should | Vibe Tracks tracks itself: this box is a track in Zach's Vibe Tracks | 0 of 0 (no check: the spec note lists no test) |

## Last 10 evaluations

| t | id | split | ruler | shall | should | checks | admissible | wall s |
|---|---|---|---|---|---|---|---|---|
| 2026-11-25T05:20:16Z | [`main-d0cb827`](solutions/main-d0cb827/) | dev | v1 | 18 | 3 | 85 | yes | 403 |
| 2026-11-25T05:26:45Z | [`main-d0cb827`](solutions/main-d0cb827/) | holdout | v1 | 18 | 3 | 85 | yes | 378 |
| 2026-11-25T07:20:55Z | [`sidebar-style-1`](solutions/sidebar-style-1/) | dev | v1 | 17 | 3 | 71 | yes | 503 |
| 2026-11-25T08:07:19Z | [`boxes-as-tracks-1`](solutions/boxes-as-tracks-1/) | dev | v1 | 13 | 2 | 42 | yes | 347 |
| 2026-11-25T08:34:00Z | [`boxes-as-tracks-1-v2`](solutions/boxes-as-tracks-1-v2/) | dev | v2 | 20 | 4 | 119 | no | 289 |
| 2026-11-25T08:41:34Z | [`boxes-as-tracks-1-v2`](solutions/boxes-as-tracks-1-v2/) | dev | v2 | 14 | 2 | 57 | yes | 397 |
| 2026-11-25T08:54:07Z | [`new-track-1`](solutions/new-track-1/) | dev | v2 | 10 | 2 | 45 | yes | 414 |
| 2026-11-25T08:58:08Z | [`rollups-1`](solutions/rollups-1/) | dev | v2 | 9 | 2 | 44 | yes | 361 |
| 2026-11-25T09:07:59Z | [`rollups-2`](solutions/rollups-2/) | dev | v2 | 5 | 2 | 32 | yes | 367 |
| 2026-11-25T09:13:43Z | [`menus-1`](solutions/menus-1/) | dev | v2 | 8 | 2 | 26 | yes | 404 |
