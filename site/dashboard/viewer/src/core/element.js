/* BBElement: the base of every viewer component (viewer/CONTRACT.md §7). Light DOM, framework-free, like data-ui.

   el.state    = the whole state.json  -> el.data holds ONLY the header + the slices schema.reads declares (frozen)
   el.settings = {id: value}           -> merged over the schema's defaults (an invalid value keeps the default)
   el.blocks   = [{id, type, settings}]
   el.context  = bb-page's context (links, load, asset, open); a standalone element gets a default one
   render()    = draw from this.data / this.settings / this.blocks; this.empty(text) draws the empty state */

import { pick } from './slices.js';
import { resolve, defaults } from './settings.js';
import { makeContext, fetchJson } from './context.js';
import { adoptCss } from './tokens.js';

export class BBElement extends HTMLElement {
  static schema = null;

  constructor() {
    super();
    this._data = null;
    this._settings = null;
    this._blocks = [];
    this._context = null;
    this._queued = false;
  }

  get schema() { return this.constructor.schema; }

  /* Standalone use, with no bb-page (a plain static page, one script tag):
     <bb-headliner state-src="state.json" settings='{"x":"date"}' links='{"solution":"detail.html?id={id}"}'>
     state-src is fetched through the page context (the one place that loads); links makes a click follow its href. */
  static get observedAttributes() { return ['state-src', 'settings', 'links']; }
  attributeChangedCallback(name, old, value) {
    if (old === value) return;
    try {
      if (name === 'settings') this.settings = value ? JSON.parse(value) : {};
      else if (name === 'links') this._context = null;
      else if (name === 'state-src' && value) {
        this._stateUrl = new URL(value, document.baseURI).href;
        fetchJson(this._stateUrl).then((s) => { this.state = s; }, (e) => this.fail(e));
      }
    } catch (e) { this.fail(e); }
  }

  /** The slices this component declared, plus the header. Never the whole state. */
  get data() { return this._data; }
  set state(s) { this._data = pick(s, this.readList()); this.update(); }
  /** The slices to keep (custom-html narrows "*" by its own setting; everything else: schema.reads). */
  readList() { return this.schema.reads || []; }

  get settings() { return this._settings || defaults(this.schema.settings); }
  set settings(given) {
    const { values, errors } = resolve(this.schema.settings, given || {});
    this._settings = values;
    this.settingErrors = errors;
    this.update();
  }

  get blocks() { return this._blocks; }
  set blocks(list) { this._blocks = Array.isArray(list) ? list : []; this.update(); }

  get context() {
    if (!this._context) {
      const links = this.getAttribute('links');
      this._context = Object.assign(makeContext({ stateUrl: this._stateUrl, links: links ? JSON.parse(links) : {} }), { follow: !!links });
    }
    return this._context;
  }
  set context(ctx) { this._context = ctx; this.update(); }

  connectedCallback() {
    this.classList.add('bb-el');
    if (this.constructor.css) adoptCss(this.localName, this.constructor.css);
    this.update();
  }

  disconnectedCallback() { this.teardown?.(); }

  /** Re-render once per task, however many properties were set. */
  update() {
    if (this._queued) return;
    this._queued = true;
    queueMicrotask(() => {
      this._queued = false;
      if (!this.isConnected) return;
      if (this._data === null) {
        // waiting for state-src: say so; with no state at all, render against an empty state (each empty state shows)
        if (this.waitingForState()) { this.innerHTML = '<div class="bb-muted" style="font-size:13px">Loading state.json…</div>'; return; }
        this._data = pick(null, []);
      }
      try {
        const out = this.render();
        if (out && typeof out.then === 'function') out.catch((e) => this.fail(e));
      } catch (e) { this.fail(e); }
    });
  }

  /** True while the state-src load in attributeChangedCallback has not set .state yet: draw "Loading", not render().
      WHY a method: bb-page loads its template and state itself inside render(), so it must never wait here (it did,
      and a page given state-src stayed on "Loading state.json…" for good: the pages lane, 2026-11-24). */
  waitingForState() { return this.hasAttribute('state-src'); }

  render() {}

  /** The standard empty state: the schema's sentence (or a specific one), never a blank box. */
  empty(text = this.schema.empty, hint = '') {
    this.innerHTML = `<div class="bb-empty" data-empty="${this.localName}"><b>${esc(text)}</b>${hint ? `<div style="margin-top:4px">${hint}</div>` : ''}</div>`;
  }

  fail(error) {
    this.innerHTML = `<div class="bb-error"><b>${esc(this.schema?.name || this.localName)} could not render.</b><pre>${esc(String(error?.message || error))}</pre></div>`;
    console.warn(`[${this.localName}]`, error);
  }
}

export const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** A number the way the headliner reads it: 3 significant digits, integers whole, never rounded to 0. */
export function fmtNum(v, decimals = null) {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  if (Number.isInteger(v) && decimals === null) return v.toLocaleString('en-CA');
  if (decimals !== null && decimals !== undefined) return v.toLocaleString('en-CA', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const a = Math.abs(v);
  return a >= 1000 ? v.toLocaleString('en-CA', { maximumFractionDigits: 0 }) : a >= 100 ? v.toFixed(0) : v.toPrecision(3);
}
