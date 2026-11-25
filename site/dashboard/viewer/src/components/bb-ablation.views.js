/* The six views of one ablation study, each mountable into any element of a <bb-ablation> (several at once):
     remix · waterfall · importance · frontier · changelog · overall
   Ported from proposals-ablation-page/_shared/views.js (whose drawing code is proposals-ablation/0N-name/view.js), changed
   only where a stock component must differ:
   - scoped to one component: no window globals, no page-wide focus bus (the element hands every view the focus), the
     tooltip and the solution links come from the element (`env`), every ResizeObserver is handed back for teardown;
   - nothing box-specific in the code: the parts, costs, units and counts are read from the study, and the manual
     walkthroughs (their captions were written for one study) are left out;
   - a solution id opens through the element's bb-open, never a link into the box's repo;
   - calm colours: the focus highlight is the accent, not amber; a cost going up is a neutral chip.

   mountView(kind, host, S, env, opts) -> {redraw(), focus(key), setRows(ids|null)} (setRows: the rows a filter rail leaves)
   opts: {compact: no controls (a small tile), head: false = no title row, focus: a part key, pairsFirst (importance)}
   env:  {tip(event, html|null), sol(id) -> html, open(id), pick(key), observe(ResizeObserver), uid(prefix)} */
import { esc, fmtV, times, pct, signed, fmtCost, STILL_PAYS, RELEARNED } from './bb-ablation.model.js';

const NS = 'http://www.w3.org/2000/svg';
function el(tag, attrs = {}, parent = null, text = null) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) node.setAttribute(k, v);
  if (text != null) node.textContent = text;
  if (parent) parent.appendChild(node);
  return node;
}
function logScale(d0, d1, r0, r1) {
  const a = Math.log10(d0), b = Math.log10(d1);
  const f = (x) => r0 + ((Math.log10(x) - a) / (b - a)) * (r1 - r0);
  f.ticks = () => {
    const out = [];
    for (let e = Math.floor(a); e <= Math.ceil(b); e++) for (const m of [1, 2, 5]) { const v = m * 10 ** e; if (v >= d0 * 0.999 && v <= d1 * 1.001) out.push(v); }
    return out;
  };
  return f;
}
function linScale(d0, d1, r0, r1) {
  const f = (x) => r0 + ((x - d0) / (d1 - d0 || 1)) * (r1 - r0);
  f.ticks = (n = 5) => {
    const span = d1 - d0, step0 = 10 ** Math.floor(Math.log10(span / n || 1));
    const step = [1, 2, 5, 10].map((m) => m * step0).find((s) => span / s <= n) || step0 * 10;
    const out = []; for (let v = Math.ceil(d0 / step) * step; v <= d1 + 1e-9; v += step) out.push(+v.toFixed(10));
    return out;
  };
  return f;
}
const tick = (v) => (v >= 1000 ? `${(v / 1000).toFixed(v % 1000 ? 1 : 0)}k` : v >= 1 ? String(+v.toFixed(2)) : String(+v.toPrecision(2)));
const MEASURED = '<span class="basis measured">measured</span>';
const ESTIMATE = '<span class="basis estimate">estimate</span>';

function frame(host, opts, env, { title, question, controls = '', body, extra = '' }) {
  host.classList.add('av');
  host.classList.toggle('compact', !!opts.compact);
  host.innerHTML = `${opts.head === false ? '' : `<div class="av-head"><h3>${esc(title)}</h3><span class="q">${esc(question)}</span></div>`}
    ${controls ? `<div class="row av-controls">${controls}</div>` : ''}${body}<div class="av-extra">${extra}</div>`;
  const q = (s) => host.querySelector(s);
  host._redraw = null;
  const ro = new ResizeObserver(() => {
    const w = host.clientWidth;
    host.classList.toggle('narrow', w < 760);
    if (Math.abs(w - (host._w || 0)) > 4) { host._w = w; if (host._redraw) host._redraw(); }
  });
  ro.observe(host);
  env.observe(ro);
  return q;
}
function segs(q, state, keys, after) {
  return keys.map((key) => {
    const node = q(`[data-seg='${key}']`);
    if (!node) return () => {};
    const sync = () => node.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === state[key])));
    node.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; state[key] = b.dataset.v; sync(); after(); });
    return sync;
  });
}
const seg = (key, options) => `<div class="seg" data-seg="${key}">${options.map(([v, label]) => `<button type="button" data-v="${esc(v)}">${esc(label)}</button>`).join('')}</div>`;
function hover(env, node, html) {
  node.addEventListener('mousemove', (e) => env.tip(e, typeof html === 'function' ? html() : html));
  node.addEventListener('mouseleave', (e) => env.tip(e, null));
}
function pickable(env, node, key) {
  if (!key) return;
  node.classList.add('pick');
  node.addEventListener('click', (e) => { e.stopPropagation(); env.pick(key); });
}
function openable(env, node, id) {
  if (!id) return;
  node.classList.add('pick');
  node.setAttribute('data-open', id);
  node.addEventListener('click', (e) => { e.stopPropagation(); env.open(id); });
}

