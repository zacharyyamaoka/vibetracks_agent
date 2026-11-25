/* The gate history's model (viewer/CONTRACT.md §5.2, §16.6): the box's gates × time, one column per iteration, per
   commit or per day, each cell pass / fail for the solution the column shows. Pure (no DOM): tests run it in Node.

   Rules (WHY, Zach's evening spec 2026-11-24 and the Ticker's rules, bb-headliner.model.js):
   - rows are the box's gates in the `gates` slice's order (OBJECTIVES.md's gate table); a box with no gates slice gets
     the gate names its solutions' records carry (`failed_gates` keys, `g_<gate>` fields), and the view says so;
   - a cell is that solution's own record: `failed_gates {gate: failed task count}` first, then `g_<gate>`; a gate a
     solution has no record for is "not recorded", never drawn as a pass;
   - where one commit or one day holds several solutions the column shows the LEADING one: search solutions before
     ablation runs (an ablation is never the best: the Ticker's rule), admissible first, then the best objective in the
     box's direction, then the earliest; the column says "leading <id> of <N>", and a cell marks when another solution
     in the column failed that gate, so a failure is never hidden behind a passing leader;
   - only_failing keeps the columns where ANY of its solutions failed a gate (the same reason); limit keeps the newest N
     columns and says how many older ones it hid. */

export const X_AXES = [
  { id: 'iteration', label: 'Iteration', long: 'one column per solution, in order of first evaluation' },
  { id: 'commit', label: 'Commit', long: 'one column per commit that introduced solutions, oldest first' },
  { id: 'date', label: 'Date', long: 'one column per day solutions were evaluated (the day as recorded)' },
];

const fin = (v) => typeof v === 'number' && Number.isFinite(v);
const ms = (iso) => { const t = Date.parse(iso || ''); return Number.isFinite(t) ? t : null; };

/** The rows: [{id, pass_when, why, declared}] and where they came from ('gates' | 'records' | 'none'). */
export function gateRows(data, sols = null) {
  const list = sols || solutionsOf(data, { ablations: true });
  const declared = Array.isArray(data.gates) ? data.gates.filter((g) => g && g.id) : [];
  const seen = new Set(declared.map((g) => String(g.id)));
  const rows = declared.map((g) => ({ id: String(g.id), pass_when: g.pass_when || '', why: g.why || '', declared: true }));
  // names the records carry beyond the gate table (none for the scenarios today; kept so nothing is dropped)
  for (const s of list) for (const name of s.recorded) if (!seen.has(name)) { seen.add(name); rows.push({ id: name, pass_when: '', why: '', declared: false }); }
  return { gates: rows, from: declared.length ? 'gates' : rows.length ? 'records' : 'none' };
}

/** One scored solution, normalised: the iterations, then (when asked) the ablation runs. */
export function solutionsOf(data, { ablations = false } = {}) {
  const norm = (r, ablation) => {
    const failed = r.failed_gates && typeof r.failed_gates === 'object' ? r.failed_gates : {};
    const recorded = [...Object.keys(failed), ...Object.keys(r).filter((k) => k.startsWith('g_')).map((k) => k.slice(2))];
    return {
      id: String(r.id), n: fin(r.n) ? r.n : null, ablation, after: fin(r.after) ? r.after : null, row: r,
      verdict: r.verdict || (ablation ? 'ablation' : ''), objective: fin(r.objective) ? r.objective : null, admissible: r.admissible === true,
      failed, recorded: [...new Set(recorded)], hasRecord: !!r.failed_gates || recorded.length > 0,
      evaluated: r.evaluated || null, day: typeof r.evaluated === 'string' && /^\d{4}-\d\d-\d\d/.test(r.evaluated) ? r.evaluated.slice(0, 10) : null,
      t: ms(r.evaluated) ?? ms(r.created) ?? 0, commit: r.commit && r.commit.sha ? r.commit : null,
    };
  };
  const its = (data.iterations || []).filter((r) => r && r.id).map((r) => norm(r, false));
  const abl = ablations ? (data.ablations || []).filter((r) => r && r.id).map((r) => norm(r, true)) : [];
  return [...its, ...abl];
}

/** A solution's state on one gate: {state: pass | fail | none, tasks}. tasks = the failed task count when recorded. */
export function cellOf(s, gate) {
  const c = s.failed[gate];
  if (fin(c) && c > 0) return { state: 'fail', tasks: c };
  const g = s.row[`g_${gate}`];
  if (g === 'fail') return { state: 'fail', tasks: fin(c) && c > 0 ? c : null };
  if (g === 'pass') return { state: 'pass', tasks: 0 };
  // WHY: a box without g_<gate> fields records only failures; a scored solution whose failed_gates omits the gate passed it
  if (s.row.failed_gates && typeof s.row.failed_gates === 'object' && !Object.keys(s.row).some((k) => k.startsWith('g_'))) return { state: 'pass', tasks: 0 };
  return { state: 'none', tasks: null };
}

/** The leading order: search solutions before ablation runs, admissible first, best objective, then the earliest. */
export function leadOrder(direction = 'lower') {
  const sign = direction === 'higher' ? -1 : 1;
  return (a, b) => (a.ablation - b.ablation) || (b.admissible - a.admissible)
    || ((a.objective === null) - (b.objective === null)) || (a.objective !== null && b.objective !== null ? sign * (a.objective - b.objective) : 0)
    || ((a.n ?? Infinity) - (b.n ?? Infinity)) || (a.t - b.t) || a.id.localeCompare(b.id);
}

