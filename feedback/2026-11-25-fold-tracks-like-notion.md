---
id: fb-fold-tracks-like-notion
polarity: negative
added: 2026-11-25
from: Zach
filed_by: claude-code (vibetracks_agent lane A)
model: claude-opus-5-5
words: exact
tracks: [vibetracks-agent]
specs: [S2.9, S3.4]
source: ["Zach's message to the Vibe Tracks Agent dispatcher, 2026-11-25, with a screenshot of the original (pre-Nov-24) Vibe Tracks sidebar; relayed verbatim to lane A"]
reacting_to: "ruler v2, where folding a track's sub-tracks was S2.9, a should, held back by the pixel-parity tension (OBJECTIVES §10.1)"
became: "docs/peps/0003-ruler-v3-open-speed-and-fold.md"
---

# Fold and unfold tracks, like folders in Notion

## Observed

add as feedback and spec. the vibe tracks side panel we need to be able to collapse and expand things. just like you can collapse and expand folders this is very important for doing roll up! Our reference here is notion. we don't have seperate folders per say instead each track it self is a folder. right now we have the design where when you hover over the dot it should turn into a chvron: Please reference the orginal vieb tracks side bar for t that looks like

His reference screenshot (the original, pre-Nov-24 Vibe Tracks sidebar; the image is not on disk): the row
**BAM Robotics** hovered; its status dot replaced by a **▾ chevron button in the leading slot**; `?` and `···` at the
row's right end; under the chevron a tooltip reading **"Fold 8 sub-tracks (← →)"**; a child row **Pick and place**
below it, indented.

## Desired

Every track with sub-tracks folds and unfolds in the sidebar like a Notion page with sub-pages: there is no separate
folder, the track itself is the folder. On hover its status dot turns into the fold chevron in the same slot; the
chevron's tooltip says how many sub-tracks it folds and that ← → do it from the keyboard. Folding is what makes a
roll-up readable: a folded parent stands for its whole subtree.

## Why

> [!ai] claude-code (vibetracks_agent lane A)
> His words settle OBJECTIVES §10.1 (Oct 16's hover chevron vs Nov 24's pixel-perfect Claude): a parent's hover
> chevron in the dot's slot is required, Notion's pattern, and Claude's pixel parity (S2.2) holds everywhere else. It
> became [PEP 0003](../docs/peps/0003-ruler-v3-open-speed-and-fold.md): **S2.9** promoted from should to shall, with
> checks for the chevron in the dot's slot, its "Fold N sub-tracks (← →)" label, fold and unfold by click and by ←
> →, the fold surviving a reload, and a folded parent keeping its roll-up (S3.4). The original sidebar's code is
> vibetracks `vibetracks/home/static/sidebar.js` (`leadSlot`: the chevron in the lead slot, its `title` "Fold N
> sub-tracks (← →)").
