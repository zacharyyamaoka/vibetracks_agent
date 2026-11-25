/* <bb-gates>: every gate with its pass state and worst margin (state.json gates). Calm: a passed gate is plain text
   with a check; only a failed one is red. A margin the box does not record says why.

   view (CONTRACT §16.6, §16.7, §16.8):
   - timeline (the default, PICKS.md: lane G's 3 State timeline with 1 Problems first's sentence and OK fold,
     proposals-gates/ @ 424f26f; Zach's 17:35 ruling: the matrix nests, v4's counting bar on top): the verdict at the
     newest column ("✓ All 5 gates pass at #34" / "✗ Set by its own worst gates (4): …"), when the history was red, the
     problems first (each opens why it is red), every passing gate folded into "✓ N OK", then ONE stock data-ui
     <data-views> over the gates .base (bb-gates.rows.js): its presets are the nested matrix (data-ui §56: Admissible ›
     gates › failing tasks, every cell one size, x = iteration / commit / day, the counting bar or the one-block strip on
     top), the table over the same rows (the generic base), and, where the state has spec_history, the spec's matrix and
     table. A cell of the ruler's matrix reads the whole section as of that column and opens the cell's why under the
     matrix (data-views-cell, answered here: its failing tasks with their values, the worst against the limit, the
     margin, the moment in the box's saved run with "▸ play it", the gate's rule); a bar or a header reads the column
     (data-views-column); the cells answered are marked through the view's picks. It replaced bb-gate-matrix's hand-rolled
     grid (lane GP), which stays a component of its own.
   - problems (v1, Problems first): the same sentence, red line, problems and OK fold, with the matrix as v1's one-block
     worst strip over the top rows (rollup: worst, folded) between the sentence and the problems.
   - tiles (today's look, `layout` cards | rows) judged on the best admissible solution, then data-ui's table over the
     same gates slice, or either alone. `toggle` gives the reader the switch. `view` is an open list, never renamed.
   The timeline's rules live in bb-gates.model.js (pure, tested in Node). */
import { BBElement, esc, fmtNum } from '../core/element.js';
import { register } from '../core/registry.js';
import { loadViews } from '../core/kit.js';
import schema from './bb-gates.schema.js';
import { timelineView, timelineOf, whyOf, messageOf, fmt } from './bb-gates.model.js';
import { gatesBase, gatesDataset, PRESETS, X_AXIS, AXIS_X } from './bb-gates.rows.js';
import './bb-evidence.js';

let uid = 0;
const VIEWS = [{ id: 'timeline', label: 'Matrix' }, { id: 'problems', label: 'Problems' }, { id: 'tiles', label: 'Tiles' }, { id: 'table', label: 'Table' }, { id: 'tiles-table', label: 'Both' }];
const STATE = { fail: ['✗', 'fail'], pass: ['✓', 'pass'], none: ['–', 'not recorded'] };
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** "red 1.48–1.59 s (+2 more spans) of 4.94 s; worst at 1.58 s (stop error 2.56 mm)" */
const momentText = (m) => {
  if (m.why) return m.why;
  const red = m.red && m.red.length ? `red ${m.red[0][0].toFixed(2)}–${m.red[0][1].toFixed(2)} s${m.red.length > 1 ? ` (+${m.red.length - 1} more span${m.red.length > 2 ? 's' : ''})` : ''}` : 'no red span drawn';
  const peak = m.peak ? `; worst at ${m.peak.t.toFixed(2)} s${m.peak.label ? ` (${m.peak.label})` : ''}` : '';
  return `${red} of ${Number(m.duration_s).toFixed(2)} s${peak}${m.passed === true ? ' · this run passed it (the scored task did not)' : ''}`;
};

/** The table's rows: one per gate, each value as the slice states it (a missing number carries its why, never 0). */
export function gateTableRows(gates) {
  // WHY `text`: the vendored data-ui table draws a rich number cell with every stored digit and no unit, whatever the
  // .base's `digits`; the text is the tiles' reading (3 significant figures + unit), the stored value stays in its hover
  const num = (v, unit, why) => (typeof v === 'number' && Number.isFinite(v)
    ? { value: v, text: `${fmtNum(v)}${unit ? ` ${unit}` : ''}`, ...(unit ? { unit } : {}) } : { value: null, why: why || 'not recorded' });
  return gates.map((g) => ({
    id: String(g.id),
    pass_when: g.pass_when || '',
    passed: g.passed === true ? 'pass' : g.passed === false ? 'fail' : 'not_run',
    failed_tasks: typeof g.failed_tasks === 'number' ? { value: g.failed_tasks, text: g.tasks ? `${g.failed_tasks} of ${g.tasks}` : String(g.failed_tasks) } : { value: null, why: 'not judged' },
    worst: num(g.worst, g.unit, g.why_null),
    worst_task: g.worst_task || '',
    margin: num(g.margin, g.unit, g.why_null),
    of: g.of || '',
    source: g.source || '',
  }));
}

