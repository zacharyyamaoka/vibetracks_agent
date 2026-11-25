# How an agent works here

You are the Vibe Tracks Agent (or one of its lanes). Your job: make Vibe Tracks meet the spec Zach gave on
2026-11-24 (a Claude-identical sidebar over his black-box agent repos, plus Home, Review and Feedback across them),
inside the gates. You do it by proposing versions of Vibe Tracks (vibetracks commits) and scoring them here.
[`OBJECTIVES.md`](OBJECTIVES.md) is the whole outside view; read it first.

## Start here (every session, in this order)

1. `pwd` and `git status`. Commit nothing you didn't write.
2. Read [`OBJECTIVES.md`](OBJECTIVES.md), then the [`specs/`](specs/) notes for the items you will touch.
3. `uv run --directory /home/bam/vibetracks_agent vta verify`. A failure stops everything.
4. Read [`PROGRESS.md`](PROGRESS.md) (regenerate with `vta progress` if the ledger is newer), then [`ideas.md`](ideas.md) and [`feedback/`](feedback/).
5. Pick one idea, or add one with the spec items it should turn green.
6. Build it in vibetracks on a branch or worktree (that repo's [`CLAUDE.md`](https://github.com/zacharyyamaoka/vibetracks/blob/main/CLAUDE.md), its PEPs and its gate apply there; never
   touch its Stable/Preview ports 4394-4397), then here:
   `vta new <id> --ref <branch or sha> --parent <id> --change "…" --agent "<agent>" --model "<model id>"`.
7. `vta evaluate <id>` (dev). It writes the scorecard, appends [`ledger.jsonl`](ledger.jsonl) and refreshes the generated files.
8. Commit, win or lose, by pathspec: `git add -- solutions/<id>` then
   `git commit -- solutions/<id> ledger.jsonl PROGRESS.md status.json site ideas.md`.
9. Cross the idea off in [`ideas.md`](ideas.md) with the id and the result; add what the result suggests.
10. A version that is admissible and beats the best lands on vibetracks `main` the vibetracks way (its gate, its
    PEP for any contract change). Zach's Stable moves only when he promotes it.

A rate limit or crash between any two steps loses nothing: the next session starts at step 1.

## Rules

- **Never edit the ruler**: [`OBJECTIVES.md`](OBJECTIVES.md), [`specs/`](specs/), [`ruler/`](ruler/). A ruler change is a new version, proposed in
  [`docs/peps/`](docs/peps/) for Zach, and every solution is re-scored on it.
- **New feedback is a note in [`feedback/`](feedback/)** (his words exact, the spec items it bears on); it reaches the ruler only
  through a version bump.
- **Never select on holdout.** It is scored only to report a finished solution.
- **Keep the losers.** A discarded version's scorecard tells the next agent what not to try.
- **One change per solution**, named in `meta.json`'s `change`.
- **A box is never written by Vibe Tracks** (S1.2), and never by you from here: the fixture boxes live in the
  evaluator's scratch dir.
- **Stock parts first**: the tree is Headless Tree's core (REFERENCES.md, "Tree and drag"); tables are data-ui; a
  box's page is the blackbox_agent viewer. Build only the missing seam.
- **State lives in files**: [`ledger.jsonl`](ledger.jsonl) + [`solutions/`](solutions/) + [`ideas.md`](ideas.md). No takeover brief is ever needed.
