/* A row that is a Markdown file opens as the note itself, in data-ui's Obsidian-parity viewer (viewer/CONTRACT.md §17).

   Zach, 2026-11-24: "I can also just have like plain markdown files I write"; data-ui CONTRACT §54: "A record opens as the
   note", drawn by like_obsidian_md_viewer (vendored with data-ui at like-obsidian/). The fold carries each such file's
   whole text in the row's `_note` (data-ui never makes a column of a `_` key), so nothing is fetched: the state is the one
   thing a component reads.

   WHY a host page renderer and not data-ui's own note page: data-ui's fetches `<notes.root><id>.md`, and a viewer
   component loads nothing but its state (CONTRACT §7, §9.3). This hands the same viewer the same text, in data-ui's own
   page frame (`.dv-note-page > .dv-obsidian`), so data-ui's note-page.css themes it from the host's tokens exactly as it
   themes its own. A follow-up for data-ui: let a host give a row's text (then this file shrinks to that one line).

   notePages(views, rows)         -> el.pageRenderer for a <data-views>: (host, {row}) => {update, destroy}
   mountNotePage(host, {text, title}) -> one note on its own (NOTES.md, a custom .md tab), {destroy}
   noteRows(rows)                 -> whether any row carries a note */
import { loadNoteViewer, ensureKitCss } from './kit.js';
import { isDark, onTheme, adoptCss } from './tokens.js';

const SOURCE_KEY = 'data-ui/note-source-mode'; // data-ui's own note page remembers Source mode under this key: one choice for both
const remembered = () => { try { return localStorage.getItem(SOURCE_KEY) === '1'; } catch { return false; } };
const remember = (on) => { try { localStorage.setItem(SOURCE_KEY, on ? '1' : '0'); } catch { /* no storage: it holds for this visit */ } };
const theme = () => (isDark() ? 'dark' : 'light');
const safeUrl = (url) => (typeof url === 'string' && /^(https?|mailto):/i.test(url) ? url : null);

export const noteRows = (rows) => Array.isArray(rows) && rows.some((r) => r && typeof r._note === 'string');

/** Obsidian's property types for the rows' own keys (data-ui note-page.js propertyTypes, read from the values): a list,
    a number, a true/false, a plain date. Only types every value fits, or Obsidian would draw a mismatch it does not show. */
export function propertyTypes(rows) {
  const out = {};
  const keys = new Set();
  for (const r of rows) for (const k of Object.keys(r)) if (!k.startsWith('_')) keys.add(k);
  for (const k of keys) {
    const vs = rows.map((r) => r[k]).filter((v) => v !== null && v !== undefined && v !== '');
    if (!vs.length) continue;
    if (vs.every(Array.isArray)) out[k] = 'multitext';
    else if (vs.every((v) => typeof v === 'number')) out[k] = 'number';
    else if (vs.every((v) => typeof v === 'boolean')) out[k] = 'checkbox';
    else if (vs.every((v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v))) out[k] = 'date';
  }
  return out;
}

const yaml = (v) => (Array.isArray(v) ? `[${v.map((x) => JSON.stringify(x)).join(', ')}]` : typeof v === 'string' ? JSON.stringify(v) : String(v));

/** A row with no file of its own (an HTML report, a chart) as a note: its own fields as the Properties block and a line
    that opens it, so every row of a tab opens the same way. Only what the row holds; nothing is made up. */
export function rowDoc(row, { skip = ['id', 'title', 'url'] } = {}) {
  const lines = Object.entries(row).filter(([k, v]) => !k.startsWith('_') && !skip.includes(k) && v !== null && v !== undefined && v !== ''
    && (typeof v !== 'object' || Array.isArray(v))).map(([k, v]) => `${k}: ${yaml(v)}`);
  const open = row.url ? `[Open ${row.path || row.title || 'it'} ↗](${row.url})` : '';
  return `${lines.length ? `---\n${lines.join('\n')}\n---\n\n` : ''}${open}\n`;
}

function frame(host, { bar = true } = {}) {
  const page = document.createElement('div');
  page.className = 'dv-note-page bb-note-page';
  const tools = document.createElement('div');
  tools.className = 'bb-note-bar';
  const msg = document.createElement('div');
  msg.className = 'dv-note-msg';
  msg.hidden = true;
  msg.setAttribute('role', 'status');
  const view = document.createElement('div');
  view.className = 'dv-obsidian';
  view.dataset.readOnly = '';
  const box = document.createElement('div');
  box.className = 'dv-note-view';
  box.innerHTML = '<p class="dv-note-loading">Opening the note…</p>';
  view.append(box);
  if (bar) page.append(tools);
  page.append(msg, view);
  host.append(page);
  return { page, tools, msg, box };
}