export const GATE_TABLE_BASE = `properties:
  id: { displayName: "Gate" }
  pass_when: { displayName: "Pass when" }
  passed: { displayName: "State" }
  failed_tasks: { displayName: "Failed tasks", type: number, decimals: 0 }
  worst: { displayName: "Worst", type: number, digits: 4 }
  worst_task: { displayName: "Worst task" }
  margin: { displayName: "Margin", type: number, digits: 4 }
  of: { displayName: "Judged on" }
  source: { displayName: "Source" }
views:
  - type: table
    name: Gates
    order: [id, passed, failed_tasks, worst, worst_task, margin, pass_when, of, source]
    display: { passed: status }
`;

const OPS = { '<=': '≤', '>=': '≥', '<': '<', '>': '>', is: 'is' };

export class BBGates extends BBElement {
  static schema = schema;
  static css = `
bb-gates .bbg-head { display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; margin: 0 0 8px; }
bb-gates .bbg-head h3 { margin: 0; font-size: 16px; }
bb-gates .bbg-head .of { color: var(--bb-muted); font-size: 13px; }
bb-gates .bbg { display: grid; gap: 8px; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); }
bb-gates .bbg.rows { grid-template-columns: 1fr; gap: 0; border: 1px solid var(--bb-border); border-radius: calc(var(--bb-radius) + 4px); }
bb-gates .gate { border: 1px solid var(--bb-border); border-radius: calc(var(--bb-radius) + 4px); padding: 10px 12px; min-width: 0; }
bb-gates .bbg.rows .gate { border: 0; border-radius: 0; border-top: 1px solid var(--bb-rule); display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr); gap: 4px 12px; }
bb-gates .bbg.rows .gate:first-child { border-top: 0; }
bb-gates .gate.fail { border-color: var(--bb-bad); }
bb-gates .gname { font-family: var(--bb-mono); font-size: 12.5px; font-weight: 600; overflow-wrap: anywhere; }
bb-gates .state { font-size: 14px; margin-top: 2px; }
bb-gates .state .ok { color: var(--bb-good); font-weight: 700; }
bb-gates .gate.fail .state { color: var(--bb-bad); font-weight: 600; }
bb-gates .state.open { color: var(--bb-muted); }
bb-gates .margin { font-size: 13px; color: var(--bb-fg); margin-top: 4px; font-variant-numeric: tabular-nums; }
bb-gates .when, bb-gates .why { font-size: 12px; color: var(--bb-muted); margin-top: 4px; overflow-wrap: anywhere; }
bb-gates .bbg-switch { margin-left: auto; display: inline-flex; border: 1px solid var(--bb-border); border-radius: 9px; overflow: hidden; background: var(--bb-card); }
bb-gates .bbg-switch button { border: 0; background: transparent; color: var(--bb-muted); font: inherit; font-size: 12.5px; padding: 4px 10px; cursor: pointer; white-space: nowrap; }
bb-gates .bbg-switch button + button { border-left: 1px solid var(--bb-border); }
bb-gates .bbg-switch button[aria-pressed="true"] { background: var(--bb-subtle); color: var(--bb-fg); font-weight: 600; }
bb-gates .bbg-table { min-width: 0; }
bb-gates .bbg + .bbg-table { margin-top: 12px; }
bb-gates .bbg-table data-views { display: block; }
/* the timeline view (lane G's 01 + 03) */
bb-gates .bbg-verdict { font-size: 20px; line-height: 1.3; margin: 2px 0 0; overflow-wrap: anywhere; }
bb-gates .bbg-verdict .g { font-weight: 700; margin-right: 4px; }
bb-gates .bbg-verdict[data-tone="ok"] .g { color: var(--bb-good); }
bb-gates .bbg-verdict[data-tone="bad"] .g { color: var(--bb-bad); }
bb-gates .bbg-verdict[data-tone="warn"] .g { color: var(--bb-warn); }
bb-gates .bbg-verdict .nm { font-family: var(--bb-mono); font-size: 16px; font-weight: 700; }
bb-gates .bbg-where, bb-gates .bbg-red { color: var(--bb-muted); font-size: 13px; margin-top: 3px; line-height: 1.45; overflow-wrap: anywhere; }
bb-gates .bbg-where b, bb-gates .bbg-red b { color: var(--bb-fg); font-weight: 600; }
bb-gates .bbg-red .red { color: var(--bb-bad); }
bb-gates .linkish { border: 0; background: none; padding: 0; font: inherit; color: var(--bb-accent); cursor: pointer; }
bb-gates .linkish:hover { text-decoration: underline; }
bb-gates .bbg-dx { margin: 10px 0 14px; border: 1px solid var(--bb-border); border-radius: calc(var(--bb-radius) + 4px); background: var(--bb-card); }
bb-gates .dx-row, bb-gates .dx-ok { display: flex; gap: 8px; align-items: center; padding: 7px 10px; border-top: 1px solid var(--bb-rule); min-width: 0; }
bb-gates .bbg-dx > :first-child { border-top: 0; }
bb-gates .dx-name { flex: 1; min-width: 0; display: flex; gap: 0 6px; flex-wrap: wrap; align-items: baseline; border: 0; background: none; padding: 0; font: inherit;
  color: var(--bb-fg); text-align: left; cursor: pointer; font-size: 13.5px; }
bb-gates .dx-name .chev { display: inline-block; width: 10px; color: var(--bb-muted); transition: transform .12s; }
bb-gates .dx-name[aria-expanded="true"] .chev { transform: rotate(90deg); }
bb-gates .dx-name .nm { font-family: var(--bb-mono); font-size: 12.5px; font-weight: 700; overflow-wrap: anywhere; }
bb-gates .dx-row[data-state="fail"] .nm { color: var(--bb-bad); }
bb-gates .dx-ok .nm { font-family: inherit; font-size: 13.5px; color: var(--bb-good); }
bb-gates .dx-name .msg { color: var(--bb-muted); overflow-wrap: anywhere; min-width: 0; }
bb-gates .pill { flex: none; font-size: 10.5px; font-weight: 700; letter-spacing: .04em; border-radius: 999px; padding: 1px 8px; border: 1px solid var(--bb-border); color: var(--bb-muted); }
bb-gates .pill.fail { color: var(--bb-bad); border-color: color-mix(in srgb, var(--bb-bad) 55%, transparent); background: color-mix(in srgb, var(--bb-bad) 10%, var(--bb-card)); }
bb-gates .dx-sub { padding: 0 10px 10px 28px; }
bb-gates .dx-sub .dx-row { border-top: 0; padding-left: 0; }
bb-gates .dx-more { padding: 6px 10px; color: var(--bb-muted); font-size: 12.5px; border-top: 1px solid var(--bb-rule); }
bb-gates .bbg-tl { min-width: 0; margin-top: 10px; }
bb-gates .bbg-tl data-views { min-width: 0; --data-height: var(--bbg-h, 560px); }
bb-gates[data-shown="problems"] .bbg-tl data-views { --data-height: var(--bbg-strip-h, 230px); }
bb-gates .bbg-tl .bbg-wait { color: var(--bb-muted); font-size: 13px; }
bb-gates .bbg-why { margin: 10px 0 0; border: 1px solid var(--bb-border); border-left: 3px solid var(--bb-border); border-radius: calc(var(--bb-radius) + 2px); padding: 10px 12px; background: var(--bb-card); min-width: 0; }
bb-gates .bbg-why[data-state="fail"] { border-left-color: var(--bb-bad); }
bb-gates .bbg-why[data-state="pass"] { border-left-color: color-mix(in srgb, var(--bb-good) 60%, var(--bb-border)); }
bb-gates .dx-sub .bbg-why, bb-gates .bbg-dx .bbg-why { margin: 0 10px 10px 28px; }
bb-gates .bbg-why h4 { margin: 0; font-size: 14.5px; display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; overflow-wrap: anywhere; }
bb-gates .bbg-why h4 .x { margin-left: auto; border: 0; background: none; color: var(--bb-muted); font: inherit; font-size: 15px; cursor: pointer; padding: 0 2px; }
bb-gates .st { font-size: 11px; font-weight: 700; border-radius: 6px; padding: 1px 6px; border: 1px solid var(--bb-border); color: var(--bb-muted); white-space: nowrap; }
bb-gates .st.fail { color: var(--bb-bad); border-color: color-mix(in srgb, var(--bb-bad) 55%, transparent); background: color-mix(in srgb, var(--bb-bad) 10%, var(--bb-card)); }
bb-gates .st.pass { color: var(--bb-good); }
bb-gates .bbg-why .sub { color: var(--bb-muted); font-size: 12.5px; margin-top: 3px; overflow-wrap: anywhere; }
bb-gates .bbg-why .nums { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px 14px; margin: 10px 0 4px; }
bb-gates .bbg-why .nums b { display: block; font-size: 17px; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
bb-gates .bbg-why .nums b.over { color: var(--bb-bad); }
bb-gates .bbg-why .nums span { color: var(--bb-muted); font-size: 12px; }
bb-gates .bbg-why ol { margin: 8px 0 0; padding-left: 20px; font-size: 13px; line-height: 1.5; }
bb-gates .bbg-why li + li { margin-top: 6px; }
bb-gates .bbg-why .muted, bb-gates .bbg-why .colnote { color: var(--bb-muted); }
bb-gates .bbg-why .colnote { font-size: 12px; margin-top: 8px; padding-top: 6px; border-top: 1px solid var(--bb-rule); }
bb-gates .chips { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
bb-gates .chip { font-family: var(--bb-mono); font-size: 11.5px; border-radius: 6px; padding: 1px 6px; background: color-mix(in srgb, var(--bb-bad) 9%, var(--bb-card));
  color: color-mix(in srgb, var(--bb-bad) 85%, var(--bb-fg)); border: 1px solid color-mix(in srgb, var(--bb-bad) 30%, transparent); overflow-wrap: anywhere; }
bb-gates .run { margin-top: 2px; overflow-wrap: anywhere; }
bb-gates .run .task { font-family: var(--bb-mono); font-size: 12px; }
bb-gates .play { border: 1px solid var(--bb-accent); color: var(--bb-accent); background: none; font: inherit; font-size: 12px; border-radius: 999px; padding: 0 8px; cursor: pointer; margin: 0 2px; }
bb-gates .play[aria-pressed="true"] { background: var(--bb-accent); color: var(--bb-on-accent); }
bb-gates .bbg-play { margin-top: 10px; min-width: 0; }
bb-gates .bbg-play bb-evidence { display: block; }
bb-gates .openit { white-space: nowrap; }
bb-gates .bbg-none { color: var(--bb-muted); font-size: 13px; margin: 8px 0 0; }
bb-gates .bbg-none ul { margin: 6px 0 0; padding-left: 18px; }
bb-gates .bbg-none code { font-size: 12px; }
`;

