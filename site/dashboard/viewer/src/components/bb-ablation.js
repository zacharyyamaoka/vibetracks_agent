/* <bb-ablation>: the Ablation tab's body (viewer/CONTRACT.md §16.2, §16.3). Each pick is a `layout`, so switching is a
   page.json edit:
   - dashboard (default; Zach's ruling 2026-11-24 ~15:00, PICKS.md "Zach's rulings"): proposals-ablation-page 1, the single
     stock data-ui dashboard: <data-facets> + one <data-views> over the study's measured variants, whose preset tabs are
     the stock table and the six views registered as data-ui view types (a click opens data-ui's side panel). The
     view switch is data-ui's own, so a prettier stock switcher (proposals-dashboards/) drops in there, not here.
   - grid (the earlier pick): 2 Overview grid (one view the big tile, the other five small; a click on a small tile makes
     it big), 3's answer sentences as the tile headers (each computed from the study, bb-ablation.model.js), 4's story
     card on top (the study, or the part you pick: a part's name anywhere, or the chips under the card).
   - changelog / pairs: one view full width (the older picks: 05 Changelog, 02 Importance with its pairs table).

   Reads state.json `ablation_study` (the box's newest study, folded by tools/folds; CONTRACT §16.1), `ablations` (the
   run count), `iterations` (is the study's target still the best?) and `costs` (each point's tier in the frontier's
   hover). Measured values and the surrogate's estimates are labelled apart everywhere. A solution id fires bb-open
   {kind: 'solution', id, href, source}: href = the page's links.solution, source = the box's own link for that solution
   at the folded commit (ablation_study.links); the component never builds a path into the box's repo itself.

   STOCK PART: data-ui (<data-views>, <data-facets>, the side panel, the table) hosts the default layout. No stock view
   draws the six charts: data-ui's chart view (Vega-Lite) could draw the waterfall and the frontier, but not the UpSet
   matrix, the both-ends bars or the remix panel; they are the proposals' own SVG (bb-ablation.views.js), registered
   with data-ui's registerView as 01 did. */
import { BBElement, esc } from '../core/element.js';
import { register } from '../core/registry.js';
import { md } from '../core/inline.js';
import { loadViews } from '../core/kit.js';
import { makeStudy, facts, answers, gridOrder, viewName, bestIteration, fmtV, times, pct, signed, numberWord,
  DASHBOARD_VIEWS, ablationBase, dashboardRows, partRow } from './bb-ablation.model.js';
import { mountView } from './bb-ablation.views.js';
import schema from './bb-ablation.schema.js';
import css from './bb-ablation.css.js';

let uid = 0;

/* The six views as data-ui view types (proposals-ablation-page/01-data-ui/register.js): each draws the study of the
   <bb-ablation> it sits in, narrowed to the rows data-ui's rail and search leave (input.rows), and opens data-ui's side
   panel: a variant's row, or a part as a synthetic row. A solution that is not a row (a side branch) fires bb-open. */
function viewType(kind) {
  return class AblationView {
    constructor(host, el) {
      this.host = host;
      this.el = el;
      this.observers = [];
      el.classList.add('dv-ablation');
      this.mount = document.createElement('div');
      this.status = document.createElement('p');
      this.status.className = 'small muted ab-status';
      el.append(this.mount, this.status);
    }

    update(input) {
      if (!this.view) {
        const owner = this.el.closest('bb-ablation');
        if (!owner || !owner.S) { this.status.textContent = 'This view draws the study of the <bb-ablation> it sits in.'; return; }
        const S = owner.S;
        const rows = new Set(dashboardRows(S.D).map((r) => r.id));
        const env = {
          ...owner.env(),
          observe: (ro) => this.observers.push(ro),
          open: (id) => (rows.has(id) ? this.host.open(id) : owner.openSolution(id)),
          pick: (key) => this.host.open(`part:${key}`, { row: partRow(S, key), title: S.name(key) }),
        };
        this.view = mountView(kind, this.mount, S, env, { head: true });
      }
      const ids = input.rows.map((r) => r.id);
      const all = ids.length === input.total;
      this.view.setRows(all ? null : ids);
      const perPart = kind === 'importance' || kind === 'overall';
      this.status.textContent = all ? `All ${input.total} measured variants.`
        : perPart ? `The rail's filter (${ids.length} of ${input.total} rows) does not change a per-part view: every number here is computed over the whole study.`
          : `Drawn from the ${ids.length} of ${input.total} variants the rail leaves; the others are faded or left out.`;
    }

    destroy() { for (const ro of this.observers) ro.disconnect(); this.observers = []; }
  };
}
let registered = false;
function registerViews(core) {
  if (registered) return;
  registered = true;
  const icon = { remix: 'grid', waterfall: 'chart', importance: 'chart', frontier: 'chart', overall: 'chart', changelog: 'list' };
  for (const [kind, name] of Object.entries(DASHBOARD_VIEWS)) {
    try {
      core.registerView(`ablation-${kind}`, { name, icon: icon[kind], load: async () => viewType(kind) });
    } catch (e) {
      if (!/already registered/.test(String(e?.message))) throw e; // a host page registered them first
    }
  }
}

