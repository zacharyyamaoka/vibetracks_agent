---
id: fb-screens-load-too-slowly
polarity: negative
added: 2026-11-25
from: Zach
filed_by: claude-code (vibetracks_agent lane A)
model: claude-opus-5-5
words: exact
tracks: [vibetracks-agent]
specs: [S1.6, S1.1]
source: ["Zach's message to the Vibe Tracks Agent dispatcher, 2026-11-25, with a screenshot of his Preview (:4396); relayed verbatim to lane A"]
reacting_to: "his Preview: he clicked \"Blackbox Agent Agent\" in the sidebar and the main pane stayed blank white while the box's page loaded"
became: "docs/peps/0003-ruler-v3-open-speed-and-fold.md"
---

# The screens take way too long to appear

## Observed

Please add a KPi which is how fast the screens apper when you click them right now they take wayyyyy to long to load: Please add this an an objective you track. make like a repeatable determinstic way to measure it, and then start making some improvements so that this loads faster

His screenshot (not on disk): Vibe Tracks Preview, the "Blackbox Agent Agent" row selected in the sidebar, and the
whole main pane blank white while that box's page loads.

## Desired

A number for "how fast a track's page appears when I click it", measured the same way every time, tracked like the
box's other objectives, and then driven down.

## Why

> [!ai] claude-code (vibetracks_agent lane A)
> What the dispatcher measured in his Preview the same day (headless Chromium, read-only): opening a built package box
> took 0.9-1.2 s to its dashboard text, 94-112 requests and 2.5-5 MB per open (the dashboard viewer loads as about 90
> separate ES modules, `Cache-Control: no-cache`, nothing shared between boxes); one open took 7.6 s behind a slow
> `/tree.json`; and 15 of his 24 boxes were never built, so their first click waits for `blackbox build` (0.3-6.7 s,
> one at a time). Ruler v2 could not see any of it: its fixture boxes commit a tiny `site/index.html`, and no check
> times anything. It became [PEP 0003](../docs/peps/0003-ruler-v3-open-speed-and-fold.md): **S1.6** (new, shall) and
> the KPI `open_ms`, timed in the page from the row's press to the box's own content on screen, over a fixed click
> sequence that includes package boxes built by the version itself; `vta speed` times his own Preview the same way.
