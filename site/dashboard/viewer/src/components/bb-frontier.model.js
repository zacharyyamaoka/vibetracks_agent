/* bb-frontier's model: performance vs a cost, with time. Ported from proposals-frontier/_shared/fr.js (lane F) to read
   state.json slices (`iterations`, `ablations`, `costs`, CONTRACT §16.1) instead of the proposal's own export. Pure (no
   DOM): the node test runs it. Nothing here knows what a solution is: ids, creation order, dates, commits, one objective,
   admissible yes/no, and whatever costs the box records per solution.

   The rules (WHY: they are the frontier chart's meaning, kept from proposals-frontier and proposals-headliner/05-frontier):
   - the Pareto front runs over ADMISSIBLE ITERATIONS only (the fold's `tier_<cost>` says the same), minimising the cost and
     bettering the objective in the box's direction; a not-admissible solution is a red ring, always drawn, never on it;
   - ablations are study variants, not search steps: hidden until the reader ticks the box, then hollow grey, never on
     the front and outside every time encoding;
   - time is the creation order (n): Fade = a dot's opacity (old faint, new solid; a red ring never fades), Tide Lines = the
     front as it stood at the search's quarters (each snapped to a commit), drawn faintly under the front now;
   - a cost the box does not record for a row leaves that row off the chart, counted with its reason (`why_null`): never
     plotted at 0; a cost recorded for no row at all still gets its chip, which says why;
   - an x value far beyond the admissible range is pinned to the plot's edge and labelled with its true value, so the
     admissible spread stays readable and nothing is hidden. */

/** The costs the viewer knows how to name (CONTRACT §16.1); a box's other cost fields get their field name. */
export const KNOWN = {
  energy_j: { chip: 'Motor energy (J)', noun: 'motor energy', long: 'motor energy over the dev tasks', unit: 'J', zero: false },
  host_compute_ms_p95: { chip: 'Host compute p95 (ms)', noun: 'host compute', long: 'host compute per control tick, p95', unit: 'ms', zero: true },
  code_lines: { chip: 'Code size (lines)', noun: 'code size', long: 'lines of code the controller runs', unit: 'lines', zero: true },
  identified_params: { chip: 'Identified parameters', noun: 'identified parameters', long: 'identified numbers in its data files', unit: 'params', zero: true },
};
// a costs row's own fields that are not a cost (CONTRACT §16.1)
const NOT_A_COST = new Set(['id', 'kind', 'n', 'verdict', 'objective', 'admissible', 'why_null', 'after', 'created']);
const RELATIVE_TIE = 1e-9;
const fin = (v) => typeof v === 'number' && Number.isFinite(v);
const ms = (iso) => { const t = Date.parse(iso); return Number.isFinite(t) ? t : null; };
export const SESSION_GAP_MS = 3600e3; // a gap of more than an hour between creations starts a new session (Fade's rule)
export const OPMIN = 0.14;            // WHY a floor: the oldest solution must still be findable, just quiet

export function costMeta(cid) {
  const k = KNOWN[cid];
  if (k) return { id: cid, ...k };
  const words = String(cid).replace(/_/g, ' ');
  return { id: cid, chip: words, noun: words, long: words, unit: '', zero: false };
}

