/* <bb-headliner>: the Ticker, exactly proposals-headliner/01-ticker as a section (Zach, 2026-11-24: "v1 Ticker is by far
   my favorite, I like how it's simple... please implement v1"). Reads only state.json `iterations` and `ablations`.

   The big number with its change chip; the "best so far at #N <id> (date)" line; 1H/1D/5D/1M/All chips; x = Solution #
   / Date / Commit; y = Log / Linear; the step line over admissible only, green new-best dots, grey admissible, red rings
   for not admissible, the blue holdout diamond; a hover card; click a dot -> bb-open {kind: 'solution', id} and the
   page's links.solution. One change from the proposal (Zach: the bare "Ablations · 30" "wasn't clear to me at a glance
   what that would do"): a labelled toggle, hollow grey dots, a legend line, and a hover card that names the component
   and frozen/refit. Frontier / Pareto charts stay out: they are bb-frontier (wave 2).

   STOCK PART: uPlot 1.6.32 (MIT, vendored) draws the canvas, scales (log10 or linear), the time axis, the stepped path
   and the drag-to-zoom select. Ours: the chips, the nearest-dot hover in 2-D (uPlot's cursor snaps on x only, and ten
   solutions can share one second), the window-open line and the holdout whisker (two draw hooks). */
import uPlot from '../../vendor/uplot/uPlot.esm.js';
import uplotCss from '../../vendor/uplot/uPlot.css.js';
import { BBElement, esc } from '../core/element.js';
import { register } from '../core/registry.js';
import { adoptCss, onTheme, cssVar } from '../core/tokens.js';
import { makeModel, RANGES, AXES, logTicks, fmt, pctNum } from './bb-headliner.model.js';
import schema from './bb-headliner.schema.js';
import css from './bb-headliner.css.js';

const dtf = new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const fmtDate = (t) => (t ? dtf.format(new Date(t)) : '—');
const sha7 = (c) => (c && c.sha && c.sha !== 'none' ? String(c.sha).slice(0, 7) : '—');
const sign = (v) => (v > 0 ? '+' : v < 0 ? '−' : '±');

