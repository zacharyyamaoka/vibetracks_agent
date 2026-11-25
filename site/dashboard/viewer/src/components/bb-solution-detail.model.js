/* bb-solution-detail's model: what the state knows about one solution. Ported from proposals-headliner/_detail (the
   solution page the headliner and the frontier proposals link to) to read state.json slices only: `iterations`,
   `ablations`, `costs`, `gates`, `playback` (CONTRACT §16.3). Pure (no DOM): the node test runs it. The proposal's per-task
   chart, ideas and ledger history read files the viewer never reads (a solution's own outputs, the raw records); they are
   left out, not approximated. Nothing here knows what a solution is. */
import { costMeta } from './bb-frontier.model.js';

const fin = (v) => typeof v === 'number' && Number.isFinite(v);
const RELATIVE_TIE = 1e-9;
const NOT_A_COST = new Set(['id', 'kind', 'n', 'verdict', 'objective', 'admissible', 'why_null', 'after', 'created']);

/** What an ablation run did, from its own words and tags ("− chord correction: … (ablation, frozen: …)"). */
export function ablationFacts(row) {
  const text = row.change || '';
  const m = /^\s*([−+-])\s*([^:(]+?)\s*:/.exec(text);
  const tag = (p) => (row.tags || []).find((t) => t.startsWith(p));
  const kind = tag('ablation:'), study = tag('study:');
  return {
    op: m ? (m[1] === '+' ? 'added' : 'removed') : null,
    component: m ? m[2].trim() : null,
    kind: kind ? kind.slice('ablation:'.length).replace(/-/g, ' ') : null,
    study: study ? study.slice('study:'.length) : null,
    fit: /\brefit\b/i.test(text) || /-refit$/.test(row.id) ? 'refit' : /\bfrozen\b/i.test(text) ? 'frozen' : null,
  };
}

/** A relative change in percent, or null. */
export const pct = (a, b) => (fin(a) && fin(b) && b ? (100 * (a - b)) / b : null);

export function makeDetail(data, id) {
  const its = (data.iterations || []).filter((r) => r && r.id);
  const abls = (data.ablations || []).filter((r) => r && r.id);
  const row = its.find((r) => r.id === id) || abls.find((r) => r.id === id);
  if (!id || !row) return null;
  const direction = data.objective?.direction === 'higher' ? 'higher' : 'lower';
  const better = (a, b) => (direction === 'lower' ? a < b - RELATIVE_TIE * Math.abs(b) : a > b + RELATIVE_TIE * Math.abs(b));
  const ablation = row.verdict === 'ablation' || abls.includes(row);
  const byId = new Map([...its, ...abls].map((r) => [r.id, r]));
  const byN = new Map(its.map((r) => [r.n, r]));
  const ordered = its.slice().sort((a, b) => a.n - b.n);

  // rank among admissible iterations (ablations are study variants, never ranked)
  const adm = its.filter((r) => r.admissible && fin(r.objective)).sort((a, b) => (better(a.objective, b.objective) ? -1 : better(b.objective, a.objective) ? 1 : a.n - b.n));
  const rank = !ablation && row.admissible ? adm.indexOf(row) + 1 || null : null;
  const best = adm[0] || null;

  // the best so far at its step: its own row's, or (an ablation) the iteration evaluated just before it
  const at = ablation ? byN.get(row.after) || null : row;
  const bestAt = at ? { value: fin(at.best_so_far) ? at.best_so_far : null, holder: at.best_holder || null, n: at.n } : null;
  const before = !ablation ? byN.get(row.n - 1) || null : null;
  const bestBefore = before && fin(before.best_so_far) ? { value: before.best_so_far, holder: before.best_holder || null, n: before.n } : null;

  // lineage: parent links up to the root (cycle-safe), and the children, iterations first
  const chain = [row];
  for (let p = row.parent, guard = 0; p && guard < 64; guard++) {
    const r = byId.get(p);
    if (!r) { chain.unshift({ id: p, missing: true }); break; }
    if (chain.includes(r)) break;
    chain.unshift(r);
    p = r.parent;
  }
  const parent = row.parent ? byId.get(row.parent) || { id: row.parent, missing: true } : null;
  const kids = [...its, ...abls].filter((r) => r.parent === id);
  const children = { iterations: kids.filter((r) => r.verdict !== 'ablation').sort((a, b) => a.n - b.n), ablations: kids.filter((r) => r.verdict === 'ablation') };

  // gates: the gate table's rows, this solution's result on each (its own g_<gate> / failed_gates); the worst and the
  // margin only where the table judged THIS solution (they are that solution's numbers, never another's)
  const failed = row.failed_gates || {};
  const table = Array.isArray(data.gates) ? data.gates : [];
  const gateIds = [...table.map((g) => g.id), ...Object.keys(failed).filter((g) => !table.some((t) => t.id === g))];
  const gates = gateIds.map((gid) => {
    const g = table.find((t) => t.id === gid) || { id: gid };
    const own = row[`g_${gid}`];
    const failedTasks = fin(failed[gid]) ? failed[gid] : 0;
    const passed = own === 'pass' ? true : own === 'fail' ? false : gid in failed ? false : fin(row.objective) ? true : null;
    const judged = g.of === id;
    return { id: gid, pass_when: g.pass_when || null, why: g.why || null, op: g.op ?? null, threshold: g.threshold ?? null, unit: g.unit ?? null, passed,
      failed_tasks: passed === false ? failedTasks : 0, judged, tasks: judged ? g.tasks ?? null : null,
      worst: judged ? g.worst ?? null : null, worst_task: judged ? g.worst_task ?? null : null, margin: judged ? g.margin ?? null : null,
      why_null: judged ? g.why_null ?? null : null };
  });

  // costs: each value with where it sits on that cost's front (the fold's tier), or why it is missing
  const costRows = Array.isArray(data.costs) ? data.costs : [];
  const crow = costRows.find((r) => r.id === id) || null;
  const costIds = [];
  for (const r of costRows) for (const k of Object.keys(r)) if (!NOT_A_COST.has(k) && !k.startsWith('tier_') && !costIds.includes(k)) costIds.push(k);
  const frontSize = (cid) => costRows.filter((r) => r[`tier_${cid}`] === 'on the front' && fin(r[cid])).length;
  const costs = crow ? costIds.map((cid) => {
    const value = fin(crow[cid]) ? crow[cid] : null;
    return { id: cid, meta: costMeta(cid), value, tier: value === null ? null : crow[`tier_${cid}`] ?? null,
      why: value === null ? (crow.why_null && crow.why_null[cid]) || 'no value recorded' : null, front: frontSize(cid) };
  }) : [];

  // saved runs for this solution (bb-run/1 records the state lists)
  const runs = ((data.playback && data.playback.runs) || []).filter((r) => r && r.solution === id && (!r.schema || r.schema === 'bb-run/1'));

  // prev / next: by iteration number, or (an ablation) within the ablation runs
  const list = ablation ? abls : ordered;
  const k = list.indexOf(row);
  return {
    row, id, ablation, direction, facts: ablation ? ablationFacts(row) : null,
    n: row.n, total: its.length, gen: row.gen ?? null, rank, admissibleCount: adm.length, best, bestAt, bestBefore,
    parent, vsParent: parent && !parent.missing ? pct(row.objective, parent.objective) : null, chain, children,
    holdoutVsDev: pct(row.holdout, row.objective), gates, costs, hasCosts: !!crow, costsSlice: costRows.length > 0, runs,
    playbackListed: !!(data.playback && Array.isArray(data.playback.runs)),
    prev: k > 0 ? list[k - 1] : null, next: k >= 0 && k < list.length - 1 ? list[k + 1] : null,
  };
}

/** The id to show when the setting is empty: `#solution=<id>` (the board's and a hash-routed site's links), else
    `?id=<id>` (links.solution's default, solution.html?id={id}). Read once per render. */
export function idFromUrl(loc) {
  if (!loc) return '';
  const h = /(?:^#|&)solution=([^&]+)/.exec(loc.hash || '');
  if (h) return decodeURIComponent(h[1]);
  return new URLSearchParams(loc.search || '').get('id') || '';
}
