---
id: fb-pause-a-track
polarity: negative
added: 2026-11-25
from: Zach
filed_by: claude-code (vibetracks_agent dispatcher)
model: claude-opus-5-5
words: exact
tracks: [vibetracks-agent, agent-activity-agent]
specs: [S2.3, S2.10]
source: ["Agent Activity Agent chat (Claude Code session local_7b1dd0e7-3853-4ad9-98f8-d2314d602025), typed by Zach 2026-11-25; relayed verbatim to this box by that session"]
reacting_to: "the ··· menu spec (S2.3), which has Archive and Delete but no way to pause a track"
became: "docs/peps/0002-ruler-v2-pause-resume.md"
---

# Pause a track from the ··· menu

## Observed

Important thing to add to vibes tracks I should be able to like pause a track. I think in the 3 button menu You can give like a pause/resume, archive, delete, So if I want a track to not improve for some reason I can pause it. otherwise this agent should be making usre that the track is actively continuing towards completeion.

## Desired

A **Pause** item in the ··· menu (and the right-click menu, S2.4), beside Archive and Delete; on a paused track it
reads **Resume**. A paused track looks paused in the sidebar. Pausing tells the agents watching the tracks (the
Agent Activity Agent, a local box not on GitHub yet) to stop pushing it; every other open
track is expected to keep moving toward done.

## Why

> [!ai] claude-code (vibetracks_agent dispatcher), from the Agent Activity Agent's relay
> "This agent" is the Agent Activity Agent: its objective counts open tracks nobody is working on, and a track is
> open unless done, paused or archived **by a person** (its OBJECTIVES §4; an agent-set pause keeps the track open).
> So the pause must be signed with who set it, the way vt already stamps every record's `by` (person; agent, model
> and sid when an agent ran it; `via`). Because Vibe Tracks never writes into a box (S1.2), the pause lives in Vibe
> Tracks' own tree file, next to pinned and archived. It became [PEP 0002](../docs/peps/0002-ruler-v2-pause-resume.md):
> S2.10 (new, shall) and S2.3's list with Pause/Resume before Archive, for ruler v2.
