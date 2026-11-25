/* bb-ablation's model: everything the Ablation tab says, computed from state.json `ablation_study` (never typed in).
   Pure (no DOM), so the node test reads the same facts back. Ported from proposals-ablation-page/_shared/kit.js (the
   formatters, the part names) and _shared/facts.js (the headline answers), with the trajectory-tracking specifics taken
   out: a part, a solution id or a cost is always looked up in the study, never named here.

   makeStudy(slice)  -> S: the study plus its lookups (components by key, overall parts, measured variants by id, costs)
   facts(S)          -> F: the answers the tiles and the story card quote (best, cheapest close, top three, ...)
   answers(S, F, h)  -> {view: {name, ask, html}}: 03's answer sentences, one per view; `h` makes the part and solution
                        links (the component passes its own, the test passes plain text) */

export const VIEWS = [
  { key: 'remix', name: 'Remix' },
  { key: 'waterfall', name: 'Waterfall' },
  { key: 'importance', name: 'Importance at both ends' },
  { key: 'frontier', name: 'Cost frontier' },
  { key: 'changelog', name: 'Changelog' },
  { key: 'overall', name: 'Overall importance' },
];
// 02's grid: Remix big, then Overall importance and the Frontier beside it, then Waterfall, Importance, Changelog
export const GRID_ORDER = ['remix', 'overall', 'frontier', 'waterfall', 'importance', 'changelog'];
export const gridOrder = (big) => [big, ...GRID_ORDER.filter((k) => k !== big)];
export const viewName = (key) => (VIEWS.find((v) => v.key === key) || { name: key }).name;

// the thresholds the proposals used: a removal "still pays" above ×1.3; a refit "re-learns" a part below ×1.15
export const STILL_PAYS = 1.3;
export const RELEARNED = 1.15;

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** An objective value the way the study pages print it: 0.0313, 0.130, 0.974. */
export function fmtV(x) {
  if (x === null || x === undefined || !Number.isFinite(x)) return '—';
  const a = Math.abs(x);
  if (a >= 100) return Math.round(x).toLocaleString('en');
  if (a >= 10) return x.toFixed(2);
  if (a >= 0.1) return x.toFixed(3);
  if (a >= 0.01) return x.toFixed(4);
  return x.toPrecision(3);
}
/** A factor: ×31.1, ×1.45, ×1.009 (three decimals near ×1, where the difference is the point). */
export function times(x) {
  if (x === null || x === undefined || !Number.isFinite(x)) return '—';
  return `×${x >= 1000 ? Math.round(x).toLocaleString('en') : x >= 10 ? x.toFixed(1) : x >= 1.1 || x < 0.9 ? x.toFixed(2) : x.toFixed(3)}`;
}
/** The change from one value to another in per cent: "−39 %", "−0.6 %", "±0 %". */
export function pct(from, to) {
  if (from == null || to == null) return '—';
  const p = (to / from - 1) * 100;
  const r = Math.abs(p) >= 10 ? Math.round(p) : Math.round(p * 10) / 10;
  if (r === 0) return '±0 %';
  return `${p < 0 ? '−' : '+'}${Math.abs(r)} %`;
}
export const signed = (x, digits = 0) => (x == null ? '—' : `${x < 0 ? '−' : x > 0 ? '+' : '±'}${Math.abs(x).toFixed(digits)}`);
/** A cost value: integers whole, else three significant digits. */
export const fmtCost = (v) => (v == null || !Number.isFinite(v) ? '—' : Number.isInteger(v) ? String(v) : Math.abs(v) >= 100 ? String(Math.round(v)) : String(+v.toPrecision(3)));
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
export const numberWord = (n) => WORDS[n] ?? String(n);
export const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** A short column head for a part: "lookahead = bus delay" -> "bus delay", "stiff gains (kp ×4)" -> "stiff gains". */
export function shortName(name) {
  let s = String(name || '').replace(/\s*\([^)]*\)\s*$/, '');
  if (s.includes(' = ')) s = s.split(' = ').pop();
  s = s.replace(/identification/g, 'id.').trim();
  return s.length > 22 ? `${s.slice(0, 21)}…` : s;
}

