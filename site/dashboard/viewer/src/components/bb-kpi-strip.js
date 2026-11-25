/* <bb-kpi-strip>: state.json kpis as data-ui <data-kpi> cards (the stock part: value, unit, delta coloured by which way
   is better, sparkline, "from"). A missing value is "—" with its why, never 0. Blocks pick and order the cards.
   Wave 2 (CONTRACT §16.6, additive): `view: table` shows the same KPIs as data-ui's table (one <data-views> with an
   inline .base: label, value with the KPI's own unit and decimals plus its sparkline cell, delta, from, source), and
   `toggle` puts a small Cards / Table switch above them; the reader's flip is kept by this element in memory only. The
   cards are drawn exactly as before the switch existed. */
import { BBElement, esc, fmtNum } from '../core/element.js';
import { register } from '../core/registry.js';
import { loadKpi, loadViews } from '../core/kit.js';
import schema from './bb-kpi-strip.schema.js';

let uid = 0;

/** The table's rows: one per KPI card, the value a rich cell (data-ui CONTRACT §22) that is written with the KPI's own
    decimals and unit, sorts by the stored number, and carries its sparkline's points and its why when missing. */
export function kpiRows(kpis, { spark = true } = {}) {
  return kpis.map((k, i) => {
    const missing = k.value === null || k.value === undefined;
    const value = missing ? { value: null, why: k.why || 'not read' }
      : { value: k.value, text: `${fmtNum(k.value, Number.isInteger(k.decimals) ? k.decimals : null)}${k.unit ? ` ${k.unit}` : ''}`, unit: k.unit || undefined };
    if (!missing && spark && Array.isArray(k.spark) && k.spark.filter((y) => Number.isFinite(y)).length > 1) value.values = k.spark.filter((y) => Number.isFinite(y));
    return { id: String(k.id ?? i + 1), k: i, label: k.label ?? k.id, value, why: missing ? k.why || 'not read' : null, delta: k.delta || null,
      tone: k.tone || null, better: k.better || null, from: k.from || null, source: k.source || null };
  });
}

/** The table's .base. `why`: a column saying why a value is missing (data-ui draws a missing cell blank, its why only
    on hover; the cards say it, so the table does too). `narrow`: a phone's column widths. */
export function kpiBase({ spark = true, why = false, narrow = false } = {}) {
  const size = narrow ? { label: 150, value: 160, why: 170, delta: 150, from: 240, source: 190 }
    : { label: 300, value: 200, why: 220, delta: 170, from: 330, source: 240 };
  const order = ['label', 'value', ...(why ? ['why'] : []), 'delta', 'from', 'source'];
  return {
    open: { mode: 'side', splitAt: 1400 },
    properties: { label: { displayName: 'KPI' }, value: { displayName: 'Value' }, why: { displayName: 'Why no value' },
      delta: { displayName: 'Change' }, from: { displayName: 'From' }, source: { displayName: 'Source' } },
    views: [{ type: 'table', name: 'KPIs', order, sort: [{ property: 'k', direction: 'ASC' }],
      ...(spark ? { display: { value: 'sparkline' } } : {}),
      columnSize: Object.fromEntries(order.map((p) => [p, size[p]])) }],
  };
}

export class BBKpiStrip extends BBElement {
  static schema = schema;
  static css = `
bb-kpi-strip .bbk { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(max(170px, calc((100% - (var(--bbk-cols) - 1) * 10px) / var(--bbk-cols))), 1fr)); }
bb-kpi-strip data-kpi { min-width: 0; }
bb-kpi-strip .bbk-bar { display: flex; justify-content: flex-end; margin: 0 0 6px; }
bb-kpi-strip .bbk-seg { display: inline-flex; border: 1px solid var(--bb-border); border-radius: 7px; overflow: hidden; font-size: 12px; }
bb-kpi-strip .bbk-seg button { font: inherit; padding: 2px 10px; border: 0; background: var(--bb-bg); color: var(--bb-muted); cursor: pointer; }
bb-kpi-strip .bbk-seg button + button { border-left: 1px solid var(--bb-border); }
bb-kpi-strip .bbk-seg button[aria-pressed="true"] { background: var(--bb-subtle); color: var(--bb-fg); font-weight: 600; }
bb-kpi-strip .bbk-seg button:focus-visible { outline: 2px solid var(--bb-accent); outline-offset: -2px; }
bb-kpi-strip .bbk-wait { color: var(--bb-muted); font-size: 13px; }
bb-kpi-strip data-views { min-width: 0; }
`;

  cards() {
    const all = this.data.kpis || [];
    const picks = this.blocks.filter((b) => b.type === 'kpi' && b.settings.id);
    const chosen = picks.length
      ? picks.map((b) => {
        const k = all.find((x) => x.id === b.settings.id);
        return k ? { ...k, label: b.settings.label || k.label }
          : { id: b.settings.id, label: b.settings.label || b.settings.id, value: null, why: `no KPI "${b.settings.id}" in state.json`, spark: [] };
      })
      : all;
    return chosen.slice(0, this.settings.limit);
  }

