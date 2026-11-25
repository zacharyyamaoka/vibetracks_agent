/* <bb-site-nav>: the box's site bar, the same on every page (viewer/CONTRACT.md §18). Lane NAV's pick, 01 Two rows
   (PICKS.md 2026-11-24 ~21:30; proposals-nav/): the brand row names the box (a link to its landing page) and holds the
   dashboards; the row below holds the open dashboard's own tabs: the viewer's tabs with their counts on the box's own
   dashboard, a drop-in's pages (and where in it you are) on a drop-in. A row that does not fit folds into More ▾
   (priority-plus: short labels first, then the highest priority number, right to left); the open tab never folds.
   Nothing on the left (Zach, 2026-11-24: "Out of scope is things that require things going on the left").

   One include per page, right after <body>, and every page of the site reads the same nav.json:
     <bb-site-nav src="../nav.json" current="comparison"></bb-site-nav>
     <script type="module" src="../dashboard/viewer/src/components/bb-site-nav.js"></script>
   WHY an include, not a frame (lane SHIP): each dashboard stays its own page at its own URL, so its own deep links
   (?deployment=…#tab=…, runs/<task>/report.html#tab=track) survive a reload and are shareable, Back is the browser's, and
   nothing is symlinked (GitHub Pages serves one site/ folder).

   The bar's heights are fixed per width band (46 + 36 px from 761 px; 78 + 36 px below), so it is the same height on
   every page whatever the page's own CSS; it sets its own font, spacing and resets for the same reason. */
import { BBElement, esc } from '../core/element.js';
import { register } from '../core/registry.js';
import { fill } from '../core/context.js';
import { customTabs } from '../core/tabs.js';
import { APPEARANCES, APPEARANCE_KEY, currentAppearance, setAppearance, restoreAppearance, storedAppearance } from '../core/appearance.js';
import { GITHUB, GEAR } from '../core/icons.js';
import { BBNav } from './bb-nav.js';
import { makeModel, locate, foldOrder } from './bb-site-nav.model.js';
import schema from './bb-site-nav.schema.js';

const svg = (d, extra = '') => `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"${extra}>${d}</svg>`;
/** The dashboards' icons (lane NAV's, proposals-nav/_shared/nav-styles.js): drawn here, nothing fetched. */
export const SITE_ICONS = {
  box: svg('<path d="M8 1.8 13.6 5v6L8 14.2 2.4 11V5z"/><path d="M2.6 5.1 8 8.2l5.4-3.1M8 8.2v6"/>'),
  coverage: svg('<rect x="1.8" y="1.8" width="12.4" height="12.4" rx="2"/><circle cx="5" cy="10.5" r=".9" fill="currentColor"/><circle cx="7.6" cy="6.4" r=".9" fill="currentColor"/><circle cx="10.6" cy="9" r=".9" fill="currentColor"/><circle cx="11.4" cy="4.8" r=".9" fill="currentColor"/>'),
  comparison: svg('<path d="M1.8 11.5c2.3 0 3-6.5 6.2-6.5s3.6 4 6.2 4"/><path d="M1.8 12.8c2.6 0 3.4-5.2 6.2-5.2 2.4 0 3.4 2.6 6.2 2.6" stroke-dasharray="1.6 1.6"/>'),
  grid: svg('<rect x="1.8" y="1.8" width="12.4" height="12.4" rx="2"/><path d="M1.8 6h12.4M1.8 10h12.4M6 1.8v12.4M10 1.8v12.4"/>'),
  chevron: svg('<path d="m4.5 6.2 3.5 3.5 3.5-3.5"/>', ' class="bbs-chev"'),
};
const ATTRS = ['src', 'current', 'page', 'here', 'href', 'theme'];

