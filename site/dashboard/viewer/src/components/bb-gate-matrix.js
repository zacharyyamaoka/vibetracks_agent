/* <bb-gate-matrix>: the gate history (viewer/CONTRACT.md §5.2, §16.6), the box's gates × time. Rows are the gates
   (OBJECTIVES.md's gate table, the `gates` slice's order); columns are each iteration, each commit or each day; a cell
   is pass, or the number of tasks that solution failed the gate on. Where a commit or a day holds several solutions the
   column shows the leading one and its header says "leading <id> of <N>"; a red corner marks a gate another solution
   in the column failed, so no failure hides behind a passing leader. Hover a cell: the solution, verdict, objective
   and failed gates; click a column: bb-open that solution.

   click: select (CONTRACT §16.7) turns a click into a choice instead: the cell (or a header's whole column) is selected,
   outlined, and announced as bb-gate-select {x, key, index, gate, lead, members}; bb-gates' timeline view hosts the
   matrix that way and answers with why the cell is red. A reader control (x, the two toggles) announces bb-gate-view
   {x, only_failing, ablations}.

   Drawn as a compact grid of our own (default) because data-ui's tracker matrix (CONTRACT §35 gate_matrix, the stock
   part) draws a glyph per cell, not a count, and opens its own side peek rather than the solution: `draw: tracker`
   keeps that stock look over the same columns for a page that prefers it. Calm (RobotDx's roll-up): a pass is a quiet
   grey-green, only a failure is red. The rules live in bb-gate-matrix.model.js (pure, tested in Node). */
import { BBElement, esc, fmtNum } from '../core/element.js';
import { register } from '../core/registry.js';
import { loadViews } from '../core/kit.js';
import schema from './bb-gate-matrix.schema.js';
import { X_AXES, buildMatrix, emptyOf } from './bb-gate-matrix.model.js';

const VERDICT = { kept: 'kept (a new best)', discarded: 'discarded (no better)', failed: 'failed (not admissible)', ablation: 'ablation run' };
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
let uid = 0;

