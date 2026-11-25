# Progress

Ruler v2 ([`OBJECTIVES.md`](OBJECTIVES.md) §8, §11). Generated 2026-11-25T16:01:14Z by `vta progress` from [`ledger.jsonl`](ledger.jsonl); never edit by hand.

## Where it stands

- **Best admissible: [`bb-0110-1`](solutions/bb-0110-1/)**, **0 of 20 shall items failing** (target 0), 1 of 4 should, 0 checks failing.

## Leaderboard (dev)

Ruler v2 only. Admissible versions by shall failing, then should failing, then checks failing; then the rest (§8).

| rank | id | shall failing | should failing | checks failing | admissible | holdout shall | change | model |
|---|---|---|---|---|---|---|---|---|
| 1 | [`bb-0110-1`](solutions/bb-0110-1/) | 0 | 1 | 0 | yes | — | re-vendor blackbox_agent 0.1.10 (fold: no divide by a zero objective; landing t… | claude-sonnet-5-5 |
| 2 | [`bb-0112-2`](solutions/bb-0112-2/) | 0 | 1 | 0 | yes | — | blackbox-agent 0.1.12 bundled (the site bar reads ⌂ <box>), and an idle ingest … | claude-opus-5-5 |
| 3 | [`dash-first-1`](solutions/dash-first-1/) | 0 | 1 | 0 | yes | — | a track opens on its box's dashboard | claude-opus-5-5 |
| 4 | [`stock-tree-2`](solutions/stock-tree-2/) | 0 | 1 | 0 | yes | — | stock-tree-1 rebased on 2d3e724 (box-sites, S1.4) and its PEP renumbered 0030: … | claude-opus-5-5 |
| 5 | [`stock-tree-1`](solutions/stock-tree-1/) | 0 | 2 | 2 | yes | — | Headless Tree under the sidebar's tree and drag (PEP 0028): @headless-tree/core… | claude-opus-5-5 |
| 6 | [`box-sites-1`](solutions/box-sites-1/) | 1 | 1 | 1 | yes | — | A box opens on its own site (vibetracks PEP 0028 §2-§4): a package box is built… | claude-opus-5-5 |
| 7 | [`box-sites-2`](solutions/box-sites-2/) | 1 | 1 | 1 | yes | — | box-sites-1 rebased on vibetracks main dec7b06 (lane M's serve memory, PEP 0017… | claude-opus-5-5 |
| 8 | [`live-1`](solutions/live-1/) | 1 | 1 | 1 | yes | — | The sidebar keeps a row reachable at a short window (vibetracks PEP 0028 §6): o… | claude-opus-5-5 |
| 9 | [`states-1`](solutions/states-1/) | 1 | 1 | 1 | yes | — | One state vocabulary (vibetracks PEP 0028 §5): status.json words in one table (… | claude-opus-5-5 |
| 10 | [`view-2`](solutions/view-2/) | 1 | 2 | 3 | yes | — | view-1 rebased on 6a73de5: Claude's view menu over the boxes (PEP 0027 §4), Gro… | claude-opus-5-5 |
| 11 | [`menus-2`](solutions/menus-2/) | 3 | 2 | 13 | yes | — | menus-1 rebased on vibetracks main 6a73de5 (roll-ups, PEP 0025): Claude's ··· m… | claude-opus-5-5 |
| 12 | [`rollups-2`](solutions/rollups-2/) | 5 | 2 | 32 | yes | — | rollups-1 rebased on vibetracks main ecf4dd6 (vt new, PEP 0026): the roll-up pa… | claude-opus-5-5 |
| 13 | [`view-1`](solutions/view-1/) | 6 | 2 | 16 | yes | — | Claude's view menu over the boxes (PEP 0027 §4): Group by › None / Parent / Sta… | claude-opus-5-5 |
| 14 | [`menus-1`](solutions/menus-1/) | 8 | 2 | 26 | yes | — | Claude's ··· menu over the boxes and Pause / Resume (PEP 0027 §2-§3): Open in ›… | claude-opus-5-5 |
| 15 | [`rollups-1`](solutions/rollups-1/) | 9 | 2 | 44 | yes | — | Roll-up pages over the boxes (PEP 0025): Home a data-ui <data-views> nested by … | claude-opus-5-5 |

## Earlier rulers

Scored on an earlier ruler: kept and labelled, never ranked against ruler v2 (OBJECTIVES §11); re-score one with `vta new` + `vta evaluate` to compare it.

| ruler | id | shall failing | should failing | checks failing | admissible | change |
|---|---|---|---|---|---|---|
| v1 | [`boxes-as-tracks-1`](solutions/boxes-as-tracks-1/) | 13 | 2 | 42 | yes | Boxes are the tracks (PEP 0024): Vibe Tracks' own tree file <vt home>/tree.json… |
| v1 | [`sidebar-style-1`](solutions/sidebar-style-1/) | 17 | 3 | 71 | yes | Sidebar style tokens to Claude 3.6556.1 (row 32/pitch 34, 14 px, radius 8, 24 p… |
| v1 | [`main-d0cb827`](solutions/main-d0cb827/) | 18 | 3 | 85 | yes | vibetracks main as it stood on 2026-11-24 (the baseline: before the Nov 24 desi… |

## Open work orders

The spec items [`bb-0110-1`](solutions/bb-0110-1/) does not meet (1); each is Zach's own words, in [`specs/`](specs/).

| item | kind | what | checks failing |
|---|---|---|---|
| [S5.1](specs/S5.1-vibetracks-tracks-itself.md) | should | Vibe Tracks tracks itself: this box is a track in Zach's Vibe Tracks | 0 of 0 (no check: the spec note lists no test) |

## Last 10 evaluations

| t | id | split | ruler | shall | should | checks | admissible | wall s |
|---|---|---|---|---|---|---|---|---|
| 2026-11-25T10:45:38Z | [`stock-tree-2`](solutions/stock-tree-2/) | dev | v2 | 0 | 1 | 0 | yes | 334 |
| 2026-11-25T11:09:32Z | [`bb-0110-1`](solutions/bb-0110-1/) | dev | v2 | 0 | 1 | 0 | yes | 318 |
| 2026-11-25T14:10:21Z | [`dash-first-1`](solutions/dash-first-1/) | dev | v2 | 20 | 4 | 119 | no | 367 |
| 2026-11-25T14:35:58Z | [`dash-first-1`](solutions/dash-first-1/) | dev | v2 | 20 | 4 | 119 | no | 409 |
| 2026-11-25T14:45:14Z | [`dash-first-1`](solutions/dash-first-1/) | dev | v2 | 0 | 1 | 0 | yes | 534 |
| 2026-11-25T15:17:22Z | [`bb-0112-1`](solutions/bb-0112-1/) | dev | v2 | 20 | 4 | 119 | no | 411 |
| 2026-11-25T15:22:10Z | [`bb-0112-1`](solutions/bb-0112-1/) | dev | v2 | 20 | 4 | 119 | no | 236 |
| 2026-11-25T15:31:40Z | [`bb-0112-1`](solutions/bb-0112-1/) | dev | v2 | 0 | 2 | 1 | no | 539 |
| 2026-11-25T15:40:21Z | [`bb-0112-1`](solutions/bb-0112-1/) | dev | v2 | 0 | 2 | 1 | no | 491 |
| 2026-11-25T16:01:14Z | [`bb-0112-2`](solutions/bb-0112-2/) | dev | v2 | 0 | 1 | 0 | yes | 351 |
