# References

Prior art and the repos this box stands on. Swept 2026-11-24 from the vault's Vibe Tracks notes (named in each
item) and the web; npm versions and dates from the registry that day.

## The reference app

- [Claude Code desktop](https://code.claude.com/docs/en/desktop): the reference app for the whole sidebar (S2.*). Its groups, pins and menus are what Vibe Tracks copies; never a second grouping model. From "Vibe Tracks — Off-the-Shelf Stand-ins to Use Now (2026-10-11)", where it was the top pick at 71/100.
- **Claude Desktop sidebar CSS, read out 2026-10-09** (claude-hub `reports/claude-code-200x-sidebar-2026-10-09.html`): measured row height, type and fills; the source for S2.2's reference values.
- **Zach's screenshots of Claude's two menus** (vault, Daily Note Nov 24 "# Vibe tracks"): the view menu (Group by, Sort by, Show, New section, Reset to defaults, View all) and the row menu (Open in, Unpin, Mark as unread, Rename, Fork, Move down, Move to section, Archive, Delete). The literal spec for S2.3 and S2.6.
- **Vibe Tracks' own sidebar** (`sidebar.js` in the vibetracks package's `home/static` folder): already Claude's row height, type, hover and selected fills, with the state dots (amber waits, grey blinking works, blue new, hollow ring idle). Reuse it; don't restart.
- **Notion's sidebar** (Daily Note Oct 16, screenshots): the fold chevron shows on hover, so open and fold are separate targets. Clashes with pixel-perfect Claude (OBJECTIVES §6.1).

## Tree and drag

