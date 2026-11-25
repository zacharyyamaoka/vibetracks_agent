# Progress

Ruler v3 ([`OBJECTIVES.md`](OBJECTIVES.md) §8, §11). Generated 2026-11-25T20:00:38Z by `vta progress` from [`ledger.jsonl`](ledger.jsonl); never edit by hand.

## Where it stands

- **Best admissible: [`main-940b507-v3`](solutions/main-940b507-v3/)**, **2 of 23 shall items failing** (target 0), 1 of 3 should, 9 checks failing.
- **Opening a track: `open_ms` 816 ms** (target 100 ms; S1.6 wants it within 400 ms and nineteen opens in twenty within 1000 ms): the median of the package boxes' opens over both dev runs (each run: 875 ms and 650 ms; spread 225 ms). A package box's first open 3,141 ms, later opens 672 ms; every kind's median: files 209 ms, package 816 ms, readme 292 ms; p95 of all 176 opens 2,435 ms, slowest 4,863 ms. Per package open 95 requests, 1.66 MB the first time and 2.9 kB after; 10 builds waited on.

## Leaderboard (dev)

Ruler v3 only. Admissible versions by shall failing, then `open_ms` (rounded to 10 ms), then should failing, then checks failing; then the rest (§8).

| rank | id | shall failing | open ms | should failing | checks failing | admissible | holdout shall | change | model |
|---|---|---|---|---|---|---|---|---|---|
| 1 | [`main-940b507-v3`](solutions/main-940b507-v3/) | 2 | 816 | 1 | 9 | yes | — | vibetracks main @ 940b507 (= bb-0112-2's tree plus a docs commit) re-scored on … | claude-opus-5-5 |

## Earlier rulers

Scored on an earlier ruler: kept and labelled, never ranked against ruler v3 (OBJECTIVES §11); re-score one with `vta new` + `vta evaluate` to compare it.

| ruler | id | shall failing | should failing | checks failing | admissible | change |
|---|---|---|---|---|---|---|
| v1 | [`boxes-as-tracks-1`](solutions/boxes-as-tracks-1/) | 13 | 2 | 42 | yes | Boxes are the tracks (PEP 0024): Vibe Tracks' own tree file <vt home>/tree.json… |
| v1 | [`sidebar-style-1`](solutions/sidebar-style-1/) | 17 | 3 | 71 | yes | Sidebar style tokens to Claude 3.6556.1 (row 32/pitch 34, 14 px, radius 8, 24 p… |
| v1 | [`main-d0cb827`](solutions/main-d0cb827/) | 18 | 3 | 85 | yes | vibetracks main as it stood on 2026-11-24 (the baseline: before the Nov 24 desi… |
| v2 | [`bb-0110-1`](solutions/bb-0110-1/) | 0 | 1 | 0 | yes | re-vendor blackbox_agent 0.1.10 (fold: no divide by a zero objective; landing t… |
| v2 | [`bb-0112-2`](solutions/bb-0112-2/) | 0 | 1 | 0 | yes | blackbox-agent 0.1.12 bundled (the site bar reads ⌂ <box>), and an idle ingest … |
| v2 | [`dash-first-1`](solutions/dash-first-1/) | 0 | 1 | 0 | yes | a track opens on its box's dashboard |
| v2 | [`stock-tree-2`](solutions/stock-tree-2/) | 0 | 1 | 0 | yes | stock-tree-1 rebased on 2d3e724 (box-sites, S1.4) and its PEP renumbered 0030: … |
| v2 | [`stock-tree-1`](solutions/stock-tree-1/) | 0 | 2 | 2 | yes | Headless Tree under the sidebar's tree and drag (PEP 0028): @headless-tree/core… |
| v2 | [`box-sites-1`](solutions/box-sites-1/) | 1 | 1 | 1 | yes | A box opens on its own site (vibetracks PEP 0028 §2-§4): a package box is built… |
| v2 | [`box-sites-2`](solutions/box-sites-2/) | 1 | 1 | 1 | yes | box-sites-1 rebased on vibetracks main dec7b06 (lane M's serve memory, PEP 0017… |
| v2 | [`live-1`](solutions/live-1/) | 1 | 1 | 1 | yes | The sidebar keeps a row reachable at a short window (vibetracks PEP 0028 §6): o… |
| v2 | [`states-1`](solutions/states-1/) | 1 | 1 | 1 | yes | One state vocabulary (vibetracks PEP 0028 §5): status.json words in one table (… |
| v2 | [`view-2`](solutions/view-2/) | 1 | 2 | 3 | yes | view-1 rebased on 6a73de5: Claude's view menu over the boxes (PEP 0027 §4), Gro… |
| v2 | [`menus-2`](solutions/menus-2/) | 3 | 2 | 13 | yes | menus-1 rebased on vibetracks main 6a73de5 (roll-ups, PEP 0025): Claude's ··· m… |
| v2 | [`rollups-2`](solutions/rollups-2/) | 5 | 2 | 32 | yes | rollups-1 rebased on vibetracks main ecf4dd6 (vt new, PEP 0026): the roll-up pa… |
| v2 | [`view-1`](solutions/view-1/) | 6 | 2 | 16 | yes | Claude's view menu over the boxes (PEP 0027 §4): Group by › None / Parent / Sta… |
| v2 | [`menus-1`](solutions/menus-1/) | 8 | 2 | 26 | yes | Claude's ··· menu over the boxes and Pause / Resume (PEP 0027 §2-§3): Open in ›… |
| v2 | [`rollups-1`](solutions/rollups-1/) | 9 | 2 | 44 | yes | Roll-up pages over the boxes (PEP 0025): Home a data-ui <data-views> nested by … |
| v2 | [`new-track-1`](solutions/new-track-1/) | 10 | 2 | 45 | yes | New track (PEP 0026): vt new "<title>" [--parent] [--dir] [--from] [--publish [… |
| v2 | [`boxes-as-tracks-1-v2`](solutions/boxes-as-tracks-1-v2/) | 14 | 2 | 57 | yes | re-score on ruler v2 |
| v2 | [`bb-0112-1`](solutions/bb-0112-1/) | 0 | 2 | 1 | no | blackbox-agent 0.1.12 bundled: the dashboard's site bar reads ⌂ <box> and names… |

## Opening each box (`open_ms`, S1.6)

[`main-940b507-v3`](solutions/main-940b507-v3/)'s first dev run, one row per box of the speed group's click sequence (round 1 is a box's first open; [`ruler/suite/groups/speed.mjs`](ruler/suite/groups/speed.mjs)). Requests and bytes: what the browser fetched between the press and the page showing.

| box | kind | first open ms | p50 ms | p95 ms | first open: requests, bytes | later: requests, bytes (p50) |
|---|---|---|---|---|---|---|
| avocet_pick_agent | package | 2,602 | 1,501 | 2,450 | 98, 1,657 kB | 95, 3 kB |
| dunlin_vision_agent | package | 2,380 | 1,022 | 2,198 | 97, 1,657 kB | 95, 3 kB |
| brambling_bin_agent | package | 2,201 | 1,007 | 2,094 | 97, 1,657 kB | 95, 3 kB |
| shrike_lidar_agent | package | 2,377 | 899 | 2,178 | 98, 1,657 kB | 95, 3 kB |
| bittern_reach_agent | package | 2,621 | 875 | 2,359 | 97, 1,657 kB | 96, 3 kB |
| garganey_calibration_agent | package | 3,965 | 836 | 3,499 | 98, 1,657 kB | 95, 3 kB |
| heron_belt_agent | files | 524 | 339 | 517 | 4, 3 kB | 3, 3 kB |
| plover_wrist_agent | files | 232 | 337 | 456 | 3, 3 kB | 3, 3 kB |
| linnet_reach_agent | files | 212 | 313 | 429 | 3, 3 kB | 3, 3 kB |
| bittern_pick_agent | readme | 379 | 266 | 368 | 5, 83 kB | 6, 5 kB |
| redshank_conveyor_agent | files | 307 | 265 | 417 | 3, 3 kB | 3, 3 kB |
| garganey_vision_agent | files | 211 | 261 | 410 | 3, 3 kB | 3, 3 kB |
| brambling_lidar_agent | files | 223 | 250 | 300 | 3, 3 kB | 3, 3 kB |
| kestrel_fleet_agent | files | 291 | 249 | 607 | 3, 3 kB | 3, 3 kB |
| godwit_torque_agent | files | 228 | 246 | 272 | 3, 3 kB | 3, 3 kB |
| curlew_gripper_agent | files | 211 | 242 | 327 | 4, 3 kB | 3, 3 kB |
| siskin_motion_agent | files | 256 | 235 | 380 | 3, 3 kB | 3, 3 kB |
| shrike_suction_agent | files | 205 | 215 | 353 | 3, 3 kB | 3, 3 kB |
| avocet_calibration_agent | files | 190 | 199 | 366 | 3, 3 kB | 3, 3 kB |
| petrel_planner_agent | files | 180 | 194 | 240 | 3, 3 kB | 3, 3 kB |
| sanderling_grasp_agent | files | 189 | 184 | 234 | 3, 3 kB | 3, 3 kB |
| dunlin_bin_agent | files | 226 | 182 | 222 | 3, 3 kB | 3, 3 kB |

## Open work orders

The spec items [`main-940b507-v3`](solutions/main-940b507-v3/) does not meet (3); each is Zach's own words, in [`specs/`](specs/).

| item | kind | what | checks failing |
|---|---|---|---|
| [S1.6](specs/S1.6-opening-a-track-is-fast.md) | shall | Opening a track shows its page fast | 2 of 2 |
| [S2.11](specs/S2.11-search.md) | shall | Search: a palette on Ctrl+K, Ctrl+O and Ctrl+P that finds text in the tracks' files, the open track first | 7 of 7 |
| [S5.1](specs/S5.1-vibetracks-tracks-itself.md) | should | Vibe Tracks tracks itself: this box is a track in Zach's Vibe Tracks | 0 of 0 (no check: the spec note lists no test) |

## Last 10 evaluations

| t | id | split | ruler | shall | open ms | should | checks | admissible | wall s |
|---|---|---|---|---|---|---|---|---|---|
| 2026-11-25T14:10:21Z | [`dash-first-1`](solutions/dash-first-1/) | dev | v2 | 20 | — | 4 | 119 | no | 367 |
| 2026-11-25T14:35:58Z | [`dash-first-1`](solutions/dash-first-1/) | dev | v2 | 20 | — | 4 | 119 | no | 409 |
| 2026-11-25T14:45:14Z | [`dash-first-1`](solutions/dash-first-1/) | dev | v2 | 0 | — | 1 | 0 | yes | 534 |
| 2026-11-25T15:17:22Z | [`bb-0112-1`](solutions/bb-0112-1/) | dev | v2 | 20 | — | 4 | 119 | no | 411 |
| 2026-11-25T15:22:10Z | [`bb-0112-1`](solutions/bb-0112-1/) | dev | v2 | 20 | — | 4 | 119 | no | 236 |
| 2026-11-25T15:31:40Z | [`bb-0112-1`](solutions/bb-0112-1/) | dev | v2 | 0 | — | 2 | 1 | no | 539 |
| 2026-11-25T15:40:21Z | [`bb-0112-1`](solutions/bb-0112-1/) | dev | v2 | 0 | — | 2 | 1 | no | 491 |
| 2026-11-25T16:01:14Z | [`bb-0112-2`](solutions/bb-0112-2/) | dev | v2 | 0 | — | 1 | 0 | yes | 351 |
| 2026-11-25T19:39:48Z | [`main-940b507-v3`](solutions/main-940b507-v3/) | dev | v3 | 23 | — | 3 | 135 | no | 614 |
| 2026-11-25T19:59:53Z | [`main-940b507-v3`](solutions/main-940b507-v3/) | dev | v3 | 2 | 816 | 1 | 9 | yes | 1,025 |