export class BBGateMatrix extends BBElement {
  static schema = schema;
  static css = `
bb-gate-matrix .bbm-head { display: flex; gap: 4px 10px; align-items: baseline; flex-wrap: wrap; margin: 0 0 6px; }
bb-gate-matrix .bbm-head h3 { margin: 0; font-size: 16px; }
bb-gate-matrix .bbm-head .sum { color: var(--bb-muted); font-size: 13px; }
bb-gate-matrix .bbm-bar { display: flex; gap: 6px 14px; align-items: center; flex-wrap: wrap; margin: 0 0 8px; font-size: 12.5px; color: var(--bb-muted); }
bb-gate-matrix .seg { display: inline-flex; border: 1px solid var(--bb-border); border-radius: 9px; overflow: hidden; background: var(--bb-card); }
bb-gate-matrix .seg button { border: 0; background: transparent; color: var(--bb-muted); font: inherit; font-size: 12.5px; padding: 5px 10px; cursor: pointer; white-space: nowrap; }
bb-gate-matrix .seg button + button { border-left: 1px solid var(--bb-border); }
bb-gate-matrix .seg button[aria-pressed="true"] { background: var(--bb-subtle); color: var(--bb-fg); font-weight: 600; }
bb-gate-matrix .bbm-bar label { display: inline-flex; gap: 6px; align-items: center; cursor: pointer; }
bb-gate-matrix .bbm-bar input { margin: 0; accent-color: var(--bb-fg); }
bb-gate-matrix .bbm-bar b { color: var(--bb-fg); font-weight: 600; }
bb-gate-matrix .bbm-note { margin: 0 0 8px; font-size: 12.5px; color: var(--bb-muted); line-height: 1.45; }
bb-gate-matrix .bbm-note b { color: var(--bb-fg); font-weight: 600; }
bb-gate-matrix .bbm-scroll { container-type: inline-size; overflow-x: auto; max-width: 100%; border: 1px solid var(--bb-border); border-radius: calc(var(--bb-radius) + 4px); background: var(--bb-card); }
bb-gate-matrix .bbm-grid { display: grid; grid-template-columns: max(104px, min(250px, 32cqw)) repeat(var(--cols), var(--cw, minmax(26px, max-content)));
  gap: 3px; padding: 8px 10px 8px 0; width: max-content; min-width: 100%; }
bb-gate-matrix .bbm-grid.wide { --cw: minmax(92px, 170px); }
bb-gate-matrix .corner, bb-gate-matrix .rh { position: sticky; left: 0; z-index: 2; background: var(--bb-card); padding: 0 10px; min-width: 0; }
bb-gate-matrix .corner { align-self: end; font-size: 11.5px; color: var(--bb-muted); padding-bottom: 4px; }
bb-gate-matrix .col { align-self: end; justify-self: center; border: 0; background: transparent; color: var(--bb-fg); font: inherit; font-size: 11.5px; cursor: pointer;
  padding: 2px 0; border-radius: 6px; max-width: 100%; }
bb-gate-matrix .col .t { display: block; writing-mode: vertical-rl; transform: rotate(180deg); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-height: 150px; line-height: 1.25; }
bb-gate-matrix .col .t b { font-weight: 600; font-family: var(--bb-mono); font-size: 11px; }
bb-gate-matrix .col .t .ld { color: var(--bb-muted); }
bb-gate-matrix .col.multi .t .ld { color: var(--bb-fg); }
bb-gate-matrix .col.abl .t { font-style: italic; color: var(--bb-muted); }
bb-gate-matrix .bbm-grid.wide .col { justify-self: stretch; text-align: left; padding: 2px 4px; }
bb-gate-matrix .bbm-grid.wide .col .t { writing-mode: horizontal-tb; transform: none; white-space: normal; max-height: none; overflow-wrap: anywhere; }
bb-gate-matrix .bbm-grid.wide .col .t b, bb-gate-matrix .bbm-grid.wide .col .t .ld { display: block; }
bb-gate-matrix .col:hover, bb-gate-matrix .col.hot { background: var(--bb-subtle); }
bb-gate-matrix .col:focus-visible { outline: 2px solid var(--bb-accent); outline-offset: 1px; }
bb-gate-matrix .rh { display: flex; flex-direction: column; justify-content: center; min-height: 28px; border-right: 1px solid var(--bb-rule); }
bb-gate-matrix .rh .g { display: flex; gap: 6px; align-items: baseline; min-width: 0; }
bb-gate-matrix .rh .id { font-family: var(--bb-mono); font-size: 12px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
bb-gate-matrix .rh .nf { flex: none; margin-left: auto; font-size: 11px; color: var(--bb-bad); font-variant-numeric: tabular-nums; }
bb-gate-matrix .rh .pw { font-size: 11px; color: var(--bb-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
bb-gate-matrix .rh .pw.undeclared { font-style: italic; }
bb-gate-matrix .cell { position: relative; min-height: 28px; border-radius: 5px; display: flex; align-items: center; justify-content: center; cursor: pointer;
  font-size: 11.5px; font-variant-numeric: tabular-nums; border: 1px solid transparent; }
bb-gate-matrix .cell.pass { background: color-mix(in srgb, var(--bb-good) 10%, var(--bb-card)); color: color-mix(in srgb, var(--bb-good) 55%, var(--bb-muted)); font-size: 10px; }
bb-gate-matrix .cell.fail { background: color-mix(in srgb, var(--bb-bad) 15%, var(--bb-card)); border-color: color-mix(in srgb, var(--bb-bad) 55%, transparent); color: var(--bb-bad); font-weight: 700; }
bb-gate-matrix .cell.none { border: 1px dashed var(--bb-border); color: var(--bb-muted); }
bb-gate-matrix .cell.others::after { content: ""; position: absolute; top: -1px; right: -1px; border-style: solid; border-width: 0 7px 7px 0;
  border-color: transparent var(--bb-bad) transparent transparent; border-top-right-radius: 5px; }
bb-gate-matrix .cell.hot { box-shadow: inset 0 0 0 1.5px var(--bb-fg); }
bb-gate-matrix .cell.sel { outline: 2px solid var(--bb-accent); outline-offset: 1px; z-index: 1; }
bb-gate-matrix .col.sel { background: var(--bb-subtle); box-shadow: inset 0 -2px 0 var(--bb-accent); }
bb-gate-matrix .cell:focus-visible { outline: 2px solid var(--bb-accent); outline-offset: 1px; }
bb-gate-matrix .bbm-legend { display: flex; gap: 4px 14px; flex-wrap: wrap; font-size: 12px; color: var(--bb-muted); margin-top: 8px; align-items: center; }
bb-gate-matrix .bbm-legend > span { display: inline-flex; gap: 6px; align-items: center; }
bb-gate-matrix .bbm-legend .cell { width: 26px; min-height: 18px; height: 18px; cursor: default; font-style: normal; }
bb-gate-matrix .bbm-legend .hint { color: var(--bb-faint); }
bb-gate-matrix .bbm-tip { position: fixed; z-index: 50; max-width: min(380px, calc(100vw - 16px)); background: var(--bb-card); color: var(--bb-fg);
  border: 1px solid var(--bb-border); border-radius: 10px; padding: 8px 10px; font-size: 12.5px; line-height: 1.45; box-shadow: 0 6px 24px rgba(0,0,0,.14); pointer-events: none; }
bb-gate-matrix .bbm-tip .k { color: var(--bb-muted); }
bb-gate-matrix .bbm-tip .tag { display: inline-block; font-size: 11px; border-radius: 6px; padding: 0 5px; margin-left: 6px; border: 1px solid var(--bb-border); color: var(--bb-muted); }
bb-gate-matrix .bbm-tip .tag.no { border-color: var(--bb-bad); color: var(--bb-bad); }
bb-gate-matrix .bbm-tip .bad { color: var(--bb-bad); }
bb-gate-matrix .bbm-tip ul { margin: 2px 0 0; padding-left: 16px; }
bb-gate-matrix .bbm-tip .go { color: var(--bb-accent); margin-top: 3px; }
bb-gate-matrix .bbm-tip .cl { margin-top: 4px; padding-top: 4px; border-top: 1px solid var(--bb-rule); }
bb-gate-matrix .bbm-tracker data-views { display: block; }
`;