export function makeFrontier(data) {
  const direction = data.objective?.direction === 'higher' ? 'higher' : 'lower';
  const better = (a, b) => (b === null || b === undefined ? true
    : direction === 'lower' ? a < b - RELATIVE_TIE * Math.abs(b) : a > b + RELATIVE_TIE * Math.abs(b));
  const costRows = Array.isArray(data.costs) ? data.costs.filter((r) => r && r.id) : [];
  const its = (data.iterations || []).filter((r) => r && r.id);
  const abls = (data.ablations || []).filter((r) => r && r.id);
  const base = new Map([...its, ...abls].map((r) => [r.id, r]));

  // the cost fields, in the order the box writes them (tier_* are the fold's verdicts on them, not costs)
  const costIds = [];
  for (const r of costRows) for (const k of Object.keys(r)) if (!NOT_A_COST.has(k) && !k.startsWith('tier_') && !costIds.includes(k)) costIds.push(k);

  const sol = (r, b, kind) => {
    const y = fin(r?.objective) ? r.objective : fin(b?.objective) ? b.objective : null;
    const admissible = !!((r && 'admissible' in r) ? r.admissible : b?.admissible);
    const created = b?.created || r?.created || b?.evaluated || null;
    return {
      id: (r || b).id, kind, ablation: kind === 'ablation', n: b?.n ?? r?.n ?? null, after: b?.after ?? null, y, ok: admissible && y !== null,
      verdict: b?.verdict || r?.verdict || (kind === 'ablation' ? 'ablation' : null), created, t: ms(created) ?? 0,
      change: b?.change || '', commit: b?.commit || null, failed: b?.failed_gates || {}, tags: b?.tags || [],
      cost: Object.fromEntries(costIds.map((c) => [c, r && fin(r[c]) ? r[c] : null])),
      why: Object.fromEntries(costIds.map((c) => [c, r ? (r.why_null && r.why_null[c]) || (fin(r[c]) ? null : 'no value recorded') : 'no costs row for it in state.json'])),
      tier: Object.fromEntries(costIds.map((c) => [c, r ? r[`tier_${c}`] ?? null : null])),
    };
  };
  const seen = new Set();
  const all = [];
  for (const r of costRows) {
    const b = base.get(r.id);
    const kind = r.kind === 'ablation' || b?.verdict === 'ablation' ? 'ablation' : 'iteration';
    all.push(sol(r, b, kind)); seen.add(r.id);
  }
  // an iteration the costs slice has no row for still counts (and is said to be missing), never silently dropped
  for (const b of its) if (!seen.has(b.id)) all.push(sol(null, b, 'iteration'));
  const search = all.filter((s) => !s.ablation).sort((a, b) => (a.n ?? Infinity) - (b.n ?? Infinity) || a.t - b.t);
  search.forEach((s, i) => { s.rank = i + 1; });
  const ablations = all.filter((s) => s.ablation).sort((a, b) => (a.after ?? 0) - (b.after ?? 0) || a.t - b.t);
  const N = search.length;
  const byId = Object.fromEntries(all.map((s) => [s.id, s]));
  const cost = (s, cid) => (s.cost[cid] ?? null);
  const recordedFor = (cid) => all.filter((s) => cost(s, cid) !== null).length;
  const recorded = (cid) => recordedFor(cid) > 0;

  /** The cost the chart opens on: the setting, or "" = the first the box records (with a value on some row). */
  function pickCost(want) {
    if (want) return costIds.includes(want) ? { cid: want, unknown: false } : { cid: null, unknown: true };
    return { cid: costIds.find(recorded) || costIds[0] || null, unknown: false };
  }
  /** Why a cost has no value for these rows, grouped: [{reason, ids}] (the chart says how many and why, never plots 0). */
  function missing(list, cid) {
    const groups = new Map();
    for (const s of list) if (cost(s, cid) === null) {
      const why = s.why[cid] || 'no value recorded';
      if (!groups.has(why)) groups.set(why, []);
      groups.get(why).push(s.id);
    }
    return [...groups].map(([reason, ids]) => ({ reason, ids }));
  }

  // ---------- the front
  /** The Pareto front over (cost, objective): admissible iterations only, sorted by cost, each kept when it betters
      every cheaper one (ties: the better objective, then the first created). */
  function pareto(list, cid) {
    const sign = direction === 'lower' ? 1 : -1;
    const pts = list.filter((s) => s.ok && !s.ablation && cost(s, cid) !== null)
      .sort((a, b) => cost(a, cid) - cost(b, cid) || sign * (a.y - b.y) || a.rank - b.rank);
    const out = []; let best = null;
    for (const s of pts) if (better(s.y, best)) { best = s.y; out.push(s); }
    return out;
  }
  const frontAt = (rank, cid) => pareto(search.slice(0, rank), cid);

  // ---------- time: creation commits, sessions, moments
  const commits = [];
  const bySha = new Map();
  for (const s of search) {
    const sha = (s.commit && s.commit.sha) || 'none';
    if (!bySha.has(sha)) { const e = { sha, commit: s.commit, firstRank: s.rank, lastRank: s.rank }; bySha.set(sha, e); commits.push(e); }
    bySha.get(sha).lastRank = s.rank;
  }
  const sessions = [];
  for (const s of search) {
    const prev = sessions[sessions.length - 1];
    if (!prev || s.t - prev.lastT > SESSION_GAP_MS) sessions.push({ k: sessions.length + 1, firstRank: s.rank, lastRank: s.rank, firstT: s.t, lastT: s.t });
    else { prev.lastRank = s.rank; prev.lastT = s.t; }
  }
  /** k moments at the quarters (k = 4) of the search by count, each snapped to the nearest commit's end (a moment is
      always "as of commit X", never half a commit). The last is the newest solution: the front now. */
  function moments(k = 4) {
    if (!N) return [];
    const ends = commits.map((c) => c.lastRank);
    const out = [];
    for (let i = 1; i <= k; i++) {
      const target = (N * i) / k;
      const m = i === k ? N : ends.reduce((a, e) => (Math.abs(e - target) < Math.abs(a - target) ? e : a), ends[0]);
      if (!out.includes(m)) out.push(m);
    }
    return out.sort((a, b) => a - b).map((rank) => ({ rank, s: search[rank - 1] }));
  }
  /** Tide lines: the front as it stood at each earlier moment (not the last: that is the front now), oldest first;
      a moment with no admissible solution carrying this cost yet draws nothing. */
  function tides(cid) {
    return moments(4).slice(0, -1).map((m) => ({ ...m, front: frontAt(m.rank, cid) })).filter((t) => t.front.length);
  }
  /** Fade's dashed line: the front before the newest session (a gap of more than an hour), when there were two. */
  function beforeSession(cid) {
    if (sessions.length < 2) return null;
    const last = sessions[sessions.length - 1];
    const front = frontAt(last.firstRank - 1, cid);
    return front.length ? { session: last, front } : null;
  }
  /** Opacity by creation order: 0 = the oldest iteration, 1 = the newest. */
  const age01 = (s) => (s.ablation ? null : N > 1 ? (s.rank - 1) / (N - 1) : 1);
  const opacity = (s) => OPMIN + (1 - OPMIN) * (age01(s) ?? 1);

  // ---------- scales
  const searchYs = search.map((s) => s.y).filter((y) => y !== null && y > 0);
  /** log y past a 20x span (the headliner's rule), unless the setting says otherwise; never log over a value <= 0. */
  function yLog(setting, list) {
    const ok = list.every((s) => s.y === null || s.y > 0);
    if (setting === 'linear') return false;
    if (setting === 'log') return ok;
    return ok && searchYs.length > 1 && Math.max(...searchYs) / Math.min(...searchYs) > 20;
  }
  /** x domain over the admissible points drawn (all drawn points when none is admissible), padded; anything beyond is
      pinned to the edge. Log x pins a value <= 0 to the left edge (a log axis has no 0). */
  function xDomain(cid, list, logX = false) {
    const vals = (l) => l.map((s) => cost(s, cid)).filter((v) => v !== null && (!logX || v > 0));
    let xs = vals(list.filter((s) => s.ok));
    if (!xs.length) xs = vals(list);
    if (!xs.length) xs = [1];
    let lo = Math.min(...xs), hi = Math.max(...xs);
    if (logX) { lo /= 1.18; hi *= 1.18; } else {
      const pad = (hi - lo) * 0.06 || Math.abs(hi) * 0.05 || 1;
      lo = costMeta(cid).zero && lo >= 0 ? 0 : lo - pad;
      hi += pad;
    }
    const side = (s) => { const v = cost(s, cid); if (v === null) return null; if (v > hi) return 'right'; if (v < lo || (logX && v <= 0)) return 'left'; return null; };
    const pin = (s) => { const v = cost(s, cid); if (v === null) return null; return side(s) === 'right' ? hi : side(s) === 'left' ? lo : v; };
    return { lo, hi, logX, side, pin, clipped: list.filter((s) => side(s)) };
  }
  function yDomain(list, log) {
    const ys = list.map((s) => s.y).filter((y) => y !== null && (!log || y > 0));
    if (!ys.length) return [0, 1];
    const lo = Math.min(...ys), hi = Math.max(...ys);
    if (log) return [lo / 1.35, hi * 1.35];
    const pad = hi > lo ? (hi - lo) * 0.08 : Math.max(Math.abs(hi) * 0.1, 1e-9);
    return [lo >= 0 ? Math.max(0, lo - pad) : lo - pad, hi + pad];
  }

  /** Everything one chart needs: the rows drawn (with the cost), the ones left off and why, the front, the domains. */
  function view(cid, { ablations: showAbl = false, logX = false, logY = 'auto' } = {}) {
    const pool = [...search, ...(showAbl ? ablations : [])];
    const drawn = pool.filter((s) => cost(s, cid) !== null && s.y !== null);
    const off = missing(pool, cid);
    const unscored = pool.filter((s) => s.y === null && cost(s, cid) !== null).map((s) => s.id);
    if (unscored.length) off.push({ reason: 'no objective scored', ids: unscored });
    const front = pareto(search, cid);
    const dom = xDomain(cid, drawn, logX);
    const ylog = yLog(logY, drawn);
    return {
      cid, meta: costMeta(cid), drawn, off, offCount: off.reduce((a, g) => a + g.ids.length, 0), front, dom, ylog, ydom: yDomain(drawn, ylog),
      tides: tides(cid), before: beforeSession(cid), shownAblations: showAbl ? ablations.filter((s) => cost(s, cid) !== null).length : 0,
    };
  }

  const best = search.filter((s) => s.ok).reduce((a, s) => (!a || better(s.y, a.y) ? s : a), null);
  const newest = search.length ? search[search.length - 1] : null;
  return {
    direction, better, costIds, all, search, ablations, N, byId, cost, recorded, recordedFor, pickCost, missing,
    pareto, frontAt, commits, sessions, moments, tides, beforeSession, age01, opacity, yLog, xDomain, yDomain, view, best, newest,
    admissible: search.filter((s) => s.ok).length,
  };
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

/** 3 significant digits, integers whole, never rounded away (the full value is on the solution's page). */
export function fmt(v) {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  if (Number.isInteger(v)) return v.toLocaleString('en-CA');
  return Math.abs(v) >= 100 ? Math.round(v).toLocaleString('en-CA') : String(+v.toPrecision(3));
}
export const tickFmt = (v) => (v === null || v === undefined ? '' : Math.abs(v) >= 1000 ? Math.round(v).toLocaleString('en-CA') : String(+(+v).toPrecision(3)));
