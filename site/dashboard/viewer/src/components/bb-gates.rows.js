/* The gates `.base` (viewer/CONTRACT.md §16.8): one row per gate node and column, the rows data-ui's nested gate matrix
   (data-ui CONTRACT §56) and its table draw, and the `.base` text whose presets are the four views over them. Pure (no
   DOM): bb-gates, bb-spec and the node tests import it.

   Zach, 2026-11-24 (PICKS.md "Zach's rulings ~17:35"): one gates `.base`; the table its generic base (v5); the matrix (v3)
   a preset that nests "like the table" in one column, every cell the same size, x = commit / day / iteration; v4's
   counting bar on top by default, v1's one-block strip the option; v1 Problems first a good view (bb-gates' own).

   Two trees, one file (`kind`), every state the fold's or the box's, never decided here (data-ui §35):
   - ruler: Admissible › each gate (the gates slice's order) › every dev task that fails a gate somewhere, one row per
     node per search iteration (the iterations slice; ablation runs are study variants, left out as bb-gates' timeline
     leaves them out). Admissible is the row's `admissible`; a gate is bb-gate-matrix's cellOf (failed_gates, then
     g_<gate>, else not recorded); a task fails where the iteration's gate_results names it (CONTRACT §16.7), passes where
     the gate was judged and does not name it, and is not recorded where the iteration has no gate_results for that gate.
     The columns are bb-gate-matrix's: iteration #n, the iteration's `commit` (upstream for an imported solution, the
     headliner's rule), the day it was evaluated; a commit or a day holding several shows the leading one by `rank`
     (bb-gate-matrix's leadOrder: search first, admissible first, best objective, earliest), so bb-gates' sentence, red
     line and why card (bb-gates.model.js) read the same column the matrix draws.
   - spec: section › requirement › test file › test, one row per test per commit it ran at (the spec_history slice, a
     junit run per commit), plus a requirement's own row where no test of a shall or should ran but the suite did
     ("no test", never a pass) or where it is deferred (lane G's rules, proposals-gates/_build/fold.py `spec_tree`). The
     columns: each commit (every commit asked for, a commit with no suite drawn n/a), its day (the day's latest commit),
     the iteration whose suite it is (the commit that added the solution; HEAD for the newest commit when it added
     none). */
import { leadOrder, solutionsOf, cellOf } from './bb-gate-matrix.model.js';

export const SEP = ' › ';
const CHAR = { P: 'pass', F: 'fail', S: 'skipped' };
const fin = (v) => typeof v === 'number' && Number.isFinite(v);
const short = (sha) => (sha ? String(sha).slice(0, 7) : null);
const natural = (a, b) => String(a).localeCompare(String(b), 'en', { numeric: true });

/** A requirement's section as the Spec tab names it (bb-spec's sectionLabel, kept in step). */
export const sectionOf = (r) => (r.section !== null && r.section !== undefined
  ? `§${r.section}${r.section_title ? ` ${r.section_title}` : ''}` : r.kind === 'contract' ? "Contract: the tooling's own tests" : 'No section');

/** The ruler's rows: Admissible › gates › failing tasks × every search iteration. */
export function rulerRows(data) {
  const gates = (data.gates || []).filter((g) => g && g.id);
  const sols = solutionsOf(data, { ablations: false });
  if (!gates.length || !sols.length) return [];
  const direction = data.objective?.direction === 'higher' ? 'higher' : 'lower';
  const rank = new Map(sols.slice().sort(leadOrder(direction)).map((s, k) => [s.id, k + 1]));
  // every task a gate fails somewhere, in task order (dev-000 before dev-010)
  const tasks = Object.fromEntries(gates.map((g) => [g.id, [...new Set(sols.flatMap((s) => ((s.row.gate_results || {})[g.id]?.failed || []).map((f) => f.task)))].sort(natural)]));
  const rows = [];
  for (const s of sols) {
    const it = s.row;
    const base = {
      kind: 'ruler', commit: short(it.commit?.sha) || 'no commit', commit_date: it.commit?.date || null, n: null,
      committed: it.evaluated || null, iteration: [`#${s.n ?? '?'}`], iteration_n: s.n, solution: s.id, rank: rank.get(s.id),
    };
    const failing = gates.filter((g) => cellOf(s, g.id).state === 'fail').map((g) => g.id);
    rows.push({ ...base, id: `r|${s.id}`, trail: 'Admissible', order: 0, state: s.admissible ? 'pass' : 'fail',
      note: s.admissible ? 'admissible: every gate passes on every dev task' : `not admissible${failing.length ? `: fails ${failing.join(', ')}` : ''}` });
    gates.forEach((g, gi) => {
      const c = cellOf(s, g.id);
      const res = (it.gate_results || {})[g.id] || null;
      const of = res && fin(res.tasks) ? ` of ${res.tasks}` : '';
      const note = c.state === 'fail' ? `fails on ${res && fin(res.failed_tasks) ? res.failed_tasks : c.tasks ?? '?'}${of} dev tasks`
        : c.state === 'pass' ? `passes${res && fin(res.tasks) ? ` on all ${res.tasks} dev tasks` : ''}` : 'not recorded for this solution';
      rows.push({ ...base, id: `r|${s.id}|${g.id}`, trail: ['Admissible', g.id].join(SEP), order: 1 + gi * 1000,
        state: c.state === 'none' ? 'not_run' : c.state, note });
      const named = res && Array.isArray(res.failed) ? new Map(res.failed.map((f) => [f.task, f])) : null;
      tasks[g.id].forEach((task, ti) => {
        const f = named ? named.get(task) : null;
        const state = named ? (f ? 'fail' : 'pass') : c.state === 'pass' ? 'pass' : 'not_run';
        const value = f && fin(f.value) ? `${Number(f.value.toPrecision(4))}${g.unit ? ` ${g.unit}` : ''}` : '';
        rows.push({ ...base, id: `r|${s.id}|${g.id}|${task}`, trail: ['Admissible', g.id, task].join(SEP), order: 2 + gi * 1000 + ti,
          state, note: f ? [value && `${value} (limit ${g.op === 'is' ? 'pass' : `${g.op} ${g.threshold}${g.unit ? ` ${g.unit}` : ''}`})`, f.note].filter(Boolean).join(' · ') || 'fails' : state === 'pass' ? 'passes' : 'not recorded' });
      });
    });
  }
  return rows;
}