  margin(g) {
    if (g.margin === null || g.margin === undefined) return `<div class="margin bb-muted">${esc(g.why_null || 'no margin recorded')}</div>`;
    const u = g.unit ? ` ${esc(g.unit)}` : '';
    const lim = `${esc(OPS[g.op] || g.op || '')} ${fmtNum(g.threshold)}${u}`;
    if (g.threshold === 0 && g.worst === 0) return `<div class="margin">worst task: 0 (limit ${lim})</div>`;
    const share = g.threshold ? ` · ${Math.round((100 * g.margin) / Math.abs(g.threshold))} % inside` : '';
    return `<div class="margin" title="worst task: ${esc(g.worst_task || '')}">worst ${fmtNum(g.worst)}${u} (limit ${lim}): ${g.margin >= 0 ? '' : '−'}${fmtNum(Math.abs(g.margin))}${u} ${g.margin >= 0 ? 'to spare' : 'over'}${share}</div>`;
  }

  /** The reader's flip while page.json's `view` is unchanged, else the setting (bb-kpi-strip's rule). */
  shown() {
    const s = this.settings;
    return s.toggle && this._flip && this._flip.from === s.view ? this._flip.view : s.view;
  }

  render() { return this.draw(); }

  async draw() {
    const gates = this.data.gates;
    if (!Array.isArray(gates) || !gates.length) return this.empty();
    const s = this.settings;
    const view = this.shown();
    const token = (this._token = (this._token || 0) + 1);
    const of = gates.find((g) => g.of)?.of;
    const passed = gates.filter((g) => g.passed === true).length;
    const judged = gates.filter((g) => g.passed !== null && g.passed !== undefined).length;
    if (view === 'timeline' || view === 'problems') {
      const toggle = s.toggle ? this.switchHtml(view) : '';
      this.timeline(toggle, view);
      return;
    }
    const tiles = view !== 'table';
    const table = view === 'table' || view === 'tiles-table';
    // WHY load data-ui before drawing anything: the element stays empty (not "settled") until its table can draw at once
    const core = table ? await loadViews() : null;
    if (token !== this._token) return; // the reader flipped again meanwhile
    const toggle = s.toggle ? this.switchHtml(view) : '';
    this.innerHTML = `<div class="bbg-head"><h3>${esc(s.title)}</h3><span class="of">${judged ? `${passed} of ${gates.length} pass · judged on <span class="bb-mono">${esc(of)}</span> (dev)` : 'not judged yet: no solution scored'}</span>${toggle}</div>
      ${tiles ? this.tiles(gates) : ''}${table ? '<div class="bbg-table"></div>' : ''}`;
    this.wireSwitch();
    if (!table) { this.dataset.drew = 'tiles'; return; }
    delete this.dataset.drew;
    const host = this.querySelector('.bbg-table');
    const views = document.createElement('data-views');
    views.id = `bbg-table-${++uid}`;
    views.setAttribute('no-url', '');
    views.setAttribute('toolbar', 'none');
    views.setAttribute('status', 'off');
    views.setAttribute('aria-label', `${this.data.box || 'Box'}: gates`);
    // WHY from the row count: data-views fills --data-height (70vh by default); five gates should take five rows' room
    views.style.setProperty('--data-height', `${Math.min(520, 58 + 31 * gates.length)}px`);
    views.addEventListener('data-views-render', () => { this.dataset.drew = view; }, { once: true });
    views.baseText = GATE_TABLE_BASE;
    views.base = core.parseBase(GATE_TABLE_BASE);
    views.data = { id: `bb/${this.data.box || 'box'}/gates`, title: 'gates', titleProperty: 'id', rows: gateTableRows(gates) };
    host.replaceChildren(views);
  }

