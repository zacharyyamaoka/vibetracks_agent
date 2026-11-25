/* <bb-catalog>: the Iterations tab's catalogue (viewer/CONTRACT.md §5.2, §11, §16.3). A thin wrapper: ONE data-ui
   <data-views> with an inline .base over the component's slice rows, nothing hand-drawn. Its presets are
   proposals-pages/iterations/iterations.base's "Iterations" table (newest first) and "Kept only", plus a "Cards" view
   over the same rows; `view` picks the one it opens on, `sort` re-sorts Iterations and Cards, `show_ablations` adds the
   ablation runs (each listed after the iteration it was evaluated after, never numbered). Registered solutions with no
   dev score yet are rows too, their verdict "waiting for a score".

   A row click opens data-ui's side panel; the panel's title and "Open page" link are the solution's page
   (context.href('solution')), and a click on them fires bb-open (context.open) instead of leaving the page directly. */
import { BBElement } from '../core/element.js';
import { register } from '../core/registry.js';
import { loadViews } from '../core/kit.js';
import schema from './bb-catalog.schema.js';

let uid = 0;

/** The objective column's decimals: whole numbers stay whole (cpa's scenarios_failing), else three. */
const decimalsOf = (rows) => (rows.every((r) => r.objective === null || r.objective === undefined || Number.isInteger(r.objective)) ? 0 : 3);

/** One flat row per iteration, ablation run (when shown) and solution waiting for a score; `k` is the list order
    (iterations by n, an ablation run just after the iteration it was evaluated after, the waiting ones newest). */
export function catalogRows(data, { showAblations = false, href = () => '' } = {}) {
  const its = data.iterations || [];
  const abl = showAblations ? data.ablations || [] : [];
  const waiting = data.unscored || [];
  const flat = (r, k) => {
    const row = {
      k, n: r.n ?? null, id: String(r.id), verdict: r.verdict, objective: r.objective ?? null, best_so_far: r.best_so_far ?? null,
      holdout: r.holdout ?? null, admissible: r.admissible ?? null, gen: r.gen ?? null, parent: r.parent ?? null,
      change: r.change ?? null, proposer: r.proposer ?? r.proposed_by?.agent ?? null, model: r.proposed_by?.model ?? null,
      evaluated: r.evaluated ?? null, created: r.created ?? null, tags: Array.isArray(r.tags) ? r.tags : [],
      gate_pass_rate: r.gate_pass_rate ?? null, failed_tasks: r.failed_tasks ?? null,
      failed_gates: Object.entries(r.failed_gates || {}).map(([g, t]) => `${g}: ${Array.isArray(t) ? t.length : t} task${(Array.isArray(t) ? t.length : t) === 1 ? '' : 's'}`),
      best_holder: r.best_holder ?? null, commit: r.commit?.sha ?? null, commit_subject: r.commit?.subject ?? null,
      page: href(r.id),
    };
    for (const [key, v] of Object.entries(r)) if (key.startsWith('g_')) row[key] = v;
    if (r.verdict === 'ablation') row.after = r.after ?? null;
    return row;
  };
  const rows = its.map((r, i) => flat(r, r.n ?? i + 1));
  abl.forEach((r, i) => rows.push(flat(r, (r.after ?? 0) + (i + 1) / (abl.length + 1))));
  const top = rows.reduce((m, r) => Math.max(m, r.k), 0);
  waiting.forEach((r, i) => rows.push({
    k: top + i + 1, n: null, id: String(r.id), verdict: 'waiting for a score', objective: null, parent: r.parent ?? null,
    change: r.change ?? null, created: r.created ?? null, tags: [], failed_gates: [], page: href(r.id),
  }));
  return rows;
}

const VERDICT_TONES = { kept: 'good', discarded: 'muted', failed: 'bad', ablation: 'neutral', 'waiting for a score': 'muted' };

/** The dataset's field schema: types, units, decimals, the verdict's tones (data-ui CONTRACT §2, §35). */
export function catalogProperties(data, rows) {
  const unit = data.objective?.unit || undefined;
  const dir = data.objective?.direction;
  const decimals = decimalsOf(rows);
  const num = (label, extra = {}) => ({ type: 'number', label, ...extra });
  const props = {
    k: num('Order', { decimals: 3, hidden: true }),
    n: num('#', { decimals: 0, note: 'iteration number: the order of its first dev evaluation' }),
    id: { type: 'text', label: 'Solution' },
    verdict: { type: 'text', label: 'Verdict', tones: VERDICT_TONES, display: 'status',
      note: 'failed when not admissible; kept when admissible and better than every kept one before it; else discarded' },
    objective: num('Objective', { unitText: unit, decimals, better: dir, note: data.objective?.name || undefined }),
    best_so_far: num('Best so far', { unitText: unit, decimals, better: dir }),
    holdout: num('Holdout', { unitText: unit, decimals, better: dir, note: 'reporting only, never selected on' }),
    admissible: { type: 'boolean', label: 'Admissible' },
    gen: num('Depth', { decimals: 0, note: 'steps from a root along parent links' }),
    parent: { type: 'text', label: 'Parent' },
    change: { type: 'text', label: 'The one change' },
    proposer: { type: 'text', label: 'Proposed by' },
    model: { type: 'text', label: 'Model' },
    evaluated: { type: 'datetime', label: 'Evaluated' },
    created: { type: 'datetime', label: 'Created' },
    tags: { type: 'list', label: 'Tags' },
    gate_pass_rate: num('Gate pass rate', { decimals: 3 }),
    failed_tasks: num('Gate failures', { decimals: 0 }),
    failed_gates: { type: 'list', label: 'Failed gates' },
    best_holder: { type: 'text', label: 'Best so far held by' },
    commit: { type: 'text', label: 'Commit' },
    commit_subject: { type: 'text', label: 'Commit subject' },
    after: num('Evaluated after #', { decimals: 0, note: 'an ablation run: the iteration evaluated just before it' }),
    page: { type: 'text', label: 'Solution page', hidden: true },
  };
  for (const key of new Set(rows.flatMap((r) => Object.keys(r).filter((x) => x.startsWith('g_')))))
    props[key] = { type: 'text', label: key.slice(2), tones: { pass: 'good', fail: 'bad' }, display: 'status' };
  return props;
}