export function makeStudy(D) {
  const comp = Object.fromEntries(D.components.map((c) => [c.key, c]));
  const order = D.components.map((c) => c.key);
  const O = D.overall || null;
  const part = O ? Object.fromEntries((O.parts || []).map((p) => [p.key, p])) : {};
  // a solution's measured row: the study's own variants first, then the population and the search's lineage
  const byId = {};
  for (const v of D.variants || []) if (v.measured && !byId[v.solution]) byId[v.solution] = v;
  for (const p of D.population || []) if (!byId[p.solution]) byId[p.solution] = p;
  for (const h of D.history || []) if (!byId[h.solution]) byId[h.solution] = h;
  const cost = Object.fromEntries((D.costs || []).map((c) => [c.key, c]));
  const base = D.objective.base, target = D.objective.target;
  const name = (key) => (comp[key] ? comp[key].name : key);
  const S = {
    D, comp, order, O, part, byId, cost, base, target,
    unit: D.objective.unit || '',
    total: base / target,
    totalDrop: O ? O.total_drop : Math.log10(base / target),
    name,
    short: (key) => shortName(name(key)),
    /** "all nine parts", "no parts (the base)", "all but X, Y", or the list */
    parts(keeps) {
      if (!keeps) return '';
      if (keeps.length === order.length) return `all ${numberWord(order.length)} parts`;
      if (!keeps.length) return 'no parts (the base)';
      if (keeps.length >= order.length - 3) return `all but ${order.filter((k) => !keeps.includes(k)).map(name).join(', ')}`;
      return keeps.map(name).join(', ');
    },
    /** a log10 drop as a share of the whole study's drop: "18.7 %" (a share that rounds to 0 is "0 %", never "−0 %") */
    share(d, digits = 0) {
      if (d == null || !Number.isFinite(d)) return '—';
      const text = Math.abs((100 * d) / S.totalDrop).toFixed(digits);
      return `${d < 0 && +text !== 0 ? '−' : ''}${text} %`;
    },
  };
  return S;
}

/** The ratio a part's own step(s) made when the search took it (product over its history steps), or null. */
function foundRatio(D, key) {
  let r = null;
  D.history.forEach((h, i) => {
    if (i && h.component === key && h.objective && D.history[i - 1].objective) r = (r ?? 1) * (h.objective / D.history[i - 1].objective);
  });
  return r;
}

/** Each part's summed change of one cost along the search's lineage (the steps that introduced it). */
export function costByPart(D, key) {
  const out = {};
  D.history.forEach((h, i) => {
    const prev = D.history[i - 1];
    if (!i || !h.component || h[key] == null || prev[key] == null) return;
    out[h.component] = (out[h.component] || 0) + h[key] - prev[key];
  });
  return out;
}

/** Costs worth a sentence: the ones the study did not flag as noisy (compute, when it measured re-scoring noise). */
export const quietCosts = (D) => (D.costs || []).filter((c) => !(D.compute_noise && /compute/.test(c.key)));
/** The (at most three) costs the frontier's answer names: quiet, and changed from base to best. */
export const sentenceCosts = (D, F) => quietCosts(D).filter((c) => F.cost[c.key] && F.cost[c.key].delta != null && Math.abs(F.cost[c.key].delta) > 1e-9).slice(0, 3);