  switchHtml(view) {
    return `<span class="bbg-switch" role="group" aria-label="Gates view">${VIEWS.map((v) => `<button data-view="${v.id}" aria-pressed="${v.id === view}">${v.label}</button>`).join('')}</span>`;
  }

  wireSwitch() {
    const s = this.settings;
    this.querySelectorAll('.bbg-head .bbg-switch button').forEach((b) => b.addEventListener('click', () => { this._flip = { view: b.dataset.view, from: s.view }; this.draw(); }));
  }

  // ── the timeline view ──────────────────────────────────────────────────────────────────────────────────────────
  /** The section's frame, drawn once per render: the head, the top (sentence, list), the matrix, the cell's why. The
      matrix is created once and kept, so the reader's x, toggles and scroll survive a click; only the top and the why
      are redrawn as the selection moves. */
  timeline(toggle, mode = 'timeline') {
    const s = this.settings;
    const d = this.data;
    // the reader's state: x, the as-of column (bb-gate-matrix's key, bb-gates.model's rules), the selected gate, what is open
    const key = `${s.x}|${mode}`;
    if (!this.tl || this.tl.from !== key) this.tl = { from: key, x: s.x, abl: false, col: null, gate: null, sel: false, open: new Set(), okOpen: false, play: null };
    this.dataset.shown = mode;
    const list = '<div class="bbg-list"></div>';
    const matrix = '<div class="bbg-tl"><div class="bbg-wait">Loading the gate matrix…</div></div>';
    // v1 puts its strip between the sentence and the problems; the matrix view puts the problems first
    this.innerHTML = `<div class="bbg-head"><h3>${esc(s.title)}</h3>${toggle}</div><div class="bbg-top"></div>${mode === 'problems' ? matrix + list : list + matrix}<div class="bbg-why-cell"></div>`;
    this.wireSwitch();
    if (!(d.iterations || []).length) { this.paintNone(); this.querySelector('.bbg-tl').remove(); this.dataset.drew = mode; return; }
    this.paint();
    this.mountMatrix(mode);
  }

