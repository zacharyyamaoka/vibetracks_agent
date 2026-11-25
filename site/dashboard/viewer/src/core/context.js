/* The page context bb-page hands every section (viewer/CONTRACT.md §7): links, the bb-open event, and the ONLY two ways a
   component may load a file. `load(path)` fetches a playback record the state lists in playback.runs, and nothing
   else; `asset(path)` fetches a page asset beside page.json (a .base view file, a custom-html or markdown file), never
   a solution's file. WHY here and nowhere else: a test (tests/boundary.test.mjs) holds every component source to it. */

const DEFAULT_LINKS = { page: '{page}.html', solution: 'solution.html?id={id}' };
const ASSET = /^(?!\/)(?![a-z]+:)(?!.*(?:^|\/)\.\.(?:\/|$))(?!.*(?:^|\/)solutions\/)[^?#]+\.(base|html|md|svg|png|jpg|jpeg|webp|gif|json)$/i;
// CONTRACT §18: the site's one bar file. WHY `../` is allowed here and nowhere else: every page of a box's site reads the
// same file at the site's root, so a page three folders down (comparison/runs/<task>/report.html) climbs to it. Only a
// file named nav.json, relative, never under solutions/.
const NAV = /^(?![a-z][a-z0-9+.-]*:)(?!\/)(?!.*(?:^|\/)solutions\/)(?:\.\.\/|\.\/)*(?:[\w.-]+\/)*nav\.json$/i;

export function fill(pattern, vars) {
  return String(pattern || '').replace(/\{(\w+)\}/g, (_, k) => encodeURIComponent(vars[k] ?? ''));
}

export function makeContext({ state = null, stateUrl = null, pageUrl = null, page = 'overview', links = {} } = {}) {
  const all = { ...DEFAULT_LINKS, ...(links || {}) };
  const base = pageUrl || (typeof document !== 'undefined' ? document.baseURI : 'http://localhost/');
  const listed = new Set(((state && state.playback && state.playback.runs) || []).map((r) => r.path));
  const ctx = {
    page,
    links: all,
    /** The state.json's URL (null when the state was handed over, not fetched): a bb-run/1 record's media resolve beside
        it (CONTRACT §14, §15). WHY on the context: a section must not reach up into its bb-page for it. */
    stateUrl: stateUrl || null,
    href(kind, vars = {}) { return all[kind] ? fill(all[kind], vars) : ''; },
    /** A playback record listed in state.playback.runs, relative to state.json. */
    async load(path) {
      if (!listed.has(path)) throw new Error(`refused: ${path} is not a playback record listed in state.playback.runs`);
      const res = await fetch(new URL(path, stateUrl || base));
      if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
      return res.json();
    },
    /** A page asset beside page.json (.base, .md, .html, an image), as text. */
    async asset(path) {
      if (!ASSET.test(String(path))) throw new Error(`refused: ${path} is not a page asset (a relative .base/.md/.html file beside the page, never under solutions/)`);
      const res = await fetch(new URL(path, base));
      if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
      return res.text();
    },
    /** The site's bar file (bb-site-nav/1, CONTRACT §18): a relative path to a file named nav.json, its schema checked. */
    async nav(path) {
      if (!NAV.test(String(path))) throw new Error(`refused: ${path} is not the site's nav.json (a relative path to a file named nav.json)`);
      const res = await fetch(new URL(path, base));
      if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
      const doc = await res.json();
      if (!doc || doc.schema !== 'bb-site-nav/1') throw new Error(`${path}: schema is ${doc && doc.schema}, not bb-site-nav/1`);
      return doc;
    },
    /** Fire bb-open from `el`; follow href unless a listener prevented it. */
    open(el, detail) {
      const ev = new CustomEvent('bb-open', { bubbles: true, composed: true, cancelable: true, detail });
      const go = el.dispatchEvent(ev);
      if (go && detail.href && ctx.follow) location.assign(new URL(detail.href, base));
      return go;
    },
    follow: true,
  };
  return ctx;
}

export const isAsset = (path) => ASSET.test(String(path));
export const isNavPath = (path) => NAV.test(String(path));

/** bb-page's two loads: its template and the state (by URL), and nothing for any other component. */
export async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

/** A box's own component module listed in page.json `imports` (CONTRACT §8), relative to the page. */
export function importModule(path, base) {
  if (!/^\.{1,2}\/.+\.m?js$/.test(path)) return Promise.reject(new Error(`refused import ${path}: a relative .js module`));
  return import(/* @vite-ignore */ new URL(path, base || document.baseURI).href);
}