  constructor() { super(); this.ui = null; this.m = null; }

  teardown() { this.hideTip(); }

  render() {
    const s = this.settings;
    // the reader's x and toggles are kept until page.json changes the settings they started from
    const key = `${s.x}|${s.only_failing}|${s.ablations}`;
    if (!this.ui || this.ui.key !== key) this.ui = { key, x: s.x, only: s.only_failing, abl: s.ablations, sel: null };
    return this.draw();
  }

  /** bb-open {kind: 'solution', id}; the context follows links.solution unless a listener prevented it. */
  open(id) { return this.context.open(this, { kind: 'solution', id, href: this.context.href('solution', { id }) }); }

  /** click: select. The reader's selection {key, gate} (gate null = the whole column), kept across redraws while its
      column is drawn; announced as bb-gate-select. `null` clears it. */
  get selection() { return this.ui?.sel || null; }

  select(sel, { quiet = false } = {}) {
    if (!this.ui) return;
    const cols = this.m?.columns || [];
    const i = sel ? cols.findIndex((c) => c.key === sel.key) : -1;
    this.ui.sel = i >= 0 ? { key: sel.key, gate: sel.gate ?? null } : null;
    this.mark();
    if (quiet) return;
    const c = cols[i];
    this.dispatchEvent(new CustomEvent('bb-gate-select', { bubbles: true, composed: true, detail: c
      ? { x: this.m.x, key: c.key, index: i, gate: this.ui.sel.gate, label: c.x, lead: c.lead.id, members: c.members.map((m) => m.id), n: c.n, ablations: this.ui.abl }
      : { x: this.m?.x || this.ui.x, key: null, index: -1, gate: null, ablations: this.ui.abl } }));
  }