  /** ONE data-ui <data-views> over the gates .base (bb-gates.rows.js), its presets the views over the same rows. */
  async mountMatrix(mode) {
    const s = this.settings;
    const d = this.data;
    const token = (this._mtoken = (this._mtoken || 0) + 1);
    const core = await loadViews();
    if (token !== this._mtoken || !this.isConnected) return;
    const host = this.querySelector('.bbg-tl');
    if (!host) return;
    const spec = !!(d.spec_history && d.spec && (d.spec.requirements || []).length);
    const text = gatesBase({ spec, commits: spec ? d.spec_history.commits.map((c) => c.sha) : [], rollup: mode === 'problems' ? 'worst' : s.rollup || 'count',
      x: this.tl.x, fold: mode === 'problems' ? 'closed' : 1 });
    const views = document.createElement('data-views');
    views.id = `bbg-m-${++uid}`;
    views.setAttribute('no-url', '');
    views.setAttribute('toolbar', 'compact');
    views.setAttribute('view', PRESETS[s.preset] && (spec || !String(s.preset).startsWith('spec')) ? PRESETS[s.preset] : PRESETS['gates-matrix']);
    views.setAttribute('aria-label', `${d.box || 'Box'}: gates matrix`);
    // WHY fitted: a box's few gates folded under Admissible left a 560 px panel two-thirds empty on the Overview; the
    // matrix opens as tall as its first fold (the chrome, the bar, the header, Admissible and its gates), up to `height`,
    // and scrolls inside past that; the spec's presets open at `height`
    const fit = 240 + 27 * ((d.gates || []).length + 2);
    views.style.setProperty('--bbg-h', `${String(s.preset || '').startsWith('spec') && spec ? s.height || 560 : Math.min(s.height || 560, fit)}px`);
    views.baseText = text;
    views.base = core.parseBase(text);
    views.data = gatesDataset(d, { spec });
    // a ruler cell: answered here (why it is red, under the matrix), the section read as of its column, the cell marked
    views.addEventListener('data-views-cell', (e) => {
      const t = e.detail;
      if (!t || !String(t.view || '').startsWith('Gates') || t.row.path[0] !== 'Admissible') return; // the spec's: the stock peek
      e.preventDefault();
      const col = this.gpKey(t.column.key);
      if (!col) return;
      Object.assign(this.tl, { col, gate: t.row.path[1] || null, sel: true, play: null });
      this.tl.open.clear();
      views.picked = t.ids;
      this.paint();
    });
    // a bar or a header of the ruler's matrix: the section as of that column (again: back to now)
    views.addEventListener('data-views-column', (e) => {
      const t = e.detail;
      if (!t || !String(t.view || '').startsWith('Gates')) return;
      e.preventDefault();
      const col = this.gpKey(t.column.key);
      if (!col || (this.tl.sel && this.tl.col === col && !this.tl.gate)) { this.backToNow(); return; }
      Object.assign(this.tl, { col, gate: null, sel: true, play: null });
      this.tl.open.clear();
      views.picked = this.columnIds(views, t.column.key);
      this.paint();
    });
    // the reader switched x (the matrix's own buttons): the sentence reads the newest column of the new axis
    views.addEventListener('data-views-change', (e) => {
      const v = e.detail && e.detail.view;
      const x = v && v.type === 'tracker' && String(v.name || '').startsWith('Gates') ? AXIS_X[(v.tracker || {}).x || 'iteration'] : null;
      if (!x || x === this.tl.x) return;
      Object.assign(this.tl, { x, col: null, gate: null, sel: false, play: null });
      this.tl.open.clear();
      views.picked = [];
      this.paint();
    });
    views.addEventListener('data-views-render', () => { this.dataset.drew = mode; }, { once: true });
    this.views = views;
    host.replaceChildren(views);
  }

