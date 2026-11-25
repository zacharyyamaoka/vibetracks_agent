---
id: fb-chevron-left-status-right
polarity: negative
added: 2026-11-25
from: Zach
filed_by: claude-code (Vibe Tracks session, chevron-left lane)
model: claude-opus-5-5
words: exact
tracks: [vibetracks-agent]
specs: [S2.9, S2.2]
source: ["Sources/Daily Notes/Daily Note - Nov 25 2026.md:1488, # Issues with vibe tracks, with two pasted images (Pasted image 20261125144943.png, Pasted image 20261125145003.png)"]
reacting_to: "ruler v3's S2.9: a parent's status dot in the leading slot turns into the fold chevron only on hover"
became: "docs/peps/0004-ruler-v4-chevron-left-status-right.md"
---

# Show the fold chevron on the left, always (Obsidian); the status icon on the right (Claude)

## Observed

Issues with vibe tracks.

1. it takes a long time to open any of the track I am not sure why it takes so long to load?
2. This should haven been aded as  KPI to vibe tracks
3. Its not clear from the outside what has things where you can fold afterwards. I think we need to move from shwoing the chervon on hover only to showing the shrvon on the right of the word or something all 

Ok so I think one option here is to swithc to like obisdan we show the vheron on the left side just like this:

His first image (Obsidian's file explorer): every folder row (Projects, reports, robotics_domain_model, Settings, sm,
Sources, Apple Notes, Books, Chats, Daily Notes …) leads with a chevron at rest, ▸ folded and ▾ open, no hover
needed; a file row (Daily Note - Nov 25 2026 …) has no chevron and its name lines up one step in; faint vertical
indent guides hang under each open folder's chevron.

and then on the right now we put the status icon

His second image (a Claude sidebar): each row's status icon sits at the row's right end, after the title: a ⚠
triangle on one row, blue dots on others, an empty circle on another; nothing at the left of the titles.

## Desired

From the outside, a row says whether it folds: a track with sub-tracks shows its chevron at the left of its title at
rest (Obsidian's explorer), and every track shows its status icon at the right end of its row (Claude's sidebar). The
title still opens the track and the chevron still folds it.

## Why

> [!ai] claude-code (Vibe Tracks session, chevron-left lane)
> Items 1 and 2 were already in the ruler before this note: [PEP 0003](../docs/peps/0003-ruler-v3-open-speed-and-fold.md)
> made the open speed the tracked KPI `open_ms` (S1.6) from his earlier words of the same day
> ([`2026-11-25-screens-load-too-slowly.md`](2026-11-25-screens-load-too-slowly.md)). Item 3 overrules that PEP's S2.9
> (the dot turning into the chevron only on hover, from [`2026-11-25-fold-tracks-like-notion.md`](2026-11-25-fold-tracks-like-notion.md)):
> hover-only hides which rows fold. It became [PEP 0004](../docs/peps/0004-ruler-v4-chevron-left-status-right.md),
> ruler v4: the chevron always visible left of a parent's title, the status dot at the row's right end. Claude's own
> sidebar draws the dot at the right end too (the S2.2 reference, Claude 3.6556.1), so the old tension of
> OBJECTIVES §10.1 is gone rather than traded.
