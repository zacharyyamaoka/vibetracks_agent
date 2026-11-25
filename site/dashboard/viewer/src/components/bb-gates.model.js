/* bb-gates' timeline view, the model (viewer/CONTRACT.md §16.7; PICKS.md "Defaults taken after the evening lanes": lane
   G's 3 State timeline with 1 Problems first's sentence and "✓ N OK" fold, proposals-gates/ @ 424f26f). Pure (no DOM):
   the node test runs it on the real scenarios.

   Rules (WHY each is lane G's, ported, not re-decided):
   - the columns are bb-gate-matrix's (its model, one rule for the leading solution of a commit or a day): search
     solutions only, so the sentence speaks of the box's history, not of its ablation study;
   - "now" is the newest column, and any column can be read "as of" (data-ui has no as-of primitive: gap 5 of
     proposals-gates/README.md, worked around here): the sentence, the problems and the OK fold follow it;
   - a column is red when its leading solution fails a gate; a failure behind a passing leader is counted apart;
   - the verdict is set by the column's own worst gates (RobotDx's roll-up), worst first: the furthest over its limit,
     relative to the limit (a pass/fail gate that fails counts as one limit over), then the most failing tasks;
   - a gate a solution has no record of is "not recorded", never a pass. */
import { buildMatrix, solutionsOf, cellOf } from './bb-gate-matrix.model.js';

export const OPS = { '<=': '≤', '>=': '≥', '<': '<', '>': '>', is: 'is' };
const fin = (v) => typeof v === 'number' && Number.isFinite(v);

/** A number with its unit, 3 significant figures (integers whole), the way lane G's cards read it. */
export function fmt(v, unit = '') {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (!fin(v)) return '—';
  const a = Math.abs(v);
  const s = Number.isInteger(v) ? String(v) : a >= 100 ? v.toFixed(0) : a >= 10 ? v.toFixed(1) : a >= 1 ? v.toFixed(2) : a === 0 ? '0' : v.toPrecision(3);
  return unit ? `${s} ${unit}` : s;
}

/** "≤ 1 mm", or for a pass/fail gate what passing means. */
export function limitText(g) {
  if (!g.op) return 'pass / fail';
  if (g.op === 'is') return 'must pass on every task';
  return `${OPS[g.op] || g.op} ${fmt(g.threshold, g.unit || '')}`;
}

/** The gate history on one x axis, search solutions only: columns, now, the red columns and their runs. */
export function timelineOf(data, x = 'iteration', { ablations = false } = {}) {
  const m = buildMatrix(data, { x, limit: 1e9, ablations });
  const cols = m.columns;
  const red = cols.map((c, i) => (c.leadFails ? i : -1)).filter((i) => i >= 0);
  const runs = [];
  for (const i of red) { const r = runs[runs.length - 1]; if (r && r[1] === i - 1) r[1] = i; else runs.push([i, i]); }
  const behind = cols.map((c, i) => (!c.leadFails && c.anyFail ? i : -1)).filter((i) => i >= 0);
  const last = red.length ? red[red.length - 1] : -1;
  return { m, x: m.x, cols, now: cols.length - 1, red, runs, behind, lastRed: last, greenSince: last >= 0 && last < cols.length - 1 ? last + 1 : -1 };
}

/** The line under the sentence: "red in 3 of 34 iteration columns: #3–#4, #8 · last red #8, green since #9". */
export function redLine(t) {
  const n = t.cols.length;
  const lab = (i) => t.cols[i].x;
  const noun = { iteration: 'iteration', commit: 'commit', date: 'date' }[t.x] || t.x;
  const parts = [];
  if (!n) return '';
  if (t.red.length) {
    const spans = t.runs.slice(0, 6).map(([a, b]) => (b > a ? `${lab(a)}–${lab(b)}` : lab(a)));
    parts.push(`red in ${t.red.length} of ${n} ${noun} column${n === 1 ? '' : 's'}: ${spans.join(', ')}${t.runs.length > 6 ? ` +${t.runs.length - 6} more` : ''}`);
    parts.push(t.greenSince >= 0 ? `last red ${lab(t.lastRed)}, green since ${lab(t.greenSince)}` : `red now (${lab(t.lastRed)})`);
  } else parts.push(`never red on this axis (${n} ${noun} column${n === 1 ? '' : 's'})`);
  if (t.behind.length) parts.push(`${t.behind.length} column${t.behind.length === 1 ? ' holds' : 's hold'} a red behind its leader`);
  return parts.join(' · ');
}

