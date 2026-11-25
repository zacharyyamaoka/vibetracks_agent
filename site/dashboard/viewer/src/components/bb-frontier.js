/* <bb-frontier>: performance vs a cost, with time (viewer/CONTRACT.md §12, §16.3). PICKS (2026-11-24): proposals-frontier
   1 Fade (a dot's opacity is its creation order: old faint, new solid) + 2 Tide Lines' earlier fronts drawn as faint
   lines, so the reader sees the front advance down and left. Reads only state.json `iterations`, `ablations` and `costs`.

   The title and box line, the cost chips (energy / compute / code size / parameters), the labelled ablation toggle, the
   "Pareto front now:" readout (each a link to the solution), the chart, the legend, then what was pinned to an edge and
   what was left off (a cost the box did not record for a row: counted with its reason, never plotted at 0). Each pick is
   a setting (`time`: fade | tide | both | none), so switching it is a page.json edit.

   STOCK PART: uPlot 1.6.32 (MIT, vendored, the headliner's) draws the canvas, the linear/log scales, the axes and the
   grid, and sizes itself. Ours (one draw hook, as the headliner's holdout whisker): the front step lines, the per-dot
   opacity (uPlot's series points have one alpha), the rings, the edge labels, and the 2-D nearest-dot hover. WHY not the
   proposals' engines: Observable Plot (Fade) is not vendored here, and data-ui's chart view (Tide) opens its own record
   peek on a dot instead of the solution (a data-ui gap the Tide proposal had to catch by hand). */
import uPlot from '../../vendor/uplot/uPlot.esm.js';
import uplotCss from '../../vendor/uplot/uPlot.css.js';
import { BBElement, esc } from '../core/element.js';
import { register } from '../core/registry.js';
import { adoptCss, onTheme, cssVar } from '../core/tokens.js';
import { makeFrontier, costMeta, logTicks, fmt, tickFmt } from './bb-frontier.model.js';
import schema from './bb-frontier.schema.js';
import css from './bb-frontier.css.js';

const dtf = new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const dayf = new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric' });
const fmtDate = (t) => (t ? dtf.format(new Date(t)) : '—');
const fmtDay = (t) => (t ? dayf.format(new Date(t)) : '—');
const sha7 = (c) => (c && c.sha && c.sha !== 'none' ? String(c.sha).slice(0, 7) : '—');
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const TIME_NOTE = { fade: 'time: opacity by creation order', tide: 'time: earlier fronts drawn faintly', both: 'time: opacity by creation order, earlier fronts faint', none: '' };
const VERDICT = {
  kept: 'kept: a new best when it ran',
  discarded: 'discarded: admissible, not better than the best so far',
  failed: 'failed: not admissible (a gate failed)',
};

export class BBFrontier extends BBElement {
  static schema = schema;
  static css = css;

  constructor() {
    super();
    this.u = null;
    this.ui = null;
    this.pts = [];
    this.hovered = null;
  }

  connectedCallback() {
    adoptCss('uplot', uplotCss);
    super.connectedCallback();
    this._stopTheme ||= onTheme(() => this.ui && this.paint());
    this._ro ||= new ResizeObserver(() => {
      const el = this.querySelector('.bbf-chart');
      if (this.u && el && el.clientWidth && Math.abs(el.clientWidth - this.u.width) > 1) this.u.setSize({ width: el.clientWidth, height: el.clientHeight });
    });
    this._ro.observe(this);
  }

  teardown() {
    this._stopTheme?.(); this._stopTheme = null;
    this._ro?.disconnect(); this._ro = null;
    this.u?.destroy(); this.u = null;
  }

  render() {
    const s = this.settings;
    if (this.u) { this.u.destroy(); this.u = null; }
    this.ui = null;
    const m = this.model = makeFrontier(this.data);
    if (!m.costIds.length) return this.empty();
    const pick = m.pickCost(s.cost);
    if (pick.unknown) {
      return this.empty(schema.empty, `This box records no cost named <b class="bb-mono">${esc(s.cost)}</b>. It records: ${m.costIds.map((c) => `${esc(costMeta(c).chip)} (<span class="bb-mono">${esc(c)}</span>)`).join(', ')}.`);
    }
    this.ui = { cid: pick.cid, ab: !!s.ablations };
    this.paint();
  }