export class BBSiteNav extends BBNav {
  static schema = schema;
  static get observedAttributes() { return [...BBElement.observedAttributes, ...ATTRS]; }
  // WHY the bar's own token values (lane SHIP): the viewer's --bb-* fall back to shadcn's names (--muted, --accent,
  // --border), which a drop-in page may use for something else (trajectory_tracking_agent's pages: --muted is a text
  // grey, --accent a blue), so the bar read the host's text grey as its background. Here only data-ui's --data-* (a host
  // that themes data-ui themes the bar too), then the viewer's literals, light and dark: the same bar on every page.
  static css = `
bb-site-nav { --bb-bg: var(--data-bg, #ffffff); --bb-fg: var(--data-fg, #18181b); --bb-muted: var(--data-muted, #71717a);
  --bb-subtle: var(--data-subtle, #f4f4f5); --bb-border: var(--data-border, #e4e4e7); --bb-hover: var(--data-hover, #ececef);
  --bb-accent: var(--data-accent, #2563eb); --bb-warn: var(--data-warn, #c98a0c); --bb-radius: var(--data-radius, 8px);
  --bb-font: var(--data-font, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif); color-scheme: light; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) bb-site-nav { --bb-bg: var(--data-bg, #111113); --bb-fg: var(--data-fg, #ececef);
  --bb-muted: var(--data-muted, #9a9aa3); --bb-subtle: var(--data-subtle, #1c1c20); --bb-border: var(--data-border, #2c2c31);
  --bb-hover: var(--data-hover, #26262b); --bb-accent: var(--data-accent, #7aa7f2); --bb-warn: var(--data-warn, #e5a93b); color-scheme: dark; } }
:root[data-theme="dark"] bb-site-nav { --bb-bg: var(--data-bg, #111113); --bb-fg: var(--data-fg, #ececef); --bb-muted: var(--data-muted, #9a9aa3);
  --bb-subtle: var(--data-subtle, #1c1c20); --bb-border: var(--data-border, #2c2c31); --bb-hover: var(--data-hover, #26262b);
  --bb-accent: var(--data-accent, #7aa7f2); --bb-warn: var(--data-warn, #e5a93b); color-scheme: dark; }
bb-site-nav { display: block; position: relative; z-index: 30; background: var(--bb-bg); color: var(--bb-fg); border-bottom: 1px solid var(--bb-border);
  font: 400 14px/1.25 var(--bb-font); letter-spacing: normal; text-align: left; text-transform: none; -webkit-font-smoothing: antialiased; margin: 0; padding: 0; }
bb-site-nav *, bb-site-nav *::before, bb-site-nav *::after { box-sizing: border-box; }
bb-site-nav [hidden] { display: none !important; }
bb-site-nav a, bb-site-nav a:hover, bb-site-nav a:visited { text-decoration: none; }
bb-site-nav svg { display: inline-block; flex: none; width: 16px; height: 16px; max-width: none; margin: 0; vertical-align: middle; }
bb-site-nav button { font: inherit; margin: 0; letter-spacing: normal; text-transform: none; box-shadow: none; min-width: 0; min-height: 0; }
bb-site-nav .bbs-head { display: flex; align-items: stretch; gap: 0 12px; height: 46px; padding: 0 16px; min-width: 0; }
bb-site-nav .bbs-brand { align-self: center; flex: 0 1 auto; min-width: 0; max-width: 34%; font-weight: 650; font-size: 15px; line-height: 20px;
  color: var(--bb-fg); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
bb-site-nav .bbs-brand:hover { text-decoration: underline; text-underline-offset: 3px; }
bb-site-nav .bbs-row { display: flex; align-items: flex-end; flex-wrap: nowrap; gap: 0 2px; min-width: 0; overflow: hidden; }
bb-site-nav .bbs-dash { flex: 1 1 auto; padding-left: 4px; }
bb-site-nav .bbs-tab { flex: none; display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; color: var(--bb-muted); background: none;
  border: 0; border-bottom: 2px solid transparent; border-radius: 6px 6px 0 0; margin: 0; font-weight: 400; }
bb-site-nav .bbs-tab:hover { color: var(--bb-fg); background: var(--bb-hover); }
bb-site-nav .bbs-tab .s { display: none; }
bb-site-nav .is-short .bbs-tab .l { display: none; }
bb-site-nav .is-short .bbs-tab .s { display: inline; }
bb-site-nav .bbs-dash .bbs-tab { height: 40px; padding: 0 12px; gap: 7px; font-size: 14.5px; border-bottom-width: 3px; }
bb-site-nav .bbs-dash .bbs-tab[aria-current="page"] { color: var(--bb-accent); border-bottom-color: var(--bb-accent); font-weight: 600; }
bb-site-nav .bbs-dash .bbs-tab[aria-current="page"]:hover { background: none; }
bb-site-nav .bbs-dash .bbs-tab .dot { width: 7px; height: 7px; border-radius: 2px; background: var(--g, var(--bb-accent)); flex: none; }
bb-site-nav .bbs-right { align-self: center; margin-left: auto; display: flex; gap: 4px; align-items: center; flex: none; }
bb-site-nav .bbs-pill { display: inline-flex; gap: 6px; align-items: center; height: 28px; padding: 0 10px; border-radius: 14px; font-size: 13px; white-space: nowrap;
  border: 1px solid var(--bb-border); color: var(--bb-muted); }
bb-site-nav .bbs-pill.on { border-color: color-mix(in srgb, var(--bb-warn) 55%, var(--bb-border)); color: var(--bb-fg); background: color-mix(in srgb, var(--bb-warn) 12%, var(--bb-bg)); }
bb-site-nav .bbs-pill b { font-variant-numeric: tabular-nums; font-weight: 650; }
bb-site-nav .bbs-icon { display: inline-flex; align-items: center; justify-content: center; flex: none; width: 32px; height: 32px; padding: 0;
  border-radius: var(--bb-radius); color: var(--bb-muted); background: none; border: 1px solid transparent; cursor: pointer; }
bb-site-nav .bbs-icon:hover, bb-site-nav .bbs-icon[aria-expanded="true"] { color: var(--bb-fg); background: var(--bb-hover); }
bb-site-nav .bbs-sub { display: flex; align-items: flex-end; gap: 0 2px; height: 36px; padding: 0 16px; min-width: 0; overflow: hidden;
  border-top: 1px solid var(--bb-border); background: var(--bb-subtle); }
bb-site-nav .bbs-sub .bbs-row { flex: 0 1 auto; }
bb-site-nav .bbs-sub .bbs-tab { height: 34px; padding: 0 10px; font-size: 13.5px; }
bb-site-nav .bbs-sub .bbs-tab[aria-current="page"] { color: var(--bb-fg); background: var(--bb-bg); border-bottom-color: var(--bb-fg); font-weight: 600; }
bb-site-nav .bbs-count { font-size: 11.5px; font-weight: 400; color: var(--bb-muted); background: var(--bb-subtle); border-radius: 9px; padding: 1px 6px; font-variant-numeric: tabular-nums; line-height: 1.3; }
bb-site-nav .bbs-sub .bbs-tab[aria-current="page"] .bbs-count, bb-site-nav .bbs-sub .bbs-tab:hover .bbs-count { background: var(--bb-hover); }
bb-site-nav .bbs-count.bf { font-style: italic; }
bb-site-nav .bbs-crumb { flex: none; display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 10px; font-size: 13.5px; font-weight: 600;
  color: var(--bb-fg); white-space: nowrap; background: var(--bb-bg); border-bottom: 2px solid var(--bb-fg); border-radius: 6px 6px 0 0; }
bb-site-nav .bbs-crumb .sep { color: var(--bb-muted); font-weight: 400; }
bb-site-nav .bbs-about { flex: 1 1 0; min-width: 0; align-self: center; padding-left: 10px; font-size: 12.5px; color: var(--bb-muted);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
bb-site-nav .bbs-more-wrap { flex: none; display: flex; align-items: flex-end; }
bb-site-nav .bbs-more { display: inline-flex; align-items: center; gap: 4px; padding: 0 10px; color: var(--bb-muted); background: none; border: 0;
  border-bottom: 2px solid transparent; border-radius: 6px 6px 0 0; cursor: pointer; white-space: nowrap; }
bb-site-nav .bbs-dash .bbs-more { height: 40px; font-size: 14.5px; border-bottom-width: 3px; }
bb-site-nav .bbs-sub .bbs-more { height: 34px; font-size: 13.5px; }
bb-site-nav .bbs-more:hover, bb-site-nav .bbs-more[aria-expanded="true"] { color: var(--bb-fg); background: var(--bb-hover); }
bb-site-nav .bbs-more[aria-current="page"] { color: var(--bb-fg); font-weight: 600; border-bottom-color: var(--bb-fg); }
bb-site-nav .bbs-chev { width: 14px; height: 14px; transition: transform .12s; }
bb-site-nav .bbs-more[aria-expanded="true"] .bbs-chev { transform: rotate(180deg); }
bb-site-nav a:focus-visible, bb-site-nav button:focus-visible { outline: 2px solid var(--bb-accent); outline-offset: -2px; }
bb-site-nav .bbs-menu { position: fixed; z-index: 60; min-width: 220px; max-width: calc(100vw - 16px); max-height: calc(100dvh - 80px); overflow: auto; padding: 6px;
  background: var(--bb-bg); color: var(--bb-fg); border: 1px solid var(--bb-border); border-radius: 10px; box-shadow: 0 12px 32px rgba(0, 0, 0, .16); font-size: 14px; }
bb-site-nav .bbs-menu .h { font-size: 11px; font-weight: 650; letter-spacing: .06em; text-transform: uppercase; color: var(--bb-muted); padding: 8px 10px 4px; }
bb-site-nav .bbs-menu a { display: flex; align-items: center; gap: 10px; padding: 7px 10px; border-radius: 7px; color: var(--bb-fg); white-space: nowrap; }
bb-site-nav .bbs-menu a .c { margin-left: auto; color: var(--bb-muted); font-size: 12.5px; font-variant-numeric: tabular-nums; }
bb-site-nav .bbs-menu a:hover, bb-site-nav .bbs-menu a:focus { background: var(--bb-hover); outline: none; }
bb-site-nav .bbs-menu a[aria-current="page"] { background: var(--bb-subtle); font-weight: 600; }
bb-site-nav .bbn-pop { position: fixed; z-index: 60; width: 280px; max-width: calc(100vw - 16px); background: var(--bb-bg); color: var(--bb-fg);
  border: 1px solid var(--bb-border); border-radius: calc(var(--bb-radius) + 4px); box-shadow: 0 10px 30px rgba(0, 0, 0, .14); padding: 12px 14px; font-size: 13.5px; line-height: 1.4; }
bb-site-nav .bbn-pop h2 { font-size: 13px; font-weight: 650; margin: 0 0 10px; color: var(--bb-fg); letter-spacing: normal; }
bb-site-nav .bbn-pop .lbl { display: block; color: var(--bb-muted); font-size: 12px; margin: 0 0 6px; }
bb-site-nav .bbn-seg { display: flex; border: 1px solid var(--bb-border); border-radius: var(--bb-radius); overflow: hidden; }
bb-site-nav .bbn-seg button { flex: 1 1 0; font-size: 13px; padding: 6px 8px; background: none; color: var(--bb-muted); border: 0; cursor: pointer; }
bb-site-nav .bbn-seg button + button { border-left: 1px solid var(--bb-border); }
bb-site-nav .bbn-seg button[aria-checked="true"] { background: var(--bb-subtle); color: var(--bb-fg); font-weight: 600; }
bb-site-nav .bbn-pop .note { color: var(--bb-muted); font-size: 12px; margin: 8px 0 0; }
bb-site-nav .bbs-fail { align-self: center; color: var(--bb-muted); font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
@media (max-width: 760px) {
  bb-site-nav .bbs-head { flex-wrap: wrap; height: auto; padding: 0 8px; gap: 0 8px; }
  bb-site-nav .bbs-brand { height: 40px; line-height: 40px; flex: 1 1 0; max-width: none; }
  bb-site-nav .bbs-right { height: 40px; }
  bb-site-nav .bbs-dash { order: 3; flex: 1 1 100%; height: 38px; padding-left: 0; }
  bb-site-nav .bbs-dash .bbs-tab, bb-site-nav .bbs-dash .bbs-more { height: 36px; padding: 0 8px; font-size: 13.5px; }
  bb-site-nav .bbs-sub { padding: 0 8px; }
  bb-site-nav .bbs-sub .bbs-tab, bb-site-nav .bbs-sub .bbs-more, bb-site-nav .bbs-crumb { padding: 0 8px; }
}
@media (max-width: 480px) {
  /* WHY tighter here: the four dashboards stay one click away on a 390 px phone with the open one in bold (lane NAV
     measured 3/3; Model × Dataset open folded Comparison at 8 px padding) */
  bb-site-nav .bbs-dash .bbs-tab svg { display: none; }
  bb-site-nav .bbs-dash .bbs-tab, bb-site-nav .bbs-dash .bbs-more { padding: 0 6px; font-size: 13px; }
}
`;

