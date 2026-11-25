# Vibe Tracks Agent

**[▶ Live landing page](https://zacharyyamaoka.github.io/vibetracks_agent/)**: not live yet. The repo is private, and Pages on a private repo needs a paid plan, so view it with `blackbox serve` below · a black-box agent repo built by the [blackbox_agent](https://github.com/zacharyyamaoka/blackbox_agent) package

Vibe Tracks as a black box. Vibe Tracks (`~/vibetracks`) is, since Zach's Nov 24 redesign, **just a sidebar** over the
black-box agent repos on his machine: click a track and you see that box's own site, live; above the tracks sit three
roll-up pages (Home, Review, Feedback) over all of them. The sidebar is a pixel-perfect copy of the Claude desktop
app's, so there is nothing new to learn. This repo freezes that spec (`OBJECTIVES.md`, ruler v1, one note per item in
`specs/`), scores every version of Vibe Tracks against it in a headless browser, and keeps every result in one
committed ledger. Yes, it is Vibe Tracks tracking itself.

| The number | Direction · target | Where it's measured |
|---|---|---|
| **Spec items not met** (`shall_failing`, headline) | ↓ · 0 of 19 | the acceptance run, per vibetracks commit, dev fixture |
| **Should items not met** (`should_failing`, tie-break) | ↓ · 0 of 4 | same run |
| **Sidebar style properties off Claude's** (diagnostic) | ↓ · 0 | S2.2's measured reference |

Where it stands right now: `PROGRESS.md` (generated) and the site (`site/index.html`).

## The design in one screen (Zach, 2026-11-24)

- **A track is a box.** Each black-box agent repo is self-contained and knows nothing of the others; no
  `vibetracks.toml`. Vibe Tracks alone owns the tree (parent, order, pins, sections) and rolls up the children's
  state and agent counts.
- **The sidebar is Claude's:** pins, a view menu (Group by, Sort by, Show, New section, Reset to defaults, View all),
  the ··· and right-click menu (Open in, Pin, Mark as unread, Rename, Fork, Move, Archive, Delete), drag to reorder and
  reparent on a stock tree.
- **Home** is a stock data-ui table, folding by parent, with Active / Done / All tracks presets. **Review** and
  **Feedback** are a box's own pages over every box.
- **New track** = `vt new`, which duplicates the black-box starter box; the dialog writes the command to copy (and can
  run it). Local-only by default; publishing to GitHub is an option that needs `gh` signed in.

## Run

```bash
uv run --directory /home/bam/vibetracks_agent vta progress
```

The site (landing page and dashboard) is built by the blackbox_agent package from this repo's git history:

```bash
uvx --from git+https://github.com/zacharyyamaoka/blackbox_agent@v0 blackbox serve --box /home/bam/vibetracks_agent
```

## Files

| File | What |
|---|---|
| `OBJECTIVES.md` | The outside view, frozen: the stage, the score, the gates, the spec table, open tensions |
| `specs/` | One note per requirement: Zach's words, what it means, why, how it is checked |
| `feedback/` | One note per piece of his feedback, words exact, with the spec items it became |
| `AGENTS.md` | How any agent works here: start-here order, the loop, the rules |
| `PROGRESS.md` | Generated digest of the ledger |
| `ideas.md` | The queue: *I'll try* and *Suggestions for Zach* |
| `ledger.jsonl` | Every result, append-only |
| `solutions/<id>/` | One vibetracks version each: `meta.json` (sha, parent, change, who proposed it) + scorecard + junit |
| `ruler/` | The frozen acceptance suite, its fixture generator and the measured Claude reference, with sha256s |
| `status.json` | `ai-team-status/1` |
| `REFERENCES.md` | Prior art and the repos this builds on |
| `site/` | What the page shows: `nav.json`, the dev junit, the reference screenshots; the package builds the rest |
| `docs/CONTRACT.md` | Schemas, CLI, write sets, deviations |

## Builds on

vibetracks (the box, read by `git archive` only; never modified from here), the blackbox_agent format and viewer,
and claude_party_agent (the reference for an app scored by acceptance scenarios).
