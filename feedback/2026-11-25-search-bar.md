---
id: fb-search-bar
polarity: negative
added: 2026-11-25
from: Zach
filed_by: claude-code (vibetracks_agent lane A)
model: claude-opus-5-5
words: exact
tracks: [vibetracks-agent]
specs: [S2.11, S2.1]
source: ["Zach's message to the Vibe Tracks Agent dispatcher, 2026-11-25, with a screenshot of the Claude desktop app's sidebar; relayed verbatim to lane A (the relay marks two elisions with …)"]
reacting_to: "the Vibe Tracks sidebar, which has no search: he wanted every place the boxes' files mention \"ruler v1\""
became: "docs/peps/0003-ruler-v3-open-speed-and-fold.md"
---

# A search bar, on Ctrl+K, Ctrl+O and Ctrl+P

## Observed

pleae support a search bar … bind it also to the hot keys ctrl K ctrl O and ctrk P for now … my goal is to be abel to like quickly jump to any section in the app with that text. Priority should be given to the open vibe track. My use case was that I wanted to see where else it spoke about like ruler v1 so I wanted to search the files for ruler v1.

His screenshot (not on disk): the top rows of the Claude desktop app's sidebar: **"+ New"**, **"🔍 Search"** with
**"Ctrl+K"** at the row's right end, **"Artifacts"**.

## Desired

A Search row in the sidebar's top rows, Claude's: the magnifier, "Search", and "Ctrl+K" at the right end. It and
Ctrl+K, Ctrl+O and Ctrl+P open one search palette. Typing finds that text across the tracks' files (and the app's
sections), each hit naming its track, file and line, the open track's hits first; Enter jumps to the page that
shows the hit; Escape closes it.

## Why

> [!ai] claude-code (vibetracks_agent lane A)
> Jumping by text is how he moves between his boxes' notes: his own case was "where else does it say ruler v1". It
> became **S2.11** (new, shall) in ruler v3 ([PEP 0003](../docs/peps/0003-ruler-v3-open-speed-and-fold.md)), and S2.1's top-row list gains Search after New track
> (Claude's order: New, then Search). The fixture's boxes all carry "ruler v1" on line 5 of their README, so the
> ruler searches for his exact phrase.