export class BBAblation extends BBElement {
  static schema = schema;
  static css = css;

  constructor() {
    super();
    this.apis = [];
    this.observers = [];
    this.ui = null;
    this._token = 0;
    this.onClick = this.onClick.bind(this);
    this.onKey = this.onKey.bind(this);
  }

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('click', this.onClick);
    this.addEventListener('keydown', this.onKey);
    this._ro ||= new ResizeObserver(() => this.measure());
    this._ro.observe(this);
  }

  teardown() {
    this.removeEventListener('click', this.onClick);
    this.removeEventListener('keydown', this.onKey);
    this._ro?.disconnect(); this._ro = null;
    this.unmountViews();
  }

  unmountViews() {
    for (const ro of this.observers) ro.disconnect();
    this.observers = [];
    this.apis = [];
    this.tip(null, null);
  }

  /** The width class the grid and story card lay out by (the element's own width, not the window's). */
  measure() {
    const w = this.clientWidth;
    if (!w) return;
    const next = w < 600 ? 'phone' : w < 1000 ? 'mid' : 'wide';
    if (this.dataset.w !== next) this.dataset.w = next;
  }

  /** What the views get from the element: the tooltip, solution links, bb-open, the part pick, teardown. */
  env() {
    const self = this;
    return {
      tip: (e, html) => self.tip(e, html),
      sol: (id) => self.solLink(id),
      open: (id) => self.openSolution(id),
      pick: (key) => self.pick(key, { toggle: true }),
      observe: (ro) => self.observers.push(ro),
      uid: (p) => `${p}-ab${++uid}`,
      tiers: self.tiers,
    };
  }

  solLink(id) {
    if (!id) return '—';
    return `<a class="ab-sol" data-sol="${esc(id)}" href="${esc(this.context.href('solution', { id }))}"><code>${esc(id)}</code></a>`;
  }
  partLink(key) {
    return `<a href="#" class="ab-part${this.ui && this.ui.focus === key ? ' on' : ''}" data-part="${esc(key)}">${esc(this.S.name(key))}</a>`;
  }

  openSolution(id) {
    const links = (this.data.ablation_study && this.data.ablation_study.links) || {};
    const detail = { kind: 'solution', id, href: this.context.href('solution', { id }) };
    if (links.solution) detail.source = `${links.solution}${encodeURIComponent(id)}/`;
    this.context.open(this, detail);
  }

  tip(event, html) {
    const t = this.querySelector(':scope .ab-tip');
    if (!t) return;
    if (!html) { t.hidden = true; return; }
    t.innerHTML = html;
    t.hidden = false;
    const w = t.offsetWidth, h = t.offsetHeight;
    let x = event.clientX + 14, y = event.clientY + 14;
    if (x + w > window.innerWidth - 8) x = event.clientX - w - 14;
    if (y + h > window.innerHeight - 8) y = event.clientY - h - 14;
    t.style.left = `${Math.max(8, x)}px`;
    t.style.top = `${Math.max(8, y)}px`;
  }

  render() {
    const D = this.data.ablation_study;
    this.unmountViews();
    if (!D || !Array.isArray(D.components) || !D.components.length || !D.objective) { this._token++; return this.empty(); }
    const s = this.settings;
    this.S = makeStudy(D);
    this.F = facts(this.S);
    this.tiers = Object.fromEntries((this.data.costs || []).map((c) => [c.id, c]));
    this.ui = { focus: null, order: gridOrder(s.view), layout: s.layout };
    this.measure();
    if (!this.dataset.w) this.dataset.w = 'wide';
    const notes = [];
    if (s.study && s.study !== D.study.study) {
      notes.push(`Only the newest study is folded into this state: this tab shows <b>${esc(D.study.study)}</b>${D.file ? ` (<span class="bb-mono">${esc(D.file)}</span>)` : ''};
        “${esc(s.study)}” is not in it.`);
    }
    const best = bestIteration(this.data.iterations, (this.data.objective || {}).direction);
    if (best && best.id !== D.study.target && best.objective < D.objective.target) {
      notes.push(`The best is now ${this.solLink(best.id)} at ${fmtV(best.objective)} ${esc(this.S.unit)}; this study explains ${this.solLink(D.study.target)}.`);
    }
    const token = ++this._token;
    const dash = s.layout === 'dashboard';
    this.innerHTML = `${dash ? '<div class="ab-wait bb-muted">Loading the ablation dashboard…</div>' : ''}${notes.map((n) => `<div class="ab-note">${n}</div>`).join('')}
      ${s.story && !dash ? '<div class="bb-card ab-story"></div>' : ''}
      <div class="ab-body"></div>
      <div class="ab-tip" hidden></div>`;
    if (dash) return this.drawDashboard(token);
    this.drawStory();
    this.drawBody();
  }

  /** The default layout: proposal 1, data-ui's own dashboard over the study's rows (facets, presets, side panel). */
  async drawDashboard(token) {
    const core = await loadViews();
    if (token !== this._token || !this.isConnected) return;
    registerViews(core);
    const { S, F } = this;
    const D = S.D;
    const body = this.querySelector(':scope > .ab-body');
    body.className = 'ab-body ab-dash-wrap';
    const doc = ablationBase(S);
    const box = this.data.box || 'Box';
    // WHY the properties as JSON flow maps (01's ablation.base writes them so too): data-ui's stringifyBase leaves a value
    // with an apostrophe unquoted ("minus the board's lead") and its parseBase then refuses the line (a data-ui gap)
    const { properties, ...rest } = doc;
    const text = `# ${box}: ablation study ${D.study.study}, one row per measured variant (proposals-ablation-page 1, as bb-ablation draws it)\n${core.stringifyBase(rest).trimEnd()}
properties:\n${Object.entries(properties).map(([k, v]) => `  ${k}: ${JSON.stringify(v)}`).join('\n')}\n`;
    const runs = Array.isArray(this.data.ablations) ? this.data.ablations.length : F.ablationRuns;
    const others = F.measuredVariants - runs;
    body.innerHTML = `<p class="ab-lede">One row per measured variant of <b>${esc(D.study.title || D.study.study)}</b> (the ${runs} ablation run${runs === 1 ? '' : 's'} and the
      ${others} search solution${others === 1 ? '' : 's'} they are built from): ${fmtV(S.base)} → ${fmtV(S.target)} ${esc(S.unit)}, ${F.total}.
      Filter on the left; the tabs are views over the same rows. Click a row, or a part's name in any view, to open it in the side panel; a solution id opens the solution.</p>
      <div class="ab-dash"></div>`;
    const views = document.createElement('data-views');
    views.id = `bbab-${++uid}`;
    views.setAttribute('no-url', '');
    views.setAttribute('open', 'side');
    views.setAttribute('toolbar', 'full');
    views.setAttribute('view', DASHBOARD_VIEWS[this.settings.view] || DASHBOARD_VIEWS.remix);
    views.setAttribute('aria-label', `${box}: ablation study`);
    views.addEventListener('data-views-render', (e) => { this.dataset.drew = e.detail.type; this.querySelector(':scope > .ab-wait')?.remove(); }, { once: true });
    views.baseText = text;
    views.base = core.parseBase(text);
    // WHY the study and the opening view in the data id: data-ui keeps a reader's view changes per data id
    views.data = { id: `bb/${box}/ablation/${D.study.study}/${this.settings.view}`, title: `${box} ablation`, titleProperty: 'solution', rows: dashboardRows(D) };
    const rail = document.createElement('data-facets');
    rail.setAttribute('for', views.id);
    body.querySelector('.ab-dash').append(rail, views);
  }

  answers() {
    return answers(this.S, this.F, {
      part: (S, key) => this.partLink(key),
      sol: (id) => this.solLink(id),
      measured: () => ' <span class="basis measured">measured</span>',
      estimate: () => ' <span class="basis estimate">estimate</span>',
    });
  }

  drawBody() {
    this.unmountViews();
    const body = this.querySelector(':scope > .ab-body');
    const env = this.env();
    const focus = this.ui.focus;
    if (this.ui.layout !== 'grid') {
      const kind = this.ui.layout === 'pairs' ? 'importance' : 'changelog';
      body.className = 'ab-body ab-single';
      body.innerHTML = '<div></div>';
      this.apis.push(mountView(kind, body.firstElementChild, this.S, env, { focus, pairsFirst: kind === 'importance' }));
      return;
    }
    body.className = 'ab-body ab-grid';
    const A = this.answers();
    const tile = (kind, size) => `<section class="ab-tile ${size}" data-view="${kind}">
      <header${size === 'small' ? ` role="button" tabindex="0" aria-label="Make ${esc(viewName(kind))} the big tile" title="Make it the big tile"` : ''}>
        <div class="t"><p class="ask">${esc(A[kind].ask)}</p><h3>${esc(A[kind].name)}</h3><div class="answer-line">${A[kind].html}</div></div>
        ${size === 'small' ? '<span class="grow" aria-hidden="true">Make big ↗</span>' : ''}</header>
      <div class="ab-tile-body"><div></div></div></section>`;
    const [big, ...small] = this.ui.order;
    body.innerHTML = `<div class="ab-top">${tile(big, 'big')}<div class="ab-side">${small.slice(0, 2).map((k) => tile(k, 'small')).join('')}</div></div>
      <div class="ab-rest">${small.slice(2).map((k) => tile(k, 'small')).join('')}</div>`;
    for (const sec of body.querySelectorAll('.ab-tile')) {
      const kind = sec.dataset.view;
      const bigOne = sec.classList.contains('big');
      this.apis.push(mountView(kind, sec.querySelector('.ab-tile-body > div'), this.S, env, { compact: !bigOne, head: false, focus }));
    }
  }

  /** 04's story card: the study, or the picked part's story; the part chips under it pick. */
  drawStory() {
    const card = this.querySelector(':scope > .ab-story');
    if (!card) return;
    const { S, F } = this;
    const { D, O } = S;
    const U = S.unit;
    const key = this.ui.focus;
    let head;
    if (!key) {
      const cheap = F.cheap;
      const runs = Array.isArray(this.data.ablations) ? this.data.ablations.length : F.ablationRuns;
      const findings = String(D.findings || '').split(/\n(?=- )/).map((b) => b.replace(/^- /, '').replace(/\n/g, ' ').trim()).filter(Boolean);
      head = `<div class="ab-story-grid"><div><h2>The study: ${esc(D.study.title || D.study.study)}</h2>
          <div class="idea">${F.measuredVariants} measured variants of ${this.solLink(D.study.target)}'s ${numberWord(S.order.length)} parts (${runs} ablation run${runs === 1 ? '' : 's'}, the rest the search's own solutions),
          from ${this.solLink(D.study.base)}. Pick a part: every view highlights it.</div>
          <div class="idea">${D.links && D.links.study ? `<a href="${esc(D.links.study)}" target="_blank" rel="noopener">${esc(D.file || 'the study file')}</a>` : esc(D.file || '')}${D.study.date ? ` · ${esc(D.study.date)}` : ''} · removal ${esc(D.study.removal || 'frozen')} unless marked refit</div></div>
        <div class="stat"><div class="label">base → best</div><div class="big">${fmtV(S.base)} → ${fmtV(S.target)}</div><div class="small">${esc(U)}, ${F.total}</div></div>
        <div class="stat"><div class="label">top three <span class="basis measured">measured</span></div><div class="big">${F.top3.length ? S.share(F.top3Orders) : '—'}</div><div class="small">${esc(F.top3.map(S.short).join(', '))}</div></div>
        <div class="stat"><div class="label">cheapest close</div><div class="big">${cheap ? `${fmtV(cheap.objective)} ${esc(U)}` : '—'}</div><div class="small">${cheap ? `${cheap.keeps.length} parts, ${cheap.code_lines} lines, ${this.solLink(cheap.solution)}` : 'none within ×5 of the best'}</div></div>
        <div class="stat"><div class="label">sets measured</div><div class="big">${O ? `${O.measured_sets} / ${O.all_sets}` : '—'}</div><div class="small">the rest: the surrogate's <span class="basis estimate">estimate</span></div></div></div>
        ${findings.length ? `<details><summary>The study's findings, in its own words (${findings.length})</summary><ul>${findings.map((f) => `<li>${md(f)}</li>`).join('')}</ul></details>` : ''}`;
    } else {
      const c = S.comp[key], p = S.part[key];
      const i = D.history.findIndex((h) => h.component === key);
      const steps = D.history.filter((h) => h.component === key);
      const before = i > 0 ? D.history[i - 1] : null, after = steps[steps.length - 1];
      const dl = (k) => (after && before && after[k] != null && before[k] != null ? after[k] - before[k] : null);
      const links = D.links || {};
      head = `<div class="ab-story-grid"><div><h2>${esc(c.name)}</h2><div class="idea">${c.idea ? `“${esc(c.idea)}”` : ''}${c.idea_line && links.ideas ? ` · <a href="${esc(links.ideas + c.idea_line)}" target="_blank" rel="noopener">idea, line ${c.idea_line}</a>` : ''}
          · added by ${(c.introduced_by || []).map((id) => this.solLink(id)).join(', ')}</div>${D.notes && D.notes[key] ? `<div class="idea" style="margin-top:6px">${esc(D.notes[key])}</div>` : ''}</div>
        <div class="stat"><div class="label">when the search took it</div><div class="big">${before && after ? pct(before.objective, after.objective) : '—'}</div><div class="small">${before && after ? `${fmtV(before.objective)} → ${fmtV(after.objective)} ${esc(U)}` : 'not on the lineage'}
          ${dl('code_lines') != null ? ` · ${signed(dl('code_lines'))} lines` : ''}${dl('energy_j') != null ? ` · ${signed(dl('energy_j'))} J` : ''}</div></div>
        <div class="stat"><div class="label">removed from the best <span class="basis measured">measured</span></div><div class="big">${times(c.without_factor)} worse</div><div class="small">frozen, ${this.solLink(c.without)}${c.without_refit_factor != null ? `; ${times(c.without_refit_factor)} after a refit` : '; refit not measured'}</div></div>
        <div class="stat"><div class="label">added alone <span class="basis measured">measured</span></div><div class="big">${times(c.alone_factor)} better</div><div class="small">on ${this.solLink(D.study.base)}</div></div>
        <div class="stat"><div class="label">share of the ${F.total}</div><div class="big">${p ? S.share(p.orders, 1) : '—'}</div><div class="small">${p ? `<span class="basis measured">measured</span> orders; Shapley <span class="basis estimate">estimate</span> ${S.share(p.shapley)} ± ${S.share(p.shapley_se).replace('−', '')}` : ''}</div></div></div>`;
    }
    const chips = `<div class="ab-pick"><div class="lbl">Pick a part · share of the ${F.total} (measured orders)</div><div class="ab-picker" role="group" aria-label="Pick a part">
      <button type="button" data-pick="" aria-pressed="${!key}">All parts<span class="v">${F.total}</span></button>
      ${(F.byOrders.length ? F.byOrders.map((q) => q.key) : S.order).map((k) => `<button type="button" data-pick="${esc(k)}" aria-pressed="${key === k}"
        title="${esc(S.name(k))}">${esc(S.name(k))}${S.part[k] ? `<span class="v">${S.share(S.part[k].orders)}</span>` : ''}</button>`).join('')}</div></div>`;
    card.innerHTML = head + chips;
  }

  /** Pick a part (null = the whole study): the story card, every view and every answer sentence follow. */
  pick(key, { toggle = false } = {}) {
    const next = key && toggle && this.ui.focus === key ? null : key || null;
    this.ui.focus = next;
    this.drawStory();
    for (const api of this.apis) api.focus(next);
    for (const a of this.querySelectorAll('a.ab-part')) a.classList.toggle('on', a.dataset.part === next);
  }

  /** A small tile's view becomes the big one; the big one takes its place. */
  makeBig(kind) {
    const order = this.ui.order;
    const i = order.indexOf(kind);
    if (i <= 0) return;
    [order[0], order[i]] = [order[i], order[0]];
    this.drawBody();
    this.querySelector(':scope .ab-tile.big')?.scrollIntoView?.({ block: 'nearest' });
  }

  onClick(e) {
    const sol = e.target.closest('a.ab-sol[data-sol]');
    if (sol && this.contains(sol)) { e.preventDefault(); e.stopPropagation(); this.openSolution(sol.dataset.sol); return; }
    const part = e.target.closest('a.ab-part[data-part]');
    if (part && this.contains(part)) { e.preventDefault(); this.pick(part.dataset.part, { toggle: true }); return; }
    const chip = e.target.closest('.ab-picker button[data-pick]');
    if (chip) { this.pick(chip.dataset.pick || null); return; }
    const small = e.target.closest('.ab-tile.small');
    if (small && this.contains(small) && !e.target.closest('a')) this.makeBig(small.dataset.view);
  }

  onKey(e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const head = e.target.closest?.('.ab-tile.small > header');
    if (head) { e.preventDefault(); this.makeBig(head.parentElement.dataset.view); }
  }
}
register(BBAblation);