/** What an ablation run did, from its meta.json words and tags ("− chord correction: … (ablation, frozen: …)"). */
export function ablationFacts(s) {
  const text = s.change || '';
  const m = /^\s*([−+-])\s*([^:(]+?)\s*:/.exec(text);
  const kindTag = (s.tags || []).find((t) => t.startsWith('ablation:'));
  const study = (s.tags || []).find((t) => t.startsWith('study:'));
  const fit = /\brefit\b/i.test(text) || /-refit$/.test(s.id) ? 'refit' : /\bfrozen\b/i.test(text) ? 'frozen' : null;
  return {
    op: m ? (m[1] === '+' ? 'added' : 'removed') : null,
    component: m ? m[2].trim() : null,
    kind: kindTag ? kindTag.slice('ablation:'.length).replace(/-/g, ' ') : null,
    study: study ? study.slice('study:'.length) : null,
    fit,
  };
}

export class BBHeadliner extends BBElement {
  static schema = schema;
  static css = css;

  constructor() {
    super();
    this.ui = null;
    this.u = null;
    this.zoom = null;
    this.hovered = null;
  }

  connectedCallback() {
    adoptCss('uplot', uplotCss);
    super.connectedCallback();
    this._stopTheme ||= onTheme(() => this.u && this.draw());
    this._ro ||= new ResizeObserver(() => {
      const el = this.querySelector('.bbh-chart');
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
    this.model = makeModel(this.data);
    this.ui = { x: s.x, r: s.range, y: s.y, ab: s.ablations };
    this.zoom = null;
    if (this.u) { this.u.destroy(); this.u = null; }
    if (!this.model.search.some((q) => q.y !== null)) return this.empty();
    const d = this.data;
    const o = d.objective || {};
    const nAbl = this.model.ablations.length;
    const box = s.title ? esc(s.title)
      : `<b>${esc(d.box || '')}</b> · ${esc(o.name || 'objective')} (dev${o.unit ? `, ${esc(o.unit)}` : ''}, ${o.direction === 'higher' ? 'higher' : 'lower'} is better)${o.ruler ? ` · ruler ${esc(o.ruler)}` : ''}`;
    this.innerHTML = `<div class="bbh">
      <div class="bbh-box">${box}</div>
      <div class="bbh-headline" aria-live="polite"></div>
      <div class="bbh-sub"></div>
      ${s.controls ? `<div class="bbh-bar"><div class="chips" role="group" aria-label="Time window"></div>
        <div class="bbh-right"><span class="bbh-ctl">x <span class="seg" data-seg="x"></span></span><span class="bbh-ctl">y <span class="seg" data-seg="y"></span></span></div></div>
        ${nAbl ? `<label class="bbh-abl" title="Ablation runs remove or add one part of the best solution to measure what it is worth. They are study variants, not search steps: drawn greyed and hollow, never on the best-so-far line, never counted.">
          <input type="checkbox" data-abl ${s.ablations ? 'checked' : ''}><span>Show the <b>${nAbl}</b> ablation run${nAbl === 1 ? '' : 's'} (study variants, not search steps)</span></label>` : ''}` : ''}
      <div class="bbh-chart" style="height:${s.height}px"><div class="bbh-ring"></div></div>
      <div class="bbh-foot"><div class="bbh-legend"></div><div class="bbh-hint">Point to re-read the number · drag across the chart to zoom · click a dot to open it</div></div>
      <div class="bbh-tip" hidden></div>
    </div>`;
    this.querySelector('[data-abl]')?.addEventListener('change', (e) => { this.ui.ab = e.target.checked; this.draw(); });
    this.draw();
  }

  yIsLog() {
    const v = this.v;
    const want = this.ui.y === 'auto' ? this.model.defaultLog : this.ui.y === 'log';
    return want && v && v.ymin > 0;
  }

  controls() {
    const chips = this.querySelector('.chips');
    if (!chips) return;
    const cur = this.zoom ? 'Custom' : this.ui.r;
    chips.innerHTML = [...RANGES.map((r) => r.id), ...(this.zoom ? ['Custom'] : [])].map((id) => {
      const r = RANGES.find((q) => q.id === id);
      const n = r ? this.model.count(id) : null;
      return `<button class="chip${r ? '' : ' custom'}" data-range="${id}" aria-pressed="${id === cur}" title="${esc(r ? `${r.long}: ${n} solution${n === 1 ? '' : 's'}` : 'the dragged range')}">${id}</button>`;
    }).join('');
    chips.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.range === 'Custom') return;
      this.zoom = null; this.ui.r = b.dataset.range; this.draw();
    }));
    const seg = (name, options, current, pick) => {
      const el = this.querySelector(`[data-seg="${name}"]`);
      el.setAttribute('role', 'group');
      el.setAttribute('aria-label', `${name} axis`);
      el.innerHTML = options.map((o) => `<button data-v="${o.id}" aria-pressed="${o.id === current}" title="${esc(o.long || o.label)}">${esc(o.label)}</button>`).join('');
      el.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => pick(b.dataset.v)));
    };
    seg('x', AXES, this.ui.x, (id) => { this.ui.x = id; this.zoom = null; this.draw(); });
    seg('y', [{ id: 'log', label: 'Log' }, { id: 'linear', label: 'Linear' }], this.yIsLog() ? 'log' : 'linear', (id) => { this.ui.y = id; this.draw(); });
  }

  legend() {
    const ab = this.ui.ab && this.model.ablations.length;
    this.querySelector('.bbh-legend').innerHTML = `
      <span><i class="lg-line"></i>best so far (admissible only)</span><span><i class="lg-dot"></i>new best</span>
      <span><i class="lg-dot adm"></i>admissible</span><span><i class="lg-ring"></i>not admissible (a gate failed)</span>
      ${this.model.best && this.model.best.hold !== null ? '<span><i class="lg-dia"></i>best on holdout</span>' : ''}
      ${ab ? '<span><i class="lg-abl"></i>ablation run: a part of the best removed or added; never moves the best line</span>' : ''}`;
  }

  headline(over) {
    const v = this.v, m = this.model, unit = this.data.objective?.unit || '';
    const el = this.querySelector('.bbh-headline'), sub = this.querySelector('.bbh-sub');
    const fmtU = (x) => `${fmt(x)}${unit ? ` ${unit}` : ''}`;
    const html = (end, change, label) => {
      if (end === null) return `<span class="value">—</span><span class="why">no admissible solution in this window</span>`;
      if (!change) return `<span class="value">${fmt(end)}</span>${unit ? `<span class="unit">${esc(unit)}</span>` : ''}`;
      const t = m.tone(change.pct);
      const arrow = change.pct < 0 ? '↓' : change.pct > 0 ? '↑' : '';
      return `<span class="value">${fmt(end)}</span>${unit ? `<span class="unit">${esc(unit)}</span>` : ''}
        <span class="delta ${t}">${arrow} ${pctNum(Math.abs(change.pct))} %</span>
        <span class="delta-text ${t}">${sign(change.abs)}${fmt(Math.abs(change.abs))}${unit ? ` ${esc(unit)}` : ''} ${esc(label)}</span>`;
    };
    if (over) {
      // the stock idiom: pointing at a moment re-reads the number there, and its change since the window opened
      const at = m.bestAt(v, m.xOf(over, v.axis));
      const change = v.startVal && at.y !== null ? { abs: at.y - v.startVal, pct: (100 * (at.y - v.startVal)) / v.startVal } : null;
      const where = over.ablation ? `after #${over.after}` : `#${over.n}`;
      el.innerHTML = html(at.y, change, `at ${where}`);
      sub.innerHTML = over.ablation
        ? `best so far when <span class="who">${esc(over.id)}</span> ran (${where}, ${fmtDate(over.t)}): <span class="who">${esc(at.s ? at.s.id : '—')}</span>`
        : `best so far at <span class="who">${where} ${esc(over.id)}</span> (${fmtDate(over.t)}): <span class="who">${esc(at.s ? at.s.id : '—')}</span>`;
      return;
    }
    const label = this.zoom ? 'in the zoomed range' : this.ui.r === 'All' ? 'since the first admissible' : `in ${this.ui.r}`;
    el.innerHTML = html(v.endBest, v.change, label);
    const b = v.bestSol;
    const hold = b && b.hold !== null ? ` · holdout ${fmtU(b.hold)}` : '';
    sub.innerHTML = b ? `<a href="${esc(this.context.href('solution', { id: b.id }))}" class="who" data-open="${esc(b.id)}">${esc(b.id)}</a> · #${b.n} · ${fmtDate(b.t)}${hold}`
      + ` · ${v.shown.length} solution${v.shown.length === 1 ? '' : 's'} in window, ${v.admissibleShown} admissible`
      + (v.prevClose ? ` · window opened at ${fmtU(v.prevClose.y)} (${esc(v.prevClose.id)})` : '') : '';
    sub.querySelector('[data-open]')?.addEventListener('click', (e) => { e.preventDefault(); this.open(b.id); });
  }

  /** bb-open {kind: 'solution', id}; the context follows links.solution unless a listener prevented it. */
  open(id) {
    return this.context.open(this, { kind: 'solution', id, href: this.context.href('solution', { id }) });
  }

  tipHtml(s) {
    const unit = this.data.objective?.unit || '';
    const fmtU = (x) => `${fmt(x)}${unit ? ` ${unit}` : ''}`;
    const gates = Object.entries(s.failed || {});
    const failText = gates.length ? gates.map(([g, n]) => `${g.replace(/_/g, ' ')} on ${n} task${n === 1 ? '' : 's'}`).join(', ') : 'not scored';
    if (s.ablation) {
      const f = ablationFacts(s);
      return `<div><b>${esc(s.id)}</b><span class="tag">ablation run</span>${s.ok ? '' : '<span class="tag no">not admissible</span>'}</div>
        ${f.component ? `<div><span class="k">${f.op}:</span> <b>${esc(f.component)}</b></div>` : ''}
        <div class="k">${[f.kind, f.fit, f.study ? `study ${f.study}` : ''].filter(Boolean).map(esc).join(' · ')}</div>
        <div>${esc(s.change)}</div>
        <div><span class="k">${esc(this.data.objective?.name || 'objective')}</span> <b>${fmtU(s.y)}</b></div>
        <div class="k">after #${s.after} · a study variant, not a search step: never moves the best line</div>
        <div class="go">click: open this run</div>`;
    }
    const state = s.ok ? `<span class="tag ok">admissible</span>${s.newBest ? '<span class="tag new">new best</span>' : ''}` : '<span class="tag no">not admissible</span>';
    return `<div><b>#${s.n} ${esc(s.id)}</b>${state}</div>
      <div>${esc(s.change)}</div>
      <div><span class="k">${esc(this.data.objective?.name || 'objective')}</span> <b>${fmtU(s.y)}</b>${s.hold !== null ? ` · holdout ${fmtU(s.hold)}` : ''}</div>
      ${s.ok ? '' : `<div class="k">fails: ${esc(failText)}</div>`}
      <div class="k">${fmtDate(s.t)} · ${sha7(s.c)} ${esc(((s.c && s.c.subject) || '').slice(0, 60))}</div>
      <div class="go">click: open this solution</div>`;
  }

  showTip(s, x, y) {
    const tip = this.querySelector('.bbh-tip');
    if (!tip) return;
    if (!s) { tip.hidden = true; return; }
    tip.innerHTML = this.tipHtml(s);
    tip.hidden = false;
    const w = tip.offsetWidth, h = tip.offsetHeight;
    let left = x + 14, top = y + 14;
    if (left + w > innerWidth - 8) left = x - w - 14;
    if (left < 8) left = 8;
    if (top + h > innerHeight - 8) top = y - h - 14;
    tip.style.left = `${left}px`;
    tip.style.top = `${Math.max(8, top)}px`;
  }

  colors() {
    const c = (n) => cssVar(this, n);
    return { card: c('--bb-card'), fg: c('--bb-fg'), muted: c('--bb-muted'), faint: c('--bb-faint'), grid: c('--bb-grid'), best: c('--bb-best'),
      bestFill: c('--bb-best-fill'), newbest: c('--bb-newbest'), adm: c('--bb-adm'), bad: c('--bb-bad'), holdout: c('--bb-holdout'), font: c('--bb-font') };
  }

  draw() {
    const m = this.model;
    const v = this.v = m.view(this.ui.x, this.ui.r, !!this.ui.ab, this.zoom);
    this.controls();
    this.legend();
    this.headline(null);
    const C = this.colors();
    const el = this.querySelector('.bbh-chart');
    if (this.u) { this.u.destroy(); this.u = null; }
    const axis = this.ui.x;
    const shown = v.all.slice().sort((a, b) => m.xOf(a, axis) - m.xOf(b, axis) || a.n - b.n);
    const [lo, hi] = v.domain;
    const beats = (a, b) => (b === null ? true : m.direction === 'lower' ? a < b : a > b);
    const xs = [lo], step = [v.prevClose ? v.prevClose.y : null], nb = [null], adm = [null], bad = [null], abl = [null];
    let cur = v.prevClose ? v.prevClose.y : null;
    for (const s of shown) {
      if (s.ok && !s.ablation && beats(s.y, cur)) cur = s.y;
      xs.push(m.xOf(s, axis)); step.push(cur);
      nb.push(!s.ablation && s.ok && s.newBest ? s.y : null);
      adm.push(!s.ablation && s.ok && !s.newBest ? s.y : null);
      bad.push(!s.ablation && !s.ok ? s.y : null);
      abl.push(s.ablation ? s.y : null);
    }
    xs.push(hi); step.push(cur); nb.push(null); adm.push(null); bad.push(null); abl.push(null);
    const ylog = this.yIsLog();
    const commits = m.commits;
    const width = el.clientWidth || 600;
    const xAxis = {
      stroke: C.muted, grid: { stroke: C.grid, width: 1 }, ticks: { stroke: C.grid }, font: `11px ${C.font}`,
      values: (uu, splits) => splits.map((x) => (axis === 'number' ? `#${x}` : axis === 'commit' ? (commits[x - 1] ? sha7(commits[x - 1]) : '') : null)),
    };
    if (axis === 'date') delete xAxis.values; // uPlot's own time ticks
    if (axis === 'commit') {
      xAxis.splits = (uu, ai, min, max) => {
        const first = Math.max(1, Math.ceil(min)), last = Math.min(commits.length, Math.floor(max));
        const every = Math.max(1, Math.ceil(((last - first + 1) * 64) / Math.max(200, width - 70)));
        const out = []; for (let k = first; k <= last; k += every) out.push(k); return out;
      };
    }
    if (axis === 'number') xAxis.incrs = [1, 2, 5, 10, 20, 50, 100, 200, 500];
    const span = v.ymax - v.ymin;
    const linPad = span > 0 ? span * 0.08 : Math.max(Math.abs(v.ymax) * 0.1, 1e-9);
    const opts = {
      width, height: el.clientHeight, ms: 1, pxAlign: 0, padding: [12, 14, 0, 4], legend: { show: false },
      cursor: { drag: { x: true, y: false, setScale: false }, points: { show: false }, x: true, y: false, focus: { prox: -1 } },
      scales: {
        x: { time: axis === 'date', range: () => (this.zoom ? this.zoom : [lo, hi]) },
        y: ylog ? { distr: 3, log: 10, range: () => [v.ymin / 1.35, v.ymax * 1.35] }
          : { distr: 1, range: () => [v.ymin >= 0 ? Math.max(0, v.ymin - linPad) : v.ymin - linPad, v.ymax + linPad] },
      },
      axes: [xAxis, { stroke: C.muted, grid: { stroke: C.grid, width: 1 }, ticks: { show: false }, font: `11px ${C.font}`,
        values: (uu, splits) => splits.map((x) => (x === null || x === undefined ? '' : String(+(+x).toPrecision(3)))), size: 52, space: 34,
        ...(ylog ? { splits: (uu, ai, min, max) => logTicks(min, max), filter: (uu, splits) => splits } : {}) }],
      series: [
        {},
        { label: 'best so far', stroke: C.best, width: 2, fill: C.bestFill, fillTo: (uu) => uu.scales.y.min,
          paths: uPlot.paths.stepped({ align: 1 }), points: { show: false }, spanGaps: true },
        { label: 'new best', stroke: C.newbest, fill: C.newbest, paths: () => null, points: { show: true, size: 10, width: 1, fill: C.newbest, stroke: C.newbest } },
        { label: 'admissible', stroke: C.adm, fill: C.adm, paths: () => null, points: { show: true, size: 8, width: 1, fill: C.adm, stroke: C.adm } },
        { label: 'not admissible', stroke: C.bad, paths: () => null, points: { show: true, size: 10, width: 1.6, fill: C.card, stroke: C.bad } },
        { label: 'ablation run', stroke: C.faint, paths: () => null, points: { show: true, size: 8, width: 1.4, fill: C.card, stroke: C.faint } },
      ],
      hooks: {
        draw: [(uu) => {
          const ctx = uu.ctx, dpr = devicePixelRatio || 1;
          ctx.save();
          // the window's open: where the best stood when the window opened (dashed, with its label)
          if (v.prevClose && !this.zoom) {
            const y = uu.valToPos(v.prevClose.y, 'y', true);
            ctx.strokeStyle = C.faint; ctx.lineWidth = dpr; ctx.setLineDash([3 * dpr, 4 * dpr]);
            ctx.beginPath(); ctx.moveTo(uu.bbox.left, y); ctx.lineTo(uu.bbox.left + uu.bbox.width, y); ctx.stroke();
            ctx.setLineDash([]); ctx.fillStyle = C.muted; ctx.font = `${11 * dpr}px ${C.font}`; ctx.textAlign = 'right';
            ctx.fillText(`window opened at ${fmt(v.prevClose.y)}`, uu.bbox.left + uu.bbox.width - 4 * dpr, y - 5 * dpr);
          }
          // the best's holdout: a dashed whisker to a diamond beside its dev dot (reporting only)
          const b = m.best;
          if (b && b.hold !== null && v.shown.includes(b) && (!ylog || b.hold > 0)) {
            const x0 = uu.valToPos(m.xOf(b, axis), 'x', true), y0 = uu.valToPos(b.y, 'y', true);
            const x1 = x0 + 12 * dpr, y1 = uu.valToPos(b.hold, 'y', true);
            ctx.strokeStyle = C.holdout; ctx.lineWidth = 1.2 * dpr; ctx.setLineDash([3 * dpr, 2 * dpr]);
            ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.setLineDash([]);
            ctx.fillStyle = C.holdout; ctx.globalAlpha = 0.85; const r = 5 * dpr;
            ctx.beginPath(); ctx.moveTo(x1, y1 - r); ctx.lineTo(x1 + r, y1); ctx.lineTo(x1, y1 + r); ctx.lineTo(x1 - r, y1); ctx.closePath(); ctx.fill();
          }
          ctx.restore();
        }],
        setCursor: [(uu) => {
          const { left, top } = uu.cursor;
          if (left === undefined || left < 0) { this.hover(null); return; }
          let near = null, dist = 26;
          for (const s of v.all) {
            if (s.y === null) continue;
            const d = Math.hypot(uu.valToPos(m.xOf(s, axis), 'x') - left, uu.valToPos(s.y, 'y') - top);
            if (d < dist) { dist = d; near = s; }
          }
          this.hover(near, uu);
        }],
        setSelect: [(uu) => {
          if (uu.select.width > 4) {
            this.zoom = [uu.posToVal(uu.select.left, 'x'), uu.posToVal(uu.select.left + uu.select.width, 'x')];
            uu.setSelect({ left: 0, width: 0, top: 0, height: 0 }, false);
            setTimeout(() => this.draw(), 0); // the headline and y range follow the zoomed window
          }
        }],
      },
    };
    this.u = new uPlot(opts, [xs, step, nb, adm, bad, abl], el);
    el.appendChild(this.querySelector('.bbh-ring'));
    this.u.over.addEventListener('mouseleave', () => this.hover(null));
    this.u.over.addEventListener('click', () => { if (this.hovered) this.open(this.hovered.id); });
  }

  hover(s, uu) {
    this.hovered = s;
    const ring = this.querySelector('.bbh-ring');
    if (!ring) return;
    if (!s || !uu) { ring.style.display = 'none'; this.showTip(null); this.headline(null); if (this.u) this.u.over.style.cursor = ''; return; }
    const px = uu.valToPos(this.model.xOf(s, this.v.axis), 'x') + uu.over.offsetLeft, py = uu.valToPos(s.y, 'y') + uu.over.offsetTop;
    ring.style.display = 'block'; ring.style.left = `${px}px`; ring.style.top = `${py}px`;
    const r = uu.over.getBoundingClientRect();
    this.showTip(s, r.left + px - uu.over.offsetLeft, r.top + py - uu.over.offsetTop);
    this.headline(s);
    uu.over.style.cursor = 'pointer';
  }

  /** Where a solution's dot is, in client pixels (headless checks hover and click through it). */
  locate(id) {
    const s = this.model?.sols.find((q) => q.id === id);
    if (!this.u || !s || !this.v.all.includes(s)) return null;
    const r = this.u.over.getBoundingClientRect();
    return { x: r.left + this.u.valToPos(this.model.xOf(s, this.v.axis), 'x'), y: r.top + this.u.valToPos(s.y, 'y') };
  }
}
register(BBHeadliner);