  /** bb-gate-view {x, only_failing, ablations}: the reader changed a control (a host follows x and the ablation runs). */
  announce() {
    this.dispatchEvent(new CustomEvent('bb-gate-view', { bubbles: true, composed: true, detail: { x: this.ui.x, only_failing: this.ui.only, ablations: this.ui.abl } }));
  }

  /** Outline the selected cell (or column) in the drawn grid. */
  mark() {
    this.querySelectorAll('.sel').forEach((e) => { e.classList.remove('sel'); e.removeAttribute('aria-selected'); });
    const sel = this.ui?.sel;
    if (!sel) return;
    const i = (this.m?.columns || []).findIndex((c) => c.key === sel.key);
    if (i < 0) return;
    const els = sel.gate ? [...this.querySelectorAll(`.bbm-grid .cell[data-c="${i}"]`)].filter((e) => e.dataset.gate === sel.gate)
      : [...this.querySelectorAll(`.bbm-grid .col[data-c="${i}"]`)];
    els.forEach((e) => { e.classList.add('sel'); e.setAttribute('aria-selected', 'true'); });
  }

  /** "4a924f8 · leading p6s of 9" (the column's x, then the solution it shows). */
  colText(c) { return `${c.x} · ${c.label}`; }

  async draw() {
    const s = this.settings;
    const d = this.data;
    const token = (this._token = (this._token || 0) + 1);
    const m = this.m = buildMatrix(d, { x: this.ui.x, only_failing: this.ui.only, limit: s.limit, ablations: this.ui.abl });
    const nAbl = (d.ablations || []).length;
    const empty = emptyOf(d, m, { only_failing: this.ui.only });
    // the empty sentence keeps the reader's controls when a control produced it ("only failing" on a box that never failed)
    if (empty && (!s.controls || !(d.iterations || []).length || !m.gates.length)) { this.dataset.drew = 'empty'; return this.empty(empty.text, esc(empty.hint)); }
    // WHY load data-ui before drawing anything (draw: tracker): the element stays empty until the matrix can draw at once
    const core = !empty && s.draw === 'tracker' ? await loadViews() : null;
    if (token !== this._token) return; // the reader changed x or a toggle meanwhile
    const o = d.objective || {};
    const fails = m.failing;
    const sum = `${plural(m.gates.length, 'gate')} × ${plural(m.iterations, 'iteration')}${m.ablationRuns ? ` + ${plural(m.ablationRuns, 'ablation run')}` : ''} · `
      + (fails.length ? `<span>${plural(fails.length, 'solution')} failed a gate: <span class="bb-mono">${esc(fails.slice(0, 6).join(', '))}${fails.length > 6 ? ` +${fails.length - 6}` : ''}</span></span>` : 'every gate passed on every solution');
    const best = `${o.direction === 'higher' ? 'highest' : 'lowest'} ${esc(o.name || 'objective')}`;
    const notes = [];
    if (m.from === 'records') notes.push('This box has no gate table in its state (no gates slice): the rows are the gate names its solutions\' records carry, so a gate that was never recorded is not listed.');
    if (m.x !== 'iteration' && m.multi) notes.push(`<b>${plural(m.multi, m.x === 'commit' ? 'commit holds' : 'day holds', m.x === 'commit' ? 'commits hold' : 'days hold')} several solutions</b>: each such column shows its <b>leading</b> one (search solutions before ablation runs, admissible first, then the ${best}); ${s.draw === 'tracker' ? 'an amber "!" marks' : 'a red corner marks'} a gate another solution in the column failed.`);
    if (m.filtered) notes.push(`Only the ${plural(m.kept, 'column')} where a gate failed (${m.filtered} all-pass ${m.filtered === 1 ? 'column' : 'columns'} left out).`);
    if (m.hidden) notes.push(`<b>${plural(m.hidden, 'older column')} hidden</b>: the newest ${s.limit} are shown.`);
    const controls = s.controls ? `<div class="bbm-bar"><span>x <span class="seg" role="group" aria-label="columns (x)">${X_AXES.map((a) => `<button data-x="${a.id}" aria-pressed="${a.id === this.ui.x}" title="${esc(a.long)}">${esc(a.label)}</button>`).join('')}</span></span>
      <label title="Keep a column when any of its solutions failed a gate"><input type="checkbox" data-only ${this.ui.only ? 'checked' : ''}><span>Only where a gate failed</span></label>
      ${nAbl ? `<label title="Ablation runs remove or add one part of the best solution to measure what it is worth: study variants, not search steps"><input type="checkbox" data-abl ${this.ui.abl ? 'checked' : ''}><span>Show the <b>${nAbl}</b> ablation run${nAbl === 1 ? '' : 's'}</span></label>` : ''}</div>` : '';
    const body = empty ? `<div class="bb-empty" data-empty="bb-gate-matrix"><b>${esc(empty.text)}</b>${empty.hint ? `<div style="margin-top:4px">${esc(empty.hint)}</div>` : ''}</div>`
      : s.draw === 'tracker' ? `<div class="bbm-tracker"></div>` : this.grid(m);
    this.innerHTML = `<div class="bbm" data-x="${esc(m.x)}">
      <div class="bbm-head"><h3>${esc(s.title)}</h3><span class="sum">${sum}</span></div>
      ${controls}${notes.length && !empty ? `<p class="bbm-note">${notes.join(' ')}</p>` : ''}
      ${body}
      ${empty || s.draw === 'tracker' ? '' : this.legend()}
      <div class="bbm-tip" hidden></div></div>`;
    this.wire();
    if (core) this.tracker(m, core);
    else this.dataset.drew = empty ? 'empty' : 'grid';
    // the selection survives a redraw (a toggle) while its column is still drawn; otherwise it lets go, and says so
    if (this.ui.sel && !m.columns.some((c) => c.key === this.ui.sel.key)) this.select(null);
    else this.mark();
  }