/** The gate definitions (the gates slice: OBJECTIVES.md's table) by id: pass_when, why, op, threshold, unit. */
export function gateDefs(data) {
  return Object.fromEntries((data.gates || []).filter((g) => g && g.id).map((g) => [String(g.id), g]));
}

/** One solution's verdict on every gate: [{id, state, failed_tasks, tasks, worst, worst_task, margin, severity, def, res}]. */
export function verdictOf(data, sol) {
  const defs = gateDefs(data);
  const ids = (data.gates || []).map((g) => String(g.id));
  return ids.map((id) => {
    const def = defs[id];
    const res = (sol.row.gate_results || {})[id] || null;
    const cell = cellOf(sol, id);
    const failed = res && fin(res.failed_tasks) ? res.failed_tasks : cell.tasks;
    const state = cell.state;
    const margin = res && fin(res.margin) ? res.margin : null;
    // worst first: how far over the limit relative to it; a pass/fail failure is one limit over
    const severity = state !== 'fail' ? 1 + (margin !== null ? margin / (Math.abs(def.threshold) || 1) : 0)
      : margin !== null ? margin / (Math.abs(def.threshold) || 1) : -1;
    return { id, state, failed_tasks: fin(failed) ? failed : null, tasks: res && fin(res.tasks) ? res.tasks : null,
      worst: res && res.worst !== undefined ? res.worst : null, worst_task: res ? res.worst_task || null : null, margin, severity, def, res };
  });
}

/** The problems (failing gates) worst first, and the rest. */
export function splitVerdict(v) {
  const problems = v.filter((g) => g.state === 'fail').sort((a, b) => a.severity - b.severity || (b.failed_tasks || 0) - (a.failed_tasks || 0) || a.id.localeCompare(b.id));
  const ok = v.filter((g) => g.state === 'pass');
  const unknown = v.filter((g) => g.state === 'none');
  return { problems, ok, unknown };
}

/** The verdict sentence: "All 5 gates pass at #34", or "Set by its own worst gates (4): a, b, c +1". */
export function sentenceOf(v, at) {
  const { problems, ok, unknown } = splitVerdict(v);
  if (problems.length) {
    const names = problems.slice(0, 3).map((g) => g.id);
    return { tone: 'bad', glyph: '✗', lead: `Set by its own worst gate${problems.length > 1 ? `s (${problems.length})` : ''}`, names,
      more: Math.max(0, problems.length - 3), text: `Set by its own worst gate${problems.length > 1 ? `s (${problems.length})` : ''}: ${names.join(', ')}${problems.length > 3 ? ` +${problems.length - 3}` : ''}` };
  }
  const all = ok.length === v.length;
  const text = `${all ? `All ${ok.length}` : `${ok.length} of ${v.length}`} gate${v.length === 1 ? '' : 's'} pass at ${at}${unknown.length ? ` · ${unknown.length} not recorded` : ''}`;
  return { tone: unknown.length ? 'warn' : 'ok', glyph: unknown.length ? '!' : '✓', text, names: [], more: 0 };
}

/** One line per gate (the problems list and the OK fold): what it says at this column. */
export function messageOf(g) {
  const u = g.def.unit || '';
  const of = g.tasks ? ` of ${g.tasks}` : '';
  if (g.state === 'none') return 'not recorded for this solution';
  if (g.state === 'fail') {
    const n = g.failed_tasks !== null ? `fails on ${g.failed_tasks}${of} task${g.failed_tasks === 1 && !of ? '' : 's'}` : 'fails';
    return g.worst !== null && g.def.op && g.def.op !== 'is' ? `${n} · worst ${fmt(g.worst, u)} (${limitText(g.def)})` : n;
  }
  if (g.worst !== null && g.margin !== null) return `worst ${fmt(g.worst, u)} · ${fmt(Math.abs(g.margin), u)} ${g.margin >= 0 ? 'to spare' : 'over'} (${limitText(g.def)})`;
  return g.tasks ? `passes on all ${g.tasks} tasks` : 'passes';
}

/** Since when this gate has been in its state on this axis: {from, prev} (column indices; prev null = since the start). */
export function sinceOf(t, gate, col) {
  const st = (i) => cellOf(t.cols[i].lead, gate).state;
  const now = st(col);
  let i = col;
  while (i > 0 && st(i - 1) === now) i--;
  return { from: i, prev: i > 0 ? st(i - 1) : null, state: now };
}

