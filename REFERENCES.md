# References

Prior art and the repos this box stands on. Swept 2026-11-24 from the vault's Vibe Tracks notes (named in each
item) and the web; npm versions and dates from the registry that day.

Every item links to where it can be opened. Web pages and GitHub repos open anywhere (a private repo opens for its
owner). A vault note's link (`obsidian://`) opens in Obsidian on Zach's machine only; anywhere else it is the note's
name, by design: the notes stay private while the repo is public.

## The reference app

- [Claude Code desktop](https://code.claude.com/docs/en/desktop): the reference app for the whole sidebar (S2.*). Its groups, pins and menus are what Vibe Tracks copies; never a second grouping model. From [Vibe Tracks — Off-the-Shelf Stand-ins to Use Now (2026-10-11)](obsidian://advanced-uri?vault=zach_brain&filepath=Sources%2FNotes%2FVibe%20Tracks%20%E2%80%94%20Off-the-Shelf%20Stand-ins%20to%20Use%20Now%20%282026-10-11%29.md&openmode=true), where it was the top pick at 71/100.
- **Claude Desktop sidebar CSS, read out 2026-10-09** (in [claude-hub](https://github.com/zacharyyamaoka/claude-hub), private; its report `reports/claude-code-200x-sidebar-2026-10-09.html` is local only): measured row height, type and fills; the source for S2.2's reference values, frozen here as [`ruler/reference/claude-sidebar.json`](ruler/reference/claude-sidebar.json).
- **Zach's screenshots of Claude's two menus** ([the view menu](site/assets/claude-view-menu.png) and [the row menu](site/assets/claude-row-menu.png), from [Daily Note Nov 24](obsidian://advanced-uri?vault=zach_brain&filepath=Sources%2FDaily%20Notes%2FDaily%20Note%20-%20Nov%2024%202026.md&openmode=true) "# Vibe tracks"): the view menu (Group by, Sort by, Show, New section, Reset to defaults, View all) and the row menu (Open in, Unpin, Mark as unread, Rename, Fork, Move down, Move to section, Archive, Delete). The literal spec for S2.3 and S2.6.
- **Vibe Tracks' own sidebar** ([`sidebar.js`](https://github.com/zacharyyamaoka/vibetracks/blob/d0cb827/vibetracks/home/static/sidebar.js) in the vibetracks package's `home/static` folder, at the baseline d0cb827; [as it looked](site/assets/vibetracks-sidebar-2026-11-24.png)): already Claude's row height, type, hover and selected fills, with the state dots (amber waits, grey blinking works, blue new, hollow ring idle). Reuse it; don't restart.
- **[Notion](https://www.notion.so)'s sidebar** ([Daily Note Oct 16](obsidian://advanced-uri?vault=zach_brain&filepath=Sources%2FDaily%20Notes%2FDaily%20Note%20-%20Oct%2016%202026.md&openmode=true), screenshots): the fold chevron shows on hover, so open and fold are separate targets. Clashes with pixel-perfect Claude ([OBJECTIVES §10.1](OBJECTIVES.md#10-open-tensions-defaults-taken-zachs-to-overrule)).

## Tree and drag

- [Headless Tree](https://headless-tree.lukasbach.com): **the pick for S2.8.** `@headless-tree/core` 1.8.1 (2026-11-24), MIT, no dependencies; ordered drag with reparenting, keyboard bindings, renaming, search, "accessible by default". It renders nothing, so the Claude-styled rows stay. Its docs are React-first: spike the vanilla path first.
- [Atlassian Pragmatic drag and drop](https://github.com/atlassian/pragmatic-drag-and-drop): the fallback. Framework-agnostic, Apache-2.0, core 4.0.0 (2026-09-24), used by Trello, Jira and Confluence; optional live-region and assistive-control packages. No tree model: folding and levels are yours to write.
- [Wunderbaum](https://github.com/mar10/wunderbaum): avoid. MIT, zero dependencies, 0.15.0 (2026-10-24), but it draws its own rows and grid, which fights pixel-perfect Claude.
- [SortableJS](https://github.com/SortableJS/Sortable): avoid. No tree semantics (fold, level, reparent target) and no keyboard path.
- **[react-arborist](https://github.com/brimdata/react-arborist), [@atlaskit/tree](https://www.npmjs.com/package/@atlaskit/tree)** (npm): avoid. Both need React; the page is vanilla JS. Zach named react-arborist as a guess on Oct 16.
- **Vibe Tracks' old board** ([PROJECT - Vibe Tracks](obsidian://advanced-uri?vault=zach_brain&filepath=Sources%2FNotes%2FPROJECT%20-%20Vibe%20Tracks.md&openmode=true)): a drag may never set a derived state (drops into Needs you or Stalled were refused). Keep that rule for the tree.

## Home table

- **[data-ui](https://github.com/zacharyyamaoka/data-ui)**: the stock row view every black-box tab uses; Home is one more `<data-views>` (S3.1). Zach, Nov 24: "I like how we use stock data Ui for each thing so like its super easy to just know the design langaugue".
- [Linear initiatives](https://linear.app/changelog/2026-07-02-initiative-properties): copy the shape (nested rows, aligned columns, roll-up, green/yellow/red health); not a backend, since its status is claimed, not observed. From [PROJECT - Vibe Tracks](obsidian://advanced-uri?vault=zach_brain&filepath=Sources%2FNotes%2FPROJECT%20-%20Vibe%20Tracks.md&openmode=true).
- **Vibe Tracks' tracks table** ([PROJECT - Vibe Tracks](obsidian://advanced-uri?vault=zach_brain&filepath=Sources%2FNotes%2FPROJECT%20-%20Vibe%20Tracks.md&openmode=true)): Name · Target · Health · Progress · State · Worked · last action, with Active / Done / All tabs: the presets S3.1 keeps.
- **[FINOS Perspective](https://perspective.finos.org) 5.6.0** (vendored in vibetracks [`static/vendor/perspective`](https://github.com/zacharyyamaoka/vibetracks/tree/d0cb827/vibetracks/home/static/vendor/perspective)): `expand(i)`, `collapse(i)`, `set_depth(n)`, sort within groups, if data-ui's fold falls short. From [Vibe Tracks — Full-Screen Tables, Pivots and Who Already Built It (2026-10-14)](obsidian://advanced-uri?vault=zach_brain&filepath=Sources%2FNotes%2FVibe%20Tracks%20%E2%80%94%20Full-Screen%20Tables%2C%20Pivots%20and%20Who%20Already%20Built%20It%20%282026-10-14%29.md&openmode=true).
- **[Metabase](https://www.metabase.com) and [Tableau](https://www.tableau.com)** (same note): copy Metabase's ± per group with the state saved; avoid Tableau's drill that expands every member at once.
- **The roll-up rule** (Zach, Oct 14, [PROJECT - Vibe Tracks](obsidian://advanced-uri?vault=zach_brain&filepath=Sources%2FNotes%2FPROJECT%20-%20Vibe%20Tracks.md&openmode=true)): a parent's dot is its own state; a worse sub-track shows as a pip (S3.4).

## Review and Feedback

- **The black-box viewer's Needs-you and Feedback tabs** (blackbox_agent [`viewer/`](https://github.com/zacharyyamaoka/blackbox_agent_lab/tree/main/viewer), [CONTRACT §17](https://github.com/zacharyyamaoka/blackbox_agent_lab/blob/main/viewer/CONTRACT.md); the lab is private, the released viewer ships in [blackbox_agent](https://github.com/zacharyyamaoka/blackbox_agent)): the components S3.2 and S3.3 reuse across every box, so a box's page and the roll-up never drift.
- [Linear similar issues](https://linear.app/changelog/2023-08-03-similar-issues): check before filing. From [Issue Trackers and Feedback Tools — What the Feedback Page Should Copy (2026-10-30)](obsidian://advanced-uri?vault=zach_brain&filepath=Sources%2FNotes%2FIssue%20Trackers%20and%20Feedback%20Tools%20%E2%80%94%20What%20the%20Feedback%20Page%20Should%20Copy%20%282026-10-30%29.md&openmode=true).
- [Canny Autopilot](https://help.canny.io/en/articles/8202451-autopilot): a repeat is a +1 on the old row, never a new one (same note).
- [Sentry issue states](https://docs.sentry.io/product/issues/states-triage/): a repeat is a regression only if it is newer than the fix (same note). Skip assignee, priority, extra statuses and auto-close by age.
- [Anthropic, redesigning source control](https://www.anthropic.com/research/redesigning-source-control): review what a change meant, not its lines; an agent's approval never counts as a person's. From [Vibe Tracks vs claude.dev — What Claude Engineers Recommend (2026-10-20)](obsidian://advanced-uri?vault=zach_brain&filepath=Sources%2FNotes%2FVibe%20Tracks%20vs%20claude.dev%20%E2%80%94%20What%20Claude%20Engineers%20Recommend%20%282026-10-20%29.md&openmode=true).
- **Zen review** ([PROJECT - Vibe Tracks](obsidian://advanced-uri?vault=zach_brain&filepath=Sources%2FNotes%2FPROJECT%20-%20Vibe%20Tracks.md&openmode=true), Oct 4-6): a count badge and the oldest item's age in the sidebar; Linear's priority inbox.

## New track and templates

- **blackbox_agent** ([the lab](https://github.com/zacharyyamaoka/blackbox_agent_lab), private: [`template/`](https://github.com/zacharyyamaoka/blackbox_agent_lab/tree/main/template), [`tools/apply_template.py`](https://github.com/zacharyyamaoka/blackbox_agent_lab/blob/main/tools/apply_template.py); the public package's [`blackbox new`](https://github.com/zacharyyamaoka/blackbox_agent#readme) writes a skeleton): the starter box `vt new` copies (S4.1). Its template is still partial (README header, nav.json, the Pages test); a full starter box is a blackbox_agent change.
- [gh repo create](https://cli.github.com/manual/gh_repo_create): `--private --source <dir> --push` makes and pushes the repo in one call (S4.3).
- [Copier](https://copier.readthedocs.io/): a template that can re-apply its own later changes to projects made from it (`copier update`). Prior art for "every box gets the template's fix", which a plain copy loses.
- [RFC 8628, device authorization](https://datatracker.ietf.org/doc/html/rfc8628): how `gh` signs in from a terminal. From [Vibe Tracks — Scope, Sync and Ten Proposals (2026-10-20)](obsidian://advanced-uri?vault=zach_brain&filepath=Sources%2FNotes%2FVibe%20Tracks%20%E2%80%94%20Scope%2C%20Sync%20and%20Ten%20Proposals%20%282026-10-20%29.md&openmode=true).
- **Unix fix** (same note): "A track is files only; adding one never touches the app", and the `vt` CLI as the one contract.

## Independent boxes and roll-ups

- [Git plumbing and porcelain](https://git-scm.com/book/en/v2/Git-Internals-Plumbing-and-Porcelain): each box writes stable files ([`status.json`](status.json), `site/data/state.json`); Vibe Tracks only reads and aggregates them (S1.2, S3.4). From [Vibe Tracks — Scope, Sync and Ten Proposals (2026-10-20)](obsidian://advanced-uri?vault=zach_brain&filepath=Sources%2FNotes%2FVibe%20Tracks%20%E2%80%94%20Scope%2C%20Sync%20and%20Ten%20Proposals%20%282026-10-20%29.md&openmode=true).
- **Per-host append-only records** ([Atuin](https://atuin.sh), [TaskChampion](https://github.com/GothenburgBitFactory/taskchampion); same note): a roll-up then needs no merge.
- **A lease per claim** ([Kubernetes Lease](https://kubernetes.io/docs/concepts/architecture/leases/); [Vibe Tracks — Bugs, Work Board and Agent Intent (2026-10-28)](obsidian://advanced-uri?vault=zach_brain&filepath=Sources%2FNotes%2FVibe%20Tracks%20%E2%80%94%20Bugs%2C%20Work%20Board%20and%20Agent%20Intent%20%28Prior%20Art%20%2B%20Design%2C%202026-10-28%29.md&openmode=true)): one way to count the agents working on a box.
- **Nobody ships a board of KPI tracks** ([Vibe Tracks — Prior Art for KPI Work Tracks (2026-10-06)](obsidian://advanced-uri?vault=zach_brain&filepath=Sources%2FNotes%2FVibe%20Tracks%20%E2%80%94%20Prior%20Art%20for%20KPI%20Work%20Tracks%20%282026-10-06%29.md&openmode=true)): the join key, a track id, is the only new part.

## Vault notes (prior analysis)

- [**PROJECT - Vibe Tracks**](obsidian://advanced-uri?vault=zach_brain&filepath=Sources%2FNotes%2FPROJECT%20-%20Vibe%20Tracks.md&openmode=true): the project note; its "where it stands (2026-10-09)" section, decision log and open questions.
- [**Vibe Tracks — Prior Art for KPI Work Tracks (2026-10-06)**](obsidian://advanced-uri?vault=zach_brain&filepath=Sources%2FNotes%2FVibe%20Tracks%20%E2%80%94%20Prior%20Art%20for%20KPI%20Work%20Tracks%20%282026-10-06%29.md&openmode=true): the Linear-first verdict.
- [**Vibe Tracks — Off-the-Shelf Stand-ins to Use Now (2026-10-11)**](obsidian://advanced-uri?vault=zach_brain&filepath=Sources%2FNotes%2FVibe%20Tracks%20%E2%80%94%20Off-the-Shelf%20Stand-ins%20to%20Use%20Now%20%282026-10-11%29.md&openmode=true): Claude Desktop's groups as the stand-in.
- [**Vibe Tracks — Full-Screen Tables, Pivots and Who Already Built It (2026-10-14)**](obsidian://advanced-uri?vault=zach_brain&filepath=Sources%2FNotes%2FVibe%20Tracks%20%E2%80%94%20Full-Screen%20Tables%2C%20Pivots%20and%20Who%20Already%20Built%20It%20%282026-10-14%29.md&openmode=true): folding tables.
- [**Vibe Tracks — Scope, Sync and Ten Proposals (2026-10-20)**](obsidian://advanced-uri?vault=zach_brain&filepath=Sources%2FNotes%2FVibe%20Tracks%20%E2%80%94%20Scope%2C%20Sync%20and%20Ten%20Proposals%20%282026-10-20%29.md&openmode=true): the files-in, state-out scope.
- [**Issue Trackers and Feedback Tools — What the Feedback Page Should Copy (2026-10-30)**](obsidian://advanced-uri?vault=zach_brain&filepath=Sources%2FNotes%2FIssue%20Trackers%20and%20Feedback%20Tools%20%E2%80%94%20What%20the%20Feedback%20Page%20Should%20Copy%20%282026-10-30%29.md&openmode=true): the Feedback page's rules.
- [**Agent Repo Format for Black-Box Optimization — Prior Art and a Standard (Research, 2026-11-24)**](obsidian://advanced-uri?vault=zach_brain&filepath=Tools%20%26%20Trackers%2FAgent%20Repo%20Format%20for%20Black-Box%20Optimization%20%E2%80%94%20Prior%20Art%20and%20a%20Standard%20%28Research%2C%202026-11-24%29.md&openmode=true): the box format itself.

## Repos this builds on

- **[vibetracks](https://github.com/zacharyyamaoka/vibetracks)**: the black box. Read by `git archive` only; never modified from here.
- **[blackbox_agent](https://github.com/zacharyyamaoka/blackbox_agent)** (released from [the lab](https://github.com/zacharyyamaoka/blackbox_agent_lab), private): the format, the viewer that draws this box's site, the starter template.
- **[claude_party_agent](https://github.com/zacharyyamaoka/claude_party_agent)** (private): the reference box for an app scored by acceptance scenarios.
