/* data-ui, the stock part for every generic view (<data-kpi>, <data-sparkline>, <data-views>, <data-facets>), loaded by
   URL from the vendored copy (viewer/vendor/data-ui, re-vendored whole, never edited). WHY by URL and @vite-ignore:
   data-ui.js finds its lazy views beside itself, so it must not be bundled (data-ui storybook/stories/lib/kit.js does the
   same). A page served from the repo needs nothing; Storybook serves the copy at /kit and calls setKitBase. */

let base = null;
export function setKitBase(url) { base = String(url).endsWith('/') ? String(url) : `${url}/`; }
export function kitBase() { return base || new URL('../../vendor/data-ui/', import.meta.url).href; }

const loading = new Map();
const load = (path) => {
  if (!loading.has(path)) loading.set(path, import(/* @vite-ignore */ new URL(path, kitBase()).href));
  return loading.get(path);
};

/** data-ui's stylesheet, once (a page that already links it keeps its own). */
export function ensureKitCss() {
  if (typeof document === 'undefined' || document.querySelector('link[href$="data-ui.css"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('data-ui.css', kitBase()).href;
  document.head.appendChild(link);
}

/** <data-kpi> and <data-sparkline> (views/kpi.js defines both). */
export async function loadKpi() {
  ensureKitCss();
  await load('views/kpi.js');
  await customElements.whenDefined('data-kpi');
}

/** <data-views> and <data-facets> (the core; views load themselves lazily beside it). */
export async function loadViews() {
  ensureKitCss();
  const core = await load('data-ui.js');
  await customElements.whenDefined('data-views');
  return core;
}

/** data-ui's Obsidian-parity note viewer (like_obsidian_md_viewer, vendored with data-ui at like-obsidian/): its module
    ({mountNote}) once its stylesheet has loaded. WHY the same <link data-dv-note-css> data-ui's own note page adds: one
    stylesheet for the page, whichever of the two opens a note first (data-ui CONTRACT §54). */
export async function loadNoteViewer() {
  ensureKitCss();
  const base = new URL('like-obsidian/', kitBase()).href;
  let link = [...document.querySelectorAll('link[data-dv-note-css]')].find((l) => l.dataset.dvNoteCss === base);
  if (!link) {
    link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `${base}like-obsidian.css`;
    link.dataset.dvNoteCss = base;
    document.head.appendChild(link);
  }
  // WHY a timeout beside load/error: a <link> that finished before we looked fires neither again
  if (!link.sheet) await new Promise((done) => { link.addEventListener('load', done, { once: true }); link.addEventListener('error', done, { once: true }); setTimeout(done, 3000); });
  return load('like-obsidian/like-obsidian.js');
}