const short = (sha) => String(sha).slice(0, 7);

/** The columns for one x axis, oldest first: [{key, kind, x, label, members (ranked), lead, n}]. */
export function columnsOf(sols, x, direction) {
  const rank = leadOrder(direction);
  if (x === 'iteration') {
    // an ablation run sits after the iteration evaluated before it (the Ticker's rule), in evaluation order
    const pos = (s) => (s.ablation ? [s.after ?? 0, 1, s.t] : [s.n ?? Infinity, 0, s.t]);
    const order = sols.slice().sort((a, b) => { const p = pos(a), q = pos(b); return p[0] - q[0] || p[1] - q[1] || p[2] - q[2] || a.id.localeCompare(b.id); });
    // an ablation run's x reads "#34+": after iteration #34, the one evaluated before it
    return order.map((s) => ({ key: `s:${s.id}`, kind: 'solution', x: s.ablation ? `#${s.after ?? 0}+` : `#${s.n ?? '?'}`, label: s.id, members: [s], lead: s, n: 1 }));
  }
  const groups = new Map();
  for (const s of sols) {
    const k = x === 'commit' ? (s.commit ? s.commit.sha : 'none') : (s.day || 'none');
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(s);
  }
  const cols = [...groups.entries()].map(([k, members]) => {
    members.sort(rank);
    const first = Math.min(...members.map((s) => s.t));
    const c = members.find((s) => s.commit)?.commit;
    const when = x === 'commit' ? (k === 'none' ? Infinity : ms(c && c.date) ?? first) : (k === 'none' ? Infinity : ms(`${k}T00:00:00Z`) ?? first);
    const xl = x === 'commit' ? (k === 'none' ? 'no commit' : short(k)) : (k === 'none' ? 'no date' : k);
    return { key: `${x}:${k}`, kind: x, x: xl, commit: x === 'commit' && k !== 'none' ? c : null, when, members, lead: members[0], n: members.length,
      label: members.length > 1 ? `leading ${members[0].id} of ${members.length}` : members[0].id };
  });
  return cols.sort((a, b) => a.when - b.when || a.key.localeCompare(b.key));
}

/** The whole matrix for one set of settings. */
export function buildMatrix(data, { x = 'iteration', only_failing = false, limit = 60, ablations = false } = {}) {
  const direction = data.objective?.direction === 'higher' ? 'higher' : 'lower';
  const sols = solutionsOf(data, { ablations });
  const { gates, from } = gateRows(data, solutionsOf(data, { ablations: true }));
  const all = columnsOf(sols, X_AXES.some((a) => a.id === x) ? x : 'iteration', direction).map((col) => {
    const cells = gates.map((g) => {
      const own = cellOf(col.lead, g.id);
      const others = col.members.slice(1).map((s) => ({ s, c: cellOf(s, g.id) })).filter((o) => o.c.state === 'fail')
        .map((o) => ({ id: o.s.id, tasks: o.c.tasks, ablation: o.s.ablation }));
      return { gate: g.id, state: own.state, tasks: own.tasks, others };
    });
    const failedBy = col.members.filter((s) => gates.some((g) => cellOf(s, g.id).state === 'fail'));
    return { ...col, cells, leadFails: cells.some((c) => c.state === 'fail'), anyFail: failedBy.length > 0, failedBy: failedBy.map((s) => s.id) };
  });
  const failingSols = sols.filter((s) => gates.some((g) => cellOf(s, g.id).state === 'fail'));
  const kept = only_failing ? all.filter((c) => c.anyFail) : all;
  const lim = Math.max(1, Math.floor(limit) || 60);
  const columns = kept.slice(-lim);
  const perGate = Object.fromEntries(gates.map((g) => [g.id, sols.filter((s) => cellOf(s, g.id).state === 'fail').map((s) => s.id)]));
  return {
    x, direction, gates, from, columns, perGate,
    solutions: sols.length, iterations: sols.filter((s) => !s.ablation).length, ablationRuns: sols.filter((s) => s.ablation).length,
    total: all.length, kept: kept.length, filtered: all.length - kept.length, hidden: kept.length - columns.length,
    multi: all.filter((c) => c.n > 1).length, everFailed: failingSols.length > 0, failing: failingSols.map((s) => s.id),
  };
}

/** The empty sentence for a state, or null when there is a matrix to draw (the order of the checks is the spec's). */
export function emptyOf(data, m, { only_failing = false } = {}) {
  const none = `This box declares no gate table (no gates slice) and none of its ${m.solutions} solutions records a gate.`;
  if (!(data.iterations || []).length && !m.solutions) return { text: 'No solution scored yet.', hint: '' };
  if (only_failing && !m.everFailed) return { text: 'No gates failed.', hint: m.gates.length ? `Every gate passed on ${m.solutions === 1 ? 'the one solution' : `all ${m.solutions} solutions`}; turn off "only where a gate failed" to see ${m.solutions === 1 ? 'it' : 'them'}.` : none };
  if (!m.gates.length) return { text: 'No gates to draw.', hint: none };
  if (!m.columns.length) return { text: 'No solution scored yet.', hint: '' };
  return null;
}