/** The iterations whose suite each commit is ({commit index: ['#1', …]}), HEAD on the newest commit when it added none. */
export function iterationsAt(data) {
  const h = data.spec_history;
  const out = {};
  if (!h) return out;
  const n = Object.fromEntries((data.iterations || []).map((r) => [r.id, r.n]));
  for (const [sid, k] of Object.entries(h.added || {})) if (fin(n[sid])) (out[k] = out[k] || []).push(n[sid]);
  for (const k of Object.keys(out)) out[k] = out[k].sort((a, b) => a - b).map((x) => `#${x}`);
  const last = h.commits.length - 1;
  if (last >= 0 && !out[last]) out[last] = ['HEAD'];
  return out;
}

/** The spec's rows: section › requirement › test file › test × every commit a test ran at, and the requirements' own. */
export function specRows(data) {
  const h = data.spec_history;
  const reqs = data.spec?.requirements || [];
  if (!h || !reqs.length) return [];
  const its = iterationsAt(data);
  const rows = [];
  const at = (k) => ({ commit: h.commits[k].sha, n: k, committed: h.commits[k].date, commit_date: h.commits[k].date, iteration: its[k] || null });
  const byReq = new Map();
  h.tests.forEach((t, i) => { if (!byReq.has(t[2])) byReq.set(t[2], []); byReq.get(t[2]).push(i); });
  const list = [...reqs, ...(byReq.has('unlinked') ? [{ id: 'unlinked', kind: 'unlinked', section: null, name: 'Not linked to a requirement', verb: 'none' }] : [])];
  let order = 0;
  for (const r of list) {
    const sec = r.id === 'unlinked' ? 'Tests not linked to a requirement' : sectionOf(r);
    // WHY the check: a specs/*.md note's name is its heading, which already starts with its id ("O1.1 The boundary")
    const label = r.id === 'unlinked' || String(r.name || '').startsWith(String(r.id)) ? String(r.name) : `${r.id} ${r.name || ''}`.trim();
    const mine = byReq.get(r.id) || [];
    order++;
    h.commits.forEach((c, k) => {
      if (!c.ran) return;
      const present = mine.some((i) => h.tests[i][3][k] !== '-');
      let state = null, note = null;
      if (r.verb === 'deferred') { state = 'deferred'; note = 'deferred: named, never judged'; }
      else if (!present && (r.verb === 'shall' || r.verb === 'should')) { state = 'not_run'; note = 'no test of this requirement ran here'; }
      if (state) rows.push({ kind: 'spec', id: `s|${r.id}|${c.sha}`, trail: [sec, label].join(SEP), order, ...at(k), state, note });
    });
    const files = [...new Set(mine.map((i) => h.tests[i][1]))];
    for (const f of files) {
      const file = String(h.files[f]).split('/').pop();
      for (const i of mine) {
        const t = h.tests[i];
        if (t[1] !== f) continue;
        order++;
        const fails = (h.failures || {})[String(i)] || {};
        for (let k = 0; k < t[3].length; k++) {
          const ch = t[3][k];
          if (ch === '-') continue;
          rows.push({ kind: 'spec', id: `s|${i}|${k}`, trail: [sec, label, file, t[0]].join(SEP), order, ...at(k), state: CHAR[ch], note: fails[String(k)] || null });
        }
      }
    }
  }
  return rows;
}