/** Mount one note: the text, its title, Source mode beside it; theme kept in step with the page. */
async function mount(parts, { text, title, links = {}, source = remembered(), types = {}, url = null }) {
  const mod = await loadNoteViewer();
  parts.box.textContent = '';
  const view = mod.mountNote(parts.box, {
    doc: text, title: title || '', theme: theme(), readOnly: true, sourceMode: source,
    properties: { types },
    resolveLink: async (target) => ({ exists: !!(links.row && links.row(target)) }),
    openLink: (target) => { const hit = links.row && links.row(target); if (hit && links.open) links.open(hit); },
    openUrl: (u) => {
      const safe = safeUrl(u);
      if (safe) { window.open(safe, '_blank', 'noopener'); return; }
      const hit = links.path && links.path(u);
      if (hit && links.open) links.open(hit);
    },
    resolveMedia: () => null, // pictures live in the repo, not in the state; the viewer draws its missing-picture box
    resolveEmbed: () => null,
  });
  let on = !!source;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'dv-btn bb-note-source';
  const label = () => {
    btn.textContent = on ? 'Live Preview' : 'Source mode';
    btn.setAttribute('aria-pressed', String(on));
    btn.title = on ? 'Draw the note as Obsidian does' : 'The file as written, its properties as YAML';
  };
  label();
  btn.addEventListener('click', () => { on = !on; remember(on); view.setSourceMode(on); label(); });
  parts.tools.replaceChildren(btn);
  if (url) {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.className = 'bb-note-open';
    a.textContent = 'On GitHub ↗';
    parts.tools.append(a);
  }
  const stop = onTheme(() => view.setTheme(theme()));
  return { view, stop };
}

const norm = (p) => {
  const out = [];
  for (const s of String(p).split('/')) { if (s === '..') out.pop(); else if (s && s !== '.') out.push(s); }
  return out.join('/');
};
const dir = (p) => String(p || '').split('/').slice(0, -1).join('/');

/** el.pageRenderer for a <data-views> whose rows carry `_note`: each row opens as its note; a row without one opens as
    its own fields (rowDoc). A `[[link]]` or a relative `.md` link to another row of the table opens that row. */
export function notePages(views, rows) {
  const types = propertyTypes(rows);
  const byId = new Map(rows.map((r) => [String(r.id), r]));
  const pathOf = (r) => r.path || r.source || `${r.id}.md`;
  return function renderNote(host, { row }) {
    const parts = frame(host);
    const state = { gone: false, held: null, row };
    const links = {
      row: (target) => {
        const t = String(target).split('#')[0].split('|')[0].trim().replace(/\.md$/, '');
        return byId.get(t) || rows.find((r) => String(r.name || r.id).split('/').pop() === t.split('/').pop()) || null;
      },
      path: (href) => {
        const want = norm(`${dir(pathOf(state.row))}/${String(href).split('#')[0]}`);
        return rows.find((r) => norm(pathOf(r)) === want) || null;
      },
      open: (hit) => views.openPeek && views.openPeek(String(hit.id)),
    };
    const text = typeof row._note === 'string' ? row._note : rowDoc(row);
    mount(parts, { text, title: row.title || row.name || String(row.id), links, types, url: row.url || null })
      .then((held) => { if (state.gone) { held.view.destroy(); held.stop(); } else state.held = held; })
      .catch((err) => { if (!state.gone) { parts.box.textContent = ''; parts.msg.hidden = false; parts.msg.textContent = `This note could not be drawn: ${err?.message || err}`; } });
    return {
      update(next) { if (next) state.row = byId.get(String(next.id)) || next; if (state.held) state.held.view.setTheme(theme()); },
      destroy() { state.gone = true; if (state.held) { state.held.view.destroy(); state.held.stop(); } state.held = null; },
    };
  };
}

/** One note on its own, as a page (NOTES.md, a custom .md tab): inside `.data-ui` so data-ui's tokens and its note-page
    colours apply outside a <data-views>. */
export function mountNotePage(host, { text, title = '', url = null }) {
  ensureKitCss();
  const wrap = document.createElement('div');
  wrap.className = 'data-ui bb-note-solo';
  host.append(wrap);
  const parts = frame(wrap);
  const state = { gone: false, held: null };
  const done = mount(parts, { text, title, url, types: {} })
    .then((held) => { if (state.gone) { held.view.destroy(); held.stop(); } else state.held = held; return held; })
    .catch((err) => { if (!state.gone) { parts.box.textContent = ''; parts.msg.hidden = false; parts.msg.textContent = `This note could not be drawn: ${err?.message || err}`; } });
  return {
    ready: done,
    destroy() { state.gone = true; if (state.held) { state.held.view.destroy(); state.held.stop(); } state.held = null; },
  };
}

/** The CSS a host adds once for the note's bar and the solo page (the rest is data-ui's note-page.css). */
export const NOTE_CSS = `
.bb-note-bar { display: flex; gap: 10px; align-items: center; justify-content: flex-end; margin: 0 0 6px; font-size: 13px; }
.bb-note-bar .bb-note-open { color: var(--bb-accent); text-decoration: none; }
.bb-note-solo { background: var(--bb-bg); border: 1px solid var(--bb-border); border-radius: calc(var(--bb-radius) + 4px); padding: 12px 16px 4px; min-width: 0; }
.bb-note-solo .dv-obsidian { min-width: 0; }
/* WHY: Obsidian's 32 px file margins inside a card's own padding leave a 390 px phone ~215 px of text */
@media (max-width: 640px) { .bb-note-solo { padding: 8px 4px 2px; } .bb-note-solo .md-obsidian { --file-margins: 12px; } }
`;
adoptCss('bb-note', NOTE_CSS);
