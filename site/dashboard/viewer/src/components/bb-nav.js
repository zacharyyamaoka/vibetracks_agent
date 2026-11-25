/* <bb-nav>: the box's tabs (viewer/CONTRACT.md §11, §17). Each count is read from a slice; a count it cannot read is left
   off, never shown as 0. On a phone the tabs scroll inside the bar, never the page.

   §17 (Zach, 2026-11-24): the built-in tabs, then the box's own (the `tabs` slice, one file each under site/tabs/), a
   "+" that says how to add one; top right a GitHub button to the box's repo (`about.url`; none when the box names no
   repo) and a settings gear: Appearance, Light / Dark / System (src/core/appearance.js), remembered in this browser. */
import { BBElement, esc } from '../core/element.js';
import { register } from '../core/registry.js';
import { PAGES, PAGE_LABELS, pageId } from '../core/slices.js';
import { fill } from '../core/context.js';
import { customTabs, ADD_TAB } from '../core/tabs.js';
import { APPEARANCES, currentAppearance, setAppearance, restoreAppearance, storedAppearance } from '../core/appearance.js';
import { GITHUB, GEAR } from '../core/icons.js';
import { onTheme } from '../core/tokens.js';
import schema from './bb-nav.schema.js';

const repoUrl = (about) => (about && typeof about.url === 'string' && /^https?:\/\//.test(about.url) ? about.url : null);

/** A link that leaves the box's site: an absolute http(s) URL. A relative path, a hash or a query stays inside it. */
export const isExternal = (url) => /^https?:\/\//i.test(String(url || ''));

/** One link block: "label ↗" in a new tab only when it leaves the site; a link inside the site (the landing, another
    page of the box) is a plain link. WHY (lane SHIP, 2026-11-24): every block was drawn "label ↗", so a way back to the
    landing read as an external link (tests/bb-nav-links.test.mjs). */
export function linkHtml({ label, url }) {
  return isExternal(url)
    ? `<a class="bbn-link" href="${esc(url)}" target="_blank" rel="noopener">${esc(label)} ↗</a>`
    : `<a class="bbn-link" href="${esc(url)}">${esc(label)}</a>`;
}
const repoName = (url) => { try { return new URL(url).pathname.replace(/^\/|\/$|\.git$/g, '') || url; } catch { return url; } };

export class BBNav extends BBElement {
  static schema = schema;
  static css = `
bb-nav { position: relative; }
bb-nav .bbn { display: flex; flex-direction: column; border-bottom: 1px solid var(--bb-border); min-width: 0; }
bb-nav .bbn-head { display: flex; align-items: center; gap: 6px 12px; min-width: 0; min-height: 34px; }
bb-nav .bbn-brand { flex: 1 1 auto; font-weight: 650; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
bb-nav .bbn-brand small { font-weight: 400; color: var(--bb-muted); margin-left: 6px; font-size: 12px; }
bb-nav .bbn-right { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; justify-content: flex-end; margin-left: auto; min-width: 0; }
bb-nav .bbn-tools { display: flex; gap: 2px; align-items: center; flex: none; }
bb-nav .bbn-tabs { display: flex; flex-wrap: wrap; align-items: center; gap: 0 2px; min-width: 0; }
bb-nav .bbn-tablist { display: contents; } /* the tabs and the + wrap as one row of items */
bb-nav .bbn-tab { flex: none; display: inline-flex; align-items: center; gap: 6px; padding: 9px 10px 8px; color: var(--bb-muted); text-decoration: none;
  font-size: 14px; white-space: nowrap; border-bottom: 2px solid transparent; margin-bottom: -1px; }
bb-nav .bbn-tab:hover { color: var(--bb-fg); }
bb-nav .bbn-tab[aria-current="page"] { color: var(--bb-fg); border-bottom-color: var(--bb-fg); font-weight: 600; }
bb-nav .bbn-count { font-size: 11.5px; color: var(--bb-muted); background: var(--bb-subtle); border-radius: 9px; padding: 1px 6px; font-variant-numeric: tabular-nums; }
bb-nav .bbn-count.bf { font-style: italic; }
bb-nav .bbn-sep { flex: none; width: 1px; height: 18px; background: var(--bb-border); margin: 0 6px; }
bb-nav .bbn-pill { display: inline-flex; gap: 6px; align-items: center; font-size: 13px; padding: 4px 10px; border-radius: 14px; text-decoration: none;
  border: 1px solid var(--bb-border); color: var(--bb-muted); white-space: nowrap; }
bb-nav .bbn-pill.on { border-color: color-mix(in srgb, var(--bb-warn) 55%, var(--bb-border)); color: var(--bb-fg); background: color-mix(in srgb, var(--bb-warn) 12%, var(--bb-bg)); }
bb-nav .bbn-pill b { font-variant-numeric: tabular-nums; }
bb-nav .bbn-link { font-size: 13px; white-space: nowrap; }
bb-nav .bbn-icon { display: inline-flex; align-items: center; justify-content: center; flex: none; width: 32px; height: 32px; border-radius: var(--bb-radius);
  color: var(--bb-muted); background: none; border: 1px solid transparent; cursor: pointer; padding: 0; text-decoration: none; font: inherit; }
bb-nav .bbn-icon:hover, bb-nav .bbn-icon[aria-expanded="true"] { color: var(--bb-fg); background: var(--bb-hover); }
bb-nav .bbn-icon:focus-visible { outline: 2px solid var(--bb-accent); outline-offset: 1px; }
bb-nav .bbn-icon.plus { width: 28px; height: 28px; font-size: 18px; line-height: 1; font-weight: 400; }
bb-nav .bbn-pop { position: fixed; z-index: 50; width: 280px; max-width: calc(100vw - 16px); background: var(--bb-bg); color: var(--bb-fg);
  border: 1px solid var(--bb-border); border-radius: calc(var(--bb-radius) + 4px); box-shadow: 0 10px 30px rgba(0, 0, 0, .14); padding: 12px 14px; font-size: 13.5px; }
bb-nav .bbn-pop[hidden] { display: none; }
bb-nav .bbn-pop h2 { font-size: 13px; font-weight: 650; margin: 0 0 10px; }
bb-nav .bbn-pop .lbl { display: block; color: var(--bb-muted); font-size: 12px; margin: 0 0 6px; }
bb-nav .bbn-seg { display: flex; border: 1px solid var(--bb-border); border-radius: var(--bb-radius); overflow: hidden; }
bb-nav .bbn-seg button { flex: 1 1 0; font: inherit; font-size: 13px; padding: 6px 8px; background: none; color: var(--bb-muted); border: 0; cursor: pointer; }
bb-nav .bbn-seg button + button { border-left: 1px solid var(--bb-border); }
bb-nav .bbn-seg button[aria-checked="true"] { background: var(--bb-subtle); color: var(--bb-fg); font-weight: 600; }
bb-nav .bbn-seg button:focus-visible { outline: 2px solid var(--bb-accent); outline-offset: -2px; }
bb-nav .bbn-pop .note { color: var(--bb-muted); font-size: 12px; margin: 8px 0 0; }
bb-nav .bbn-pop code { font-family: var(--bb-mono); font-size: 12px; overflow-wrap: anywhere; }
bb-nav .bbn-pop ul { margin: 8px 0; padding-left: 0; list-style: none; display: grid; gap: 4px; }
bb-nav .bbn-pop li code { margin-right: 6px; }
@media (max-width: 640px) {
  bb-nav .bbn-head { flex-wrap: wrap; }
  bb-nav .bbn-brand { flex: 1 1 0; }
  bb-nav .bbn-right { order: 3; flex-basis: 100%; justify-content: flex-start; margin-left: 0; }
  bb-nav .bbn-right:empty { display: none; }
  bb-nav .bbn-tabs { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: thin; }
}
`;

  connectedCallback() {
    // the reader's remembered appearance, before anything draws (a theme the host set on <html> wins)
    restoreAppearance();
    super.connectedCallback();
  }

  teardown() { this.closePops(); }

  counts() {
    const d = this.data;
    const c = {};
    if (d.spec && Number.isInteger(d.spec.shall_active)) c.spec = { text: `${d.spec.shall_pass}/${d.spec.shall_active}`, title: 'shalls passing / active' };
    if (Array.isArray(d.feedback)) c.feedback = { text: String(d.feedback.length), title: 'feedback files' };
    if (Array.isArray(d.iterations)) c.iterations = { text: String(d.iterations.length),
      title: `${d.iterations.length} iterations${d.unscored?.length ? `, ${d.unscored.length} waiting for a score` : ''}` };
    if (Array.isArray(d.ablations)) c.ablation = { text: String(d.ablations.length), title: `${d.ablations.length} ablation runs (study variants, not search steps)` };
    if (d.agents) {
      if (d.agents.registered) c.agents = { text: String(d.agents.registered), title: 'agents that registered themselves' };
      else if (d.agents.backfilled) c.agents = { text: String(d.agents.backfilled), bf: true, title: `0 registered; ${d.agents.backfilled} proposers backfilled from each solution's meta.json` };
      else c.agents = { text: '0', title: 'no agent recorded' };
    }
    if (d.activity && Number.isInteger(d.activity.rows)) c.activity = { text: d.activity.rows.toLocaleString('en-CA'), bf: d.activity.backfilled,
      title: d.activity.backfilled ? 'backfilled from git log and the evaluations' : 'rows of the activity log' };
    if (Array.isArray(d.audits)) c.audits = { text: String(d.audits.length), title: d.audits.length ? 'audit rounds' : 'never audited' };
    if (Array.isArray(d.analysis)) {
      const n = (t) => d.analysis.filter((r) => r.type === t).length;
      c.analysis = { text: String(d.analysis.length), title: `${n('report')} reports, ${n('markdown')} Markdown files, ${n('study')} study files` };
    } else if (Number.isInteger(d.reports)) c.analysis = { text: String(d.reports), title: 'report files' };
    if (Array.isArray(d.ideas)) {
      const open = d.ideas.filter((i) => i.open && i.lane === 'agent').length;
      c.ideas = { text: String(open), title: `${open} open in "I'll try"` };
    }
    if (Array.isArray(d.references)) c.references = { text: String(d.references.length), title: 'references: what the box builds on' };
    if (d.notes && Array.isArray(d.notes.rows) && d.notes.rows.length) c.notes = { text: String(d.notes.rows.length), title: `notes in ${d.notes.folder || 'the box'}` };
    return c;
  }

  /** The tab that is open: a box's own tab when the page is one (its `page` is the tab's slug), else `current`. */
  currentTab(own) {
    const page = this.context.page;
    if (own.some((t) => t.slug === page)) return page;
    return pageId(this.settings.current);
  }

  render() {
    this.closePops();
    const s = this.settings;
    const d = this.data || {};
    const pattern = s.href || this.context.links.page;
    const counts = s.counts ? this.counts() : {};
    const own = customTabs(d);
    const current = this.currentTab(own);
    const tab = (id, label, c, cls = '') => `<a class="bbn-tab${cls}" role="tab" href="${esc(fill(pattern, { page: id }))}" data-page="${esc(id)}"${id === current ? ' aria-current="page" aria-selected="true"' : ' aria-selected="false"'}>${esc(label)}${c ? `<span class="bbn-count${c.bf ? ' bf' : ''}" title="${esc(c.title)}">${esc(c.text)}</span>` : ''}</a>`;
    const tabs = PAGES.map((p) => tab(p, PAGE_LABELS[p], counts[p])).join('')
      + (own.length ? '<span class="bbn-sep" aria-hidden="true"></span>' : '') + own.map((t) => tab(t.slug, t.label, null, ' own')).join('');
    const needs = Array.isArray(d.needs) ? d.needs.length : null;
    const pill = s.needs_pill && needs !== null
      ? `<a class="bbn-pill${needs ? ' on' : ''}" href="${esc(fill(pattern, { page: 'overview' }))}#needs" data-page="needs" title="${needs ? 'open asks only Zach can answer' : 'nothing is waiting on Zach'}">Needs you <b>${needs}</b></a>` : '';
    const links = this.blocks.filter((b) => b.type === 'link' && b.settings.label && b.settings.url)
      .map((b) => linkHtml(b.settings)).join('');
    const brand = s.brand ? `<div class="bbn-brand" title="${esc(d.box)}">${esc(d.box || '')}${d.ref ? `<small class="bb-mono">@ ${esc(d.ref)}</small>` : ''}</div>` : '';
    const repo = repoUrl(d.about);
    const gh = repo ? `<a class="bbn-icon gh" href="${esc(repo)}" target="_blank" rel="noopener" data-github aria-label="${esc(repoName(repo))} on GitHub" title="${esc(repoName(repo))} on GitHub">${GITHUB}</a>` : '';
    const gear = `<button type="button" class="bbn-icon gear" data-settings aria-haspopup="dialog" aria-expanded="false" aria-controls="${this.popId('settings')}" aria-label="Settings" title="Settings">${GEAR}</button>`;
    const add = `<button type="button" class="bbn-icon plus" data-add-tab aria-haspopup="dialog" aria-expanded="false" aria-controls="${this.popId('add')}" aria-label="Add a tab" title="Add a tab">+</button>`;
    // WHY two rows: the box's name with the repo and settings top right, then the tabs (twelve and the box's own never fit
    // beside the name); the + scrolls with the tabs, its popover is fixed so the scroller never clips it
    this.innerHTML = `<nav class="bbn" aria-label="${esc(d.box || 'Box')} tabs"><div class="bbn-head">${brand}<div class="bbn-right">${links}${pill}</div><div class="bbn-tools">${gh}${gear}</div></div>`
      + `<div class="bbn-tabs"><div class="bbn-tablist" role="tablist">${tabs}</div>${add}</div></nav>`
      + this.settingsPop() + this.addPop();
    this.querySelectorAll('a[data-page]').forEach((a) => a.addEventListener('click', (e) => {
      const go = this.context.open(this, { kind: a.dataset.page === 'needs' ? 'need' : 'page', id: a.dataset.page, href: a.getAttribute('href') });
      if (!go || !this.context.follow) e.preventDefault();
    }));
    // WHY: on a phone the tabs scroll sideways; the open one is scrolled into the bar (never the page)
    const strip = this.querySelector('.bbn-tabs');
    const open = this.querySelector('.bbn-tab[aria-current="page"]');
    if (strip && open && strip.scrollWidth > strip.clientWidth) strip.scrollLeft = Math.max(0, open.offsetLeft - strip.offsetLeft - 24);
    this.wirePop(this.querySelector('[data-settings]'), this.querySelector('[data-pop="settings"]'));
    this.wirePop(this.querySelector('[data-add-tab]'), this.querySelector('[data-pop="add"]'));
    this.querySelectorAll('[data-appearance]').forEach((b) => b.addEventListener('click', () => {
      const kept = setAppearance(b.dataset.appearance);
      this.syncAppearance(kept);
      this.dispatchEvent(new CustomEvent('bb-appearance', { bubbles: true, composed: true, detail: { appearance: b.dataset.appearance, remembered: kept } }));
    }));
  }

  popId(name) { return `${this._uid ||= `bbn${Math.random().toString(36).slice(2, 8)}`}-${name}`; }

  settingsPop() {
    const now = currentAppearance();
    const seg = APPEARANCES.map((a) => `<button type="button" role="radio" data-appearance="${a.value}" aria-checked="${a.value === now}">${a.label}</button>`).join('');
    return `<div class="bbn-pop" data-pop="settings" id="${this.popId('settings')}" role="dialog" aria-label="Settings" hidden>
<h2>Settings</h2><span class="lbl" id="${this.popId('appearance')}">Appearance</span>
<div class="bbn-seg" role="radiogroup" aria-labelledby="${this.popId('appearance')}">${seg}</div>
<p class="note" data-remembered></p></div>`;
  }

  addPop() {
    const k = ADD_TAB.kinds.map(([ext, what]) => `<li><code>${esc(ext)}</code>${esc(what)}</li>`).join('');
    return `<div class="bbn-pop" data-pop="add" id="${this.popId('add')}" role="dialog" aria-label="Add a tab" hidden>
<h2>Add a tab</h2><p style="margin:0">${esc(ADD_TAB.lead)}</p><p style="margin:6px 0 0"><code>${esc(ADD_TAB.pattern)}</code></p><ul>${k}</ul><p class="note">${esc(ADD_TAB.after)}</p></div>`;
  }

  /** The popover's buttons and its note say what the page shows now (another control may have changed it). */
  syncAppearance(kept = this._kept ?? null) {
    this._kept = kept; // the last write's answer: a later re-sync (the theme observer) must not forget that storage refused it
    const now = currentAppearance();
    this.querySelectorAll('[data-appearance]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.appearance === now)));
    const note = this.querySelector('[data-remembered]');
    if (!note) return;
    const stored = storedAppearance();
    note.textContent = kept === false ? 'Not remembered: this browser keeps no site storage here.'
      : now === 'system' ? 'Follows this device’s light or dark setting.' : stored === now ? 'Remembered in this browser.' : 'Set on this page.';
  }

  wirePop(btn, pop) {
    if (!btn || !pop) return;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = pop.hidden;
      this.closePops();
      if (open) this.openPop(btn, pop);
    });
  }

  openPop(btn, pop) {
    pop.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    if (pop.dataset.pop === 'settings') this.syncAppearance();
    // WHY fixed and clamped to the viewport: the tab bar scrolls sideways, and a popover inside it would be clipped; on a
    // 390 px phone it must never widen the page
    const r = btn.getBoundingClientRect();
    const w = Math.min(pop.offsetWidth || 280, innerWidth - 16);
    pop.style.top = `${Math.round(r.bottom + 6)}px`;
    pop.style.left = `${Math.round(Math.max(8, Math.min(r.right - w, innerWidth - w - 8)))}px`;
    (pop.querySelector('[aria-checked="true"]') || pop.querySelector('button, a, [tabindex]') || pop).focus?.({ preventScroll: true });
    const close = (e) => {
      if (e.type === 'keydown' && e.key !== 'Escape') return;
      if (e.type === 'pointerdown' && (pop.contains(e.target) || btn.contains(e.target))) return;
      this.closePops();
      if (e.type === 'keydown') btn.focus({ preventScroll: true });
    };
    // the popover follows the page: another control (or the system scheme) may change the theme while it is open
    const stopTheme = pop.dataset.pop === 'settings' ? onTheme(() => this.syncAppearance()) : () => {};
    this._popOff = () => {
      stopTheme();
      document.removeEventListener('pointerdown', close, true);
      document.removeEventListener('keydown', close, true);
      removeEventListener('scroll', closeAll, true);
      removeEventListener('resize', closeAll);
    };
    const closeAll = () => this.closePops();
    document.addEventListener('pointerdown', close, true);
    document.addEventListener('keydown', close, true);
    addEventListener('scroll', closeAll, true);
    addEventListener('resize', closeAll);
  }

  closePops() {
    if (this._popOff) { this._popOff(); this._popOff = null; }
    this.querySelectorAll?.('.bbn-pop').forEach((p) => { p.hidden = true; });
    this.querySelectorAll?.('[aria-expanded="true"]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
  }
}
register(BBNav);