/** Saved runs the state lists for one solution on one task (bb-run/1 records a component may load to play). */
export function playable(data, sid, task) {
  return ((data.playback && data.playback.runs) || []).filter((r) => r && r.solution === sid && (!r.task || r.task === task) && (!r.schema || r.schema === 'bb-run/1'));
}

/** The facts behind one cell (a gate at a column) or a whole column (gate null): what the why card says. */
export function whyOf(data, t, col, gate) {
  const c = t.cols[col];
  if (!c) return null;
  const sol = c.lead;
  const v = verdictOf(data, sol);
  const where = [sol.n !== null ? `#${sol.n}` : '', sol.commit ? `commit ${String(sol.commit.sha).slice(0, 7)}` : ''].filter(Boolean).join(' · ');
  const others = c.members.slice(1);
  const behind = c.failedBy.filter((id) => id !== sol.id);
  const colnote = c.n > 1
    ? `${c.x} holds ${c.n} solutions; this reads the leading one, ${sol.id} (search solutions first, admissible first, then the ${data.objective?.direction === 'higher' ? 'highest' : 'lowest'} ${data.objective?.name || 'objective'}).`
      + (behind.length ? ` ${behind.join(', ')} in it ${behind.length > 1 ? 'fail' : 'fails'} a gate: switch x to Iteration to read ${behind.length > 1 ? 'each' : 'it'}.` : ' None of the others fails a gate.')
    : '';
  if (!gate) {
    const { problems } = splitVerdict(v);
    return { kind: 'column', col, label: c.x, sol: sol.id, where, admissible: sol.admissible, verdict: sol.verdict, objective: sol.objective,
      problems: problems.map((g) => ({ id: g.id, line: messageOf(g) })), gates: v.length, colnote, others: others.map((s) => s.id) };
  }
  const g = v.find((x) => x.id === gate);
  if (!g) return null;
  const since = sinceOf(t, gate, col);
  const word = { fail: 'red', pass: 'green', none: 'not recorded' }[g.state];
  const prevWord = { fail: 'red', pass: 'green', none: 'not recorded' }[since.prev];
  const res = g.res;
  const failed = res && Array.isArray(res.failed) ? res.failed : null;
  const moments = res && Array.isArray(res.moments) ? res.moments.map((m) => ({ ...m, play: playable(data, sol.id, m.task) })) : null;
  return {
    kind: 'cell', col, label: c.x, gate, sol: sol.id, where, state: g.state,
    title: g.state === 'fail' ? `${gate} fails${g.failed_tasks !== null ? ` on ${g.failed_tasks}${g.tasks ? ` of ${g.tasks}` : ''} task${g.failed_tasks === 1 && !g.tasks ? '' : 's'}` : ''}`
      : g.state === 'pass' ? `${gate} passes${g.tasks ? ` on all ${g.tasks} tasks` : ''}` : `${gate}: not recorded for ${sol.id}`,
    since: since.from === col && since.prev === null && col === 0 ? `${word} from the first column`
      : `${word} since ${t.cols[since.from].x}${since.prev ? ` (${prevWord} at ${t.cols[since.from - 1].x})` : ' (the first column)'}`,
    limit: limitText(g.def), unit: g.def.unit || '', op: g.def.op, threshold: g.def.threshold,
    worst: g.worst, worst_task: g.worst_task, margin: g.margin, failed_tasks: g.failed_tasks, tasks: g.tasks,
    failed, moments, savedAny: moments !== null, rule: { pass_when: g.def.pass_when || '', why: g.def.why || '' },
    why_null: res ? res.why_null || null : 'the box records no per-solution gate detail',
    colnote, others: others.map((s) => s.id),
  };
}

/** Everything the timeline view draws for one x and one as-of column (its key; null = now, the newest search column).
    The sentence and the red line read the search solutions; `ablations` only widens which column a key may name. */
export function timelineView(data, { x = 'iteration', key = null, ablations = false } = {}) {
  const base = timelineOf(data, x);
  const t = ablations ? timelineOf(data, x, { ablations: true }) : base;
  if (!base.cols.length) return { t, base, empty: true };
  const found = key ? t.cols.findIndex((c) => c.key === key) : -1;
  const at = found >= 0 ? found : t.cols.findIndex((c) => c.key === base.cols[base.now].key);
  const c = t.cols[at];
  const v = verdictOf(data, c.lead);
  return { t, base, empty: false, at, isNow: found < 0, column: c, verdict: v, ...splitVerdict(v), sentence: sentenceOf(v, c.x), red: redLine(base) };
}

export { solutionsOf };