export function facts(S) {
  const { D, O, comp, order, byId, base, target } = S;
  const F = {};
  F.parts = order.length;
  F.totalFactor = base / target;
  F.total = times(F.totalFactor);
  F.best = { solution: D.study.target, value: target, parts: order.length };
  const ids = new Set();
  for (const v of D.variants || []) if (v.measured && v.objective != null) ids.add(v.solution);
  F.measuredVariants = ids.size;
  F.ablationRuns = new Set((D.variants || []).filter((v) => v.measured && v.ablation).map((v) => v.solution)).size;
  const lineage = new Set(D.history.map((h) => h.solution));
  // the cheapest measured variant within ×5 of the best's error that the search never visited
  F.cheap = (D.variants || []).filter((v) => v.measured && !lineage.has(v.solution) && v.objective < 5 * target && v.code_lines != null)
    .sort((a, b) => a.code_lines - b.code_lines)[0] || null;
  const path = D.path || [];
  F.steps = path.length;
  F.firstThree = path.slice(0, 3).reduce((m, p) => m * (p.from_mm / p.to_mm), 1);
  F.biggestStep = path.length ? path.reduce((m, p) => (p.to_mm / p.from_mm < m.to_mm / m.from_mm ? p : m), path[0]) : null;
  F.byOrders = O ? [...O.parts].sort((a, b) => b.orders - a.orders) : [];
  F.top3 = F.byOrders.slice(0, 3).map((p) => p.key);
  F.top3Orders = F.byOrders.slice(0, 3).reduce((s, p) => s + p.orders, 0);
  F.top3Shapley = F.byOrders.slice(0, 3).reduce((s, p) => s + p.shapley, 0);
  F.top3Se = F.top3.length ? [Math.min(...F.top3.map((k) => S.part[k].shapley_se)), Math.max(...F.top3.map((k) => S.part[k].shapley_se))] : null;
  // what base -> best cost, per cost the study records
  const h0 = byId[D.study.base], h1 = byId[D.study.target];
  F.cost = Object.fromEntries((D.costs || []).map((c) => {
    const a = h0 && h0[c.key], b = h1 && h1[c.key];
    const delta = a == null || b == null ? null : b - a;
    return [c.key, { delta, pct: delta == null || !a ? null : (b / a - 1) * 100, from: a ?? null, to: b ?? null }];
  }));
  // a cost one part carries almost alone (>= 80 % of base -> best): "the stiff gains are the energy"
  // (only among the costs the frontier's sentence names; a share above ×1.25 means the other parts pulled the other way)
  F.costOwner = null;
  for (const c of sentenceCosts(D, F)) {
    const total = F.cost[c.key].delta;
    const per = Object.entries(costByPart(D, c.key)).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0];
    const share = per ? per[1] / total : 0;
    if (share >= 0.8 && share <= 1.25 && (!F.costOwner || Math.abs(share - 1) < Math.abs(F.costOwner.share - 1))) F.costOwner = { cost: c.key, key: per[0], delta: per[1], share };
  }
  const now = (c) => c.without_refit_factor ?? c.without_factor;
  F.stillPays = D.components.filter((c) => now(c) > STILL_PAYS).map((c) => c.key);
  F.relearned = D.components.filter((c) => c.without_refit_factor != null && c.without_refit_factor < RELEARNED).map((c) => c.key);
  F.refitMeasured = D.components.filter((c) => c.without_refit_factor != null).map((c) => c.key);
  // a part that paid late: among those that still pay, the smallest step when the search took it
  const late = F.stillPays.map((k) => ({ key: k, ratio: foundRatio(D, k) })).filter((x) => x.ratio != null)
    .sort((a, b) => Math.abs(a.ratio - 1) - Math.abs(b.ratio - 1))[0];
  F.paidLate = late ? { key: late.key, ratio: late.ratio, found: pct(1, late.ratio), now: comp[late.key].without_factor } : null;
  const maxBy = (list, f) => list.reduce((m, c) => (m === null || f(c) > f(m) ? c : m), null);
  F.maxLoo = maxBy(D.components.filter((c) => c.without_factor != null), (c) => c.without_factor);
  F.maxRefit = maxBy(D.components.filter((c) => c.without_refit_factor != null), (c) => c.without_refit_factor);
  F.maxAlone = maxBy(D.components.filter((c) => c.alone_factor != null), (c) => c.alone_factor);
  F.methods = O ? { measured: O.methods.filter((m) => m.basis === 'measured').map((m) => m.key), estimate: O.methods.filter((m) => m.basis === 'estimate').map((m) => m.key) } : { measured: [], estimate: [] };
  return F;
}

