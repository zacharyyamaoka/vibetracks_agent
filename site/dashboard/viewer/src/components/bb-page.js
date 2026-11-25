/* <bb-page>: renders a page.json template (viewer/CONTRACT.md §2). It validates the template against every registered
   component's schema, draws a visible error card in place of a section that fails (and the rest of the page anyway),
   and gives each section its settings, ordered blocks, the page context and the state, in that order. Each section
   keeps only the slices its own schema declares.

   <bb-page src="overview.json" state-src="state.json"></bb-page>    or    el.template = {...}; el.state = {...} */
import { BBElement, esc } from '../core/element.js';
import { register, registered } from '../core/registry.js';
import { pick } from '../core/slices.js';
import { validatePage, orderedBlocks } from '../core/validate.js';
import { makeContext, fetchJson, importModule } from '../core/context.js';
import schema from './bb-page.schema.js';

const WIDTH = { narrow: 960, normal: 1200, wide: 1600 };

export class BBPage extends BBElement {
  static schema = schema;
  static get observedAttributes() { return ['src', 'state-src']; }
  static css = `
bb-page.bb-el { margin: 0 auto; padding: 16px 16px 48px; width: 100%; }
bb-page > .bbp { display: flex; flex-direction: column; min-width: 0; }
bb-page > .bbp > section.bb-section { min-width: 0; }
`;

  set template(t) { this._template = t; this.update(); }
  get template() { return this._template; }
  // the page is the dispatcher: it holds the state to hand each section its own slices (its own data is the header)
  set state(s) { this._full = s; this._data = pick(s, []); this.update(); }

  attributeChangedCallback() { this._loaded = false; this.update(); }
  // WHY: render() fetches src and state-src itself (load()); BBElement's wait for a state-src fetch would never end here
  waitingForState() { return false; }

  async load() {
    if (this._loaded) return;
    this._loaded = true;
    const src = this.getAttribute('src'), stateSrc = this.getAttribute('state-src');
    if (src) { this.pageUrl = new URL(src, document.baseURI).href; this._template = await fetchJson(this.pageUrl); }
    if (stateSrc) { this.stateUrl = new URL(stateSrc, document.baseURI).href; this._full = await fetchJson(this.stateUrl); this._data = pick(this._full, []); }
  }

  async render() {
    if (!this._loaded && (this.hasAttribute('src') || this.hasAttribute('state-src')) && !this.childElementCount)
      this.innerHTML = '<div class="bb-muted" style="font-size:13px">Loading the page…</div>';
    await this.load();
    const t = this._template;
    if (!t) return this.empty('No page template: set src="page.json" or .template.');
    for (const path of t.imports || []) await importModule(path, this.pageUrl);
    const catalogue = registered();
    const errors = validatePage(t, catalogue);
    const bySection = {};
    const pageErrors = [];
    for (const e of errors) {
      const m = /^sections\.([^.[]+)/.exec(e.path);
      if (m && t.sections?.[m[1]]) (bySection[m[1]] ||= []).push(e);
      else pageErrors.push(e);
    }
    if (errors.length) console.warn(`[bb-page] ${t.name || 'page'}: ${errors.length} problem(s)\n${errors.map((e) => `${e.path}: ${e.message}`).join('\n')}`);
    const s = this.settings;
    this.style.maxWidth = `${WIDTH[s.width] || 1200}px`;
    const ctx = makeContext({ state: this._full, stateUrl: this.stateUrl, pageUrl: this.pageUrl, page: t.page || 'overview', links: t.links });
    ctx.follow = !this.hasAttribute('nofollow');
    const wrap = document.createElement('div');
    wrap.className = 'bbp';
    wrap.style.gap = `${s.gap}px`;
    if (pageErrors.length) wrap.append(card(`${t.name || 'This page'}: the template has ${pageErrors.length} problem${pageErrors.length === 1 ? '' : 's'}`, pageErrors));
    const order = Array.isArray(t.order) ? t.order : [];
    let drawn = 0;
    for (const id of order) {
      const sec = t.sections?.[id];
      if (!sec || sec.disabled) continue;
      const box = document.createElement('section');
      box.className = 'bb-section';
      box.dataset.section = id;
      box.dataset.type = sec.type;
      if (bySection[id]) {
        box.append(card(`Section “${id}” (${sec.type}) can't render`, bySection[id]));
      } else {
        const sch = catalogue[sec.type];
        const el = document.createElement(sec.type);
        el.settings = sec.settings || {};
        el.blocks = orderedBlocks(sec, sch);
        el.context = ctx;
        el.state = this._full;
        box.append(el);
      }
      wrap.append(box);
      drawn++;
    }
    if (!drawn && !pageErrors.length) return this.empty();
    this.replaceChildren(wrap);
  }
}

function card(title, errs) {
  const div = document.createElement('div');
  div.className = 'bb-error';
  div.innerHTML = `<b>${esc(title)}</b><pre>${esc(errs.map((e) => `${e.path}: ${e.message}`).join('\n'))}</pre>`;
  return div;
}
register(BBPage);