  grid(m) {
    const wide = m.columns.length <= 8;
    const heads = m.columns.map((c, i) => {
      const abl = c.lead.ablation && c.n === 1;
      const t = `<b>${esc(c.x)}</b> <span class="ld">${esc(c.label)}</span>`;
      return `<button class="col${c.n > 1 ? ' multi' : ''}${abl ? ' abl' : ''}" role="columnheader" data-c="${i}" data-col="${esc(c.key)}" data-lead="${esc(c.lead.id)}" data-n="${c.n}"
        aria-label="${esc(`${this.colText(c)}: ${this.settings.click === 'select' ? 'select this column' : `open ${c.lead.id}`}`)}"><span class="t">${t}</span></button>`;
    }).join('');
    const rows = m.gates.map((g) => {
      const nf = m.perGate[g.id].length;
      const rh = `<div class="rh" role="rowheader" title="${esc([g.id, g.pass_when && `pass when: ${g.pass_when}`, g.why && `why: ${g.why}`, nf ? `${plural(nf, 'solution')} failed it: ${m.perGate[g.id].join(', ')}` : ''].filter(Boolean).join('\n'))}">
        <div class="g"><span class="id">${esc(g.id)}</span>${nf ? `<span class="nf" title="${esc(`${plural(nf, 'solution')} failed it`)}">✕ ${nf}</span>` : ''}</div>
        ${g.declared ? (g.pass_when ? `<div class="pw">${esc(g.pass_when)}</div>` : '') : '<div class="pw undeclared">recorded, not in the gate table</div>'}</div>`;
      const cells = m.columns.map((c, i) => {
        const cell = c.cells.find((x) => x.gate === g.id);
        const txt = cell.state === 'fail' ? (cell.tasks === null ? '✕' : String(cell.tasks)) : cell.state === 'pass' ? '✓' : '–';
        const word = cell.state === 'fail' ? `failed${cell.tasks === null ? '' : ` on ${plural(cell.tasks, 'task')}`}` : cell.state === 'pass' ? 'passed' : 'not recorded';
        const others = cell.others.length ? `; ${plural(cell.others.length, 'other solution')} in this column failed it` : '';
        return `<div class="cell ${cell.state}${cell.others.length ? ' others' : ''}" role="cell" data-c="${i}" data-gate="${esc(g.id)}" data-state="${cell.state}"${cell.tasks ? ` data-tasks="${cell.tasks}"` : ''}${cell.others.length ? ` data-others="${cell.others.length}"` : ''}${this.settings.click === 'select' ? ' tabindex="0"' : ''}
          aria-label="${esc(`${g.id} · ${this.colText(c)}: ${c.lead.id} ${word}${others}`)}">${txt}</div>`;
      }).join('');
      return `<div class="rh-row" role="row" style="display:contents">${rh}${cells}</div>`;
    }).join('');
    return `<div class="bbm-scroll"><div class="bbm-grid${wide ? ' wide' : ''}" role="table" aria-label="${esc(`gates × ${m.x}`)}" style="--cols:${m.columns.length}">
      <div role="row" style="display:contents"><div class="corner" role="columnheader">gate · ${esc(m.x === 'iteration' ? 'solution' : m.x)} →</div>${heads}</div>${rows}</div></div>`;
  }