/** Plain-text link makers (the node test, a text export); the component passes HTML ones. */
export const TEXT_LINKS = { part: (S, key) => S.name(key), sol: (id) => id, measured: () => '', estimate: () => '' };

/** 03's answer sentences, one per view: what the tile's chart proves, said the way a person would. */
export function answers(S, F, h = TEXT_LINKS) {
  const { D, O, comp, unit } = S;
  const U = unit ? ` ${unit}` : '';
  const part = (k) => h.part(S, k);
  const names = (keys) => keys.map(part).join(', ').replace(/, ([^,]*)$/, ' and $1');
  const out = {};

  const cheap = F.cheap;
  out.remix = {
    ask: 'What is the best combination?',
    html: `${cap(S.parts(S.order))}: ${h.sol(F.best.solution)} at ${fmtV(F.best.value)}${U}.${cheap
      ? ` The cheapest that comes close is ${numberWord(cheap.keeps.length)} part${cheap.keeps.length === 1 ? '' : 's'}, ${names(cheap.keeps)}, at ${fmtV(cheap.objective)}${U} in ${cheap.code_lines} lines.` : ''}`,
  };

  const bs = F.biggestStep;
  out.waterfall = {
    ask: 'How did we get here?',
    html: F.steps ? `${cap(numberWord(F.steps))} step${F.steps === 1 ? '' : 's'} from ${h.sol(D.study.base)} to ${h.sol(D.study.target)}; the first ${numberWord(Math.min(3, F.steps))} give ${times(F.firstThree)} of the ${F.total}.${bs
      ? ` The biggest single step: + ${bs.add.map(part).join(' + ')}, ${pct(bs.from_mm, bs.to_mm)}.` : ''}` : `The study records no path from ${h.sol(D.study.base)} to ${h.sol(D.study.target)}.`,
  };

  const L = F.maxLoo, R = F.maxRefit;
  out.importance = {
    ask: 'What is each part worth, removed from the best and added alone?',
    html: L ? `Removing ${part(L.key)} from the best costs ${times(L.without_factor)} frozen${L.without_refit_factor != null ? `, ${times(L.without_refit_factor)} after a refit` : ''}${R && R.key !== L.key
      ? `; ${part(R.key)} still costs ${times(R.without_refit_factor)} even after a refit` : ''}.${F.relearned.length ? ` ${cap(numberWord(F.relearned.length))} of the ${numberWord(F.refitMeasured.length)} refit parts are re-learned by one identification pass.` : ''}` : 'No part was removed from the best.',
  };

  const said = sentenceCosts(D, F).map((c) => {
    const v = F.cost[c.key];
    const digits = Number.isInteger(v.delta) || Math.abs(v.delta) >= 10 ? 0 : 2;
    return `${c.label} ${signed(v.delta, digits)} ${c.unit}${/energy/.test(c.key) && v.pct != null ? ` (${signed(v.pct)} %)` : ''}`;
  });
  const own = F.costOwner;
  out.frontier = {
    ask: `What did each ${unit || 'unit of error'} cost?`,
    html: said.length ? `From base to best: ${said.join(', ').replace(/, ([^,]*)$/, ' and $1')}${own
      ? `; ${part(own.key)} ${own.share > 0.95 ? 'is' : 'is most of'} the ${S.cost[own.cost].label.replace(/^(motor|host) /, '')}: ${signed(own.delta)} ${S.cost[own.cost].unit}` : ''}.${cheap
      ? ` ${fmtV(cheap.objective)}${U} in ${cheap.code_lines} lines (${h.sol(cheap.solution)}) is a point the search never visited.` : ''}` : 'The study records no cost per solution.',
  };

  const late = F.paidLate;
  out.changelog = {
    ask: 'Which steps mattered, and do they still?',
    html: `${late ? `Some paid late: ${part(late.key)} did ${late.found} when found and costs ${times(late.now)} to remove now. ` : ''}${cap(numberWord(F.stillPays.length))} of ${numberWord(F.parts)} parts still cost more than ×${STILL_PAYS} to remove; ${numberWord(F.relearned.length)} ${F.relearned.length === 1 ? 'is' : 'are'} re-learned by a refit.`,
  };

  out.overall = {
    ask: `How much of the ${F.total} is each part's?`,
    html: O && F.top3.length ? `${cap(names(F.top3))} carry ${S.share(F.top3Orders)} of the ${F.total} averaged over the measured orders${h.measured()}; the Shapley estimate${h.estimate()} says ${S.share(F.top3Shapley)}, each part ±${S.share(F.top3Se[0])} to ±${S.share(F.top3Se[1])}.`
      : 'The study has no overall importance table.',
  };
  for (const v of VIEWS) out[v.key].name = v.name;
  return out;
}