  /** Why a cost has no value (the reason most rows give), for its chip and the note under the chips. */
  reasonFor(cid) {
    const groups = this.model.missing(this.model.all, cid).sort((a, b) => b.ids.length - a.ids.length);
    return groups.length ? groups[0].reason : '';
  }

  paint() {
    const s = this.settings, m = this.model, d = this.data, o = d.objective || {};
    const { cid } = this.ui;
    const meta = costMeta(cid);
    if (this.u) { this.u.destroy(); this.u = null; }
    this.hovered = null;
    const v = this.v = m.view(cid, { ablations: this.ui.ab, logX: s.log_x, logY: s.log_y });
    const has = m.recorded(cid);
    const nAbl = m.ablations.length;
    const unit = o.unit || '';
    const timeNote = TIME_NOTE[s.time] || '';
    const title = s.title ? esc(s.title) : `Performance <span class="vs">vs</span> ${esc(meta.noun)}`;
    const nil = m.costIds.filter((c) => !m.recorded(c));
    const chips = s.picker ? `<div class="bbf-chips" role="group" aria-label="Cost on x">${m.costIds.map((c) => {
      const cm = costMeta(c), rec = m.recorded(c);
      const tip = rec ? `${cm.long}${cm.unit ? ` (${cm.unit})` : ''}: recorded for ${m.recordedFor(c)} of ${m.all.length} solutions` : `not recorded: ${this.reasonFor(c)}`;
      return `<button class="chip${rec ? '' : ' none'}" data-cost="${esc(c)}" aria-pressed="${c === cid}" title="${esc(tip)}">${esc(cm.chip)}${rec ? '' : '<span class="nil">· not recorded</span>'}</button>`;
    }).join('')}</div>` : '';
    const toggle = s.toggle && nAbl ? `<label class="bbf-abl" title="Ablation runs remove or add one part of a solution to measure what it is worth. They are study variants, not search steps: hollow grey, never on the front, outside the time encoding.">
      <input type="checkbox" data-abl ${this.ui.ab ? 'checked' : ''}><span>Show the <b>${nAbl}</b> ablation run${nAbl === 1 ? '' : 's'} (study variants, not search steps)</span></label>` : '';
    const nilNote = s.picker && nil.length ? `<div class="bbf-notes bbf-nil">${groupBy(nil, (c) => this.reasonFor(c)).map(([why, cs]) =>
      `<div>Not recorded in this state: ${cs.map((c) => `<b>${esc(costMeta(c).chip)}</b>`).join(' and ')} (${esc(why)}).</div>`).join('')}</div>` : '';
    const objName = esc(o.label || o.name || 'objective');
    this.innerHTML = `<div class="bbf" data-cost="${esc(cid)}" data-drawn="${v.drawn.length}" data-front="${v.front.length}" data-off="${v.offCount}">
      <div class="bbf-box"><b>${esc(d.box || '')}</b> · y: ${objName} on dev${unit ? ` (${esc(unit)}` : ' ('}${unit ? ', ' : ''}${m.direction} is better) · ${plural(m.N, 'solution')}, ${m.admissible} admissible${timeNote && has ? ` · ${timeNote}` : ''}</div>
      <h3 class="bbf-title">${title}</h3>
      ${chips || toggle ? `<div class="bbf-bar">${chips}${toggle}</div>` : ''}${nilNote}
      ${has ? `<div class="bbf-front"></div>
        <div class="bbf-ylabel">${objName}${unit ? ` (${esc(unit)})` : ''} ${m.direction === 'lower' ? '↓' : '↑'} better</div>
        <div class="bbf-chart" style="height:${s.height}px"><div class="bbf-ring"></div></div>
        <div class="bbf-xlabel">${esc(cap(meta.long))}${meta.unit ? ` (${esc(meta.unit)})` : ''}${s.log_x ? ', log scale' : ''} → cheaper is left</div>
        <div class="bbf-foot"><div class="bbf-legend"></div><div class="bbf-hint">Point at a dot for its card · click to open it</div></div>
        <div class="bbf-notes bbf-pins"></div>`
    : `<div class="bbf-nocost" style="min-height:${Math.min(s.height, 220)}px"><b>No ${esc(meta.noun)} recorded for any of the ${plural(m.all.length, 'solution')}.</b>
        ${v.off.map((g) => `<div>Why: ${esc(g.reason)} (${plural(g.ids.length, 'solution')}).</div>`).join('')}
        ${s.picker && m.costIds.some(m.recorded) ? '<div>Pick a recorded cost above.</div>' : ''}</div>`}
      <div class="bbf-tip" hidden></div>
    </div>`;
    this.querySelectorAll('[data-cost]').forEach((b) => b.tagName === 'BUTTON' && b.addEventListener('click', () => { this.ui.cid = b.dataset.cost; this.paint(); }));
    this.querySelector('[data-abl]')?.addEventListener('change', (e) => { this.ui.ab = e.target.checked; this.paint(); });
    this.shown = v.drawn.map((q) => q.id);
    this.frontIds = v.front.map((q) => q.id);
    if (!has) return;
    this.readout(false);
    this.legend();
    this.pins();
    this.chart();
  }

  /** "Pareto front now: a → b → …": each a link that opens the solution. A long front folds to its two ends and a count
      (WHY: against energy the front is ten solutions long; the chart shows them, the readout names them). */
  readout(open) {
    const el = this.querySelector('.bbf-front');
    const v = this.v, unit = this.data.objective?.unit || '';
    const front = v.front;
    if (!front.length) { el.innerHTML = `<span class="lead">Pareto front now:</span><span>no admissible iteration carries this cost</span>`; return; }
    const chip = (q, i) => `${i ? '<span class="arrow">→</span>' : ''}<a href="${esc(this.context.href('solution', { id: q.id }))}" data-open="${esc(q.id)}" title="#${q.n} · ${esc(q.change)}">${esc(q.id)} · ${fmt(q.y)}${unit ? ` ${esc(unit)}` : ''} · ${fmt(this.model.cost(q, v.cid))}${v.meta.unit ? ` ${esc(v.meta.unit)}` : ''}</a>`;
    const fold = front.length > 5 && !open;
    const shown = fold ? [front[0], front[1], null, front[front.length - 2], front[front.length - 1]] : front;
    el.innerHTML = '<span class="lead">Pareto front now:</span>' + shown.map((q, i) => (q ? chip(q, i)
      : `<span class="arrow">→</span><button class="more" data-more title="show the whole front">… ${front.length - 4} more</button>`)).join(' ')
      + `<span class="count">${front.length} on the front</span>`;
    el.querySelector('[data-more]')?.addEventListener('click', () => this.readout(true));
    el.querySelectorAll('[data-open]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); this.open(a.dataset.open); }));
  }

  legend() {
    const s = this.settings, m = this.model, v = this.v;
    const fade = s.time === 'fade' || s.time === 'both';
    const tide = (s.time === 'tide' || s.time === 'both') && v.tides.length;
    const parts = [];
    if (fade && m.N > 1) {
      const last = m.sessions[m.sessions.length - 1];
      const ticks = [...new Set([1, last ? last.firstRank : 1, m.N])].map((r) => m.search[r - 1]);
      parts.push(`<span title="each dot's opacity is its creation order: #1 faintest, the newest solid; red rings never fade"><i class="lg-ramp"></i>older → newer: ${ticks.map((q, i) => `#${q.n} ${i ? fmtDate(q.t) : fmtDay(q.t)}`).join(' · ')}</span>`);
    }
    parts.push('<span><i class="lg-line"></i>front now</span>');
    if (tide) parts.push(`<span title="${esc(v.tides.map((t) => `#${t.s.n}: ${fmtDate(t.s.t)} · ${sha7(t.s.commit)}`).join('\n'))}"><i class="lg-tide"></i>earlier fronts, as of ${v.tides.map((t) => `#${t.s.n}`).join(' · ')}</span>`);
    if (s.time === 'fade' && v.before) parts.push(`<span><i class="lg-dash"></i>front before the newest session (from #${m.search[v.before.session.firstRank - 1].n})</span>`);
    parts.push('<span><i class="lg-front"></i>on the front</span>');
    if (m.best && v.drawn.includes(m.best)) parts.push(`<span><i class="lg-best"></i>best: #${m.best.n} ${esc(m.best.id)}</span>`);
    if (v.drawn.some((q) => !q.ok && !q.ablation)) parts.push('<span><i class="lg-ring"></i>not admissible (a gate failed)</span>');
    if (this.ui.ab && v.shownAblations) parts.push('<span><i class="lg-abl"></i>ablation run: no time, never on the front</span>');
    this.querySelector('.bbf-legend').innerHTML = parts.join('');
  }

  /** What sits on an edge (with its true value) and what was left off (with how many and why). */
  pins() {
    const v = this.v, m = this.model, unit = v.meta.unit;
    const val = (q) => `${fmt(m.cost(q, v.cid))}${unit ? ` ${esc(unit)}` : ''}`;
    const list = (ids) => ids.slice(0, 6).map(esc).join(', ') + (ids.length > 6 ? `, … ${ids.length - 6} more` : '');
    const out = [];
    const right = v.dom.clipped.filter((q) => v.dom.side(q) === 'right');
    const left = v.dom.clipped.filter((q) => v.dom.side(q) === 'left');
    if (right.length) out.push(`<div>Pinned at the right edge (beyond the admissible range): ${right.map((q) => `<b>${esc(q.id)}</b> ${val(q)}${q.ok ? '' : ' (not admissible)'}`).join(', ')}.</div>`);
    if (left.length) out.push(`<div>Pinned at the left edge (${v.dom.logX ? 'a log axis has no 0 or below' : 'below the admissible range'}): ${left.length > 6 ? `${left.length} solutions (${list(left.map((q) => q.id))})` : left.map((q) => `<b>${esc(q.id)}</b> ${val(q)}`).join(', ')}.</div>`);
    for (const g of v.off) out.push(`<div>Left off this chart: <b>${plural(g.ids.length, 'solution')}</b> with no ${esc(v.meta.noun)} (${esc(g.reason)}): ${list(g.ids)}.</div>`);
    this.querySelector('.bbf-pins').innerHTML = out.join('');
  }

  colors() {
    const c = (n) => cssVar(this, n);
    return { card: c('--bb-card'), fg: c('--bb-fg'), muted: c('--bb-muted'), faint: c('--bb-faint'), grid: c('--bb-grid'), best: c('--bb-best'),
      newbest: c('--bb-newbest'), bad: c('--bb-bad'), font: c('--bb-font') };
  }

  chart() {
    const s = this.settings, v = this.v, m = this.model;
    const el = this.querySelector('.bbf-chart');
    const C = this.colors();
    const dom = v.dom;
    const [ylo, yhi] = v.ydom;
    this.pts = v.drawn.map((q) => ({ s: q, x: dom.pin(q), side: dom.side(q) }));
    const axisFont = `11px ${C.font}`;
    const opts = {
      width: el.clientWidth || 600, height: el.clientHeight || s.height, pxAlign: 0, padding: [12, 18, 0, 6], legend: { show: false },
      // WHY drag.click is a no-op: this chart has no drag, and uPlot's default swallows a click whose pointer moved since
      // the last mousedown (a tap on a touch screen, a click right after a hover), which would eat the open
      cursor: { x: false, y: false, points: { show: false }, drag: { x: false, y: false, setScale: false, click: () => {} }, focus: { prox: -1 } },
      select: { show: false },
      scales: {
        x: { time: false, ...(dom.logX ? { distr: 3, log: 10 } : { distr: 1 }), range: () => [dom.lo, dom.hi] },
        y: { ...(v.ylog ? { distr: 3, log: 10 } : { distr: 1 }), range: () => [ylo, yhi] },
      },
      axes: [
        { stroke: C.muted, grid: { stroke: C.grid, width: 1 }, ticks: { stroke: C.grid }, font: axisFont, space: 60, size: 30,
          values: (u, splits) => splits.map(tickFmt), ...(dom.logX ? { splits: (u, ai, mn, mx) => logTicks(mn, mx, 9), filter: (u, sp) => sp } : {}) },
        { stroke: C.muted, grid: { stroke: C.grid, width: 1 }, ticks: { show: false }, font: axisFont, size: 46, space: 30,
          values: (u, splits) => splits.map(tickFmt), ...(v.ylog ? { splits: (u, ai, mn, mx) => logTicks(mn, mx), filter: (u, sp) => sp } : {}) },
      ],
      series: [{}, { paths: () => null, points: { show: false } }],
      hooks: { draw: [(u) => this.marks(u, C)], setCursor: [(u) => this.onCursor(u)] },
    };
    this.u = new uPlot(opts, [[dom.lo, dom.hi], [null, null]], el);
    el.appendChild(this.querySelector('.bbf-ring'));
    this.u.over.addEventListener('mouseleave', () => this.hover(null));
    this.u.over.addEventListener('click', () => { if (this.hovered) this.open(this.hovered.id); });
  }

  /** Everything on the plot, in one pass: earlier fronts, the front now, dots by age, rings, labels. */
  marks(u, C) {
    const s = this.settings, v = this.v, m = this.model;
    const ctx = u.ctx, dpr = uPlot.pxRatio || 1;
    const fade = s.time === 'fade' || s.time === 'both';
    const tide = s.time === 'tide' || s.time === 'both';
    const X = (val) => u.valToPos(val, 'x', true), Y = (val) => u.valToPos(val, 'y', true);
    const px = (q) => X(v.dom.pin(q)), py = (q) => Y(q.y);
    const { left, top, width, height } = u.bbox;
    const right = left + width;
    const circle = (x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r * dpr, 0, 2 * Math.PI); };
    const stair = (front) => {
      ctx.beginPath();
      front.forEach((q, i) => { const x = px(q), y = py(q); if (!i) ctx.moveTo(x, y); else { ctx.lineTo(x, py(front[i - 1])); ctx.lineTo(x, y); } });
      ctx.lineTo(right, py(front[front.length - 1]));
    };
    ctx.save();
    ctx.save();
    ctx.beginPath(); ctx.rect(left, top, width, height); ctx.clip();
    // tide lines: the front as it stood at each earlier moment, oldest faintest (the same age ramp as the dots)
    const labels = [];
    if (tide) {
      for (const t of v.tides) {
        const a = 0.16 + 0.34 * (m.age01(t.s) ?? 1);
        ctx.globalAlpha = a; ctx.strokeStyle = C.best; ctx.lineWidth = 1.5 * dpr; ctx.setLineDash([]);
        stair(t.front); ctx.stroke();
        labels.push({ y: py(t.front[t.front.length - 1]), text: `#${t.s.n}`, a: Math.min(1, a + 0.35) });
      }
    }
    // Fade's own: the front before the newest session, dashed (only when Fade stands alone; Tide's lines replace it)
    if (s.time === 'fade' && v.before) {
      ctx.globalAlpha = 0.6; ctx.strokeStyle = C.best; ctx.lineWidth = 1.6 * dpr; ctx.setLineDash([5 * dpr, 4 * dpr]);
      stair(v.before.front); ctx.stroke(); ctx.setLineDash([]);
    }
    if (v.front.length) { ctx.globalAlpha = 1; ctx.strokeStyle = C.best; ctx.lineWidth = 2.2 * dpr; stair(v.front); ctx.stroke(); }
    ctx.restore();
    // the tide lines' names at the right edge, where each line ends (a label too close to another is skipped)
    ctx.font = `${10.5 * dpr}px ${C.font}`; ctx.textAlign = 'right'; ctx.fillStyle = C.muted;
    const placed = v.front.length ? [py(v.front[v.front.length - 1])] : [];
    for (const l of labels.reverse()) {
      if (placed.some((y) => Math.abs(y - l.y) < 11 * dpr)) continue;
      placed.push(l.y); ctx.globalAlpha = l.a; ctx.fillText(l.text, right - 3 * dpr, l.y - 3 * dpr);
    }
    ctx.globalAlpha = 1;
    // admissible iterations, oldest first so the newest sit on top; opacity = creation order under Fade
    const front = new Set(v.front);
    const adm = v.drawn.filter((q) => !q.ablation && q.ok).sort((a, b) => a.rank - b.rank);
    for (const q of adm) { ctx.globalAlpha = fade ? m.opacity(q) : 0.62; ctx.fillStyle = C.fg; circle(px(q), py(q), 4.6); ctx.fill(); }
    ctx.globalAlpha = 1;
    for (const q of v.front) { ctx.strokeStyle = C.best; ctx.lineWidth = 2 * dpr; circle(px(q), py(q), 8); ctx.stroke(); }
    // a gate failure: a red ring, never faded, never on the front
    for (const q of v.drawn.filter((r) => !r.ablation && !r.ok)) {
      ctx.fillStyle = C.card; ctx.strokeStyle = C.bad; ctx.lineWidth = 1.8 * dpr; circle(px(q), py(q), 5.5); ctx.fill(); ctx.stroke();
    }
    // ablation runs: hollow grey, dashed, outside the time encoding
    ctx.setLineDash([2 * dpr, 2 * dpr]);
    for (const q of v.drawn.filter((r) => r.ablation)) { ctx.strokeStyle = C.faint; ctx.lineWidth = 1.3 * dpr; circle(px(q), py(q), 4.6); ctx.stroke(); }
    ctx.setLineDash([]);
    // the best: a green dot inside its front ring (the headliner's new-best colour), named; the newest, named (Fade)
    const best = m.best && v.drawn.includes(m.best) ? m.best : null;
    if (best) { ctx.fillStyle = C.newbest; circle(px(best), py(best), 5); ctx.fill(); }
    const named = [];
    const name = (q, text) => {
      const x = px(q), y = py(q);
      const flip = x > right - 110 * dpr;
      let dy = 4 * dpr;
      while (named.some((o) => Math.abs(o.x - x) < 120 * dpr && Math.abs(o.y - (y + dy)) < 13 * dpr)) dy += 13 * dpr;
      named.push({ x, y: y + dy });
      ctx.font = `600 ${11 * dpr}px ${C.font}`; ctx.fillStyle = C.fg; ctx.textAlign = flip ? 'right' : 'left';
      ctx.fillText(text, x + (flip ? -12 : 12) * dpr, y + dy);
    };
    const newest = m.newest && v.drawn.includes(m.newest) ? m.newest : null;
    if (best && best === newest) name(best, `newest best #${best.n}`);
    else { if (best) name(best, `best #${best.n}`); if (newest) name(newest, `newest #${newest.n}`); }
    // pinned points: their true value beside the edge, stacked so two near-equal ys never overprint
    ctx.font = `${11 * dpr}px ${C.font}`; ctx.fillStyle = C.muted;
    const unit = v.meta.unit;
    const edge = (side) => this.pts.filter((p) => p.side === side).sort((a, b) => b.s.y - a.s.y);
    const r = edge('right');
    ctx.textAlign = 'right';
    r.forEach((p, i) => ctx.fillText(`${p.s.id} ${fmt(m.cost(p.s, v.cid))}${unit ? ` ${unit}` : ''} →`, right - 10 * dpr, py(p.s) + (i * 13 - (r.length - 1) * 6.5 + 4) * dpr));
    ctx.restore();
  }

  onCursor(u) {
    const { left, top } = u.cursor;
    if (left === undefined || left < 0) { this.hover(null); return; }
    // the nearest dot within 24 px; near-ties go to the marked ones (the best, then the front), then to the one drawn
    // last (the newer, on top, as the reader sees it). WHY: p5s-onefit sits a pixel from the best, p5s-pass3.
    const front = new Set(this.v.front);
    let near = null, score = Infinity;
    for (const p of this.pts) {
      const d = Math.hypot(u.valToPos(p.x, 'x') - left, u.valToPos(p.s.y, 'y') - top);
      if (d > 24) continue;
      const sc = d - (p.s === this.model.best ? 4 : front.has(p.s) ? 2 : 0);
      if (sc <= score) { score = sc; near = p; }
    }
    this.hover(near ? near.s : null);
  }

  hover(q) {
    this.hovered = q;
    const ring = this.querySelector('.bbf-ring');
    const tip = this.querySelector('.bbf-tip');
    const u = this.u;
    if (!ring || !tip) return;
    if (!q || !u) { ring.style.display = 'none'; tip.hidden = true; if (u) u.over.style.cursor = ''; return; }
    const x = u.valToPos(this.v.dom.pin(q), 'x'), y = u.valToPos(q.y, 'y');
    ring.style.display = 'block';
    ring.style.left = `${x + u.over.offsetLeft}px`;
    ring.style.top = `${y + u.over.offsetTop}px`;
    u.over.style.cursor = 'pointer';
    tip.innerHTML = this.tipHtml(q);
    tip.hidden = false;
    const r = u.over.getBoundingClientRect();
    const cx = r.left + x, cy = r.top + y;
    const w = tip.offsetWidth, h = tip.offsetHeight;
    let l = cx + 14, t = cy + 14;
    if (l + w > innerWidth - 8) l = cx - w - 14;
    if (l < 8) l = 8;
    if (t + h > innerHeight - 8) t = cy - h - 14;
    tip.style.left = `${l}px`;
    tip.style.top = `${Math.max(8, t)}px`;
  }

  tipHtml(q) {
    const v = this.v, m = this.model, o = this.data.objective || {}, unit = o.unit || '';
    const onFront = v.front.includes(q);
    const tags = q.ablation ? '<span class="tag">ablation run</span>'
      : `${q.ok ? '<span class="tag">admissible</span>' : '<span class="tag no">not admissible</span>'}${onFront ? '<span class="tag front">on the front</span>' : ''}${q === m.best ? '<span class="tag new">best</span>' : ''}`;
    const fails = Object.entries(q.failed || {});
    const verdict = q.ablation ? `ablation run after #${q.after ?? '—'}: a study variant, not a search step` : VERDICT[q.verdict] || q.verdict || '—';
    const side = v.dom.side(q);
    return `<div><b>${q.ablation ? '' : `#${q.n} `}${esc(q.id)}</b>${tags}</div>
      ${q.change ? `<div>${esc(q.change)}</div>` : ''}
      <div><span class="k">${esc(o.label || o.name || 'objective')}</span> <b>${fmt(q.y)}${unit ? ` ${esc(unit)}` : ''}</b> · <span class="k">${esc(v.meta.noun)}</span> <b>${fmt(m.cost(q, v.cid))}${v.meta.unit ? ` ${esc(v.meta.unit)}` : ''}</b></div>
      ${side ? `<div class="k">pinned at the ${side} edge: ${side === 'right' ? 'beyond the admissible range' : 'off the axis'}</div>` : ''}
      ${!q.ok && !q.ablation && fails.length ? `<div class="k">fails: ${esc(fails.map(([g, n]) => `${g.replace(/_/g, ' ')} on ${n} task${n === 1 ? '' : 's'}`).join(', '))}</div>` : ''}
      <div class="k">${esc(verdict)}</div>
      <div class="k">created ${fmtDate(q.t)} · commit ${sha7(q.commit)}</div>
      <div class="go">click: open this solution</div>`;
  }

  /** bb-open {kind: 'solution', id}; the context follows links.solution unless a listener prevented it. */
  open(id) {
    return this.context.open(this, { kind: 'solution', id, href: this.context.href('solution', { id }) });
  }

  /** Where a solution's dot is, in client pixels (headless checks hover and click through it). */
  locate(id) {
    const p = this.pts.find((q) => q.s.id === id);
    if (!this.u || !p) return null;
    const r = this.u.over.getBoundingClientRect();
    return { x: r.left + this.u.valToPos(p.x, 'x'), y: r.top + this.u.valToPos(p.s.y, 'y') };
  }
}

const cap = (t) => { const x = String(t || ''); return x ? x[0].toUpperCase() + x.slice(1) : x; };
function groupBy(list, key) {
  const g = new Map();
  for (const x of list) { const k = key(x); if (!g.has(k)) g.set(k, []); g.get(k).push(x); }
  return [...g];
}

register(BBFrontier);