  /** The column of bb-gate-matrix's model that a matrix column key names (both draw the same columns: #n, a commit, a day). */
  gpKey(key) {
    const k = String(key);
    const c = timelineOf(this.data, this.tl.x, { ablations: this.tl.abl }).cols.find((x) => String(x.x) === k);
    return c ? c.key : null;
  }

  /** The rows a ruler column stands on: every node's row of the column's leading solution (what the matrix draws there). */
  columnIds(views, key) {
    const rows = (views.data && views.data.rows) || [];
    const x = X_AXIS[this.tl.x] || 'iteration';
    const inCol = (r) => (x === 'iteration' ? (r.iteration || []).includes(String(key)) : x === 'commit' ? r.commit === String(key) : String(r.committed || '').slice(0, 10) === String(key));
    const mine = rows.filter((r) => r.kind === 'ruler' && inCol(r));
    const lead = mine.reduce((m, r) => (m === null || r.rank < m ? r.rank : m), null);
    return mine.filter((r) => r.rank === lead).map((r) => r.id);
  }

  backToNow() {
    Object.assign(this.tl, { col: null, gate: null, sel: false, play: null });
    this.tl.open.clear();
    if (this.views) this.views.picked = [];
    this.paint();
  }

  /** A box with gates but no scored solution: nothing passes, nothing fails (not run is never green). */
  paintNone() {
    const gates = this.data.gates || [];
    this.querySelector('.bbg-top').innerHTML = `<div class="bbg-verdict" data-tone="warn"><span class="g">!</span>No gates judged yet</div>
      <div class="bbg-none">This box declares ${plural(gates.length, 'gate')} but has no scored solution: nothing passes and nothing fails (not run is never shown as green). The first scored solution fills this in.
      <ul>${gates.map((g) => `<li><code>${esc(g.id)}</code>${g.pass_when ? `: ${esc(g.pass_when)}` : ''}</li>`).join('')}</ul></div>`;
  }