// ── Remix: the ablation table as an UpSet dot matrix + a remix panel ("what if I keep only these parts?") ──────────
function remix(host, S, env, opts) {
  const { D, order } = S;
  const U = S.unit;
  const state = { kind: 'all', sort: 'objective', filter: {}, remix: new Set(order), focus: opts.focus || null, only: null };
  const q = frame(host, opts, env, {
    title: 'Remix', question: 'What is the best combination?',
    controls: opts.compact ? '' : `<span class="label">Rows</span>${seg('kind', [['all', 'all measured'], ['ends', 'one part in or out'], ['path', 'the path']])}
      <span class="label">Sort</span>${seg('sort', [['objective', 'by error'], ['size', 'by part count']])}`,
    body: `<div class="av-split"><div class="card"><div class="av-chart matrix"></div>
        <div class="legend av-note"><span><i style="background:var(--ab-s1);border-radius:50%"></i>part in</span>
        <span><i style="background:var(--ab-grid);border-radius:50%"></i>part out</span><span><i style="background:var(--ab-s2)"></i>refit (not frozen)</span>
        <span class="muted">Click a part's column head: any → with it → without it. Click a row to remix it; its id opens the solution.</span></div></div>
      <div class="card remix-panel"><h4>Remix</h4><div class="small muted">Pick parts; see the measured variant, or the surrogate's guess.</div>
        <div class="toggles"></div><div class="answer"></div></div></div>`,
  });
  const key = (keeps) => order.filter((k) => keeps.includes(k)).join(',');
  const lattice = Object.fromEntries((D.lattice || []).map((l) => [key(l.keeps), l]));
  function rows() {
    let list = D.variants.filter((v) => v.measured && v.objective);
    const seen = new Set();
    list = list.filter((v) => (seen.has(v.solution) ? false : seen.add(v.solution)));
    if (state.only) list = list.filter((v) => state.only.has(v.solution));
    if (state.kind === 'ends') list = list.filter((v) => ['leave-one-out', 'add-one-in', 'base', 'target'].includes(v.kind) || v.keeps.length === 1 || v.keeps.length === order.length - 1);
    if (state.kind === 'path') list = list.filter((v) => v.step || v.kind === 'base');
    for (const [k, f] of Object.entries(state.filter)) {
      if (f === 'in') list = list.filter((v) => v.keeps.includes(k));
      if (f === 'out') list = list.filter((v) => !v.keeps.includes(k));
    }
    if (state.kind === 'path') return list.sort((a, b) => (a.step || 0) - (b.step || 0));
    const by = state.sort === 'objective' ? (a, b) => a.objective - b.objective : (a, b) => b.keeps.length - a.keeps.length || a.objective - b.objective;
    return list.sort(by);
  }
  function draw() {
    const h = q('.matrix');
    h.innerHTML = '';
    const list = rows();
    const phone = (h.clientWidth || 760) < 560;
    const idW = phone ? 96 : 150, cell = phone ? 19 : 28, rowH = opts.compact ? 17 : 20, top = phone ? 96 : 118, bottom = 34;
    // WHY a floor: the values need their column beside the dots; a narrower tile scrolls the matrix inside itself
    const W = Math.max(h.clientWidth || 760, idW + order.length * cell + 52);
    const barX0 = idW + order.length * cell + 12, barX1 = W - (phone ? 46 : 70);
    const bars = barX1 - barX0 > 60;
    const H = top + Math.max(1, list.length) * rowH + bottom;
    const svg = el('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Variants by included parts and error' }, h);
    order.forEach((k, j) => {
      const cx = idW + j * cell + cell / 2;
      const f = state.filter[k] || 'any';
      if (state.focus === k) el('rect', { x: cx - cell / 2, y: 0, width: cell, height: H - bottom + 4, fill: 'var(--ab-hl)', 'data-focus': '1' }, svg);
      const g = el('g', { class: 'hdr', 'data-part': k, style: 'cursor:pointer' }, svg);
      const strong = f !== 'any' || state.focus === k;
      el('text', { x: cx, y: top - 10, transform: `rotate(-50 ${cx} ${top - 10})`, 'font-size': phone ? 10.5 : 11.5, class: strong ? 'ink' : '', 'font-weight': strong ? 600 : 400 }, g,
        S.short(k) + (f === 'in' ? ' ✓' : f === 'out' ? ' ✗' : ''));
      el('rect', { x: cx - cell / 2, y: 0, width: cell, height: top, fill: 'transparent' }, g);
      g.addEventListener('click', () => {
        state.filter[k] = { any: 'in', in: 'out', out: 'any' }[f];
        if (state.filter[k] === 'any') delete state.filter[k];
        draw();
      });
      el('line', { x1: cx, x2: cx, y1: top - 4, y2: H - bottom, class: 'grid' }, svg);
    });
    const values = list.map((v) => v.objective);
    const x = logScale(Math.min(...values, S.target) * 0.85, Math.max(...values, S.base) * 1.1, barX0, barX1);
    if (bars) for (const t of x.ticks()) {
      el('line', { x1: x(t), x2: x(t), y1: top - 4, y2: H - bottom, class: 'grid' }, svg);
      el('text', { x: x(t), y: H - bottom + 14, 'text-anchor': 'middle', 'font-size': 10.5 }, svg, tick(t));
    }
    el('text', { x: W - 4, y: H - 4, 'text-anchor': 'end', 'font-size': 10.5 }, svg, bars ? `error, ${U} (log)` : `error, ${U}`);
    const remixKey = key([...state.remix]);
    list.forEach((v, i) => {
      const y = top + i * rowH;
      const picked = key(v.keeps) === remixKey && v.removal === 'frozen';
      if (picked) el('rect', { x: 0, y: y + 1, width: W, height: rowH - 2, rx: 4, fill: 'var(--ab-hl)' }, svg);
      const xs = [];
      order.forEach((k, j) => {
        const cx = idW + j * cell + cell / 2, inn = v.keeps.includes(k);
        if (inn) xs.push(cx);
        el('circle', { cx, cy: y + rowH / 2, r: inn ? 5 : 3.5, fill: inn ? (v.removal === 'refit' ? 'var(--ab-s2)' : 'var(--ab-s1)') : 'var(--ab-grid)' }, svg);
      });
      if (xs.length > 1) el('line', { x1: Math.min(...xs), x2: Math.max(...xs), y1: y + rowH / 2, y2: y + rowH / 2, stroke: v.removal === 'refit' ? 'var(--ab-s2)' : 'var(--ab-s1)', 'stroke-width': 2, opacity: 0.5 }, svg);
      if (bars) el('rect', { x: barX0, y: y + 4, width: Math.max(2, x(v.objective) - barX0), height: rowH - 8, rx: 3,
        fill: v.solution === D.study.target ? 'var(--ab-s3)' : 'var(--ab-faint)', opacity: 0.8 }, svg);
      el('text', { x: bars ? barX1 + 4 : W - 4, y: y + rowH - 6, 'font-size': 11, class: 'ink', 'text-anchor': bars ? 'start' : 'end' }, svg, fmtV(v.objective));
      const hit = el('rect', { x: 0, y, width: W, height: rowH, fill: 'transparent', 'data-row': v.solution, style: 'cursor:pointer' }, svg);
      hit.addEventListener('click', () => { state.remix = new Set(v.keeps); remixPanel(); draw(); });
      hover(env, hit, () => `<b>${esc(v.solution)}</b> · ${esc(v.kind)}${v.step ? ` step ${v.step}` : ''} · ${esc(v.removal)}<br>${fmtV(v.objective)} ${esc(U)} ·
        ${v.code_lines ?? '—'} code lines · ${v.identified_params ?? '—'} parameters<br>in: ${esc(v.keeps.map(S.name).join(', ') || 'none')}`);
      // WHY after the hit rect: the id stays clickable above it (it opens the solution; the row remixes)
      const id = el('text', { x: 4, y: y + rowH - 6, 'font-size': phone ? 10.5 : 11.5, class: 'ink sol', 'font-family': 'var(--bb-mono)' }, svg,
        v.solution.length > (phone ? 13 : 21) ? `${v.solution.slice(0, phone ? 12 : 20)}…` : v.solution);
      openable(env, id, v.solution);
    });
    if (!list.length) el('text', { x: idW, y: top + 14, 'font-size': 12 }, svg, 'No measured variant matches these filters.');
  }
  function remixPanel() {
    const tog = q('.toggles');
    tog.innerHTML = '';
    order.forEach((k) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = S.name(k); b.setAttribute('aria-pressed', String(state.remix.has(k)));
      b.addEventListener('click', () => { if (state.remix.has(k)) state.remix.delete(k); else state.remix.add(k); remixPanel(); draw(); });
      tog.appendChild(b);
    });
    const keeps = order.filter((k) => state.remix.has(k));
    const hit = lattice[key(keeps)];
    const ans = q('.answer');
    if (!hit) { ans.innerHTML = '<div class="small muted">This set is not in the study\'s table.</div>'; return; }
    const v = hit.solution && S.byId[hit.solution];
    const neighbours = (D.lattice || []).filter((l) => l.how === 'measured' && l.keeps.length && Math.abs(l.keeps.length - keeps.length) === 1
      && (l.keeps.every((k) => keeps.includes(k)) || keeps.every((k) => l.keeps.includes(k))));
    if (hit.how === 'measured') {
      ans.innerHTML = `<div class="label">${MEASURED}</div><div class="big">${fmtV(hit.objective)} ${esc(U)}</div>
        <div class="small">${env.sol(hit.solution)} · ${times(S.base / hit.objective)} better than the base · ${times(hit.objective / S.target)} the best's error<br>
        ${v ? `${v.code_lines ?? '—'} code lines · ${v.identified_params ?? '—'} parameters${v.energy_j != null ? ` · ${Math.round(v.energy_j)} J` : ''}` : ''}</div>`;
    } else {
      const sur = D.surrogate || {};
      ans.innerHTML = `<div class="label">${ESTIMATE} not measured · the surrogate's guess</div><div class="big">≈ ${fmtV(hit.objective)} ${esc(U)}</div>
        <div class="small muted">±${times(sur.loo_error_factor)} (its leave-one-out error over ${sur.points ?? '—'} measured sets): a guess, not a score.</div>
        ${D.format === 'changelog' ? `<div class="small" style="margin-top:6px">To measure it, one row in the study file, then the normal loop:</div>
        <pre>| ? | ${order.map((k) => (keeps.includes(k) ? '●' : '')).join(' | ')} | remix-request | frozen |</pre>` : ''}`;
    }
    ans.insertAdjacentHTML('beforeend', `<div class="small" style="margin-top:8px"><b>One part away</b> ${MEASURED}<br>${neighbours.slice(0, 6).map((l) => {
      const more = l.keeps.length > keeps.length;
      const k = more ? l.keeps.find((x) => !keeps.includes(x)) : keeps.find((x) => !l.keeps.includes(x));
      return `${more ? '+' : '−'} ${esc(S.name(k))}: ${fmtV(l.objective)} ${esc(U)} ${env.sol(l.solution)}`;
    }).join('<br>') || 'none'}</div>`);
  }
  const syncs = segs(q, state, ['kind', 'sort'], () => draw());
  syncs.forEach((f) => f());
  remixPanel();
  host._redraw = draw;
  draw();
  return { redraw: draw, focus(k) { state.focus = k; draw(); }, setRows(ids) { state.only = ids ? new Set(ids) : null; draw(); } };
}