  legend() {
    return `<div class="bbm-legend"><span><i class="cell pass">✓</i> passed</span><span><i class="cell fail">12</i> failed on 12 tasks</span>
      <span><i class="cell pass others">✓</i> another solution in the column failed it</span><span><i class="cell none">–</i> not recorded</span>
      <span class="hint">hover a cell to read it · ${this.settings.click === 'select' ? 'click a cell for why it is red' : 'click a column to open its solution'}</span></div>`;
  }

  wire() {
    this.querySelectorAll('[data-x]').forEach((b) => { if (b.tagName === 'BUTTON') b.addEventListener('click', () => {
      if (this.ui.x === b.dataset.x) return;
      this.ui.x = b.dataset.x;
      this.ui.sel = null;
      this.hideTip();
      this.draw();
      this.announce();
    }); });
    this.querySelector('[data-only]')?.addEventListener('change', (e) => { this.ui.only = e.target.checked; this.hideTip(); this.draw().then(() => this.announce()); });
    this.querySelector('[data-abl]')?.addEventListener('change', (e) => { this.ui.abl = e.target.checked; this.hideTip(); this.draw().then(() => this.announce()); });
    const grid = this.querySelector('.bbm-grid');
    if (!grid) return;
    const target = (e) => e.target.closest?.('.cell[data-c], .col[data-c]');
    grid.addEventListener('pointerover', (e) => { const t = target(e); if (t) this.showTip(t); });
    grid.addEventListener('pointerleave', () => this.hideTip());
    grid.addEventListener('focusin', (e) => { const t = target(e); if (t) this.showTip(t); });
    grid.addEventListener('focusout', () => this.hideTip());
    const pickCell = (t) => {
      const c = this.m.columns[Number(t.dataset.c)];
      if (!c) return;
      if (this.settings.click !== 'select') { this.open(c.lead.id); return; }
      const gate = t.dataset.gate || null;
      const cur = this.ui.sel;
      // a second click on the selected cell lets go of it
      this.select(cur && cur.key === c.key && cur.gate === gate ? null : { key: c.key, gate });
    };
    grid.addEventListener('click', (e) => { const t = target(e); if (t) pickCell(t); });
    grid.addEventListener('keydown', (e) => {
      const t = e.target.closest?.('.cell[data-c]');
      if (!t || (e.key !== 'Enter' && e.key !== ' ')) return;
      e.preventDefault();
      pickCell(t);
    });
    this.querySelector('.bbm-scroll')?.addEventListener('scroll', () => this.hideTip(), { passive: true });
  }

  hot(i) {
    this.querySelectorAll('.hot').forEach((e) => e.classList.remove('hot'));
    if (i !== null) this.querySelectorAll(`.bbm-grid [data-c="${i}"]`).forEach((e) => e.classList.add('hot'));
  }

