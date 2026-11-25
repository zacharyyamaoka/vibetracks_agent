/* The Ticker's model, ported from proposals-headliner/_shared/hl.js to read state.json slices (iterations, ablations)
   instead of the proposal's own export. Pure (no DOM): tests run it in Node. Nothing here knows what a solution is.

   Rules kept from tools/progress_chart.py and the Ticker (WHY: the README chart's meaning, and the page must read the same):
   - the best-so-far line runs over ADMISSIBLE solutions only; a non-admissible one is a red ring and never moves it;
   - a new best is the fold's verdict "kept" (beats the best by more than a relative 1e-9: a float tie is not progress);
   - log y when the values span more than 20x (the reader can flip it);
   - range chips are time windows anchored to the newest solution, not to the wall clock (a page read a week later
     must not go blank); the x axis only changes the coordinate the same solutions are drawn at;
   - ablations are not search progress: never on the line, never the best, the anchor or the counts; hidden until
     the reader turns them on, then greyed. On the number axis an ablation sits after the iteration evaluated before it. */

const H = 3600e3, DAY = 24 * H;
export const RANGES = [
  { id: '1H', ms: H, long: 'the hour up to the newest solution' },
  { id: '1D', ms: DAY, long: 'the day up to the newest solution' },
  { id: '5D', ms: 5 * DAY, long: 'five days up to the newest solution' },
  { id: '1M', ms: 30 * DAY, long: '30 days up to the newest solution' },
  { id: 'All', ms: null, long: 'every solution' },
];
export const AXES = [
  { id: 'number', label: 'Solution #', long: 'iteration number (order of first evaluation)' },
  { id: 'date', label: 'Date', long: 'date created' },
  { id: 'commit', label: 'Commit', long: 'commit that introduced it' },
];
const RELATIVE_TIE = 1e-9;
const fin = (v) => typeof v === 'number' && Number.isFinite(v);