// ── Waterfall: one bar per step from the base to the target, greedy path or as searched ─────────────────────────────
function waterfall(host, S, env, opts) {
  const { D } = S;
  const U = S.unit;
  const costs = D.costs || [];
  const state = { order: 'greedy', scale: 'log', cost: costs[0] ? costs[0].key : null, focus: opts.focus || null, only: null };
  const q = frame(host, opts, env, {
    title: 'Waterfall', question: 'How did we get here?',
    controls: opts.compact ? '' : `<span class="label">Order</span>${seg('order', [['greedy', 'what helps most first'], ['history', 'as searched']])}
      <span class="label">Scale</span>${seg('scale', [['log', 'log (×)'], ['lin', `linear (${U})`]])}
      ${costs.length ? `<span class="label">Under each step</span>${seg('cost', costs.map((c) => [c.key, c.label]))}` : ''}`,
    body: `<div class="summary"></div><div class="card"><div class="av-chart chart"></div>
      <div class="legend av-note"><span><i style="background:var(--bb-good)"></i>error went down</span><span><i style="background:var(--bb-bad)"></i>error went up</span>
      <span><i style="background:var(--ab-faint)"></i>no change (&lt; 0.5 %)</span><span class="muted note"></span></div></div>`,
  });
  const path = D.path || [];
  const prevOf = (p) => { const i = path.indexOf(p); return i === 0 ? D.study.base : path[i - 1].solution; };
  const delta = (a, b, k) => { const x = S.byId[a] && S.byId[a][k], y = S.byId[b] && S.byId[b][k]; return x == null || y == null ? null : x - y; };
  function steps() {
    if (state.order === 'greedy') {
      return path.map((p) => ({ label: `+ ${p.add.map(S.name).join(' + ')}`, keys: p.add, solution: p.solution, from: p.from_mm, to: p.to_mm,
        note: p.exact ? 'every candidate at this step was measured' : 'chosen on the surrogate, then measured', cost: (k) => delta(p.solution, prevOf(p), k) }));
    }
    const out = [];
    D.history.forEach((h, i) => {
      if (i === 0) return;
      const prev = D.history[i - 1];
      const c = h.component && S.comp[h.component];
      const partial = c && c.introduced_by.length > 1 && c.introduced_by.indexOf(h.solution) < c.introduced_by.length - 1;
      out.push({ label: c ? `+ ${c.name}${partial ? ' (first half)' : c.introduced_by.length > 1 ? ' (second half)' : ''}` : '= refactor (no component)',
        keys: h.component ? [h.component] : [], solution: h.solution, from: prev.objective, to: h.objective, note: h.change, cost: (k) => delta(h.solution, prev.solution, k) });
    });
    return out;
  }
  function summary() {
    const s = steps();
    if (!s.length) { q('.summary').innerHTML = ''; return; }
    const best = s.reduce((m, x) => (x.to / x.from < m.to / m.from ? x : m), s[0]);
    const firstThree = s.slice(0, 3).reduce((m, x) => m * (x.from / x.to), 1);
    q('.summary').innerHTML = `
      <div class="card"><div class="label">Base → target</div><div class="big">${fmtV(S.base)} → ${fmtV(S.target)} ${esc(U)}</div><div class="small muted">${times(S.total)} lower, ${esc(D.study.split || 'dev')}</div></div>
      <div class="card"><div class="label">Biggest single step</div><div class="big">${esc(best.label.replace('+ ', ''))}</div><div class="small muted">${pct(best.from, best.to)} (${fmtV(best.from)} → ${fmtV(best.to)} ${esc(U)})</div></div>
      <div class="card"><div class="label">First three steps</div><div class="big">${times(firstThree)}</div><div class="small muted">of the ${times(S.total)} in ${s.length} steps</div></div>`;
  }
  function label(svg, i, text, value, phone, labelW, yOf, barH, W, strong, solution) {
    const y = phone ? yOf(i) - 6 : yOf(i) + barH / 2 + 4;
    const t = el('text', { x: phone ? 8 : labelW, y, 'text-anchor': phone ? 'start' : 'end', 'font-size': 13, class: strong ? 'ink' : '', 'font-weight': strong ? 600 : 400 }, svg, text);
    el('text', { x: W - 8, y, 'text-anchor': 'end', 'font-size': 12.5, class: 'ink' }, svg, value);
    if (solution && !phone && !opts.compact) openable(env, el('text', { x: labelW, y: y + 13, 'text-anchor': 'end', 'font-size': 10.5, class: 'sol' }, svg, solution), solution);
    return t;
  }
  function draw() {
    const h = q('.chart');
    h.innerHTML = '';
    const s = steps();
    const W = h.clientWidth || 900, phone = W < 600;
    const labelW = phone ? 0 : 250, valueW = phone ? 0 : 150;
    const rowH = phone ? 52 : opts.compact ? 32 : 40, top = 26, bottom = 44;
    const rows = s.length + 2;
    const H = top + rows * rowH + bottom;
    const svg = el('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Waterfall of the error along the ablation path' }, h);
    const x0 = labelW + 8, x1 = W - valueW - 12;
    const values = [S.base, S.target, ...s.map((r) => r.to), ...s.map((r) => r.from)];
    const lo = Math.min(...values), hi = Math.max(...values);
    const x = state.scale === 'log' ? logScale(lo * 0.8, hi * 1.15, x0, x1) : linScale(0, hi * 1.05, x0, x1);
    for (const t of state.scale === 'log' ? x.ticks() : x.ticks(6)) {
      el('line', { x1: x(t), x2: x(t), y1: top - 6, y2: H - bottom + 4, class: 'grid' }, svg);
      el('text', { x: x(t), y: H - bottom + 18, 'text-anchor': 'middle', 'font-size': 11 }, svg, tick(t));
    }
    el('text', { x: x1, y: H - 4, 'text-anchor': 'end', 'font-size': 11 }, svg, `${D.objective.key} (${D.study.split || 'dev'}, ${U}${state.scale === 'log' ? ', log' : ''}) — lower is better`);
    const barH = phone ? 20 : opts.compact ? 18 : 24;
    const yOf = (i) => top + i * rowH + (phone ? 22 : (rowH - barH) / 2);
    const left = state.scale === 'log' ? x0 : x(0);
    for (const e of [{ i: 0, label: 'base', solution: D.study.base, value: S.base }, { i: rows - 1, label: 'target', solution: D.study.target, value: S.target }]) {
      el('rect', { x: left, y: yOf(e.i), width: Math.max(1, x(e.value) - left), height: barH, rx: 4, fill: 'var(--ab-s1)', opacity: 0.85 }, svg);
      label(svg, e.i, `${e.label}: ${e.solution}`, `${fmtV(e.value)} ${U}`, phone, labelW, yOf, barH, W, true);
    }
    const unitOf = state.cost && S.cost[state.cost] ? S.cost[state.cost].unit : '';
    s.forEach((r, k) => {
      const i = k + 1;
      const focus = state.focus && r.keys.includes(state.focus);
      if (focus) el('rect', { x: 0, y: top + i * rowH, width: W, height: rowH, fill: 'var(--ab-hl)', 'data-focus': '1' }, svg);
      const dim = (state.focus && !focus) || (state.only && !state.only.has(r.solution));
      const change = r.to / r.from - 1;
      const colour = Math.abs(change) < 0.005 ? 'var(--ab-faint)' : change < 0 ? 'var(--bb-good)' : 'var(--bb-bad)';
      const a = Math.min(x(r.from), x(r.to)), b = Math.max(x(r.from), x(r.to));
      el('rect', { x: a, y: yOf(i), width: Math.max(2, b - a), height: barH, rx: 4, fill: colour, opacity: dim ? 0.35 : 1, 'data-step': i }, svg);
      el('line', { x1: x(r.from), x2: x(r.from), y1: yOf(i) - (rowH - barH), y2: yOf(i) + barH, stroke: 'var(--ab-faint)', 'stroke-dasharray': '2 2' }, svg);
      const c = state.cost ? r.cost(state.cost) : null;
      const one = c != null && Math.abs(c) === 1 && unitOf.endsWith('s') ? unitOf.slice(0, -1) : unitOf;
      const t = label(svg, i, r.label, `${pct(r.from, r.to)}${c == null ? '' : ` · ${signed(c, Number.isInteger(c) || Math.abs(c) >= 10 ? 0 : 2)} ${one}`}`, phone, labelW, yOf, barH, W, focus, r.solution);
      pickable(env, t, r.keys[0]);
      const hit = el('rect', { x: x0, y: yOf(i) - 4, width: Math.max(10, x1 - x0), height: barH + 8, fill: 'transparent', style: 'cursor:pointer' }, svg);
      hover(env, hit, () => `<b>${esc(r.label)}</b><br><code>${esc(r.solution)}</code> (click to open)<br>${fmtV(r.from)} → ${fmtV(r.to)} ${esc(U)} (${pct(r.from, r.to)})<br>
        ${state.cost ? `${esc(S.cost[state.cost].label)}: ${c == null ? '—' : `${signed(c, Number.isInteger(c) || Math.abs(c) >= 10 ? 0 : 2)} ${esc(unitOf)}`}<br>` : ''}<span class="muted">${esc(r.note || '')}</span>`);
      hit.addEventListener('click', () => env.open(r.solution));
      svg.appendChild(t); // WHY: the label stays clickable above the hover rect
    });
    const exact = path.filter((p) => p.exact).map((p) => p.step), guided = path.filter((p) => !p.exact).map((p) => p.step);
    q('.note').textContent = state.order === 'greedy'
      ? `Every step is a measured solution.${guided.length ? ` Step${guided.length === 1 ? '' : 's'} ${guided.join(', ')} ${guided.length === 1 ? 'was' : 'were'} picked on a surrogate (Biedenkapp et al. 2017)` : ''}${exact.length ? `${guided.length ? ';' : ''} step${exact.length === 1 ? '' : 's'} ${exact.join(', ')} compared every candidate` : ''}.`
      : 'As searched: the agent\'s own order, with half-steps (a part found over two solutions) and any step that changed no part.';
    summary();
  }
  const syncs = segs(q, state, ['order', 'scale', 'cost'], () => draw());
  syncs.forEach((f) => f());
  host._redraw = draw;
  draw();
  return { redraw: draw, focus(k) { state.focus = k; draw(); }, setRows(ids) { state.only = ids ? new Set(ids) : null; draw(); } };
}