  solLine(s) {
    const o = this.data.objective || {};
    const unit = o.unit ? ` ${o.unit}` : '';
    const failed = Object.entries(s.failed).filter(([, v]) => v > 0);
    return `<b class="bb-mono">${esc(s.id)}</b> · ${esc(VERDICT[s.verdict] || s.verdict || '')} · ${s.objective === null ? '—' : `${fmtNum(s.objective)}${esc(unit)}`}`
      + (failed.length ? ` · <span class="bad">${failed.map(([g, v]) => `${esc(g)} ${v}`).join(', ')}</span>` : '');
  }

  tipHtml(c, gate) {
    const s = c.lead;
    const o = this.data.objective || {};
    const unit = o.unit ? ` ${o.unit}` : '';
    const failed = Object.entries(s.failed).filter(([, v]) => v > 0);
    const where = [s.ablation ? 'ablation run' : s.n !== null ? `#${s.n}` : '', s.commit ? `commit ${String(s.commit.sha).slice(0, 7)}` : '', s.day ? `evaluated ${s.day}` : ''].filter(Boolean).join(' · ');
    const tag = s.verdict === 'failed' ? ' no' : '';
    let h = `<div><b class="bb-mono">${esc(s.id)}</b><span class="tag${tag}">${esc(VERDICT[s.verdict] || s.verdict || 'scored')}</span></div>
      <div><span class="k">${esc(o.name || 'objective')}</span> ${s.objective === null ? '—' : `<b>${fmtNum(s.objective)}${esc(unit)}</b>`} <span class="k">(${o.direction === 'higher' ? 'higher' : 'lower'} is better)${s.admissible ? '' : ' · not admissible'}</span></div>
      ${where ? `<div class="k">${esc(where)}</div>` : ''}
      <div>${failed.length ? `<span class="bad">Failed ${plural(failed.length, 'gate')}:</span> ${failed.map(([g, v]) => `${esc(g)} on ${plural(v, 'task')}`).join(', ')}`
        : `Passed ${c.cells.some((x) => x.state === 'none') ? 'every recorded gate' : 'every gate'}.`}</div>`;
    if (gate) {
      const cell = c.cells.find((x) => x.gate === gate);
      const g = this.m.gates.find((x) => x.id === gate);
      const word = cell.state === 'fail' ? `<span class="bad">failed${cell.tasks === null ? '' : ` on ${plural(cell.tasks, 'task')}`}</span>` : cell.state === 'pass' ? 'passed' : 'not recorded for this solution';
      h += `<div class="cl"><b class="bb-mono">${esc(gate)}</b>: ${word}${g?.pass_when ? `<div class="k">pass when: ${esc(g.pass_when)}</div>` : ''}
        ${cell.others.length ? `<div class="bad">Also failed by ${cell.others.map((x) => `${esc(x.id)}${x.tasks ? ` (${x.tasks})` : ''}`).join(', ')} in this column.</div>` : ''}</div>`;
    }
    if (c.n > 1) {
      const others = c.members.slice(1);
      h += `<div class="cl"><span class="k">Leading of ${c.n} in ${esc(c.kind === 'commit' ? `commit ${c.x}` : c.kind === 'date' ? c.x : 'this column')}: search solutions before ablation runs, admissible first, then the ${o.direction === 'higher' ? 'highest' : 'lowest'} ${esc(o.name || 'objective')}. The others:</span>
        <ul>${others.slice(0, 10).map((x) => `<li>${this.solLine(x)}</li>`).join('')}${others.length > 10 ? `<li class="k">+${others.length - 10} more</li>` : ''}</ul></div>`;
    }
    return `${h}<div class="go">${this.settings.click === 'select' ? (gate ? 'click: why' : 'click: this column') : `click: open ${esc(s.id)}`}</div>`;
  }

  showTip(el) {
    const i = Number(el.dataset.c);
    const c = this.m?.columns[i];
    const tip = this.querySelector('.bbm-tip');
    if (!c || !tip) return;
    this.hot(i);
    tip.innerHTML = this.tipHtml(c, el.dataset.gate || null);
    tip.hidden = false;
    const r = el.getBoundingClientRect();
    const w = tip.offsetWidth, h = tip.offsetHeight;
    const vw = document.documentElement.clientWidth, vh = window.innerHeight;
    let left = r.right + 8;
    if (left + w > vw - 8) left = r.left - w - 8;
    left = Math.max(8, Math.min(left, vw - w - 8));
    let top = r.top;
    if (top + h > vh - 8) top = vh - h - 8;
    tip.style.left = `${left}px`;
    tip.style.top = `${Math.max(8, top)}px`;
  }

