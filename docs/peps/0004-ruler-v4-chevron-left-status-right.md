# PEP 0004: Ruler v4 shows the fold chevron left of a parent's title at rest (Obsidian) and the status dot at the row's right end (Claude) (S2.9)

- **Status:** accepted 2026-11-25, under Zach's own ask of that day (quoted below; his ask is the go-ahead for the
  ruler change it needs). Frozen into ruler v4 by [`tools/freeze_ruler.py`](../../tools/freeze_ruler.py). Undo: revert the freeze commit; the v3
  ruler, its rows and its scorecards are all still in git.
- **Date:** 2026-11-25
- **Amends** [PEP 0003](0003-ruler-v3-open-speed-and-fold.md)'s S2.9 (the hover chevron); its S1.6 / `open_ms` and S2.11 are unchanged.

## Why

Zach, Daily Note - Nov 25 2026, # Issues with vibe tracks
([`feedback/2026-11-25-chevron-left-status-right.md`](../../feedback/2026-11-25-chevron-left-status-right.md)): *"Its not clear from the outside what has things where you can
fold afterwards. I think we need to move from shwoing the chervon on hover only to showing the shrvon on the right of
the word or something all"* … *"Ok so I think one option here is to swithc to like obisdan we show the vheron on the
left side just like this:"* (his image: Obsidian's file explorer, a chevron left of every folder at rest, ▸ folded and
▾ open, files without one) … *"and then on the right now we put the status icon"* (his image: a Claude sidebar, a
status icon — a ⚠ triangle, blue dots — at each row's right end).

Ruler v3's S2.9 required the opposite: the status dot in the leading slot, turning into the chevron only on hover, and
a check failed when the chevron stayed visible after the pointer left. A version doing what he now asks would have
scored one *shall* failing, and the loop would have "fixed" it back.

## The change (ruler v4)

**S2.9**, retitled "Fold and unfold: the chevron always left of a parent's title (Obsidian), the status dot at the
row's right end (Claude)" ([`specs/S2.9-row-anatomy.md`](../../specs/S2.9-row-anatomy.md)):

- a parent's fold chevron shows **left of its title at rest** (no hover needed); a leaf shows none (its leading slot
  stays, empty, so titles at one depth line up);
- the status dot sits at the **row's right end**, after the badges, never in the leading slot; on hover the row's
  `···` may take its place, as in Claude's sidebar;
- unchanged from v3: the labels "Fold N sub-tracks (← →)" / "Unfold N sub-tracks", chevron click folds and never
  opens, title click opens and never folds, ← →, a fold surviving a reload, a folded parent's roll-up (S3.4).

**Checks** (names change, the count does not):

| Group | v3 check | v4 check |
| --- | --- | --- |
| sidebar | S2.9 the status dot is in the leading slot | S2.9 the status dot is at the row's right end, nothing left of a leaf's title |
| sidebar | S2.9 a parent's fold chevron is hidden until hover | S2.9 a parent's fold chevron shows left of its title at rest |
| fold | S2.9 hovering a parent turns its status dot into the fold chevron, in the same slot | S2.9 a parent shows its fold chevron left of its title at rest, and its status dot at the row's right end |

"At the row's right end": the round status dot (3-12 px, as `dotIn` finds it) lies right of the title's start and its
right edge is within 40 px of the row's. "At rest": the pointer at (1300, 880), outside the sidebar. The fold group now
locates the chevron at rest (the last control left of the title, `controlsIn`) instead of from the dot's place, and
asserts it is still visible after the pointer leaves the row (v3 asserted the reverse). The other two sidebar S2.9
checks and the other six fold checks are as in v3.

**Spec totals:** 23 *shall*, 3 *should*, 135 checks (as v3). The fixture, the stage, the KPI `open_ms` (S1.6) and the
frozen refs are unchanged.

## Why this also helps S2.2

The S2.2 reference ([`ruler/reference/claude-sidebar.json`](../../ruler/reference/claude-sidebar.json), Claude 3.6556.1) draws a row's status dot at its right end;
the v3 sidebar group carried a comment that S2.9 asked for the leading slot instead. Under v4 both items want the dot in
the same place, so OBJECTIVES §10.1's tension is resolved rather than traded. S2.2's own checks (dot size, the `···`
at the row's right end, the 36 px title inset) are unchanged and still pass with the leading slot kept at its width.

## Re-scoring

Every solution is re-scored on v4 by the loop's next run (not done in the session that froze this). Until a v4 row
exists, `vta progress` would show no `open_ms` for v4; `status.json` keeps its last v3 headline until then. v1-v3 rows
stay in the ledger, labelled, never ranked against v4.