/** The newest best among the iterations (admissible, lowest objective for a lower-is-better box), or null. */
export function bestIteration(iterations, direction = 'lower') {
  const ok = (iterations || []).filter((i) => i.admissible && i.objective != null);
  if (!ok.length) return null;
  return ok.reduce((m, i) => ((direction === 'higher' ? i.objective > m.objective : i.objective < m.objective) ? i : m), ok[0]);
}

/* ── the default layout: proposals-ablation-page 1, one data-ui <data-views> over the study's rows ─────────────────── */
// the preset names 01's ablation.base gives the six views (data-ui view types registered by bb-ablation.js)
export const DASHBOARD_VIEWS = { remix: 'Remix', waterfall: 'Waterfall', importance: 'Importance', frontier: 'Frontier', overall: 'Overall importance', changelog: 'Changelog' };
const DASHBOARD_ORDER = ['remix', 'table', 'waterfall', 'importance', 'frontier', 'overall', 'changelog'];

/** The rows the dashboard shows: ablation_study.rows (one per measured variant), id = the solution. WHY without
    `link`: a solution opens through bb-open, never a link the component builds or shows into the box's repo. */
export function dashboardRows(D) {
  return (D.rows || []).map((r) => {
    const { link, ...row } = r;
    row.id = String(row.id ?? row.solution);
    return row;
  });
}

/** 01's ablation.base as a document, from the study (its property names are the slice's row fields): facets, the side
    panel, the property labels, and seven presets, the stock table beside the six views. */