  hideTip() {
    const tip = this.querySelector('.bbm-tip');
    if (tip) tip.hidden = true;
    this.hot(null);
  }

  /** draw: tracker — data-ui's stock gate matrix (tracker matrix mode) over one derived row per gate × column. */
  tracker(m, core) {
    const host = this.querySelector('.bbm-tracker');
    const o = this.data.objective || {};
    const unit = o.unit ? ` ${o.unit}` : '';
    const rows = [];
    m.columns.forEach((c, i) => {
      const col = this.colText(c); // unique: an id, a sha or a day
      for (const cell of c.cells) {
        // WHY partial: the tracker has no corner mark, so a pass whose column holds a failure says so (amber "!")
        const word = cell.state === 'fail' ? 'fail' : cell.state === 'pass' ? (cell.others.length ? 'partial' : 'pass') : 'not_run';
        rows.push({ id: `${i}:${cell.gate}`, gate: cell.gate, column: col, state: word, failed_tasks: cell.state === 'fail' ? cell.tasks : 0,
          solution: c.lead.id, verdict: c.lead.verdict, objective: c.lead.objective === null ? null : { value: c.lead.objective, unit: o.unit || undefined },
          of: c.n, others_failed: cell.others.map((x) => x.id),
          reads: `${c.lead.id} ${cell.state === 'fail' ? `failed on ${cell.tasks ?? '?'} tasks` : cell.state === 'pass' ? 'passed' : 'not recorded'}${c.n > 1 ? ` (leading of ${c.n})` : ''} · ${c.lead.objective === null ? '—' : `${fmtNum(c.lead.objective)}${unit}`}${cell.others.length ? ` · also failed by ${cell.others.map((x) => x.id).join(', ')}` : ''}` });
      }
    });
    const q = (t) => JSON.stringify(String(t));
    const text = `properties:
  gate: { displayName: "Gate" }
  column: { displayName: ${q(m.x === 'iteration' ? 'Solution' : m.x === 'commit' ? 'Commit' : 'Day')} }
  state: { displayName: "State", labels: { partial: "passed, another failed" } }
  failed_tasks: { displayName: "Failed tasks", type: number, decimals: 0 }
  solution: { displayName: "Solution shown" }
  of: { displayName: "Solutions in the column", type: number, decimals: 0 }
  reads: { displayName: "Reads" }
views:
  - type: tracker
    name: Gate history
    groupBy: { property: gate }
    groupOrder: [${m.gates.map((g) => q(g.id)).join(', ')}]
    tracker:
      state: state
      column: column
      columns: [${m.columns.map((c) => q(this.colText(c))).join(', ')}]
      label: reads
      tones: { pass: neutral }
`;
    const views = document.createElement('data-views');
    views.id = `bbm-tracker-${++uid}`;
    views.setAttribute('no-url', '');
    views.setAttribute('toolbar', 'none');
    views.setAttribute('status', 'off');
    views.setAttribute('aria-label', `${this.data.box || 'Box'}: gate history`);
    views.style.setProperty('--data-height', `${Math.min(720, 160 + 30 * m.gates.length)}px`);
    views.addEventListener('data-views-render', () => { this.dataset.drew = 'tracker'; }, { once: true });
    // a cell opens data-ui's record of it; the solution it shows opens too (bb-open), as a column click does in the grid
    views.addEventListener('data-views-open', (e) => { const id = e.detail?.row?.solution; if (id) this.open(id); });
    views.baseText = text;
    views.base = core.parseBase(text);
    views.data = { id: `bb/${this.data.box || 'box'}/gate-history`, title: 'gate history', titleProperty: 'id', rows };
    host.replaceChildren(views);
  }
}
register(BBGateMatrix);
