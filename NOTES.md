# The design in one screen

Zach, 2026-11-24: *"All vieb tracks now is though is just a side bar"* and *"Its nice not having to relearn new UIs."*

- **A track is a box.** Each black-box agent repo on this machine is self-contained and knows nothing of the others.
  There is no `vibetracks.toml`. Clicking a track shows that box's own site, live, because it's local (S1.1-S1.4).
- **Vibe Tracks owns the tree.** It holds parent, child, order, pins and sections in its own file, and rolls up each
  box's state and agent count to its parent (S1.3, S3.4).
- **The sidebar is Claude's**, pixel for pixel. It has pins, the view menu, the ··· and right-click menu, groupings, and
  drag to reorder and reparent on a stock tree (S2.1-S2.9).
- **Three roll-up pages over every box.**
  - Home is a stock data-ui table with Active / Done / All tracks.
  - Review and Feedback are a box's own pages, extended across every box (S3.1-S3.3).
- **New track is `vt new`.** It copies the black-box starter box, and the dialog writes the command to copy. Tracks are
  local-only by default; publishing to GitHub is an option and needs `gh` (S4.1-S4.4).

## The reference: Claude's two menus

The view menu over the list (S2.6):

![Claude's view menu: Group by None, Sort by Last updated, Show, New section, Reset to defaults, View all](../assets/claude-view-menu.png)

The ··· menu on a row (S2.3):

![Claude's row menu: Open in, Unpin P, Mark as unread U, Rename R, Fork F, Move down, Move to section, Archive A, Delete D](../assets/claude-row-menu.png)

Vibe Tracks' sidebar on Nov 24, before the redesign:

![Vibe Tracks' sidebar: Home, Review, Feedback, New track, then nested tracks with state dots and age badges](../assets/vibetracks-sidebar-2026-11-24.png)

## Open tensions (defaults in force; OBJECTIVES.md §10)

1. **Hover chevron (Oct 16) vs pixel-perfect Claude.** Claude wins, so S2.9 is a *should*.
2. **Built-in sync (Oct 25) vs local boxes.** The tree file is per machine; boxes sync through their own git.
3. **"Not that helpful" (W2 retro).** v1 scores the spec only. A use number is the ruler v2 candidate.
4. **Delete** never deletes a box's folder. **Rename** changes only Vibe Tracks' label. **Publish** is private.
