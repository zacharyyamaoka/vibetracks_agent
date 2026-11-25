# PEP 0002: Ruler v2 adds Pause / Resume (S2.10) and puts it in the ··· menu (S2.3)

- **Status:** accepted 2026-11-25 by the dispatcher, because it is Zach's own ask in his words
  ([`feedback/2026-11-25-pause-a-track.md`](../../feedback/2026-11-25-pause-a-track.md)). It freezes into ruler v2
  once the boxes-as-tracks lane's ruler-v1 run is scored: that run reads `ruler/` from this working tree, so the ruler
  files change only after it ends. Undo: set this line back to "proposed" before the freeze, or revert the freeze commit.
- **Date:** 2026-11-25
- **Does not include** [PEP 0001](0001-ruler-v2-use-number.md) (the use number): that one changes his success
  criteria beyond his words and stays his call.

## Why

Zach, 2026-11-25, typed in the Agent Activity Agent's chat and relayed verbatim: *"I should be able to like pause a
track. I think in the 3 button menu You can give like a pause/resume, archive, delete, So if I want a track to not
improve for some reason I can pause it. otherwise this agent should be making usre that the track is actively
continuing towards completeion."*

Ruler v1 can't score it: S2.3 lists Claude's nine items and allows extras only after Delete, behind a separator, and
nothing checks that a pause is recorded or shown.

## The change (ruler v2)

**S2.3, amended.** The ··· menu's list becomes Claude's items with **Pause `Z` / Resume `Z`** placed right before
Archive, in Archive's group, where he named it: Open in › · Pin/Unpin P · Mark as unread U · Rename R · Fork F ·
Move up/down · Move to section › · **Pause/Resume Z** · Archive A · Delete D. (`Z` because P is Pin's letter and Z
is free; a check reads the letter, so another free letter is a one-line change before the freeze.)

**S2.10 (new, shall): Pause a track; a paused track looks paused and stays paused until resumed.**

| What | Checked by |
|---|---|
| The ··· and right-click menus show **Pause** on an active track and **Resume** on a paused one | menu labels, real pointer events |
| Pausing changes nothing in the box (S1.2): it is Vibe Tracks' own state, in its own tree file, beside pinned and archived | box `git status` clean; no new file in the box |
| A paused row is visibly paused: a pause glyph in the status-dot slot and a muted title (Claude has no paused row; this is the closest honest look, and the sidebar measurement records it) | computed style + glyph present on screen, never DOM presence alone |
| It survives a reload and a `vt serve` restart | re-measured after both |
| **Who paused it is recorded**: from the page, a person record; from `vt pause <track>` run inside an agent's session, an agent record (vt stamps it, the caller can't) | the record's `by` in the tree file |
| Parity: `vt pause <track>` / `vt resume <track>` (named by the box folder's basename, like `vt add --parent`) do the same as the menu | CLI then page agree within one tick |
| Resume returns the row to its state colour and the menu to **Pause** | menu label + style |

## The record (what the Agent Activity Agent reads)

The tree file's entry for a track keeps an append-only `status` list; the latest record wins, and an empty list means
active. One record:

```json
{"at": "2026-11-25T08:10:00Z", "status": "paused", "by": {"person": "zach@…", "via": "page"}}
{"at": "2026-11-25T09:00:00Z", "status": "active", "by": {"person": "zach@…", "agent": "claude-code", "model": "claude-opus-5-5", "sid": "…", "via": "cli"}}
```

`by` is vibetracks' existing stamp (`vibetracks/core/records.py` `stamp()`): `person` always; `agent`, `model`,
`sid` and `account` only when an agent's session ran the verb; `via` is `page` or `cli`. **A person's pause = the
latest record is `paused` and its `by` has no `agent`.** The tree file's path and its other keys are the
boxes-as-tracks PEP's to name (vibetracks `docs/peps/`); this PEP fixes only the `status` list's shape.

## What it costs

- One spec note (`specs/S2.10-pause-and-resume.md`), the S2.3 note's list, one check group (`ruler/suite/groups/pause.mjs`) and
  S2.3's expected list in `menu.mjs`; `tools/freeze_ruler.py` re-pins the manifest; every solution is re-scored on v2
  (OBJECTIVES §11).
- The shall count goes 19 → 20.