// ── Importance at both ends: leave-one-out (frozen, refit) beside add-one-in, the Shapley estimate, measured pairs ──
function importance(host, S, env, opts) {
  const { D, O } = S;
  const state = { sort: 'without', refit: 'frozen', focus: opts.focus || null };
  const q = frame(host, opts, env, {
    title: 'Importance at both ends', question: 'What is each part worth, removed from the best and added alone?',
    controls: opts.compact ? '' : `<span class="label">Sort by</span>${seg('sort', [['without', 'removing it from the best'], ['alone', 'adding it alone'], ...(O ? [['shapley', 'fair share (estimate)']] : [])])}
      <span class="label">Removal</span>${seg('refit', [['frozen', 'frozen'], ['both', 'frozen + refit']])}`,
    body: `${opts.pairsFirst ? '<div class="card pairs" style="margin-bottom:12px"></div>' : ''}<div class="card"><div class="av-chart chart"></div><div class="legend av-note">
      <span><i style="background:var(--ab-s1)"></i>removed from the best, frozen</span><span><i style="background:var(--ab-s2)"></i>removed, then refit</span>
      <span><i style="background:var(--ab-s3)"></i>added alone to the base</span>${O ? `<span><i style="background:var(--ab-est);border-radius:50%"></i>fair share (Shapley) ${ESTIMATE}</span>` : ''}</div></div>`,
    extra: opts.pairsFirst ? '' : '<div class="card pairs" style="margin-top:12px"></div>',
  });
  function rows() {
    const k = { without: (c) => -(c.without_factor || 0), alone: (c) => -(c.alone_factor || 0), shapley: (c) => -(S.part[c.key] ? S.part[c.key].shapley : 0) }[state.sort];
    return [...D.components].sort((a, b) => k(a) - k(b));
  }
  function verdict(c) {
    if (c.without_refit_factor != null && c.without_refit_factor < RELEARNED) return 're-learned by a refit';
    if (c.without_refit_factor != null) return 'still pays after a refit';
    if (c.without_factor > 1.25 * c.alone_factor) return 'pays more with the others';
    if (c.alone_factor > 1.1) return 'pays on its own too';
    return 'small either way';
  }
  function domain() {
    const vals = [1];
    for (const c of D.components) for (const v of [c.without_factor, c.without_refit_factor, c.alone_factor]) if (v != null && v > 0) vals.push(v);
    if (O) for (const p of O.parts) vals.push(10 ** (p.shapley - p.shapley_se), 10 ** (p.shapley + p.shapley_se));
    return [Math.min(0.5, Math.min(...vals) * 0.8), Math.max(2, Math.max(...vals) * 1.25)];
  }
  function draw() {
    const h = q('.chart');
    h.innerHTML = '';
    const W = h.clientWidth || 900, phone = W < 600;
    const labelW = phone ? 0 : 210, valueW = phone ? 0 : 170;
    const both = state.refit === 'both';
    const barH = opts.compact ? 7 : 9, gap = 3, bars = both ? 3 : 2;
    const rowH = (phone ? 30 : 12) + bars * (barH + gap) + (opts.compact ? 6 : 12);
    const top = 30, bottom = 40;
    const list = rows();
    const H = top + list.length * rowH + bottom;
    const svg = el('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Leave-one-out and add-one-in factor per part' }, h);
    const x0 = labelW + 10, x1 = W - valueW - 10;
    const [lo, hi] = domain();
    const x = logScale(lo, hi, x0, x1);
    for (const t of x.ticks()) {
      if (phone && ![0.5, 1, 2, 5, 10, 20, 50, 100].includes(t)) continue;
      el('line', { x1: x(t), x2: x(t), y1: top - 8, y2: H - bottom + 4, class: t === 1 ? 'axis' : 'grid' }, svg);
      el('text', { x: x(t), y: H - bottom + 18, 'text-anchor': 'middle', 'font-size': 11 }, svg, `×${t}`);
    }
    el('text', { x: x(1) + 4, y: top - 14, 'font-size': 11 }, svg, '→ bigger effect (×, log)');
    el('text', { x: x(1) - 4, y: top - 14, 'font-size': 11, 'text-anchor': 'end' }, svg, 'harmful ←');
    el('text', { x: x1, y: H - 4, 'text-anchor': 'end', 'font-size': 11 }, svg, phone ? '× worse without · × better alone' : '× worse without it · × better with only it · ×1 = no effect');
    list.forEach((c, i) => {
      const y = top + i * rowH + (phone ? 22 : 4);
      if (state.focus === c.key) el('rect', { x: 0, y: top + i * rowH - 2, width: W, height: rowH, fill: 'var(--ab-hl)', 'data-focus': '1' }, svg);
      const t = el('text', { x: phone ? 6 : labelW, y: phone ? y - 8 : y + 10, 'text-anchor': phone ? 'start' : 'end', 'font-size': 13, class: 'ink',
        'font-weight': state.focus === c.key ? 600 : 400, 'data-part': c.key }, svg, c.name);
      pickable(env, t, c.key);
      if (!phone) el('text', { x: labelW, y: y + 24, 'text-anchor': 'end', 'font-size': 11 }, svg, verdict(c));
      else el('text', { x: W - 6, y: y - 8, 'text-anchor': 'end', 'font-size': 11 }, svg, verdict(c));
      const series = [['without_factor', 'var(--ab-s1)', 'without it (frozen)', c.without, c.without_mm], ...(both ? [['without_refit_factor', 'var(--ab-s2)', 'without it, refit', c.without_refit, c.without_refit_mm]] : []),
        ['alone_factor', 'var(--ab-s3)', 'alone on the base', c.alone, c.alone_mm]];
      series.forEach(([k, colour, what, solution, value], j) => {
        const v = c[k], yy = y + j * (barH + gap);
        if (v == null) { el('text', { x: x(1) + 4, y: yy + barH - 1, 'font-size': 10 }, svg, 'not measured'); return; }
        const a = Math.min(x(1), x(v)), b = Math.max(x(1), x(v));
        const rect = el('rect', { x: a, y: yy, width: Math.max(2, b - a), height: barH, rx: 3, fill: colour }, svg);
        if (!phone) el('text', { x: x1 + 8, y: yy + barH - 1, 'font-size': 11, class: 'ink' }, svg, `${times(v)} ${k === 'alone_factor' ? 'better' : 'worse'}`);
        else el('text', { x: Math.min(b + 4, W - 50), y: yy + barH - 1, 'font-size': 10.5, class: 'ink' }, svg, times(v));
        hover(env, rect, () => `<b>${esc(c.name)}</b> — ${what} ${MEASURED}<br><code>${esc(solution || '—')}</code>: ${fmtV(value)} ${esc(S.unit)}
          vs ${k === 'alone_factor' ? `base ${fmtV(S.base)}` : `best ${fmtV(S.target)}`} ${esc(S.unit)} → ${times(v)}`);
        if (solution) { rect.style.cursor = 'pointer'; rect.addEventListener('click', () => env.open(solution)); }
      });
      // WHY the overall table's Shapley, not the components' shapley_factor: the same number, plus its jackknife error
      const p = S.part[c.key];
      if (!p) return;
      const sv = 10 ** p.shapley, l = 10 ** (p.shapley - p.shapley_se), r = 10 ** (p.shapley + p.shapley_se);
      const clamp = (v) => Math.min(hi / 1.04, Math.max(lo * 1.04, v));
      const cy = y + (bars * (barH + gap)) / 2 - 1;
      el('line', { x1: x(clamp(l)), x2: x(clamp(r)), y1: cy, y2: cy, stroke: 'var(--ab-est)', 'stroke-width': 1.5 }, svg);
      const dot = el('circle', { cx: x(clamp(sv)), cy, r: 4.5, fill: 'var(--bb-bg)', stroke: 'var(--ab-est)', 'stroke-width': 2 }, svg);
      hover(env, dot, `<b>${esc(c.name)}</b> — fair share (Shapley) ${ESTIMATE}<br>average step over every order of adding the ${S.order.length} parts:
        ${times(sv)} (${S.share(p.shapley)} of the ${times(O.total_factor)}), jackknife ±${S.share(p.shapley_se, 1)}<br>
        <span class="muted">${O.all_sets - O.measured_sets} of the ${O.all_sets} sets come from the surrogate (±${times(O.surrogate.loo_error_factor)} per set)</span>`);
    });
    pairs();
  }
  function pairs() {
    const list = [...(D.pairs || [])].sort((a, b) => a.interaction_factor - b.interaction_factor);
    q('.pairs').innerHTML = `<h4 class="h4">Pairs: do two parts add up? ${MEASURED}</h4>
      <p class="small muted" style="margin:0 0 8px">Measured where all four corners exist. Interaction = joint effect ÷ (effect of each alone, multiplied).
      Below ×1: together they do more than the product (they need each other); above ×1: they overlap.</p>
      ${list.length ? `<div class="scroll-x"><table class="data"><thead><tr><th>pair</th><th>where</th><th class="num">interaction</th><th>reading</th><th>solutions</th></tr></thead><tbody>
      ${list.map((p) => `<tr${state.focus && p.pair.includes(state.focus) ? ' class="hl"' : ''}><td>${esc(p.pair.map(S.name).join(' + '))}</td><td>${esc(p.context)}</td><td class="num">${times(p.interaction_factor)}</td>
        <td>${p.interaction_factor < 0.9 ? `need each other (${times(1 / p.interaction_factor)} more together)` : p.interaction_factor > 1.1 ? 'overlap' : 'about independent'}</td>
        <td class="small">${p.solutions.map((s) => env.sol(s)).join(' ')}</td></tr>`).join('')}</tbody></table></div>` : '<p class="small muted">No pair was measured at all four corners.</p>'}`;
  }
  const syncs = segs(q, state, ['sort', 'refit'], () => draw());
  syncs.forEach((f) => f());
  host._redraw = draw;
  draw();
  return { redraw: draw, focus(k) { state.focus = k; draw(); }, setRows() { /* per part: a row filter does not apply */ } };
}