  /** Cards or table: the reader's flip while page.json's `view` is unchanged, else the setting. */
  shown() {
    const s = this.settings;
    return s.toggle && this._flip && this._flip.from === s.view ? this._flip.view : s.view;
  }

  bar(view) {
    if (!this.settings.toggle) return '';
    const b = (v, label) => `<button type="button" data-view="${v}" aria-pressed="${view === v}">${label}</button>`;
    return `<div class="bbk-bar"><span class="bbk-seg" role="group" aria-label="Show the KPIs as">${b('cards', 'Cards')}${b('table', 'Table')}</span></div>`;
  }

  listen() {
    if (this._listening) return;
    this._listening = true;
    this.addEventListener('click', (e) => {
      const btn = e.target.closest && e.target.closest('.bbk-seg button[data-view]');
      if (!btn || !this.contains(btn) || btn.getAttribute('aria-pressed') === 'true') return;
      this._flip = { view: btn.dataset.view, from: this.settings.view };
      this.update();
    });
  }

  async render() {
    const kpis = this.cards();
    if (!kpis.length) return this.empty();
    const s = this.settings;
    const view = this.shown();
    this.listen();
    const token = (this._token = (this._token || 0) + 1);
    if (view === 'table') return this.renderTable(kpis, token);
    // the no-JS text first (data-kpi keeps it until it upgrades), then the stock card
    this.innerHTML = `${this.bar(view)}<div class="bbk" style="--bbk-cols:${s.columns}">${kpis.map((k) => `<data-kpi data-id="${esc(k.id)}">${esc(k.label)}: ${esc(k.value ?? '—')} ${esc(k.unit || '')}</data-kpi>`).join('')}</div>`;
    await loadKpi();
    if (token !== this._token) return; // the reader flipped to the table meanwhile
    const els = this.querySelectorAll('data-kpi');
    kpis.forEach((k, i) => {
      const from = [k.from, s.show_source && k.source ? `source: ${k.source}` : ''].filter(Boolean).join(' · ');
      els[i].card = {
        label: k.label,
        value: { value: k.value ?? null, unit: k.unit || undefined, why: k.value === null || k.value === undefined ? (k.why || 'not read') : undefined, source: k.source || undefined },
        column: Number.isInteger(k.decimals) ? { decimals: k.decimals } : {},
        delta: k.delta ? { text: k.delta, tone: k.tone || 'neutral' } : null,
        spark: s.spark && Array.isArray(k.spark) ? k.spark.map((y) => ({ y })) : null,
        from,
      };
    });
  }

  async renderTable(kpis, token) {
    const s = this.settings;
    const box = this.data.box || 'Box';
    const wait = document.createElement('div');
    wait.className = 'bbk-wait';
    wait.textContent = 'Loading the KPI table…';
    this.replaceChildren(wait);
    const core = await loadViews();
    if (token !== this._token) return;
    const rows = kpiRows(kpis, { spark: s.spark });
    const narrow = this.getBoundingClientRect().width < 640;
    const doc = kpiBase({ spark: s.spark, why: rows.some((r) => r.why), narrow });
    const text = `# ${box}: KPIs, bb-kpi-strip's table over state.json kpis\n${core.stringifyBase(doc)}`;
    const views = document.createElement('data-views');
    views.id = `bbk-${++uid}`;
    views.setAttribute('no-url', '');
    views.setAttribute('toolbar', 'none');
    views.setAttribute('status', 'off');
    views.setAttribute('aria-label', `${box}: KPIs`);
    // WHY a fixed height from the row count: data-views fills --data-height (70vh by default); a strip of 3-8 KPIs
    // should take its rows' room, not the screen's
    views.style.setProperty('--data-height', `${Math.min(560, 44 + 30 * rows.length)}px`);
    views.addEventListener('data-views-render', (e) => { this.dataset.drew = e.detail.type; wait.remove(); }, { once: true });
    views.baseText = text;
    views.base = core.parseBase(text);
    views.data = { id: `bb/${box}/kpis/table.${+s.spark}`, title: `${box} KPIs`, titleProperty: 'label',
      properties: {
        k: { type: 'number', label: 'Order', decimals: 0, hidden: true },
        label: { type: 'text', label: 'KPI' },
        value: { type: 'number', label: 'Value', note: "each KPI's own unit and decimals; a missing value says why" },
        why: { type: 'text', label: 'Why no value' }, delta: { type: 'text', label: 'Change' }, tone: { type: 'text', label: 'Tone' }, better: { type: 'text', label: 'Better' },
        from: { type: 'text', label: 'From' }, source: { type: 'text', label: 'Source' },
      },
      rows };
    const bar = document.createElement('div');
    bar.innerHTML = this.bar('table');
    this.append(...bar.childNodes, views);
  }
}
register(BBKpiStrip);
