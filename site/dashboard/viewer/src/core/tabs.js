/* A box's own tabs (viewer/CONTRACT.md §17): the `tabs` slice the fold writes from site/tabs/<order>-<slug>.<ext>, each
   row holding the page template the site renders for it. Pure: no DOM. */
import { RESERVED_PAGES } from './slices.js';

/** The tabs a site lists, in the fold's order: each with a template, a slug no built-in page has, never refused. */
export function customTabs(state) {
  const list = state && Array.isArray(state.tabs) ? state.tabs : [];
  return list.filter((t) => t && t.template && !t.why && !RESERVED_PAGES.includes(t.slug));
}

/** The page template for a box's own tab (a copy), or null. */
export function tabTemplate(state, slug) {
  const t = customTabs(state).find((x) => x.slug === slug);
  return t ? JSON.parse(JSON.stringify(t.template)) : null;
}

/** How a box adds a tab: the sentence the tab bar's + says (and the contract's example). */
export const ADD_TAB = {
  lead: 'A box adds a tab by adding one file to its repo:',
  pattern: 'site/tabs/<order>-<slug>.md | .json | .base | .html',
  kinds: [
    ['.md', 'a Markdown page, drawn as Obsidian draws it'],
    ['.json', 'a page template (page.json: sections in order)'],
    ['.base', 'rows: data: <slice>, its views the presets'],
    ['.html', 'self-contained HTML in a sandboxed frame'],
  ],
  after: 'It shows after the built-in tabs at the next fold.',
};