  constructor() {
    super();
    this._given = {};
    this._doc = null;
    this._navUrl = null;
    this._failed = null;
  }

  attributeChangedCallback(name, old, value) {
    if (!ATTRS.includes(name)) { super.attributeChangedCallback(name, old, value); return; }
    if (old === value) return;
    if (value === null) delete this._given[name]; else this._given[name] = value;
    if (name === 'src') { this._doc = null; this._failed = null; this._loading = null; }
    this.settings = { ...(this._settingsGiven || {}), ...this._given };
  }

  /** Settings set as a property (a page.json section) merge with the attributes; the attributes win. */
  set settings(given) { this._settingsGiven = { ...(given || {}) }; super.settings = { ...this._settingsGiven, ...this._given }; }
  get settings() { return super.settings; }

  /** The nav document handed over (a story, a host that already read it): {doc, url} or a doc (then resolved here). */
  set nav(v) {
    const doc = v && v.doc ? v.doc : v;
    this._doc = doc || null;
    this._navUrl = v && v.url ? new URL(v.url, document.baseURI).href : new URL(this.settings.src || 'nav.json', document.baseURI).href;
    this._failed = null;
    this.update();
  }
  get nav() { return this._doc; }

  connectedCallback() {
    // a light-only page stays light (its own content has no dark mode); every other page restores the reader's pick
    if (this.settings.theme === 'light') document.documentElement.setAttribute('data-theme', 'light');
    else restoreAppearance();
    BBElement.prototype.connectedCallback.call(this);
    if (!this._ro && typeof ResizeObserver !== 'undefined') {
      let w = 0;
      this._ro = new ResizeObserver(() => { const now = this.clientWidth; if (now !== w) { w = now; this.fit(); } });
      this._ro.observe(this);
    }
    document.fonts?.ready?.then(() => this.fit());
  }

