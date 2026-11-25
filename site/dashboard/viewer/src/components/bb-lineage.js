/* <bb-lineage>: who descends from whom (viewer/CONTRACT.md §5.2, §16.3). A thin wrapper: ONE data-ui <data-views> whose
   one view is data-ui's `lineage` (the tree of life, d3-hierarchy), with proposals-pages/iterations/iterations.base's
   Lineage preset inline: parents = parent, label = id, focus = the newest iteration's best holder (its ancestry is the
   trunk), kept = admissible (a line with no admissible descendant is extinct), extinct shown as stubs.

   Two settings do not map to a lineage key, because data-ui (2587b04) has none:
   - `color`: the view colours a mark by trunk / alive / extinct only. The marks are tinted by verdict or by depth with a
     stylesheet scoped to this element over data-ui's own marks (g.dv-lineage-node[data-id]), so the drawing stays
     data-ui's and only the dot's colour is ours; a key line above names the colours.
   - `orientation`: the rectangular layout always runs left to right. The setting is kept (CONTRACT §5.2) and inert, as
     its schema `info` says; `layout` (rectangular | radial) is the lineage view's own key.

   A click on a mark opens data-ui's side panel; its title and "Open page" are the solution's page, and a click on them
   fires bb-open (context.open). */
import { BBElement, esc } from '../core/element.js';
import { register } from '../core/registry.js';
import { loadViews } from '../core/kit.js';
import schema from './bb-lineage.schema.js';

let uid = 0;

/** True when at least one iteration names another iteration as its parent (else there is no edge to draw). */
export function hasParents(iterations = []) {
  const ids = new Set(iterations.map((r) => String(r.id)));
  return iterations.some((r) => r.parent !== null && r.parent !== undefined && ids.has(String(r.parent)) && String(r.parent) !== String(r.id));
}

/** The best holder the trunk leads to: the newest iteration's (the best so far when the state was folded). */
export function focusOf(iterations = []) {
  const newest = iterations.reduce((a, r) => (a === null || (r.n ?? -Infinity) >= (a.n ?? -Infinity) ? r : a), null);
  return newest?.best_holder ?? null;
}

export function lineageRows(iterations = [], href = () => '') {
  return iterations.map((r) => ({
    id: String(r.id), n: r.n ?? null, verdict: r.verdict, objective: r.objective ?? null, best_so_far: r.best_so_far ?? null,
    holdout: r.holdout ?? null, admissible: r.admissible ?? null, gen: r.gen ?? null, parent: r.parent ?? null,
    change: r.change ?? null, proposer: r.proposer ?? r.proposed_by?.agent ?? null, evaluated: r.evaluated ?? null, page: href(r.id),
  }));
}

/** iterations.base's Lineage preset, as bb-lineage draws it. */
export function lineageBase(focus, settings) {
  return {
    open: { mode: 'side', splitAt: 980 },
    properties: { id: { displayName: 'Solution' }, verdict: { displayName: 'Verdict' }, objective: { displayName: 'Objective' },
      holdout: { displayName: 'Holdout' }, parent: { displayName: 'Parent' }, change: { displayName: 'The one change' },
      proposer: { displayName: 'Proposed by' }, gen: { displayName: 'Depth' } },
    views: [{ type: 'lineage', name: 'Lineage', order: ['id', 'verdict', 'objective', 'holdout', 'parent', 'change', 'proposer'],
      lineage: { parents: 'parent', label: 'id', ...(focus ? { focus } : {}), kept: { admissible: [true] }, extinct: 'show',
        layout: settings.layout === 'radial' ? 'radial' : 'rectangular' } }],
  };
}

export const VERDICT_COLOURS = { kept: 'var(--bb-newbest)', discarded: 'var(--bb-adm)', failed: 'var(--bb-bad)' };

/** A mark's colour by depth: the holdout blue mixed into the page from a light tint (depth 0) to full (the deepest). */
export const genColour = (g, top) => `color-mix(in oklab, var(--bb-holdout) ${Math.round(40 + (60 * (top ? Math.max(0, g) / top : 1)))}%, var(--bb-bg))`;

