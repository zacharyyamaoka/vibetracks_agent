/* The box's dashboard on its own site (viewer/CONTRACT.md §18): <bb-site-nav> on top, then one tab of the viewer at a time,
   the viewer's own templates (pages/site/<page>.json, unedited, their .base presets beside them) over the box's state.json.
   A box's site gets this file, the viewer it imports and the page that loads it (site/dashboard/index.html) from
   blackbox_agent's tools/vendor_viewer.py; never edit the copy, re-vendor it.

   Routes are the hash: #<tab id> (a built-in tab or the box's own, CONTRACT §17.3) or #solution=<id> (shown under
   Iterations). A tab is one link click, Back walks the tabs, a URL names a tab and survives a reload.

   The page's <body> names the state, relative to the page (the default is a box's site/ layout), and the bar its nav.json:
     <body data-state="../data/state.json"> <bb-site-nav src="../nav.json" current="blackbox" href="#{page}">
   The template's own bb-nav section is left out: the site bar draws the tabs (with the same counts) for every page.
   window.__dash = {ready, page, errors} is what a headless check waits on. */
import '../src/components/index.js';
import { tabTemplate } from '../src/core/tabs.js';
import { PAGES, pageId } from '../src/core/slices.js';

const SITE = new URL('../pages/site/', import.meta.url).href;
const body = document.body;
const STATE = new URL(body.dataset.state || '../data/state.json', location.href).href;
window.__dash = { ready: false, page: null, errors: [] };

async function json(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json();
}

const cache = new Map();
const builtIn = (page) => {
  const url = new URL(`${page}.json`, SITE).href;
  if (!cache.has(url)) cache.set(url, json(url).then((t) => ({ t, url })));
  return cache.get(url);
};

function route() {
  const h = decodeURIComponent(location.hash.slice(1));
  if (h.startsWith('solution=')) return { page: 'solution', id: h.slice(9), tab: 'iterations' };
  const page = /^[a-z0-9-]+$/.test(h) ? pageId(h) : 'overview';
  return { page, id: '', tab: page };
}

/** The template a route shows: a built-in tab or the solution page (the viewer's file), the box's own tab (the state's
    tabs slice), else the viewer's "no tab by that name" page. A copy, without its bb-nav section. */
async function templateFor(state, r) {
  let got = null;
  if (PAGES.includes(r.page) || r.page === 'solution') got = await builtIn(r.page);
  else {
    const own = tabTemplate(state, r.page);
    got = own ? { t: own, url: SITE } : await builtIn('tab');
  }
  const t = JSON.parse(JSON.stringify(got.t));
  for (const [id, s] of Object.entries(t.sections || {})) {
    if (s.type === 'bb-nav') { delete t.sections[id]; t.order = (t.order || []).filter((x) => x !== id); }
  }
  if (r.page === 'solution' && t.sections?.detail) t.sections.detail.settings = { ...(t.sections.detail.settings || {}), id: r.id };
  t.links = { ...(t.links || {}), page: '#{page}', solution: '#solution={id}' };
  return { t, url: got.url };
}

async function main() {
  const bar = document.querySelector('bb-site-nav');
  const view = document.querySelector('[data-view]') || document.body.appendChild(document.createElement('main'));
  const state = await json(STATE);
  if (bar) bar.state = state;
  let shown = null;
  let wantNeeds = false;

  const scrollNeeds = () => {
    wantNeeds = false;
    const s = view.querySelector('section[data-section="needs"]');
    if (s) window.scrollTo({ top: s.getBoundingClientRect().top + scrollY - 8 });
  };

  const show = async () => {
    const r = route();
    if (bar) bar.setAttribute('page', r.tab);
    const key = `${r.page}|${r.id}`;
    if (key === shown) { if (wantNeeds) scrollNeeds(); return; }
    const first = shown === null;
    shown = key;
    window.__dash.ready = false;
    window.__dash.page = r.page;
    const { t, url } = await templateFor(state, r);
    document.title = `${r.page === 'solution' ? `${r.id} · ` : ''}${t.name} · ${state.box || 'Dashboard'}`;
    const el = document.createElement('bb-page');
    el.setAttribute('nofollow', '');
    el.pageUrl = url; // the .base presets resolve beside the template, as in the viewer's own site
    el.stateUrl = STATE; // bb-run/1 records resolve beside state.json (CONTRACT §4, §15)
    el.template = t;
    el.state = state;
    view.replaceChildren(el);
    if (!first) window.scrollTo(0, 0);
    for (let i = 0; i < 400 && !view.querySelector('section.bb-section'); i++) await new Promise((ok) => requestAnimationFrame(ok));
    view.querySelectorAll('section.bb-section[data-section]').forEach((s) => { if (!s.id) s.id = s.dataset.section; });
    if (wantNeeds) { await new Promise((ok) => setTimeout(ok, 150)); scrollNeeds(); }
    window.__dash.ready = true;
  };

  document.addEventListener('bb-open', (e) => {
    const d = e.detail || {};
    e.preventDefault(); // every open is a route here: a hash change, so Back walks it
    if (d.kind === 'page' && d.id) location.hash = pageId(d.id);
    else if (d.kind === 'need') { wantNeeds = true; if (location.hash === '#overview' || !location.hash) show(); else location.hash = 'overview'; }
    else if (d.kind === 'solution' && d.id) location.hash = `solution=${encodeURIComponent(d.id)}`;
  });
  window.addEventListener('hashchange', () => { show().catch(fail); });
  await show();
}

function fail(e) {
  window.__dash.errors.push(String(e && e.message || e));
  console.error(e);
  const view = document.querySelector('[data-view]');
  if (view) view.innerHTML = `<div class="bb-error" role="alert"><b>The dashboard could not load.</b><pre>${String(e && e.message || e).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</pre></div>`;
}

main().catch(fail);
