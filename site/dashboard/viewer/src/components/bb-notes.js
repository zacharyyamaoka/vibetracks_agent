/* <bb-notes>: the Notes tab (viewer/CONTRACT.md §17). Zach, 2026-11-24: "another one for like Notes (which is just like a
   free form markdown section I think)".

   - notes/ (the `notes` slice's rows, folded the way data-ui reads a notes folder): a data-ui <data-views> over them,
     the folder's own .base as its presets when it has one (hosted unchanged), else Table / Cards; the <data-facets> rail;
     a row opens as the note in the Obsidian-parity viewer (src/core/notes.js).
   - NOTES.md alone: that file as one page, in the same viewer.
   - Neither: the empty state says how to add one. */
import { BBElement, esc } from '../core/element.js';
import { register } from '../core/registry.js';
import { loadViews } from '../core/kit.js';
import { notePages, mountNotePage } from '../core/notes.js';
import schema from './bb-notes.schema.js';

let uid = 0;

/** The stock presets for a notes folder: every note as a row (its title, when it last changed, the start of its text),
    and as cards. The note's own keys stay one click away (data-ui's + column). */
export const NOTES_BASE = `# Notes: one row per .md file in the box's notes/ folder (CONTRACT §17); a row opens as the note
facets:
  - { property: changed, as: date }
open: { mode: side, splitAt: 980 }
properties:
  title: { displayName: "Note" }
  name: { displayName: "File" }
  changed: { displayName: "Changed" }
  sha: { displayName: "In commit" }
  page: { displayName: "Text" }
views:
  - type: table
    name: Notes
    order: [title, changed, page]
    sort:
      - { property: changed, direction: DESC }
  - type: cards
    name: Cards
    order: [title, changed, page]
    cardSize: 280
    sort:
      - { property: changed, direction: DESC }
`;

export const HOW_TO = 'Add a <code>notes/</code> folder to the box with one <code>.md</code> file per note (front matter optional: its keys become columns), or a single <code>NOTES.md</code>. The fold reads them at the next commit; each note opens as Obsidian draws it.';

export class BBNotes extends BBElement {
  static schema = schema;
  static css = `
bb-notes .bbno { display: flex; gap: 12px; min-width: 0; }
bb-notes .bbno > data-facets { flex: 0 0 220px; min-width: 0; }
bb-notes .bbno > data-views { flex: 1 1 auto; min-width: 0; }
bb-notes .bbno-head { display: flex; gap: 10px; align-items: baseline; flex-wrap: wrap; margin: 0 0 10px; font-size: 13px; color: var(--bb-muted); }
bb-notes .bbno-head b { color: var(--bb-fg); font-weight: 600; }
bb-notes .bb-empty code { font-family: var(--bb-mono); font-size: .92em; }
@media (max-width: 700px) { bb-notes .bbno { flex-direction: column; } bb-notes .bbno > data-facets { flex: none; } }
`;

  teardown() { this._page?.destroy(); this._page = null; }

  async render() {
    this.teardown();
    const n = this.data.notes;
    const rows = n && Array.isArray(n.rows) ? n.rows : [];
    if (!n || (!rows.length && !n.text)) return this.empty(schema.empty, HOW_TO);
    const head = document.createElement('div');
    head.className = 'bbno-head';
    if (!rows.length) { // one NOTES.md: the page itself
      head.innerHTML = `<b>${esc(n.file)}</b>${n.changed ? `<span>changed ${esc(String(n.changed).slice(0, 10))}${n.sha ? ` · <span class="bb-mono">${esc(n.sha)}</span>` : ''}</span>` : ''}`;
      this.replaceChildren(head);
      // Obsidian's inline title is the file's name; left off when the note opens with its own heading (said once)
      this._page = mountNotePage(this, { text: n.text, title: n.title ? '' : String(n.file || '').replace(/\.md$/, '') });
      await this._page.ready;
      this.dataset.drew = 'page';
      return;
    }
    this.innerHTML = '<div class="bb-muted" style="font-size:13px">Loading the notes…</div>';
    const core = await loadViews();
    const s = this.settings;
    const text = n.base || NOTES_BASE;
    const doc = core.parseBase(text);
    delete doc.data; // hosted unchanged: the rows are the folder's notes, whatever file the .base names
    const views = document.createElement('data-views');
    views.id = `bbno-${++uid}`;
    views.setAttribute('no-url', '');
    views.setAttribute('aria-label', `${this.data.box || 'Box'}: notes`);
    if (s.view) views.setAttribute('view', s.view);
    views.style.setProperty('--data-height', `${s.height}px`);
    views.addEventListener('data-views-render', (e) => { this.dataset.drew = e.detail.type; }, { once: true });
    const list = rows.map((r) => ({ ...r }));
    views.pageRenderer = notePages(views, list); // before the data: the host's page wins over data-ui's (which would fetch)
    views.baseText = text;
    views.base = doc;
    // data-ui's notes dataset (CONTRACT §54): the rows, their typed properties, and what the folder is
    // the folder's own keys typed as data-ui types them, and the fields the fold adds (WHY all of them: a dataset that
    // names its properties gets no others inferred)
    views.data = { id: `bb/${this.data.box || 'box'}/notes`, title: 'notes', titleProperty: 'title', rows: list,
      properties: { ...(n.properties || {}), title: { type: 'text', label: 'Note', readOnly: true },
        path: { type: 'text', label: 'File', readOnly: true }, changed: { type: 'date', label: 'Changed', readOnly: true },
        sha: { type: 'text', label: 'In commit', readOnly: true } } };
    head.innerHTML = `<b>${esc(n.folder || n.file)}</b><span>${rows.length} note${rows.length === 1 ? '' : 's'}${n.base_path ? ` · presets from <span class="bb-mono">${esc(n.base_path)}</span>` : ''}</span>`;
    const row = document.createElement('div');
    row.className = 'bbno';
    if (s.facets) {
      const rail = document.createElement('data-facets');
      rail.setAttribute('for', views.id);
      row.append(rail);
    }
    row.append(views);
    this.replaceChildren(head, row);
  }
}
register(BBNotes);