export function ablationBase(S) {
  const { D, order, unit } = S;
  const rows = D.rows || [];
  const has = (k) => rows.some((r) => r[k] !== undefined && r[k] !== null);
  const err = has('error_mm') ? 'error_mm' : 'objective';
  const U = unit ? ` (${unit})` : '';
  const P = {};
  const prop = (k, p) => { if (has(k)) P[k] = p; };
  prop('solution', { displayName: 'Variant' });
  prop('kind', { displayName: 'Kind' });
  prop('removal', { displayName: 'Removal' });
  prop('step', { displayName: 'Path step' });
  prop('n_parts', { displayName: 'Parts' });
  prop('parts_in', { displayName: 'Parts in' });
  prop('parts_out', { displayName: 'Parts out' });
  prop(err, { displayName: `Error${U}`, digits: 3 });
  prop('x_best', { displayName: '× the best', digits: 3 });
  prop('x_base_better', { displayName: '× better than base', digits: 3 });
  for (const c of D.costs || []) {
    const ints = rows.every((r) => r[c.key] == null || Number.isInteger(r[c.key]));
    prop(c.key, { displayName: `${cap(c.label)} (${c.unit})`, ...(ints ? {} : /energy/.test(c.key) ? { decimals: 0 } : { digits: 3 }) });
  }
  for (const k of Object.keys(rows[0] || {})) if (/^on_.+_front$/.test(k)) prop(k, { displayName: `On the ${k.slice(3, -6).replace(/_/g, ' ')} front` });
  prop('admissible', { displayName: 'Admissible' });
  prop('change', { displayName: 'The one change' });
  prop('parent', { displayName: 'Parent' });
  prop('created', { displayName: 'Created' });
  for (const k of order) prop(`in_${k}`, { displayName: S.short(k) });
  const facets = ['kind', 'removal', { property: 'parts_in', label: 'Part in' }, { property: 'parts_out', label: 'Part out' },
    { property: err, as: 'range', label: `Error${U}` }, ...(has('code_lines') ? [{ property: 'code_lines', as: 'range', label: 'Code lines' }] : []),
    ...(has('on_code_front') ? ['on_code_front'] : [])].filter((f) => has(typeof f === 'string' ? f : f.property));
  const keep = (list) => list.filter((k) => P[k]);
  const costKeys = ['code_lines', 'identified_params', 'energy_j'].filter((k) => P[k]);
  const views = {
    remix: { type: 'ablation-remix', name: DASHBOARD_VIEWS.remix, order: keep(['solution', 'kind', 'removal', err]) },
    table: { type: 'table', name: 'Table', order: keep(['solution', 'kind', 'removal', 'step', ...order.map((k) => `in_${k}`), err, 'x_best', ...costKeys, 'change']),
      sort: [{ property: err, direction: 'ASC' }], display: { [err]: 'bar' } },
    waterfall: { type: 'ablation-waterfall', name: DASHBOARD_VIEWS.waterfall, order: keep(['solution', 'step', err]) },
    importance: { type: 'ablation-importance', name: DASHBOARD_VIEWS.importance, order: keep(['solution', 'kind', 'change']) },
    frontier: { type: 'ablation-frontier', name: DASHBOARD_VIEWS.frontier, order: keep(['solution', err, ...costKeys.filter((k) => k !== 'identified_params')]) },
    overall: { type: 'ablation-overall', name: DASHBOARD_VIEWS.overall, order: keep(['solution', 'kind', 'change']) },
    changelog: { type: 'ablation-changelog', name: DASHBOARD_VIEWS.changelog, order: keep(['solution', 'kind', err]) },
  };
  return { facets, open: { mode: 'side', splitAt: 980 }, properties: P, views: DASHBOARD_ORDER.map((k) => views[k]) };
}

/** A part as a synthetic row for data-ui's side panel (01's partRow): its numbers, each marked measured or estimate,
    in the variant columns (data-ui's peek shows a row through the dataset's declared properties only). */
export function partRow(S, key) {
  const c = S.comp[key], p = S.part[key], O = S.O;
  return {
    id: `part:${key}`, solution: c.name, kind: 'part (not a variant)', removal: '—',
    parent: (c.introduced_by || []).join(', '),
    change: [`removed from the best ${times(c.without_factor)} worse (${c.without}, frozen, measured)${c.without_refit ? `, ${times(c.without_refit_factor)} after a refit (${c.without_refit}, measured)` : ', refit not measured'}`,
      `added alone ${times(c.alone_factor)} better (${c.alone}, measured)`,
      ...(p && O ? [`share of the ${times(O.total_factor)}: ${S.share(p.orders, 1)} over the ${O.measured_orders} measured orders (measured), Shapley ${S.share(p.shapley, 1)} ± ${S.share(p.shapley_se, 1).replace('−', '')} (estimate)`] : []),
      ...(c.idea ? [`idea: “${c.idea}”`] : [])].join(' · '),
  };
}