  /** The sentence, the red line, the problems and the OK fold as of the chosen column; the cell's why under the matrix. */
  paint() {
    const d = this.data;
    const tl = this.tl;
    const v = timelineView(d, { x: tl.x, key: tl.col, ablations: tl.abl });
    if (v.empty) { this.paintNone(); return; }
    const c = v.column;
    const sol = c.lead;
    const names = v.sentence.names.map((n) => `<span class="nm">${esc(n)}</span>`).join(', ');
    const verdict = v.problems.length ? `${esc(v.sentence.lead)}: ${names}${v.sentence.more ? ` +${v.sentence.more}` : ''}` : esc(v.sentence.text);
    const who = `${sol.n !== null && v.t.x !== 'iteration' ? `${esc(sol.id)} (#${sol.n})` : esc(sol.id)}${c.n > 1 ? ` <span class="bb-muted">(the leader of ${c.n})</span>` : ''}`;
    const where = v.isNow ? `now: <b>${esc(c.x)}</b> · ${who}` : `as of <b>${esc(c.x)}</b> · ${who} · <button type="button" class="linkish" data-now>back to now ▸</button>`;
    const redCount = v.base.red.length;
    const red = esc(v.red).replace(/^red in (\d+ of \d+)/, (_, n) => `red in <b class="red">${n}</b>`);
    const top = this.querySelector('.bbg-top');
    top.innerHTML = `<div class="bbg-verdict" data-tone="${v.sentence.tone}" data-verdict><span class="g" aria-hidden="true">${v.sentence.glyph}</span>${verdict}</div>
      <div class="bbg-where">${where}</div>
      <div class="bbg-red" data-red="${redCount}">${red} · click a cell for why</div>`;
    const list = this.querySelector('.bbg-list') || top;
    list.innerHTML = `<div class="bbg-dx" role="list" aria-label="Gates as of ${esc(c.x)}">${v.problems.map((g) => this.row(d, v, g)).join('')}${v.ok.length ? this.okFold(d, v) : ''}${v.unknown.length ? `<div class="dx-more">${plural(v.unknown.length, 'gate')} not recorded for ${esc(sol.id)}: ${v.unknown.map((g) => `<code>${esc(g.id)}</code>`).join(', ')}</div>` : ''}</div>`;
    top.querySelector('[data-now]')?.addEventListener('click', () => this.backToNow());
    list.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', () => {
      const id = b.dataset.toggle;
      if (tl.open.has(id)) tl.open.delete(id); else tl.open.add(id);
      this.paint();
    }));
    list.querySelector('[data-okfold]')?.addEventListener('click', () => { tl.okOpen = !tl.okOpen; this.paint(); });
    const why = this.querySelector('.bbg-why-cell');
    why.innerHTML = tl.sel ? this.whyHtml(whyOf(d, v.t, v.at, tl.gate), { close: true, where: 'cell' }) : '';
    why.querySelector('[data-close]')?.addEventListener('click', () => top.querySelector('[data-now]')?.click());
    this.wireWhy(this);
  }

  /** One gate's line in the problems list (or the OK fold), and its why when open. */
  row(d, v, g, sub = false) {
    const open = this.tl.open.has(g.id);
    const why = open ? this.whyHtml(whyOf(d, v.t, v.at, g.id)) : '';
    return `<div class="dx-row" role="listitem" data-gate="${esc(g.id)}" data-state="${g.state}"><button type="button" class="dx-name" data-toggle="${esc(g.id)}" aria-expanded="${open}">
      <span class="chev" aria-hidden="true">›</span><span class="nm">${esc(g.id)}</span><span class="msg">${esc(messageOf(g))}</span></button>
      <span class="pill${g.state === 'fail' ? ' fail' : ''}">${g.state === 'fail' ? 'FAIL' : g.state === 'pass' ? 'OK' : '—'}</span></div>${why}`;
  }

  okFold(d, v) {
    const open = this.tl.okOpen;
    const n = v.ok.length;
    return `<div class="dx-ok" data-ok="${n}"><button type="button" class="dx-name" data-okfold aria-expanded="${open}"><span class="chev" aria-hidden="true">›</span>
      <span class="nm">✓ ${n} OK</span><span class="msg">· ${n === 1 ? 'passes' : 'all pass'} at ${esc(v.column.x)}</span></button><span class="pill">OK</span></div>
      ${open ? `<div class="dx-sub">${v.ok.map((g) => this.row(d, v, g, true)).join('')}</div>` : ''}`;
  }

  /** The why card: a cell (a gate at a column) or a whole column. */
  whyHtml(w, { close = false, where = 'list' } = {}) {
    if (!w) return '';
    const x = close ? '<button type="button" class="x" data-close title="Close: back to now" aria-label="Close">✕</button>' : '';
    const openIt = `<a href="${esc(this.context.href('solution', { id: w.sol }))}" class="openit" data-open-sol="${esc(w.sol)}">open ${esc(w.sol)} ▸</a>`;
    if (w.kind === 'column') {
      const head = w.problems.length ? `<span class="st fail">✗ fail</span> ${esc(w.sol)} fails ${w.problems.length} of ${w.gates} gates${w.admissible ? '' : ': not admissible'}`
        : `<span class="st pass">✓ pass</span> ${esc(w.sol)} passes all ${w.gates} gates`;
      return `<div class="bbg-why" data-why="column@${esc(w.label)}" data-state="${w.problems.length ? 'fail' : 'pass'}"><h4>${head}${x}</h4>
        <div class="sub">${esc(w.sol)} · ${esc(w.where || w.label)} · ${openIt}</div>
        ${w.problems.length ? `<ol>${w.problems.map((p) => `<li><b class="bb-mono">${esc(p.id)}</b>: ${esc(p.line)}</li>`).join('')}</ol>` : ''}
        ${w.colnote ? `<div class="colnote">${esc(w.colnote)}</div>` : ''}</div>`;
    }
    const [glyph, word] = STATE[w.state];
    const u = w.unit;
    const nums = [];
    nums.push(['Limit', w.limit]);
    if (w.worst !== null && typeof w.worst === 'number') nums.push([`Worst${w.worst_task ? ` (${w.worst_task})` : ''}`, fmt(w.worst, u)]);
    if (w.margin !== null) nums.push(['Margin', w.margin >= 0 ? `${fmt(w.margin, u)} to spare` : `${fmt(-w.margin, u)} over`, w.margin < 0]);
    if (w.failed_tasks !== null) nums.push(['Failing tasks', w.tasks ? `${w.failed_tasks} of ${w.tasks}` : String(w.failed_tasks)]);
    const steps = [];
    if (w.failed && w.failed.length) {
      steps.push(`<b>Which tasks fail it</b> (${w.failed.length}):<div class="chips">${w.failed.map((f) => {
        const val = typeof f.value === 'number' ? ` · ${fmt(f.value, u)}` : '';
        return `<span class="chip" title="${esc([f.task, f.note && `the ruler: ${f.note}`].filter(Boolean).join('\n'))}">${esc(f.task)}${esc(val)}</span>`;
      }).join('')}</div>`);
      const noted = w.failed.find((f) => f.note);
      if (noted) steps.push(`<b>What the ruler says</b> on <span class="bb-mono">${esc(noted.task)}</span>: ${esc(noted.note)}`);
      if (w.moments && w.moments.length) {
        const any = w.moments.some((m) => m.play.length);
        steps.push(`<b>The moment in the run</b>:${w.moments.slice(0, 4).map((m) => {
          const rec = m.play[0];
          const on = this.playing(rec?.path, w.gate, where);
          return `<div class="run"><span class="task">${esc(m.task)}</span>${rec ? ` <button type="button" class="play" data-play="${esc(rec.path)}" data-gate="${esc(w.gate)}" data-where="${where}" aria-pressed="${on}">▸ play it</button>` : ''} · ${esc(momentText(m))}</div>`;
        }).join('')}${w.moments.length > 4 ? `<div class="run muted">+${w.moments.length - 4} more saved runs</div>` : ''}${any ? '' : '<div class="run muted">The box saved these runs; this state lists no run record to play them here.</div>'}`);
      } else if (w.moments) steps.push(`<b>The moment in the run</b>: <span class="muted">the box saved no run of ${w.failed.length === 1 ? 'this task' : 'these tasks'}</span>`);
      else steps.push('<b>The moment in the run</b>: <span class="muted">this box saved no runs at this ref</span>');
    } else if (w.state === 'fail' && !w.failed) {
      steps.push(`<span class="muted">${esc(w.why_null || 'the box names no failing task')}</span>`);
    } else if (w.state === 'pass' && w.worst_task && typeof w.worst === 'number') {
      steps.push(`Closest to the limit: <span class="bb-mono">${esc(w.worst_task)}</span> at ${esc(fmt(w.worst, u))}`);
    } else if (w.why_null) steps.push(`<span class="muted">${esc(w.why_null)}</span>`);
    if (w.rule.pass_when || w.rule.why) steps.push(`<b>The gate</b> (OBJECTIVES.md): ${esc(w.rule.pass_when || w.limit)}${w.rule.why ? ` <span class="muted">· why: ${esc(w.rule.why)}</span>` : ''}`);
    const play = w.moments?.some((m) => m.play.some((r) => this.playing(r.path, w.gate, where))) ? '<div class="bbg-play" data-player></div>' : '';
    return `<div class="bbg-why" data-why="${esc(w.gate)}@${esc(w.label)}" data-state="${w.state}"><h4><span class="st ${w.state === 'none' ? '' : w.state}">${glyph} ${word}</span> ${esc(w.title)}${x}</h4>
      <div class="sub">${esc(w.sol)} · ${esc(w.where)} · ${esc(w.since)} · ${openIt}</div>
      <div class="nums">${nums.map(([k, val, over]) => `<div><b${over ? ' class="over"' : ''}>${esc(val)}</b><span>${esc(k)}</span></div>`).join('')}</div>
      ${steps.length ? `<ol>${steps.map((x2) => `<li>${x2}</li>`).join('')}</ol>` : ''}
      ${w.colnote ? `<div class="colnote">${esc(w.colnote)}</div>` : ''}${play}</div>`;
  }

  /** Is this saved run playing in this why card (the cell's, under the matrix, or a list row's)? */
  playing(path, gate, where) {
    const p = this.tl?.play;
    return !!(p && path && p.path === path && p.gate === gate && p.where === where);
  }

  /** The why cards' links: open the solution (bb-open), play a saved run (the stock bb-evidence, in place). */
  wireWhy(root) {
    root.querySelectorAll('[data-open-sol]').forEach((a) => {
      if (a.dataset.wired) return;
      a.dataset.wired = '1';
      a.addEventListener('click', (e) => { e.preventDefault(); this.context.open(this, { kind: 'solution', id: a.dataset.openSol, href: this.context.href('solution', { id: a.dataset.openSol }) }); });
    });
    root.querySelectorAll('[data-play]').forEach((b) => {
      if (b.dataset.wired) return;
      b.dataset.wired = '1';
      b.addEventListener('click', () => {
        const { play: path, gate, where } = b.dataset;
        this.tl.play = this.playing(path, gate, where) ? null : { path, gate, where };
        this.paint();
      });
    });
    root.querySelectorAll('[data-player]').forEach((host) => {
      if (host.firstChild) return;
      // the stock player, set the way bb-page sets a section: settings, context, then this element's state (it keeps
      // only `playback`, its own reads); it loads the record through context.load, which refuses an unlisted path
      const ev = document.createElement('bb-evidence');
      ev.settings = { run: this.tl.play.path, metric: this.tl.play.gate, picker: false, height: 480 };
      ev.context = this.context;
      ev.state = this.data;
      host.append(ev);
    });
  }

  /** Today's tiles, unchanged (layout: cards | rows). */
  tiles(gates) {
    const s = this.settings;
    return `<div class="bbg ${s.layout === 'rows' ? 'rows' : ''}">${gates.map((g) => {
        const state = g.passed === true ? '<span class="ok">✓</span> passes' : g.passed === false ? `✗ fails${g.failed_tasks ? ` on ${g.failed_tasks}${g.tasks ? ` of ${g.tasks}` : ''} task${g.failed_tasks === 1 ? '' : 's'}` : ''}` : 'not judged';
        return `<div class="gate${g.passed === false ? ' fail' : ''}"><div><div class="gname">${esc(g.id)}</div>
          <div class="state${g.passed === null || g.passed === undefined ? ' open' : ''}">${state}${g.passed === true && g.tasks ? ` <span class="bb-muted">(${g.tasks} tasks)</span>` : ''}</div></div>
          <div>${g.passed === null || g.passed === undefined ? '' : this.margin(g)}
          ${g.pass_when ? `<div class="when">${esc(g.pass_when)}</div>` : ''}${s.show_why && g.why ? `<div class="why">why: ${esc(g.why)}</div>` : ''}</div></div>`;
      }).join('')}</div>`;
  }
}
register(BBGates);