- [Headless Tree](https://headless-tree.lukasbach.com): **the pick for S2.8.** `@headless-tree/core` 1.8.1 (2026-11-24), MIT, no dependencies; ordered drag with reparenting, keyboard bindings, renaming, search, "accessible by default". It renders nothing, so the Claude-styled rows stay. Its docs are React-first: spike the vanilla path first.
- [Atlassian Pragmatic drag and drop](https://github.com/atlassian/pragmatic-drag-and-drop): the fallback. Framework-agnostic, Apache-2.0, core 4.0.0 (2026-09-24), used by Trello, Jira and Confluence; optional live-region and assistive-control packages. No tree model: folding and levels are yours to write.
- [Wunderbaum](https://github.com/mar10/wunderbaum): avoid. MIT, zero dependencies, 0.15.0 (2026-10-24), but it draws its own rows and grid, which fights pixel-perfect Claude.
- [SortableJS](https://github.com/SortableJS/Sortable): avoid. No tree semantics (fold, level, reparent target) and no keyboard path.
- **react-arborist, @atlaskit/tree** (npm): avoid. Both need React; the page is vanilla JS. Zach named react-arborist as a guess on Oct 16.
- **Vibe Tracks' old board** (PROJECT - Vibe Tracks): a drag may never set a derived state (drops into Needs you or Stalled were refused). Keep that rule for the tree.

## Home table

- **data-ui** (`~/data-ui`): the stock row view every black-box tab uses; Home is one more `<data-views>` (S3.1). Zach, Nov 24: "I like how we use stock data Ui for each thing so like its super easy to just know the design langaugue".
- [Linear initiatives](https://linear.app/changelog/2026-07-02-initiative-properties): copy the shape (nested rows, aligned columns, roll-up, green/yellow/red health); not a backend, since its status is claimed, not observed. From PROJECT - Vibe Tracks.
- **Vibe Tracks' tracks table** (PROJECT - Vibe Tracks): Name · Target · Health · Progress · State · Worked · last action, with Active / Done / All tabs: the presets S3.1 keeps.
- **FINOS Perspective 5.6.0** (vendored in vibetracks `static/vendor/perspective`): `expand(i)`, `collapse(i)`, `set_depth(n)`, sort within groups, if data-ui's fold falls short. From "Vibe Tracks — Full-Screen Tables, Pivots and Who Already Built It (2026-10-14)".
- **Metabase and Tableau** (same note): copy Metabase's ± per group with the state saved; avoid Tableau's drill that expands every member at once.
- **The roll-up rule** (Zach, Oct 14, PROJECT - Vibe Tracks): a parent's dot is its own state; a worse sub-track shows as a pip (S3.4).

## Review and Feedback

- **The black-box viewer's Needs-you and Feedback tabs** (blackbox_agent `viewer/`, CONTRACT §17): the components S3.2 and S3.3 reuse across every box, so a box's page and the roll-up never drift.
- [Linear similar issues](https://linear.app/changelog/2023-08-03-similar-issues): check before filing. From "Issue Trackers and Feedback Tools — What the Feedback Page Should Copy (2026-10-30)".
- [Canny Autopilot](https://help.canny.io/en/articles/8202451-autopilot): a repeat is a +1 on the old row, never a new one (same note).
- [Sentry issue states](https://docs.sentry.io/product/issues/states-triage/): a repeat is a regression only if it is newer than the fix (same note). Skip assignee, priority, extra statuses and auto-close by age.
- [Anthropic, redesigning source control](https://www.anthropic.com/research/redesigning-source-control): review what a change meant, not its lines; an agent's approval never counts as a person's. From "Vibe Tracks vs claude.dev — What Claude Engineers Recommend (2026-10-20)".
- **Zen review** (PROJECT - Vibe Tracks, Oct 4-6): a count badge and the oldest item's age in the sidebar; Linear's priority inbox.

## New track and templates

- **blackbox_agent** (`~/blackbox_agent`, `template/`, `tools/apply_template.py`): the starter box `vt new` copies (S4.1). Its template is still partial (README header, nav.json, the Pages test); a full starter box is a blackbox_agent change.
- [gh repo create](https://cli.github.com/manual/gh_repo_create): `--private --source <dir> --push` makes and pushes the repo in one call (S4.3).
- [Copier](https://copier.readthedocs.io/): a template that can re-apply its own later changes to projects made from it (`copier update`). Prior art for "every box gets the template's fix", which a plain copy loses.
- [RFC 8628, device authorization](https://datatracker.ietf.org/doc/html/rfc8628): how `gh` signs in from a terminal. From "Vibe Tracks — Scope, Sync and Ten Proposals (2026-10-20)".
- **Unix fix** (same note): "A track is files only; adding one never touches the app", and the `vt` CLI as the one contract.

## Independent boxes and roll-ups

- [Git plumbing and porcelain](https://git-scm.com/book/en/v2/Git-Internals-Plumbing-and-Porcelain): each box writes stable files (`status.json`, `site/data/state.json`); Vibe Tracks only reads and aggregates them (S1.2, S3.4). From "Vibe Tracks — Scope, Sync and Ten Proposals (2026-10-20)".
- **Per-host append-only records** (Atuin, TaskChampion; same note): a roll-up then needs no merge.
- **A lease per claim** (Kubernetes Lease; "Vibe Tracks — Bugs, Work Board and Agent Intent (2026-10-28)"): one way to count the agents working on a box.
- **Nobody ships a board of KPI tracks** ("Vibe Tracks — Prior Art for KPI Work Tracks (2026-10-06)"): the join key, a track id, is the only new part.

## Vault notes (prior analysis)

- **PROJECT - Vibe Tracks**: the project note; its "where it stands (2026-10-09)" section, decision log and open questions.
- **Vibe Tracks — Prior Art for KPI Work Tracks (2026-10-06)**: the Linear-first verdict.
- **Vibe Tracks — Off-the-Shelf Stand-ins to Use Now (2026-10-11)**: Claude Desktop's groups as the stand-in.
- **Vibe Tracks — Full-Screen Tables, Pivots and Who Already Built It (2026-10-14)**: folding tables.
- **Vibe Tracks — Scope, Sync and Ten Proposals (2026-10-20)**: the files-in, state-out scope.
- **Issue Trackers and Feedback Tools — What the Feedback Page Should Copy (2026-10-30)**: the Feedback page's rules.
- **Agent Repo Format for Black-Box Optimization — Prior Art and a Standard (Research, 2026-11-24)**: the box format itself.

## Repos this builds on

- **vibetracks** (`~/vibetracks`): the black box. Read by `git archive` only; never modified from here.
- **blackbox_agent** (`~/blackbox_agent`): the format, the viewer that draws this box's site, the starter template.
- **claude_party_agent** (`~/claude_party_agent`): the reference box for an app scored by acceptance scenarios.
