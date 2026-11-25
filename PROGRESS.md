# Progress

Ruler v2 ([`OBJECTIVES.md`](OBJECTIVES.md) §8, §11). Generated 2026-11-25T10:45:38Z by `vta progress` from [`ledger.jsonl`](ledger.jsonl); never edit by hand.

## Where it stands

- **Best admissible: [`stock-tree-2`](solutions/stock-tree-2/)**, **0 of 20 shall items failing** (target 0), 1 of 4 should, 0 checks failing.

## Leaderboard (dev)

Ruler v2 only. Admissible versions by shall failing, then should failing, then checks failing; then the rest (§8).

| rank | id | shall failing | should failing | checks failing | admissible | holdout shall | change | model |
|---|---|---|---|---|---|---|---|---|
| 1 | [`stock-tree-2`](solutions/stock-tree-2/) | 0 | 1 | 0 | yes | — | stock-tree-1 rebased on 2d3e724 (box-sites, S1.4) and its PEP renumbered 0030: … | claude-opus-5-5 |
| 2 | [`stock-tree-1`](solutions/stock-tree-1/) | 0 | 2 | 2 | yes | — | Headless Tree under the sidebar's tree and drag (PEP 0028): @headless-tree/core… | claude-opus-5-5 |
| 3 | [`box-sites-1`](solutions/box-sites-1/) | 1 | 1 | 1 | yes | — | A box opens on its own site (vibetracks PEP 0028 §2-§4): a package box is built… | claude-opus-5-5 |
| 4 | [`box-sites-2`](solutions/box-sites-2/) | 1 | 1 | 1 | yes | — | box-sites-1 rebased on vibetracks main dec7b06 (lane M's serve memory, PEP 0017… | claude-opus-5-5 |
| 5 | [`live-1`](solutions/live-1/) | 1 | 1 | 1 | yes | — | The sidebar keeps a row reachable at a short window (vibetracks PEP 0028 §6): o… | claude-opus-5-5 |
| 6 | [`states-1`](solutions/states-1/) | 1 | 1 | 1 | yes | — | One state vocabulary (vibetracks PEP 0028 §5): status.json words in one table (… | claude-opus-5-5 |
| 7 | [`view-2`](solutions/view-2/) | 1 | 2 | 3 | yes | — | view-1 rebased on 6a73de5: Claude's view menu over the boxes (PEP 0027 §4), Gro… | claude-opus-5-5 |
| 8 | [`menus-2`](solutions/menus-2/) | 3 | 2 | 13 | yes | — | menus-1 rebased on vibetracks main 6a73de5 (roll-ups, PEP 0025): Claude's ··· m… | claude-opus-5-5 |
| 9 | [`rollups-2`](solutions/rollups-2/) | 5 | 2 | 32 | yes | — | rollups-1 rebased on vibetracks main ecf4dd6 (vt new, PEP 0026): the roll-up pa… | claude-opus-5-5 |
| 10 | [`view-1`](solutions/view-1/) | 6 | 2 | 16 | yes | — | Claude's view menu over the boxes (PEP 0027 §4): Group by › None / Parent / Sta… | claude-opus-5-5 |
| 11 | [`menus-1`](solutions/menus-1/) | 8 | 2 | 26 | yes | — | Claude's ··· menu over the boxes and Pause / Resume (PEP 0027 §2-§3): Open in ›… | claude-opus-5-5 |
| 12 | [`rollups-1`](solutions/rollups-1/) | 9 | 2 | 44 | yes | — | Roll-up pages over the boxes (PEP 0025): Home a data-ui <data-views> nested by … | claude-opus-5-5 |
| 13 | [`new-track-1`](solutions/new-track-1/) | 10 | 2 | 45 | yes | — | New track (PEP 0026): vt new "<title>" [--parent] [--dir] [--from] [--publish [… | claude-opus-5-5 |
| 14 | [`boxes-as-tracks-1-v2`](solutions/boxes-as-tracks-1-v2/) | 14 | 2 | 57 | yes | — | re-score on ruler v2 | claude-opus-5-5 |

## Earlier rulers

Scored on an earlier ruler: kept and labelled, never ranked against ruler v2 (OBJECTIVES §11); re-score one with `vta new` + `vta evaluate` to compare it.

| ruler | id | shall failing | should failing | checks failing | admissible | change |
|---|---|---|---|---|---|---|
| v1 | [`boxes-as-tracks-1`](solutions/boxes-as-tracks-1/) | 13 | 2 | 42 | yes | Boxes are the tracks (PEP 0024): Vibe Tracks' own tree file <vt home>/tree.json… |
| v1 | [`sidebar-style-1`](solutions/sidebar-style-1/) | 17 | 3 | 71 | yes | Sidebar style tokens to Claude 3.6556.1 (row 32/pitch 34, 14 px, radius 8, 24 p… |
| v1 | [`main-d0cb827`](solutions/main-d0cb827/) | 18 | 3 | 85 | yes | vibetracks main as it stood on 2026-11-24 (the baseline: before the Nov 24 desi… |

## Open work orders

The spec items [`stock-tree-2`](solutions/stock-tree-2/) does not meet (1); each is Zach's own words, in [`specs/`](specs/).

| item | kind | what | checks failing |
|---|---|---|---|
| [S5.1](specs/S5.1-vibetracks-tracks-itself.md) | should | Vibe Tracks tracks itself: this box is a track in Zach's Vibe Tracks | 0 of 0 (no check: the spec note lists no test) |

## Last 10 evaluations

| t | id | split | ruler | shall | should | checks | admissible | wall s |
|---|---|---|---|---|---|---|---|---|
| 2026-11-25T09:23:05Z | [`view-1`](solutions/view-1/) | dev | v2 | 6 | 2 | 16 | yes | 448 |
| 2026-11-25T09:31:46Z | [`menus-2`](solutions/menus-2/) | dev | v2 | 3 | 2 | 13 | yes | 387 |
| 2026-11-25T09:41:02Z | [`view-2`](solutions/view-2/) | dev | v2 | 1 | 2 | 3 | yes | 409 |
| 2026-11-25T10:04:32Z | [`live-1`](solutions/live-1/) | dev | v2 | 20 | 4 | 119 | no | 331 |
| 2026-11-25T10:10:16Z | [`states-1`](solutions/states-1/) | dev | v2 | 1 | 1 | 1 | yes | 344 |
| 2026-11-25T10:15:33Z | [`box-sites-1`](solutions/box-sites-1/) | dev | v2 | 1 | 1 | 1 | yes | 316 |
| 2026-11-25T10:31:19Z | [`box-sites-2`](solutions/box-sites-2/) | dev | v2 | 1 | 1 | 1 | yes | 326 |
| 2026-11-25T10:35:59Z | [`stock-tree-1`](solutions/stock-tree-1/) | dev | v2 | 0 | 2 | 2 | yes | 325 |
| 2026-11-25T10:36:29Z | [`live-1`](solutions/live-1/) | dev | v2 | 1 | 1 | 1 | yes | 309 |
| 2026-11-25T10:45:38Z | [`stock-tree-2`](solutions/stock-tree-2/) | dev | v2 | 0 | 1 | 0 | yes | 334 |