// ── Cost frontier: error against each cost with the Pareto front; a path through cost space ─────────────────────────
// WHY the path toggle: Zach, 2026-11-24, "it shows the waterfall view but now we see both the improvement amount WITH
// the cost", so the waterfall's greedy path can be drawn here too, not only the search's lineage.
function frontier(host, S, env, opts) {
  const { D } = S;
  const U = S.unit;
  const costs = D.costs || [];
  const state = { axis: costs[0] ? costs[0].key : 'all', show: 'study', path: 'lineage', focus: opts.focus || null, only: null };
  const arrow = env.uid('arrow');
  const q = frame(host, opts, env, {
    title: 'Cost frontier', question: `What did each ${U || 'unit of error'} cost?`,
    controls: opts.compact ? '' : `<span class="label">Cost</span>${seg('axis', [...costs.map((c) => [c.key, c.label]), ...(costs.length > 1 ? [['all', `all ${costs.length}`]] : [])])}
      <span class="label">Path</span>${seg('path', [['lineage', 'as searched'], ['greedy', "the waterfall's path"]])}
      <span class="label">Show</span>${seg('show', [['study', 'study + lineage'], ['population', '+ whole population']])}`,
    body: `<div class="av-split"><div class="card"><div class="av-chart plot"></div>
        <div class="legend av-note"><span><i style="background:var(--ab-s1);border-radius:50%"></i><span class="pathname">the search's lineage (arrows: its order)</span></span>
        <span><i style="background:var(--ab-s2);border-radius:50%"></i><span class="orangename">ablation variant</span></span><span><i style="background:var(--ab-faint);border-radius:50%"></i>other solutions</span>
        <span><i style="background:var(--bb-fg)"></i>the front: nothing is both cheaper and better</span></div>
        <div class="small muted noise av-note"></div></div>
      <div class="card front"></div></div>`,
  });
  const historyIds = new Set(D.history.map((h) => h.solution));
  const tiers = env.tiers || {};
  function points() {
    const study = new Map();
    for (const v of D.variants) if (v.measured && v.objective) study.set(v.solution, { ...v, group: historyIds.has(v.solution) ? 'lineage' : 'ablation' });
    for (const h of D.history) if (h.objective) study.set(h.solution, { ...(study.get(h.solution) || {}), ...h, group: 'lineage' });
    let list = [...study.values()];
    if (state.only) list = list.filter((p) => state.only.has(p.solution));
    if (state.show === 'population') for (const p of D.population || []) if (!study.has(p.solution) && p.objective) list.push({ ...p, group: 'other' });
    return list.filter((p) => p.admissible !== false);
  }
  function front(list, key) {
    const pts = list.filter((p) => p[key] != null);
    return pts.filter((p) => !pts.some((o) => o[key] <= p[key] && o.objective <= p.objective && (o[key] < p[key] || o.objective < p.objective))).sort((a, b) => a[key] - b[key]);
  }
  function pathPoints(key) {
    const seq = state.path === 'greedy' ? [D.study.base, ...(D.path || []).map((p) => p.solution)] : D.history.map((h) => h.solution);
    return seq.map((s) => S.byId[s]).filter((p) => p && p[key] != null && p.objective);
  }
  function scatter(cell, key, small) {
    const list = points().filter((p) => p[key] != null);
    const W = cell.clientWidth || 700, phone = W < 560;
    const H = small ? 240 : phone ? 380 : opts.compact ? 300 : 460;
    const left = 54, right = 16, top = small ? 26 : 16, bottom = 40;
    const svg = el('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `Error against ${S.cost[key].label}` }, cell);
    const path = pathPoints(key);
    const all = [...list, ...path];
    if (!all.length) { el('text', { x: left, y: top + 20, 'font-size': 12 }, svg, `No ${S.cost[key].label} recorded.`); return []; }
    const xs = all.map((p) => p[key]), ys = all.map((p) => p.objective);
    const x = linScale(Math.min(0, ...xs), Math.max(...xs) * 1.06 || 1, left, W - right);
    const y = logScale(Math.min(...ys) * 0.8, Math.max(...ys) * 1.25, H - bottom, top);
    for (const t of x.ticks(phone || small ? 4 : 6)) {
      el('line', { x1: x(t), x2: x(t), y1: top, y2: H - bottom, class: 'grid' }, svg);
      el('text', { x: x(t), y: H - bottom + 14, 'text-anchor': 'middle', 'font-size': 10.5 }, svg, tick(t));
    }
    for (const t of y.ticks()) {
      el('line', { x1: left, x2: W - right, y1: y(t), y2: y(t), class: 'grid' }, svg);
      el('text', { x: left - 5, y: y(t) + 4, 'text-anchor': 'end', 'font-size': 10.5 }, svg, tick(t));
    }
    el('text', { x: W - right, y: H - 6, 'text-anchor': 'end', 'font-size': 11 }, svg, `${S.cost[key].label} (${S.cost[key].unit}) →`);
    if (small) el('text', { x: left, y: 14, 'font-size': 11, class: 'ink' }, svg, S.cost[key].label);
    el('text', { transform: `translate(12 ${(top + H - bottom) / 2}) rotate(-90)`, 'text-anchor': 'middle', 'font-size': 11 }, svg, `error, ${U} (log) ↓ better`);
    const defs = el('defs', {}, svg);
    const m = el('marker', { id: arrow, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' }, defs);
    el('path', { d: 'M0,0 L10,5 L0,10 z', fill: 'var(--ab-s1)', opacity: 0.8 }, m);
    for (let i = 1; i < path.length; i++) {
      el('line', { x1: x(path[i - 1][key]), y1: y(path[i - 1].objective), x2: x(path[i][key]), y2: y(path[i].objective),
        stroke: 'var(--ab-s1)', 'stroke-width': state.path === 'greedy' ? 2 : 1.5, opacity: state.path === 'greedy' ? 0.8 : 0.55, 'marker-end': `url(#${arrow})` }, svg);
    }
    const f = front(list, key);
    if (f.length) {
      let d = `M${x(f[0][key])},${y(f[0].objective)}`;
      for (let i = 1; i < f.length; i++) d += `H${x(f[i][key])}V${y(f[i].objective)}`;
      el('path', { d, fill: 'none', stroke: 'var(--bb-fg)', 'stroke-width': 2 }, svg);
    }
    const onFront = new Set(f.map((p) => p.solution));
    const onPath = new Set(path.map((p) => p.solution));
    const colour = { lineage: 'var(--ab-s1)', ablation: 'var(--ab-s2)', other: 'var(--ab-faint)' };
    for (const p of [...list].sort((a) => (a.group === 'other' ? -1 : 1))) {
      const lacks = state.focus && p.keeps && !p.keeps.includes(state.focus);
      const dim = state.focus && p.keeps && !lacks;
      // WHY recolour on the greedy path: blue always means "on the drawn path", orange "another study variant"
      const g = state.path === 'greedy' ? (onPath.has(p.solution) ? 'lineage' : p.group === 'other' ? 'other' : 'ablation') : p.group;
      const dot = el('circle', { cx: x(p[key]), cy: y(p.objective), r: onFront.has(p.solution) ? 6 : p.group === 'other' ? 3.5 : 4.5,
        fill: p.group !== 'other' && p.removal === 'refit' ? 'var(--bb-bg)' : colour[g], stroke: onFront.has(p.solution) ? 'var(--bb-fg)' : colour[g],
        'stroke-width': onFront.has(p.solution) ? 2 : 1.5, opacity: p.group === 'other' ? 0.6 : dim ? 0.3 : 1, 'data-sol': p.solution, style: 'cursor:pointer' }, svg);
      if (lacks) el('circle', { cx: x(p[key]), cy: y(p.objective), r: 9, fill: 'none', stroke: 'var(--bb-accent)', 'stroke-width': 2.5 }, svg);
      const tier = tiers[p.solution] && tiers[p.solution][`tier_${key}`];
      hover(env, dot, () => `<b>${esc(p.solution)}</b>${onFront.has(p.solution) ? ' · on the front' : ''}${tier ? ` · state.json costs: ${esc(tier)}` : ''}<br>${fmtV(p.objective)} ${esc(U)} · ${esc(S.cost[key].label)} ${fmtCost(p[key])} ${esc(S.cost[key].unit)}
        ${p.keeps ? `<br>parts: ${esc(p.keeps.length ? p.keeps.map(S.name).join(', ') : 'none')}${p.removal === 'refit' ? ' (refit)' : ''}` : ''}${p.change ? `<br><span class="muted">${esc(p.change.slice(0, 140))}</span>` : ''}`);
      dot.addEventListener('click', () => env.open(p.solution));
    }
    if (!small) {
      const boxes = [];
      for (const p of f) {
        const bx = x(p[key]) + 8, by = y(p.objective) - 7, w = p.solution.length * 6.2;
        if (bx + w > W - right || boxes.some((b) => bx < b[0] + b[2] && bx + w > b[0] && Math.abs(by - b[1]) < 12)) continue;
        boxes.push([bx, by, w]);
        el('text', { x: bx, y: by, 'font-size': 10.5, class: 'ink' }, svg, p.solution);
      }
    }
    return f;
  }
  function draw() {
    const h = q('.plot');
    h.innerHTML = '';
    if (!costs.length) { h.innerHTML = '<p class="small muted">The study records no cost per solution.</p>'; q('.front').innerHTML = ''; return; }
    let f = null;
    if (state.axis === 'all') {
      const grid = document.createElement('div'); grid.className = 'multiples'; h.appendChild(grid);
      for (const c of costs) { const cell = document.createElement('div'); grid.appendChild(cell); scatter(cell, c.key, true); }
    } else f = scatter(h, state.axis, false);
    q('.pathname').textContent = state.path === 'greedy' ? "the waterfall's greedy path (arrows: step order)" : "the search's lineage (arrows: its order)";
    q('.orangename').textContent = state.path === 'greedy' ? 'other study variant (incl. the lineage)' : 'ablation variant';
    const n = D.compute_noise;
    const c = S.cost[state.axis];
    q('.noise').innerHTML = (state.focus ? `<b>Ringed:</b> the variants without ${esc(S.name(state.focus))}. ` : '')
      + (n && (/compute/.test(state.axis) || state.axis === 'all') ? `Compute is noisy: re-scoring the same solution moved its p95 by ×${n.median_max_over_min.toFixed(2)} (median over ${n.repeats.length} solutions scored twice or more).` : '')
      + (c ? ` ${esc(c.label)} (${esc(c.unit)}) is read from ${c.source === 'study' ? 'the study file, which the box measured with its own cost tool' : `the ${esc(c.source || 'ledger')}'s diagnostics`}.` : '');
    const box = q('.front');
    const fronts = D.fronts || {};
    if (!f) {
      box.innerHTML = `<h4 class="h4">The fronts</h4>${costs.map((k) => `<div class="small"><b>${esc(k.label)}</b>: ${(fronts[k.key] || []).length} solutions — ${(fronts[k.key] || []).slice(0, 6).map((s) => env.sol(s)).join(', ')}${(fronts[k.key] || []).length > 6 ? '…' : ''}</div>`).join('')}`;
      return;
    }
    box.innerHTML = `<h4 class="h4">The front: ${esc(c.label)}</h4><div class="scroll-x"><table class="data"><thead><tr><th>solution</th><th class="num">${esc(c.unit)}</th><th class="num">${esc(U)}</th></tr></thead><tbody>
      ${f.map((p) => `<tr><td>${env.sol(p.solution)}<div class="small muted">${p.keeps ? esc(S.parts(p.keeps)) + (p.removal === 'refit' ? ' (refit)' : '') : esc((p.change || '').slice(0, 60))}</div></td>
        <td class="num">${fmtCost(p[state.axis])}</td><td class="num">${fmtV(p.objective)}</td></tr>`).join('')}</tbody></table></div>
      <p class="small muted">Each row is cheaper than the next and worse; anything off this list is beaten on both.</p>`;
  }
  const syncs = segs(q, state, ['axis', 'show', 'path'], () => draw());
  syncs.forEach((f) => f());
  host._redraw = draw;
  draw();
  return { redraw: draw, focus(k) { state.focus = k; draw(); }, setRows(ids) { state.only = ids ? new Set(ids) : null; draw(); } };
}

// ── Changelog: the search condensed, one card per part: when it was found, and removing it today ────────────────────
function changelog(host, S, env, opts) {
  const { D } = S;
  const U = S.unit;
  const state = { mode: 'condensed', order: 'search', focus: opts.focus || null, only: null };
  const q = frame(host, opts, env, {
    title: 'Changelog', question: 'Which steps mattered, and do they still?',
    controls: opts.compact ? '' : `<span class="label">Show</span>${seg('mode', [['condensed', 'net improvements'], ['all', 'everything tried']])}
      <span class="label">Order</span>${seg('order', [['search', 'as searched'], ['still', 'what still pays most']])}`,
    body: '<div class="steps-list"></div><p class="small muted count"></p>',
  });
  const SAME = 0.005;
  const costs = (D.costs || []).filter((c) => !(D.compute_noise && /compute/.test(c.key)));
  const lean = costs.filter((c) => c.source === 'study').map((c) => c.key); // code and parameters: a step may only shrink them
  function cards() {
    const h = D.history, out = [];
    for (let i = 1; i < h.length; i++) {
      const step = h[i], prev = h[i - 1], key = step.component;
      const same = key && out.find((c) => c.key === key);
      if (same) { same.ids.push(step.solution); same.parts.push([prev, step]); continue; }
      out.push({ key, ids: [step.solution], from: prev, to: step, parts: [[prev, step]] });
    }
    for (const c of out) {
      c.ratio = c.parts.reduce((m, [a, b]) => m * (b.objective / a.objective), 1);
      c.change = c.ratio - 1;
      c.fromV = c.parts[0][0].objective;
      c.toV = c.fromV * c.ratio;
      c.costs = Object.fromEntries((D.costs || []).map((k) => [k.key, c.parts.every(([a, b]) => a[k.key] != null && b[k.key] != null) ? c.parts.reduce((s, [a, b]) => s + b[k.key] - a[k.key], 0) : null]));
      const better = c.change < -SAME;
      const cheaper = Math.abs(c.change) <= SAME && lean.some((k) => c.costs[k] < 0) && lean.every((k) => !(c.costs[k] > 0));
      c.kept = better || cheaper;
      c.why = better ? 'error down' : cheaper ? 'same error, less code' : 'no net improvement';
    }
    return out;
  }
  const lineage = new Set(D.history.map((x) => x.solution));
  const sideBranches = (id) => (D.search || []).filter((p) => p.parent === id && !lineage.has(p.solution));
  const still = (c) => { const k = c.key && S.comp[c.key]; return k ? Math.log10(k.without_refit_factor || k.without_factor || 1) : -1; };
  function stillText(k) {
    const f = k.without_factor, r = k.without_refit_factor;
    const verdict = r != null ? (r < RELEARNED ? 're-learned by a refit' : 'still pays after a refit') : f > STILL_PAYS ? 'still pays' : 'small now';
    return `<div class="label">removing it from the best today</div>
      <div><b>${times(f)}</b> worse <span class="muted small">frozen, ${env.sol(k.without)}</span></div>
      ${r != null ? `<div><b>${times(r)}</b> worse <span class="muted small">refit, ${env.sol(k.without_refit)}</span></div>` : ''}
      <div class="small">alone on the base: ${times(k.alone_factor)} better · <b>${verdict}</b></div>`;
  }
  const base = Object.fromEntries(costs.map((c) => [c.key, S.byId[D.study.base] && S.byId[D.study.base][c.key]]));
  function draw() {
    const list0 = q('.steps-list');
    list0.innerHTML = '';
    let list = cards();
    list.forEach((c, i) => { c.n = i + 1; });
    const total = list.length;
    if (state.mode === 'condensed') list = list.filter((c) => c.kept);
    if (state.order === 'still') list = [...list].sort((a, b) => still(b) - still(a));
    const lo = Math.log10(S.target * 0.8), hi = Math.log10(S.base * 1.1);
    const pos = (v) => ((Math.log10(v) - lo) / (hi - lo)) * 100;
    for (const c of list) {
      const k = c.key && S.comp[c.key];
      const card = document.createElement('div');
      card.className = `card step${c.kept ? '' : ' filtered'}${state.focus && c.key === state.focus ? ' focus' : ''}`;
      if (state.only && !c.ids.some((x) => state.only.has(x))) card.style.opacity = 0.45;
      if (c.key) card.dataset.key = c.key;
      const title = k ? `+ ${esc(k.name)}` : Math.abs(c.change) > SAME ? esc(c.to.change) : '= refactor, no part changed';
      const a = Math.min(pos(c.fromV), pos(c.toV)), b = Math.max(pos(c.fromV), pos(c.toV));
      const colour = Math.abs(c.change) <= SAME ? 'var(--ab-faint)' : c.change < 0 ? 'var(--bb-good)' : 'var(--bb-bad)';
      // calm: a cost chip is neutral; the arrow says which way it moved
      const chip = (cost) => {
        const v = c.costs[cost.key], b0 = Math.abs(base[cost.key] || 0);
        if (v == null || Math.abs(v) < Math.max(0.5, 0.003 * b0)) return '';
        return `<span class="chip">${v > 0 ? '↑' : '↓'} ${signed(v, Number.isInteger(v) || Math.abs(v) >= 10 ? 0 : 2)} ${esc(cost.unit)}</span>`;
      };
      const note = (c.key ? D.notes && D.notes[c.key] : D.notes && D.notes[c.ids[0]]) || '';
      const links = D.links || {};
      card.innerHTML = `<div class="n">${c.n}</div>
        <div><h4>${k ? `<a href="#" class="ab-part" data-part="${esc(c.key)}">${title}</a>` : title}${c.kept && c.why !== 'same error, less code' ? '' : `<span class="tag">${esc(c.why)}</span>`}</h4>
          <div class="ids">${c.ids.map((s) => env.sol(s)).join(' → ')}${k && k.idea_line && links.ideas ? ` · <a href="${esc(links.ideas + k.idea_line)}" target="_blank" rel="noopener">idea, line ${k.idea_line}</a>` : ''}</div>
          <div class="chips">${costs.map(chip).join('')}</div></div>
        <div class="c3"><div class="label">when the search took it</div><div class="delta" style="color:${colour}">${pct(c.fromV, c.toV)}</div>
          <div class="small muted">${c.parts.length > 1 ? `${c.parts.length} steps: ` : ''}${fmtV(c.fromV)} → ${fmtV(c.toV)} ${esc(U)}</div>
          <div class="bar"><span style="left:${a}%;width:${Math.max(1.5, b - a)}%;background:${colour}"></span></div></div>
        <div class="c4 still">${k ? stillText(k) : '<div class="label">at the end</div><div class="small muted">not a part: nothing to remove</div>'}</div>
        ${note && !opts.compact ? `<div class="note small">${esc(note)}</div>` : ''}`;
      const partLink = card.querySelector('a.ab-part');
      if (partLink) partLink.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); env.pick(c.key); });
      list0.appendChild(card);
      if (state.mode === 'all') for (const id of c.ids) for (const s of sideBranches(id)) {
        const side = document.createElement('div');
        side.className = 'side-branch';
        side.innerHTML = `side branch from <code>${esc(id)}</code>: ${env.sol(s.solution)} ${fmtV(s.objective)} ${esc(U)} — ${esc((s.change || '').slice(0, 120))}`;
        list0.appendChild(side);
      }
    }
    const kept = cards().filter((c) => c.kept).length;
    q('.count').textContent = state.mode === 'condensed' ? `${kept} of ${total} cards kept (steps merged per part); "everything tried" shows the rest and the side branches.`
      : `All ${total} cards with their side branches; faded cards made no net improvement.`;
  }
  const syncs = segs(q, state, ['mode', 'order'], () => draw());
  syncs.forEach((f) => f());
  draw();
  return { redraw: draw, focus(k) { state.focus = k; draw(); }, setRows(ids) { state.only = ids ? new Set(ids) : null; draw(); } };
}

// ── Overall importance: every statistic of "how much did this part matter", measured beside estimated ──────────────
function overall(host, S, env, opts) {
  const { O } = S;
  if (!O) { host.innerHTML = '<p class="small muted">The study has no overall importance table.</p>'; return { redraw() {}, focus() {}, setRows() {} }; }
  const state = { sort: 'orders', basis: 'all', focus: opts.focus || null };
  const q = frame(host, opts, env, {
    title: 'Overall importance', question: `How much of the ${times(O.total_factor)} is each part's, by every standard measure?`,
    controls: opts.compact ? '' : `<span class="label">Sort by</span>${seg('sort', [['orders', 'measured orders'], ['shapley', 'Shapley (estimate)'], ['loo', 'removed from the best'], ['aoi', 'added alone']])}
      <span class="label">Show</span>${seg('basis', [['measured', 'measured only'], ['all', '+ estimates']])}`,
    body: `<div class="card"><div class="av-chart chart"></div><div class="legend av-note">
        <span><i style="background:var(--bb-fg);border-radius:50%"></i>average over the ${O.measured_orders} measured orders ${MEASURED}</span>
        <span><i style="background:var(--ab-grid);height:6px;vertical-align:1px"></i>its range over those orders</span>
        <span><i style="background:var(--ab-s3);width:4px"></i>added alone</span><span><i style="background:var(--ab-s1);width:4px"></i>removed from the best</span>
        <span class="est-legend"><i style="border:2px solid var(--ab-est);border-radius:50%;width:10px;height:10px"></i>Shapley ± jackknife ${ESTIMATE}</span></div></div>`,
    extra: '<div class="av-split" style="margin-top:12px"><div class="card sums"></div><div class="card fanova"></div></div><details class="more methods"></details>',
  });
  const unmeasured = O.all_sets - O.measured_sets;
  const val = (p, k) => ({ orders: p.orders, shapley: p.shapley, loo: p.loo, aoi: p.aoi }[k]);
  function draw() {
    const h = q('.chart');
    h.innerHTML = '';
    const est = state.basis === 'all';
    host.querySelector('.est-legend').style.display = est ? '' : 'none';
    const list = [...O.parts].sort((a, b) => val(b, state.sort) - val(a, state.sort));
    const W = h.clientWidth || 900, phone = W < 600;
    const labelW = phone ? 0 : 200, valueW = phone ? 0 : 210;
    const rowH = phone ? 46 : opts.compact ? 26 : 34, top = 24, bottom = 40;
    const H = top + list.length * rowH + bottom;
    const svg = el('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Share of the total improvement per part, by method' }, h);
    const x0 = labelW + 12, x1 = W - valueW - 12;
    const shares = list.flatMap((p) => [p.orders_min, p.orders_max, p.loo, p.aoi, ...(est ? [p.shapley - p.shapley_se, p.shapley + p.shapley_se] : [])]).map((d) => d / O.total_drop);
    const lo = Math.min(-0.05, ...shares), hi = Math.max(0.5, ...shares);
    const x = linScale(lo, hi * 1.02, x0, x1);
    for (const t of x.ticks(phone ? 4 : 8)) {
      el('line', { x1: x(t), x2: x(t), y1: top - 6, y2: H - bottom + 4, class: t === 0 ? 'axis' : 'grid' }, svg);
      el('text', { x: x(t), y: H - bottom + 18, 'text-anchor': 'middle', 'font-size': 11 }, svg, `${Math.round(t * 100)} %`);
    }
    el('text', { x: phone ? W - 4 : x1, y: H - 4, 'text-anchor': 'end', 'font-size': 11 }, svg, phone ? `share of the ${times(O.total_factor)} · left of 0 = made it worse`
      : `share of the ${times(O.total_factor)} (log10 error drop ÷ ${O.total_drop.toFixed(3)}) · left of 0 = it made things worse there`);
    list.forEach((p, i) => {
      const y = top + i * rowH, cy = y + (phone ? 30 : rowH / 2);
      if (state.focus === p.key) el('rect', { x: 0, y, width: W, height: rowH, fill: 'var(--ab-hl)', 'data-focus': '1' }, svg);
      const t = el('text', { x: phone ? 6 : labelW, y: phone ? y + 14 : cy + 4, 'text-anchor': phone ? 'start' : 'end', 'font-size': 13, class: 'ink',
        'font-weight': state.focus === p.key ? 600 : 400, 'data-part': p.key }, svg, p.name);
      pickable(env, t, p.key);
      const s = (d) => x(d / O.total_drop);
      el('line', { x1: s(p.orders_min), x2: s(p.orders_max), y1: cy, y2: cy, stroke: 'var(--ab-grid)', 'stroke-width': 7, 'stroke-linecap': 'round' }, svg);
      el('line', { x1: s(p.aoi), x2: s(p.aoi), y1: cy - 8, y2: cy + 8, stroke: 'var(--ab-s3)', 'stroke-width': 3 }, svg);
      el('line', { x1: s(p.loo), x2: s(p.loo), y1: cy - 8, y2: cy + 8, stroke: 'var(--ab-s1)', 'stroke-width': 3 }, svg);
      if (est) {
        el('line', { x1: s(p.shapley - p.shapley_se), x2: s(p.shapley + p.shapley_se), y1: cy + 7, y2: cy + 7, stroke: 'var(--ab-est)', 'stroke-width': 1.5 }, svg);
        el('circle', { cx: s(p.shapley), cy: cy + 7, r: 4.5, fill: 'var(--bb-bg)', stroke: 'var(--ab-est)', 'stroke-width': 2 }, svg);
      }
      el('circle', { cx: s(p.orders), cy, r: 5, fill: 'var(--bb-fg)' }, svg);
      if (!phone) el('text', { x: W - 6, y: cy + 4, 'text-anchor': 'end', 'font-size': 12, class: 'ink' }, svg,
        `${S.share(p.orders, 1)}${est ? `  ·  est ${S.share(p.shapley, 0)} ±${S.share(p.shapley_se, 0).replace('−', '')}` : ''}`);
      else el('text', { x: W - 6, y: y + 14, 'text-anchor': 'end', 'font-size': 11.5, class: 'ink' }, svg, `${S.share(p.orders, 1)}${est ? ` · est ${S.share(p.shapley)}` : ''}`);
      const hit = el('rect', { x: x0, y: phone ? y + 18 : y, width: Math.max(10, x1 - x0), height: phone ? rowH - 18 : rowH, fill: 'transparent' }, svg);
      svg.appendChild(t); // WHY: the label stays clickable above the hover rect
      hover(env, hit, () => `<b>${esc(p.name)}</b><br>${MEASURED} average over ${O.measured_orders} measured orders: <b>${S.share(p.orders, 1)}</b>
        (range ${S.share(p.orders_min)} to ${S.share(p.orders_max)})<br>added alone to the base: ${S.share(p.aoi, 1)} (${times(10 ** p.aoi)} better)<br>
        removed from the best: ${S.share(p.loo, 1)} (${times(10 ** p.loo)} worse)${p.loo_refit != null ? `; after a refit ${times(10 ** p.loo_refit)}` : ''}<br>
        its greedy-path step: ${S.share(p.path, 1)}<br>${ESTIMATE} Shapley ${S.share(p.shapley, 1)} ± ${S.share(p.shapley_se, 1).replace('−', '')} ·
        fANOVA main effect ${(100 * p.main).toFixed(1)} % ± ${(100 * p.main_se).toFixed(1)} of the variance`);
    });
    sums(); fanova();
  }
  const ref = (k) => { const r = O.refs && O.refs[k]; return r ? `<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.text.split(',')[0])}</a>` : ''; };
  function sums() {
    const Sm = O.sums;
    const rowsS = [
      ['added alone, summed', Sm.aoi, 'measured', 'undercounts: each part alone does little'],
      ['removed from the best, summed', Sm.loo, 'measured', 'overcounts: each removal also breaks what the part enabled'],
      ['½ (alone + removed), summed', Sm.midpoint, 'measured', 'equals the total only if parts interact at most in pairs (Owen 1972)'],
      [`measured orders (${O.measured_orders}), averaged`, Sm.orders, 'measured', 'adds up exactly, by construction'],
      [`Shapley over all ${O.all_sets} sets`, Sm.shapley, 'estimate', `adds up exactly; ${unmeasured} sets from the surrogate`],
    ];
    const maxv = Math.max(...rowsS.map((r) => r[1]));
    const w = O.convexity && O.convexity.worst;
    const step = (d) => (d >= 0 ? `${times(10 ** d)} better` : `${times(10 ** -d)} worse`);
    q('.sums').innerHTML = `<h4 class="h4">Does it add up to the ${times(O.total_factor)}?</h4>
      <p class="small muted" style="margin:0 0 8px">A fair split of the improvement must sum to it. The gap between the first two rows is the interaction: the parts are worth far more together.</p>
      <div class="scroll-x"><table class="data"><tbody>${rowsS.map(([name, v, basis, why]) => `<tr><td>${esc(name)} <span class="basis ${basis}">${basis}</span><div class="small muted">${esc(why)}</div></td>
        <td class="num">${times(10 ** v)}</td><td class="bar-cell"><div class="sbar"><span style="width:${(100 * Math.log10(1 + v)) / Math.log10(1 + maxv)}%;background:${basis === 'estimate' ? 'var(--ab-est)' : 'var(--ab-faint)'}"></span>
        <i class="target" style="left:${(100 * Math.log10(1 + O.total_drop)) / Math.log10(1 + maxv)}%"></i></div></td></tr>`).join('')}</tbody></table></div>
      <p class="small muted">Black tick: the real ${times(O.total_factor)}.${O.convexity ? ` Convexity check ${MEASURED}: a part's step grew with more parts present in
      ${O.convexity.checks - O.convexity.violations} of ${O.convexity.checks} nested pairs of measured sets, so "Shapley lies between added-alone and removed" (Shapley 1971) is not guaranteed here.` : ''}
      ${w ? `Worst: ${esc(S.name(w.part))} is ${step(w.step_small)} ${w.smaller.length ? `after ${esc(w.smaller.map(S.short).join(', '))}` : 'alone on the base'} but
      ${step(w.step_large)} after ${esc(w.larger.map(S.short).join(', '))} (${env.sol(w.solutions[2])} → ${env.sol(w.solutions[3])}).` : ''}</p>`;
  }
  function fanova() {
    const est = state.basis === 'all';
    const f = O.fanova;
    const box = q('.fanova');
    box.style.display = est && f ? '' : 'none';
    if (!f) return;
    box.innerHTML = `<h4 class="h4">fANOVA: variance explained ${ESTIMATE}</h4>
      <p class="small muted" style="margin:0 0 8px">Hutter et al. 2014's decomposition, computed exactly over the ${O.all_sets}-set table, of which ${unmeasured} sets are the
      surrogate's. Main effects explain ${(100 * f.by_order[0]).toFixed(0)} % of the variance, pairs ${(100 * f.by_order[1]).toFixed(1)} %:
      that mostly restates the surrogate's additive prior, which the measured sums contradict. Read the order, not the size.</p>
      <div class="scroll-x"><table class="data"><thead><tr><th>part</th><th class="num">main effect</th><th class="num">total effect</th><th class="num">Banzhaf ×</th></tr></thead><tbody>
      ${[...O.parts].sort((a, b) => b.main - a.main).map((p) => `<tr${state.focus === p.key ? ' class="hl"' : ''}><td>${esc(p.name)}</td><td class="num">${(100 * p.main).toFixed(1)} % ±${(100 * p.main_se).toFixed(1)}</td>
        <td class="num">${(100 * p.total_effect).toFixed(1)} % ±${(100 * p.total_effect_se).toFixed(1)}</td><td class="num">${times(10 ** p.banzhaf)}</td></tr>`).join('')}</tbody></table></div>`;
  }
  q('.methods').innerHTML = `<summary>The methods: which are measured, which are estimates, and where each comes from</summary><div class="scroll-x"><table class="data"><tbody>
    ${(O.methods || []).map((m) => `<tr data-method="${esc(m.key)}" data-basis="${esc(m.basis)}"><td><b>${esc(m.name)}</b> <span class="basis ${m.basis === 'estimate' ? 'estimate' : 'measured'}">${esc(m.basis)}</span><div class="small muted">${esc(m.line)}</div></td><td class="small">${ref(m.cite)}</td></tr>`).join('')}
    <tr><td><b>Error bars</b><div class="small muted">Measured values are single scored runs; the study records no run-to-run error for them. Estimates carry a jackknife error: the surrogate refit ${O.surrogate ? O.surrogate.jackknife_refits : '—'} times, each time without one measured set; the surrogate's own leave-one-out error is ${times(O.surrogate && O.surrogate.loo_error_factor)} per set.</div></td><td class="small">${[ref('castro09'), ref('homma96')].filter(Boolean).join(' · ')}</td></tr>
    </tbody></table></div>${['cave18', 'hypershap', 'grabisch99'].some((k) => O.refs && O.refs[k]) ? `<p class="small muted">Prior art for one report of many importance views over the same runs: ${[ref('cave18'), ref('hypershap'), ref('grabisch99')].filter(Boolean).join('; ')}.</p>` : ''}`;
  const syncs = segs(q, state, ['sort', 'basis'], () => draw());
  syncs.forEach((f) => f());
  host._redraw = draw;
  draw();
  return { redraw: draw, focus(k) { state.focus = k; draw(); }, setRows() { /* per part: a row filter does not apply */ } };
}

const MOUNT = { remix, waterfall, importance, frontier, changelog, overall };

/** Mount one view into `host` (emptied first). */
export function mountView(kind, host, S, env, opts = {}) {
  host.innerHTML = '';
  host._w = 0;
  return MOUNT[kind](host, S, env, opts);
}