/** The scoped stylesheet: one rule per colour over data-ui's marks, by row id. Pure, so the test reads it. */
export function colourCss(rows, by, scope) {
  const groups = new Map();
  const top = Math.max(0, ...rows.map((r) => (Number.isFinite(r.gen) ? r.gen : 0)));
  for (const r of rows) {
    const key = by === 'gen' ? (Number.isFinite(r.gen) ? `g${r.gen}` : null) : r.verdict in VERDICT_COLOURS ? r.verdict : null;
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, { colour: by === 'gen' ? genColour(r.gen, top) : VERDICT_COLOURS[key], ring: by !== 'gen' && key === 'failed', ids: [] });
    groups.get(key).ids.push(r.id);
  }
  const sel = (ids, extra = '') => ids.map((id) => `${scope} g.dv-lineage-node${extra}[data-id="${cssString(id)}"] .dv-lineage-dot`).join(',\n');
  const out = [];
  for (const { colour, ring, ids } of groups.values()) {
    // fill on every mark (the trunk keeps data-ui's accent outline); the outline only off the trunk, unselected, unhovered
    out.push(`${sel(ids)} { fill: ${ring ? 'var(--bb-bg)' : colour}; }`);
    out.push(`${sel(ids, ':not(.dv-golden):not(.dv-selected):not(:hover)')} { stroke: ${colour}; stroke-width: ${ring ? 2 : 1.2}; }`);
  }
  return out.join('\n');
}
const cssString = (s) => String(s).replace(/["\\]/g, (c) => `\\${c}`).replace(/\n/g, '\\a ');

export class BBLineage extends BBElement {
  static schema = schema;
  static css = `
bb-lineage { --bbl-h: 560px; }
bb-lineage .bbl-wait { color: var(--bb-muted); font-size: 13px; }
bb-lineage .bbl-key { display: flex; flex-wrap: wrap; gap: 4px 14px; align-items: center; font-size: 12.5px; color: var(--bb-muted); margin: 0 0 8px; }
bb-lineage .bbl-key .sw { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
bb-lineage .bbl-key i { display: inline-block; width: 10px; height: 10px; border-radius: 50%; border: 1.5px solid transparent; }
bb-lineage .bbl-key .ramp { display: inline-block; width: 72px; height: 8px; border-radius: 4px; vertical-align: middle; }
bb-lineage .bbl-key .note { overflow-wrap: anywhere; }
bb-lineage data-views { min-width: 0; --data-height: var(--bbl-h); }
@media (max-width: 640px) { bb-lineage { --bbl-h: 520px; } }
`;

  listen() {
    if (this._listening) return;
    this._listening = true;
    this.addEventListener('click', (e) => {
      const a = e.target.closest && e.target.closest('a[href]');
      // WHY not .dv-open-rel: a relation (the parent) steps the panel to that row, data-ui's own trail
      if (!a || !this.contains(a) || !a.closest('.dv-peek') || a.classList.contains('dv-open-rel')) return;
      const id = this._hrefs?.get(a.href);
      if (id === undefined) return;
      e.preventDefault();
      e.stopPropagation();
      this.context.open(this, { kind: 'solution', id, href: this.context.href('solution', { id }) });
    }, true);
  }

  key(rows, focus) {
    const s = this.settings;
    const trunk = focus ? `<span class="note">the thick line: the ancestry of the best, <span class="bb-mono">${esc(focus)}</span></span>` : '';
    if (s.color === 'gen') {
      const top = Math.max(0, ...rows.map((r) => (Number.isFinite(r.gen) ? r.gen : 0)));
      return `<span class="sw">depth 0 <span class="ramp" style="background:linear-gradient(90deg, ${genColour(0, top)}, ${genColour(top, top)})"></span> ${top}</span>${trunk}`;
    }
    const n = (v) => rows.filter((r) => r.verdict === v).length;
    return `<span class="sw"><i style="background:var(--bb-newbest)"></i>kept ${n('kept')}</span>`
      + `<span class="sw"><i style="background:var(--bb-adm)"></i>discarded ${n('discarded')}</span>`
      + `<span class="sw"><i style="border-color:var(--bb-bad)"></i>failed ${n('failed')}</span>${trunk}`;
  }

  async render() {
    const its = this.data.iterations || [];
    if (!hasParents(its)) return this.empty(undefined, its.length ? `${its.length} iteration${its.length === 1 ? '' : 's'}, none naming another as its parent: nothing to hang a tree on.` : '');
    const s = this.settings;
    const box = this.data.box || 'Box';
    const href = (id) => this.context.href('solution', { id });
    const rows = lineageRows(its, href);
    const focus = focusOf(its);
    this.listen();
    this._hrefs = new Map(rows.filter((r) => r.page).map((r) => [new URL(r.page, document.baseURI).href, r.id]));
    const n = ++uid;
    this.dataset.bbl = String(n);
    const wait = document.createElement('div');
    wait.className = 'bbl-wait';
    wait.textContent = 'Loading the lineage…';
    this.replaceChildren(wait);
    const token = (this._token = (this._token || 0) + 1);
    const core = await loadViews();
    if (token !== this._token) return; // a newer render started meanwhile
    const doc = lineageBase(focus, s);
    const text = `# ${box}: lineage, proposals-pages/iterations/iterations.base's Lineage preset (bb-lineage)\n${core.stringifyBase(doc)}`;
    const key = document.createElement('div');
    key.className = 'bbl-key';
    key.setAttribute('aria-label', 'Key');
    key.innerHTML = this.key(rows, focus);
    const style = document.createElement('style');
    style.textContent = colourCss(rows, s.color, `bb-lineage[data-bbl="${n}"]`);
    const views = document.createElement('data-views');
    views.id = `bbl-${n}`;
    views.setAttribute('no-url', '');
    views.setAttribute('view', 'Lineage');
    views.setAttribute('aria-label', `${box}: lineage`);
    views.addEventListener('data-views-render', (e) => { this.dataset.drew = e.detail.type; wait.remove(); }, { once: true });
    views.baseText = text;
    views.base = core.parseBase(text);
    views.data = { id: `bb/${box}/lineage/${s.layout}`, title: `${box} lineage`, titleProperty: 'id', linkProperty: 'page',
      properties: {
        id: { type: 'text', label: 'Solution' }, parent: { type: 'text', label: 'Parent' },
        change: { type: 'text', label: 'The one change' }, proposer: { type: 'text', label: 'Proposed by' },
        verdict: { type: 'text', label: 'Verdict', tones: { kept: 'good', discarded: 'muted', failed: 'bad' }, display: 'status' },
        objective: { type: 'number', label: 'Objective', unitText: this.data.objective?.unit || undefined, decimals: 3 },
        holdout: { type: 'number', label: 'Holdout', unitText: this.data.objective?.unit || undefined, decimals: 3 },
        best_so_far: { type: 'number', label: 'Best so far', unitText: this.data.objective?.unit || undefined, decimals: 3 },
        admissible: { type: 'boolean', label: 'Admissible' }, gen: { type: 'number', label: 'Depth', decimals: 0 },
        n: { type: 'number', label: '#', decimals: 0 }, evaluated: { type: 'datetime', label: 'Evaluated' },
        page: { type: 'text', label: 'Solution page', hidden: true },
      },
      rows };
    this.append(key, style, views);
  }
}
register(BBLineage);
