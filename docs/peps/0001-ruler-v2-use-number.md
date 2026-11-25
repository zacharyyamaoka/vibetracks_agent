# PEP 0001: Ruler v2 adds a use number

- **Status:** accepted 2026-11-25 by the dispatcher under Zach's standing default for reversible changes (Nov 4:
  "I would prefer it just goes with its default particularly on these things that are easy to reverse"). It adds a
  reported number only: never a gate, never used to choose a version, the headline stays `shall_failing`. It lands as
  a live stage after ruler v2 (PEP 0002) freezes. Undo: set this line back to "proposed" (nothing has been built on it).
- **Date:** 2026-11-24
- **Builds on:** OBJECTIVES.md §10.3

## Why

Zach's W2 retro (by Nov 21): *"Ok I haven't found the vibetracks thing to be that helpful. Mabye its just about me
actually taking the time in obsidan to just write it out"*. Ruler v1 scores only the spec. A version could pass all
19 *shall* items and still go unopened, and the ledger would call that a win. That is Goodhart's law: the spec
measures what Vibe Tracks does, not whether it helps.

## The change

Add a **live stage**, read from Zach's real machine. It is reported per day, like claude_party_agent's live rows, and
never used to choose between versions:

| Number | What | Source |
|---|---|---|
| `days_opened` (7-day window) | days on which a Vibe Tracks page was open | vibetracks already touches `<vt home>/reader` while a page reads the bundle (PEP 0017 §7); the tick records whether that happened that day |
| `boxes_opened_per_day` | distinct boxes opened from the sidebar | needs one counter in the box-opening route; a person's click, never an agent's |

**The headline stays `shall_failing`.** The live numbers sit beside it, the way ClaudeParty shows blocked minutes
next to its failing-scenario count. No gate: a use number is a question for Zach, never a bar a version must clear.

## What it costs

- One `vta tick` (like `cpa tick`) that reads those two files and appends a `live` row each day.
- The box-opening counter is a vibetracks change. It comes in its own commit after the boxes-as-tracks rung (ideas.md),
  because before that rung there are no boxes to open.

## To accept

Change "proposed" to "accepted" above and add a "v2" line to OBJECTIVES.md §11. The next agent builds `vta tick`.