/** The dataset the gates `.base` reads (runtime shape, data-ui CONTRACT §3). */
export function gatesDataset(data, { ruler = true, spec = true } = {}) {
  const rows = [...(ruler ? rulerRows(data) : []), ...(spec ? specRows(data) : [])];
  return {
    id: `bb/${data.box || 'box'}/gates-history`, title: 'gates', titleProperty: 'trail', rows,
    properties: {
      kind: { type: 'text' }, trail: { type: 'text' }, order: { type: 'number' }, commit: { type: 'text' }, commit_date: { type: 'date' },
      n: { type: 'number' }, committed: { type: 'date' }, iteration: { type: 'list' }, iteration_n: { type: 'number' },
      solution: { type: 'text' }, rank: { type: 'number' }, state: { type: 'text', labels: { not_run: 'no test' } }, note: { type: 'text' },
    },
  };
}

const TONES = '{ pass: neutral, skipped: muted, deferred: muted, not_run: warn }';
const ORDER = '[deferred, ok, pass, skipped, warn, warning, partial, unknown, not_run, stale, error, fail]';
const SECTIONS = `    display: { state: status }
    record:
      sections:
        - { name: Verdict, properties: [state, note] }
        - { name: Where, properties: [trail, commit, committed, iteration, solution, rank] }`;
/** bb-gates' x settings ↔ the matrix's axis ids. */
export const X_AXIS = { iteration: 'iteration', commit: 'commit', date: 'committed:day' };
export const AXIS_X = Object.fromEntries(Object.entries(X_AXIS).map(([k, v]) => [v, k]));
export const PRESETS = { 'gates-matrix': 'Gates · matrix', 'gates-table': 'Gates · table', 'spec-matrix': 'Spec · matrix', 'spec-table': 'Spec · table' };

const q = (s) => JSON.stringify(String(s));
/** The gates `.base` text: the presets over one dataset. `commits` (spec_history's) are the spec matrix's asked columns. */
export function gatesBase({ ruler = true, spec = true, commits = [], rollup = 'count', x = 'iteration', specX = 'commit', fold = 1 } = {}) {
  const views = [];
  const lead = '{ by: rank, keep: first, name: solution, word: leading }';
  if (ruler) {
    views.push(`  - type: tracker
    name: ${PRESETS['gates-matrix']}
    filters: 'kind == "ruler"'
    groupBy: { property: trail, path: " › " }
    sort:
      - { property: order, direction: ASC }
      - { property: iteration_n, direction: ASC }
    tracker:
      state: state
      label: note
      tones: ${TONES}
      order: ${ORDER}
      x: ${X_AXIS[x] || 'iteration'}
      axes:
        - { property: iteration, label: Iteration, order: iteration_n }
        - { property: commit, label: Commit, order: commit_date, pick: ${lead} }
        - { property: committed, by: day, label: Day, pick: ${lead} }
      rollup: ${rollup}
      noun: [gate check, gate checks]
      fold: ${fold}
${SECTIONS}`);
    views.push(`  - type: table
    name: ${PRESETS['gates-table']}
    filters: 'kind == "ruler"'
    groupBy: { property: trail, path: " › " }
    order: [trail, state, iteration, solution, commit, committed, note]
    sort:
      - { property: order, direction: ASC }
      - { property: iteration_n, direction: ASC }
    fold: closed
    rowHeight: short
    display: { state: status }`);
  }
  if (spec) {
    views.push(`  - type: tracker
    name: ${PRESETS['spec-matrix']}
    filters: 'kind == "spec"'
    groupBy: { property: trail, path: " › " }
    sort:
      - { property: order, direction: ASC }
      - { property: n, direction: ASC }
    tracker:
      state: state
      label: note
      tones: ${TONES}
      order: ${ORDER}
      x: ${specX === 'date' ? 'committed:day' : specX}
      axes:
        - { property: commit, label: Commit${commits.length ? `, columns: [${commits.map(q).join(', ')}]` : ''} }
        - { property: committed, by: day, label: Day, pick: { by: n, keep: last, name: commit } }
        - { property: iteration, label: Iteration, order: n }
      rollup: ${rollup}
      noun: [test, tests]
      fold: 1
${SECTIONS}`);
    views.push(`  - type: table
    name: ${PRESETS['spec-table']}
    filters: 'kind == "spec"'
    groupBy: { property: trail, path: " › " }
    order: [trail, state, commit, committed, iteration, note]
    sort:
      - { property: order, direction: ASC }
      - { property: n, direction: ASC }
    fold: closed
    rowHeight: short
    display: { state: status }`);
  }
  return `# The gates .base (viewer CONTRACT §16.8): one row per gate node and column, written by bb-gates.rows.js from the state's
# slices; the presets are the views over the same rows (data-ui CONTRACT §56: the nested matrix; §45: the table's groups).
viewTypes: [tracker, table]
views:
${views.join('\n')}
properties:
  kind: { displayName: Tree }
  trail: { displayName: Gate }
  state: { displayName: Verdict }
  note: { displayName: Says }
  commit: { displayName: Commit }
  commit_date: { displayName: Commit date }
  n: { displayName: Commit order }
  committed: { displayName: When }
  iteration: { displayName: Iteration }
  iteration_n: { displayName: Iteration number }
  solution: { displayName: Solution }
  rank: { displayName: Rank }
  order: { displayName: Order }
`;
}