export function makeModel(data) {
  const direction = data.objective?.direction === 'higher' ? 'higher' : 'lower';
  const beats = (a, b) => (b === null || b === undefined ? true
    : direction === 'lower' ? a < b - RELATIVE_TIE * Math.abs(b) : a > b + RELATIVE_TIE * Math.abs(b));
  const its = (data.iterations || []).filter((r) => r && r.id);
  const abls = (data.ablations || []).filter((r) => r && r.id);
  const ms = (iso) => { const t = Date.parse(iso); return Number.isFinite(t) ? t : null; };
  const sols = [];
  for (const r of its) sols.push(row(r, false));
  // ablations: spread inside the gap after the iteration evaluated before them
  const byAfter = new Map();
  for (const r of abls) { const k = r.after ?? 0; if (!byAfter.has(k)) byAfter.set(k, []); byAfter.get(k).push(r); }
  for (const [after, list] of byAfter) list.forEach((r, k) => { const s = row(r, true); s.n = after + (k + 1) / (list.length + 1); s.after = after; sols.push(s); });

  function row(r, ablation) {
    const y = fin(r.objective) ? r.objective : null;
    return {
      id: r.id, n: r.n, row: r, ablation, y, ok: !!(r.admissible && y !== null), newBest: !ablation && r.verdict === 'kept',
      hold: fin(r.holdout) ? r.holdout : null, t: ms(r.created) ?? ms(r.evaluated) ?? 0, change: r.change || '',
      failed: r.failed_gates || {}, commit: r.commit || null, tags: r.tags || [],
    };
  }

  // commits, oldest first; a solution's slot is its commit's index, spread inside the slot when a commit holds several
  const cmap = new Map();
  for (const s of sols) {
    const c = s.commit && s.commit.sha ? s.commit : { sha: 'none', date: null, subject: '(no commit recorded)' };
    if (!cmap.has(c.sha)) cmap.set(c.sha, { ...c, t: ms(c.date) ?? s.t, ids: [] });
    cmap.get(c.sha).ids.push(s);
  }
  const commits = [...cmap.values()].sort((a, b) => a.t - b.t || String(a.sha).localeCompare(String(b.sha)));
  commits.forEach((c, i) => {
    c.slot = i + 1;
    c.ids.sort((a, b) => a.n - b.n);
    const m = c.ids.length;
    const spread = m > 1 ? Math.min(0.7, 0.07 * (m - 1)) : 0; // WHY spread: ten solutions can share one commit
    c.ids.forEach((s, k) => { s.cx = c.slot + (m > 1 ? -spread / 2 + (spread * k) / (m - 1) : 0); s.c = c; });
  });

  const xOf = (s, axis) => (axis === 'number' ? s.n : axis === 'date' ? s.t : s.cx);
  const order = {
    number: sols.slice().sort((a, b) => a.n - b.n),
    date: sols.slice().sort((a, b) => a.t - b.t || a.n - b.n),
    commit: sols.slice().sort((a, b) => a.cx - b.cx || a.n - b.n),
  };
  const search = sols.filter((s) => !s.ablation);
  const best = search.filter((s) => s.ok).reduce((a, s) => (!a || beats(s.y, a.y) ? s : a), null);
  const anchor = search.length ? Math.max(...search.map((s) => s.t)) : 0;
  const inRange = (s, rangeId) => {
    const r = RANGES.find((q) => q.id === rangeId);
    return !r || r.ms === null || s.t >= anchor - r.ms;
  };

  /** Everything a chart needs for one (axis, range): points in walk order, the best-so-far steps, the window's open. */
  function view(axis, rangeId, showAblations = false, xRange = null) {
    const keep = xRange ? (s) => xOf(s, axis) >= xRange[0] && xOf(s, axis) <= xRange[1] : (s) => inRange(s, rangeId);
    const walk = order[axis].filter(keep);
    const shown = walk.filter((s) => !s.ablation);
    const extra = showAblations ? walk.filter((s) => s.ablation) : [];
    const firstN = shown.length ? Math.min(...shown.map((q) => q.n)) : Infinity;
    // the window's open: the best so far just before the window's first solution (in iteration order)
    const before = search.filter((s) => s.ok && s.n < firstN);
    const prevClose = before.length ? before.reduce((a, s) => (beats(s.y, a.y) ? s : a)) : null;
    let cur = prevClose ? prevClose.y : null;
    const steps = [];
    for (const s of shown) if (s.ok && beats(s.y, cur)) { cur = s.y; steps.push({ x: xOf(s, axis), y: cur, s }); }
    const xs = [...shown, ...extra].map((s) => xOf(s, axis));
    let lo = xs.length ? Math.min(...xs) : 0, hi = xs.length ? Math.max(...xs) : 1;
    if (xRange) { [lo, hi] = xRange; } else if (axis === 'date') { const pad = Math.max((hi - lo) * 0.03, 60e3); lo -= pad; hi += pad; } else { lo -= 0.6; hi += 0.6; }
    const endBest = cur;
    const startVal = prevClose ? prevClose.y : steps.length ? steps[0].y : null;
    const ys = [...shown, ...extra].filter((s) => s.y !== null).map((s) => s.y);
    if (prevClose) ys.push(prevClose.y);
    if (!ys.length) ys.push(...search.filter((s) => s.y !== null).map((s) => s.y));
    if (best && best.hold !== null && shown.includes(best)) ys.push(best.hold);
    return {
      axis, rangeId, shown, extra, all: [...shown, ...extra], steps, prevClose, endBest, startVal,
      bestSol: steps.length ? steps[steps.length - 1].s : prevClose,
      domain: [lo, hi], ymin: ys.length ? Math.min(...ys) : 0, ymax: ys.length ? Math.max(...ys) : 1,
      // one admissible point and nothing before the window: no change to state (never a "0 %" chip)
      change: endBest !== null && startVal && (steps.length > 1 || prevClose) ? { abs: endBest - startVal, pct: (100 * (endBest - startVal)) / startVal } : null,
      admissibleShown: shown.filter((s) => s.ok).length,
    };
  }
  function bestAt(v, x) {
    let y = v.prevClose ? v.prevClose.y : null, s = v.prevClose;
    for (const st of v.steps) if (st.x <= x + 1e-9) { y = st.y; s = st.s; }
    return { y, s };
  }
  const searchYs = search.map((s) => s.y).filter((y) => y !== null && y > 0);
  const defaultLog = searchYs.length > 1 && Math.min(...searchYs) > 0 && Math.max(...searchYs) / Math.min(...searchYs) > 20;
  /** The better/worse tone of a change in the box's direction. */
  const tone = (pct) => (pct === 0 ? 'flat' : (pct < 0) === (direction === 'lower') ? 'good' : 'bad');
  const count = (rangeId) => search.filter((s) => inRange(s, rangeId)).length;
  return { direction, sols, search, ablations: sols.filter((s) => s.ablation), commits, best, anchor, xOf, order, view, bestAt, defaultLog, tone, count, inRange };
}

/** 1-2-5 ticks inside [lo, hi] (the static chart's log ticks), thinned to at most `max` labels. */
export function logTicks(lo, hi, max = 8) {
  const out = [];
  for (let e = Math.floor(Math.log10(lo)); e <= Math.ceil(Math.log10(hi)); e++) {
    for (const m of [1, 2, 5]) { const v = m * 10 ** e; if (v >= lo * 0.999 && v <= hi * 1.001) out.push(+v.toPrecision(3)); }
  }
  if (out.length <= max) return out;
  return out.filter((v) => /^1/.test(String(v).replace(/^0\.0*/, '')));
}

/** 3 significant digits, integers whole, never rounded away (the full value is in the tooltip). */
export function fmt(v) {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  if (Number.isInteger(v)) return v.toLocaleString('en-CA');
  return Math.abs(v) >= 100 ? v.toFixed(0) : v.toPrecision(3);
}
export const pctNum = (a) => (a >= 10 ? a.toFixed(1) : a >= 0.1 ? a.toFixed(2) : a >= 0.001 ? a.toPrecision(2) : a === 0 ? '0' : '<0.001');