  teardown() { this.closePops(); this._ro?.disconnect(); this._ro = null; }

  load() {
    const src = this.settings.src || 'nav.json';
    this._loading = this.context.nav(src).then((doc) => {
      this._doc = doc;
      this._navUrl = new URL(src, document.baseURI).href;
      this.update();
    }, (e) => { this._failed = String(e && e.message || e); console.warn('[bb-site-nav]', e); this.update(); });
  }

  /** The model for this page: the dashboards, where this page is, the counts. */
  model() {
    const own = customTabs(this.data).map((t) => ({ slug: t.slug, label: t.label }));
    const model = makeModel(this._doc, this._navUrl, { own });
    const s = this.settings;
    const where = locate(model, { url: location.href, current: s.current, page: s.page });
    return { model, ...where };
  }

  render() {
    this.closePops();
    if (!this._doc) {
      if (this._failed) {
        this.innerHTML = `<div class="bbs-head" role="navigation" aria-label="Site"><span class="bbs-fail" role="status" title="${esc(this._failed)}">The site bar could not read ${esc(this.settings.src)}: ${esc(this._failed)}</span></div><div class="bbs-sub"></div>`;
        return;
      }
      if (!this._loading) this.load();
      // the bar's own heights while nav.json loads, so the page under it never jumps
      this.innerHTML = '<div class="bbs-head" aria-hidden="true"></div><div class="bbs-sub" aria-hidden="true"></div>';
      return;
    }
    const s = this.settings;
    const d = this.data || {};
    let where;
    try { where = this.model(); } catch (e) {
      // a nav.json that is not bb-site-nav/1 (or names a dashboard twice): said in the bar, never an empty strip
      this._failed = String(e && e.message || e);
      this._doc = null;
      this.update();
      return;
    }
    const { model, dash, tab } = where;
    this._m = { model, dash, tab };
    const onViewer = !!(dash && dash.kind === 'viewer' && s.href);
    const tabHref = (t) => (onViewer && dash.tabs.includes(t) ? fill(s.href, { page: t.id }) : t.href);
    const counts = s.counts && dash && dash.kind === 'viewer' ? this.counts() : {};
    const countHtml = (id) => { const c = counts[id]; return c ? `<span class="bbs-count${c.bf ? ' bf' : ''}" title="${esc(c.title)}">${esc(c.text)}</span>` : ''; };
    const label = (t) => (t.short && t.short !== t.label ? `<span class="l">${esc(t.label)}</span><span class="s">${esc(t.short)}</span>` : `<span>${esc(t.label)}</span>`);
    const groupVars = (g) => (g && g.color ? ` style="--g:${esc(g.color)}"` : '');
    // the brand row: the box's name, the dashboards, then Needs you, GitHub, the gear
    const dashes = model.dashboards.map((x) => {
      const open = dash && x.id === dash.id;
      const href = open && onViewer ? fill(s.href, { page: x.tabs[0].id }) : x.href;
      const icon = SITE_ICONS[x.icon] || (x.group && x.group.kind === 'domain' ? `<span class="dot"${groupVars(x.group)}></span>` : '');
      return `<a class="bbs-tab" href="${esc(href)}" data-item="${esc(x.id)}"${open ? ' aria-current="page"' : ''}${x.short !== x.label ? ` title="${esc(x.label)}"` : ''}>${icon}${label(x)}</a>`;
    }).join('');
    const more = (row) => `<span class="bbs-more-wrap" data-more-wrap hidden><button type="button" class="bbs-more" data-more="${row}" aria-haspopup="menu" aria-expanded="false"><span class="ml">${esc(model.overflow.label || 'More')}</span>${SITE_ICONS.chevron}</button></span>`;
    const needs = s.needs_pill && dash && dash.kind === 'viewer' && Array.isArray(d.needs) ? d.needs.length : null;
    const pillHref = onViewer ? fill(s.href, { page: 'overview' }) : (dash ? `${dash.href}#overview` : '');
    const pill = needs !== null ? `<a class="bbs-pill${needs ? ' on' : ''}" href="${esc(pillHref)}" data-need title="${needs ? 'open asks only Zach can answer' : 'nothing is waiting on Zach'}">Needs you <b>${needs}</b></a>` : '';
    const repo = model.site.repo || (d.about && /^https?:\/\//.test(d.about.url || '') ? d.about.url : null);
    const repoName = repo ? (() => { try { return new URL(repo).pathname.replace(/^\/|\/$|\.git$/g, ''); } catch { return repo; } })() : '';
    const gh = repo ? `<a class="bbs-icon" href="${esc(repo)}" target="_blank" rel="noopener" data-github aria-label="${esc(repoName)} on GitHub" title="${esc(repoName)} on GitHub">${GITHUB}</a>` : '';
    const gear = `<button type="button" class="bbs-icon" data-settings aria-haspopup="dialog" aria-expanded="false" aria-controls="${this.popId('settings')}" aria-label="Settings" title="Settings">${GEAR}</button>`;
    const head = `<div class="bbs-head"><a class="bbs-brand" href="${esc(model.site.landing)}" title="${esc(model.site.name)}: the landing page">${esc(model.site.name)}</a>`
      + `<div class="bbs-row bbs-dash" data-fit="dash" role="navigation" aria-label="Dashboards">${dashes}${more('dash')}</div>`
      + `<div class="bbs-right">${pill}${gh}${gear}</div></div>`;
    // the row below: the open dashboard's own tabs (the viewer's, with counts) or pages (a drop-in's), where in it, what it is
    let sub = '<div class="bbs-sub"></div>';
    if (dash) {
      const here = s.here ? `<span class="bbs-crumb" aria-current="page"><span class="sep" aria-hidden="true">›</span>${esc(s.here)}</span>` : '';
      const tabs = dash.tabs.map((t) => `<a class="bbs-tab" href="${esc(tabHref(t))}" data-item="${esc(t.id)}"${tab && t.id === tab.id && !s.here ? ' aria-current="page"' : ''}${t.short !== t.label ? ` title="${esc(t.label)}"` : ''}>${label(t)}${countHtml(t.id)}</a>`).join('');
      const about = dash.kind === 'pages' && (dash.about || dash.by) ? `<span class="bbs-about" title="${esc([dash.about, dash.by].filter(Boolean).join(' · '))}">${esc(dash.about)}${dash.by ? ` <span style="opacity:.8">· ${esc(dash.by)}</span>` : ''}</span>` : '';
      sub = `<div class="bbs-sub"><div class="bbs-row" data-fit="tabs" role="navigation" aria-label="${esc(dash.label)}">${tabs}${more('tabs')}</div>${here}${about}</div>`;
    }
    this.innerHTML = head + sub + this.sitePop() + `<div class="bbs-menu" data-menu role="menu" hidden></div>`;
    this.wire();
    this.fit();
  }

  wire() {
    this.wirePop(this.querySelector('[data-settings]'), this.querySelector('[data-pop="settings"]'));
    this.querySelectorAll('[data-appearance]').forEach((b) => b.addEventListener('click', () => {
      const mode = b.dataset.appearance;
      const kept = this.settings.theme === 'light' ? rememberOnly(mode) : setAppearance(mode);
      this.syncAppearance(kept);
      this.dispatchEvent(new CustomEvent('bb-appearance', { bubbles: true, composed: true, detail: { appearance: mode, remembered: kept } }));
    }));
    const pill = this.querySelector('[data-need]');
    if (pill) pill.addEventListener('click', (e) => {
      const go = this.context.open(this, { kind: 'need', id: 'needs', href: pill.getAttribute('href') });
      if (!go) e.preventDefault();
    });
    this.querySelectorAll('[data-more]').forEach((b) => {
      b.addEventListener('click', (e) => { e.stopPropagation(); this.toggleMenu(b); });
      b.addEventListener('keydown', (e) => { if (e.key === 'ArrowDown' && b.getAttribute('aria-expanded') !== 'true') { e.preventDefault(); this.toggleMenu(b); } });
    });
  }

  /** Priority-plus, per row: short labels first, then fold (the highest priority number first, right to left) until the
      row fits; the open item never folds. Returns {row: {visible, folded, short}} (what a test or a host measures). */
  fit() {
    const out = {};
    if (!this._m || !this.isConnected) return out;
    const { model, dash, tab } = this._m;
    for (const row of this.querySelectorAll('[data-fit]')) {
      const kind = row.dataset.fit;
      const items = kind === 'dash' ? model.dashboards : dash.tabs;
      const keep = kind === 'dash' ? dash && dash.id : (this.settings.here ? null : tab && tab.id);
      const links = [...row.querySelectorAll('[data-item]')];
      const wrap = row.querySelector('[data-more-wrap]');
      const btn = wrap && wrap.querySelector('[data-more]');
      const folded = new Set();
      const apply = () => { links.forEach((a) => { a.hidden = folded.has(a.dataset.item); }); if (wrap) wrap.hidden = folded.size === 0; };
      const fits = () => row.scrollWidth <= row.clientWidth + 1;
      row.classList.remove('is-short');
      apply();
      if (!fits() && row.querySelector('.bbs-tab .s')) row.classList.add('is-short');
      if (!fits()) for (const id of foldOrder(items, keep)) { folded.add(id); apply(); if (fits()) break; }
      const list = items.filter((t) => folded.has(t.id));
      if (btn) {
        btn._folded = list;
        btn._kind = kind;
        btn._keep = keep;
        const cur = list.find((t) => t.id === keep);
        btn.querySelector('.ml').textContent = cur ? `More: ${cur.label}` : (model.overflow.label || 'More');
        if (cur) btn.setAttribute('aria-current', 'page'); else btn.removeAttribute('aria-current');
      }
      out[kind] = { visible: links.filter((a) => !a.hidden).map((a) => a.dataset.item), folded: list.map((t) => t.id), short: row.classList.contains('is-short') };
    }
    this.fitted = out;
    return out;
  }

  /** More ▾: the folded items as a menu under the button (WAI-ARIA menu button: arrows, Home/End, Escape). */
  toggleMenu(btn) {
    const menu = this.querySelector('[data-menu]');
    if (!menu) return;
    const open = btn.getAttribute('aria-expanded') === 'true';
    this.closePops();
    if (open) { btn.focus({ preventScroll: true }); return; }
    const { dash } = this._m;
    const counts = this.settings.counts && dash && dash.kind === 'viewer' ? this.counts() : {};
    const s = this.settings;
    const onViewer = !!(dash && dash.kind === 'viewer' && s.href);
    const heading = btn._kind === 'dash' ? 'Dashboards' : dash.label;
    menu.innerHTML = `<div class="h">${esc(heading)}</div>` + (btn._folded || []).map((t) => {
      const href = btn._kind === 'tabs' && onViewer ? fill(s.href, { page: t.id }) : t.href;
      const cur = t.id === btn._keep;
      return `<a role="menuitem" href="${esc(href)}" data-item="${esc(t.id)}"${cur ? ' aria-current="page"' : ''}><span>${esc(t.label)}</span>${counts[t.id] ? `<span class="c">${esc(counts[t.id].text)}</span>` : ''}</a>`;
    }).join('');
    menu.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    const r = btn.getBoundingClientRect();
    const w = Math.min(menu.offsetWidth || 220, innerWidth - 16);
    menu.style.top = `${Math.round(r.bottom + 4)}px`;
    menu.style.left = `${Math.round(Math.max(8, Math.min(r.left, innerWidth - w - 8)))}px`;
    const items = () => [...menu.querySelectorAll('a')];
    (menu.querySelector('a[aria-current="page"]') || items()[0])?.focus({ preventScroll: true });
    const key = (e) => {
      const list = items();
      const at = list.indexOf(document.activeElement);
      if (e.key === 'Escape') { e.preventDefault(); this.closePops(); btn.focus({ preventScroll: true }); }
      else if (e.key === 'ArrowDown' && list.length) { e.preventDefault(); list[(at + 1) % list.length].focus(); }
      else if (e.key === 'ArrowUp' && list.length) { e.preventDefault(); list[(at - 1 + list.length) % list.length].focus(); }
      else if (e.key === 'Home' && list.length) { e.preventDefault(); list[0].focus(); }
      else if (e.key === 'End' && list.length) { e.preventDefault(); list[list.length - 1].focus(); }
      else if (e.key === 'Tab') this.closePops();
    };
    const away = (e) => { if (!menu.contains(e.target) && !btn.contains(e.target)) this.closePops(); };
    const closeAll = () => this.closePops();
    const picked = (e) => { if (e.target.closest('a')) this.closePops(); };
    menu.addEventListener('keydown', key);
    menu.addEventListener('click', picked);
    document.addEventListener('pointerdown', away, true);
    addEventListener('resize', closeAll);
    addEventListener('scroll', closeAll, true);
    this._menuOff = () => {
      menu.removeEventListener('keydown', key);
      menu.removeEventListener('click', picked);
      document.removeEventListener('pointerdown', away, true);
      removeEventListener('resize', closeAll);
      removeEventListener('scroll', closeAll, true);
    };
  }

  closePops() {
    super.closePops();
    if (this._menuOff) { this._menuOff(); this._menuOff = null; }
    const menu = this.querySelector?.('[data-menu]');
    if (menu) menu.hidden = true;
  }

  sitePop() {
    const now = this.shownAppearance();
    const seg = APPEARANCES.map((a) => `<button type="button" role="radio" data-appearance="${a.value}" aria-checked="${a.value === now}">${a.label}</button>`).join('');
    return `<div class="bbn-pop" data-pop="settings" id="${this.popId('settings')}" role="dialog" aria-label="Settings" hidden>
<h2>Settings</h2><span class="lbl" id="${this.popId('appearance')}">Appearance</span>
<div class="bbn-seg" role="radiogroup" aria-labelledby="${this.popId('appearance')}">${seg}</div>
<p class="note" data-remembered></p></div>`;
  }

  /** The pick the popover shows: what the page shows, or on a light-only page what is remembered for the others. */
  shownAppearance() { return this.settings.theme === 'light' ? (storedAppearance() || 'system') : currentAppearance(); }

  syncAppearance(kept = this._kept ?? null) {
    if (this.settings.theme !== 'light') { super.syncAppearance(kept); return; }
    this._kept = kept;
    const now = this.shownAppearance();
    this.querySelectorAll('[data-appearance]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.appearance === now)));
    const note = this.querySelector('[data-remembered]');
    if (note) note.textContent = kept === false ? 'Not remembered: this browser keeps no site storage here.'
      : 'This page has no dark mode, so it stays light; your pick shows on the other pages.';
  }
}

/** A pick remembered for the site's other pages without changing this one (a light-only page). */
function rememberOnly(mode) {
  try {
    const s = globalThis.localStorage;
    if (!s) return false;
    if (mode === 'light' || mode === 'dark') s.setItem(APPEARANCE_KEY, mode); else s.removeItem(APPEARANCE_KEY);
    return true;
  } catch { return false; }
}

register(BBSiteNav);