/** The inline .base: iterations.base's Iterations and Kept only tables (its display names), plus a Cards view. */
export function catalogBase(data, settings) {
  const better = data.objective?.direction === 'higher' ? 'DESC' : 'ASC';
  const sort = settings.sort === 'objective'
    ? [{ property: 'objective', direction: better }, { property: 'k', direction: 'DESC' }]
    : [{ property: 'k', direction: 'DESC' }];
  return {
    open: { mode: 'side', splitAt: 980 },
    properties: {
      n: { displayName: '#' }, id: { displayName: 'Solution' }, verdict: { displayName: 'Verdict' },
      objective: { displayName: 'Objective' }, best_so_far: { displayName: 'Best so far' }, holdout: { displayName: 'Holdout' },
      admissible: { displayName: 'Admissible' }, gen: { displayName: 'Depth' }, parent: { displayName: 'Parent' },
      change: { displayName: 'The one change' }, evaluated: { displayName: 'Evaluated' }, created: { displayName: 'Created' },
      tags: { displayName: 'Tags' }, gate_pass_rate: { displayName: 'Gate pass rate' }, best_holder: { displayName: 'Best so far held by' },
      proposer: { displayName: 'Proposed by' }, failed_tasks: { displayName: 'Gate failures' },
    },
    views: [
      { type: 'table', name: 'Iterations', order: ['n', 'id', 'verdict', 'objective', 'best_so_far', 'holdout', 'parent', 'change', 'proposer', 'evaluated'],
        sort, display: { verdict: 'status' } },
      { type: 'table', name: 'Kept only', filters: 'verdict == "kept"', order: ['n', 'id', 'objective', 'holdout', 'parent', 'change'],
        sort: [{ property: 'n', direction: 'ASC' }] },
      { type: 'cards', name: 'Cards', order: ['id', 'verdict', 'objective', 'change', 'parent', 'proposer', 'evaluated'], cardSize: 260,
        sort, display: { verdict: 'status' } },
    ],
  };
}

export const VIEW_NAMES = { table: 'Iterations', cards: 'Cards' };

export class BBCatalog extends BBElement {
  static schema = schema;
  static css = `
bb-catalog { --bbc-h: 640px; }
bb-catalog .bbc-wait { color: var(--bb-muted); font-size: 13px; }
bb-catalog data-views { min-width: 0; --data-height: var(--bbc-h); }
@media (max-width: 640px) { bb-catalog { --bbc-h: 560px; } }
`;

  /** The panel's solution links fire bb-open (once per element; capture, so data-ui never follows them itself). */
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

  async render() {
    const d = this.data;
    const s = this.settings;
    const href = (id) => this.context.href('solution', { id });
    const rows = catalogRows(d, { showAblations: s.show_ablations, href });
    if (!rows.length) return this.empty();
    this.listen();
    this._hrefs = new Map(rows.filter((r) => r.page).map((r) => [new URL(r.page, document.baseURI).href, r.id]));
    const box = d.box || 'Box';
    const wait = document.createElement('div');
    wait.className = 'bbc-wait';
    wait.textContent = 'Loading the iterations…';
    this.replaceChildren(wait);
    const token = (this._token = (this._token || 0) + 1);
    const core = await loadViews();
    if (token !== this._token) return; // a newer render started meanwhile
    const doc = catalogBase(d, s);
    const text = `# ${box}: iterations, proposals-pages/iterations/iterations.base's Iterations and Kept only tables + Cards (bb-catalog)\n${core.stringifyBase(doc)}`;
    const views = document.createElement('data-views');
    views.id = `bbc-${++uid}`;
    views.setAttribute('no-url', '');
    views.setAttribute('view', VIEW_NAMES[s.view] || 'Iterations');
    views.setAttribute('aria-label', `${box}: iterations`);
    // settled = the first view drew (the story runner and shoot wait on the "Loading" line going away)
    views.addEventListener('data-views-render', (e) => { this.dataset.drew = e.detail.type; wait.remove(); }, { once: true });
    views.baseText = text;
    views.base = core.parseBase(text);
    // WHY the settings in the data id: data-ui keeps a reader's view changes per data id, so a page.json edit starts fresh
    views.data = { id: `bb/${box}/catalog/${s.view}.${s.sort}.${+s.show_ablations}`, title: `${box} iterations`,
      titleProperty: 'id', linkProperty: 'page', properties: catalogProperties(d, rows), rows };
    this.append(views);
  }
}
register(BBCatalog);
