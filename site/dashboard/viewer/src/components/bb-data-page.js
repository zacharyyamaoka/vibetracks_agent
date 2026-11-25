/* <bb-data-page>: a tab's stock body (Zach's layout ruling, viewer/CONTRACT.md §11): a data-ui <data-views> over ONE
   state.json slice, with the page's .base file as its presets (view tabs), the <data-facets> rail and the side panel
   on row click. The .base file is hosted unchanged: its `data:` key is replaced by the slice's rows. No .base file =
   one table over every field. Set settings before state (bb-page does): the slice it is handed is the one `slice`
   names, and no other. */
import { BBElement, esc } from '../core/element.js';
import { register } from '../core/registry.js';
import { get } from '../core/slices.js';
import { loadViews } from '../core/kit.js';
import { noteRows, notePages } from '../core/notes.js';
import schema from './bb-data-page.schema.js';

let uid = 0;

/** The stock row view: one table, scalar and list fields in first-seen order (objects stay for the side panel). */
export function stockBase(rows, slice) {
  const order = [];
  for (const r of rows.slice(0, 50)) for (const [k, v] of Object.entries(r)) {
    // `_` keys ride with the row and are never columns (a note's text: `_note`, CONTRACT §17)
    if (order.includes(k) || k.startsWith('_') || (v && typeof v === 'object' && !Array.isArray(v))) continue;
    order.push(k);
  }
  const properties = {};
  for (const k of order) {
    const nums = rows.map((r) => r[k]).filter((v) => typeof v === 'number');
    if (nums.length && nums.some((v) => !Number.isInteger(v))) properties[k] = { digits: 4 };
  }
  return { properties, views: [{ type: 'table', name: `All ${slice}`, order }] };
}

export function rowsOf(list) {
  return list.map((r, i) => {
    const row = r && typeof r === 'object' ? { ...r } : { value: r };
    if (row.id === undefined || row.id === null) row.id = row.n ?? i + 1;
    row.id = String(row.id);
    return row;
  });
}

export class BBDataPage extends BBElement {
  static schema = schema;
  static css = `
bb-data-page .bbd { display: flex; gap: 12px; min-width: 0; }
bb-data-page .bbd > data-facets { flex: 0 0 220px; min-width: 0; }
bb-data-page .bbd > data-views { flex: 1 1 auto; min-width: 0; }
@media (max-width: 700px) { bb-data-page .bbd { flex-direction: column; } bb-data-page .bbd > data-facets { flex: none; } }
`;

  readList() { return [this.settings.slice]; }

  async render() {
    const s = this.settings;
    const list = get(this.data, s.slice);
    if (!Array.isArray(list) || !list.length) {
      // the page's sentence: its first sentence as the headline, the rest (how to add a row) under it
      const cut = s.empty.indexOf('. ');
      return cut > 0 ? this.empty(s.empty.slice(0, cut + 1), esc(s.empty.slice(cut + 2))) : this.empty(s.empty || `No rows in ${s.slice} yet.`);
    }
    this.innerHTML = `<div class="bb-muted" style="font-size:13px">Loading the ${esc(s.slice)} row view…</div>`;
    const core = await loadViews();
    let text = s.base_text || (s.base ? await this.context.asset(s.base) : '');
    const doc = text ? core.parseBase(text) : stockBase(list, s.slice);
    delete doc.data; // WHY: hosted unchanged; the rows are the slice's, whatever file the preset was written against
    // CONTRACT §16.3: the page's own filter ANDed with the file's (data-ui's andFilters), so a preset written against
    // iterations-only data is hosted unchanged over a slice that also holds ablation runs (costs: kind == "iteration")
    if (s.filters) doc.filters = core.andFilters(doc.filters, s.filters);
    if (!text) text = core.stringifyBase(doc);
    const views = document.createElement('data-views');
    views.id = `bbd-${s.slice.replace(/\W/g, '-')}-${++uid}`;
    views.setAttribute('no-url', '');
    views.setAttribute('aria-label', `${this.data.box || 'Box'}: ${s.slice}`);
    if (s.view) views.setAttribute('view', s.view);
    views.style.setProperty('--data-height', `${s.height}px`);
    views.addEventListener('data-views-render', (e) => { this.dataset.drew = e.detail.type; }, { once: true });
    views.baseText = text;
    views.base = doc;
    const rows = rowsOf(list);
    // CONTRACT §17: a row that is a Markdown file (`_note`) opens as the note in the Obsidian-parity viewer; set before the
    // data, so data-ui keeps the host's page (its own would fetch the file)
    const notes = noteRows(rows);
    if (notes) views.pageRenderer = notePages(views, rows);
    // a note's panel is headed by its title, as Obsidian heads it by its name
    const titleProperty = notes && rows.every((r) => typeof r.title === 'string') ? 'title' : 'id';
    views.data = { id: `bb/${this.data.box || 'box'}/${s.slice}`, title: s.slice, titleProperty, rows };
    const row = document.createElement('div');
    row.className = 'bbd';
    if (s.facets) {
      const rail = document.createElement('data-facets');
      rail.setAttribute('for', views.id);
      row.append(rail);
    }
    row.append(views);
    this.replaceChildren(row);
  }
}
register(BBDataPage);
