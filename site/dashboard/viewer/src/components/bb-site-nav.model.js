/* bb-site-nav/1 (viewer/CONTRACT.md §18): a box's site's ONE bar file, `site/nav.json`, read into the model <bb-site-nav>
   draws on every page. Pure: no DOM, no fetch (Node tests import it).

   Zach, 2026-11-24 ~19:00: "So right now we want a tab for Trajectory Coverage and Trajectory Comparison. And also one for
   Model x Dataset", nothing on the left ("Out of scope is things that require things going on the left"). The shape is
   lane NAV's (proposals-nav/nav.json, bb-site-nav/1) as its pick, 01 Two rows, needs it: the brand row names the box and
   holds the dashboards; the row below holds the open dashboard's own tabs, folding into "More ▾" (priority-plus), the
   open tab never folding. Shipped with three changes from the prototype: every dashboard has an `href` (its entry page;
   NAV's `src`); the box's viewer is `tabs: "viewer"` (its tabs are the viewer's own, so a viewer that adds a tab needs no
   edit here); a drop-in lists its `pages` (its own row-2 tabs). No `fallback` and no `hide`: nothing is framed, every
   page is its own URL and includes the bar itself (deep links, reload and Back are the browser's own). */

import { PAGES, PAGE_LABELS } from '../core/slices.js';

export const SCHEMA = 'bb-site-nav/1';
/** The fold order of the viewer's tabs (lane NAV's nav.json, measured at 1280 / 1024 / 390): 1 folds last. */
export const BOX_PRIORITY = { overview: 1, spec: 2, feedback: 2, iterations: 2, ablation: 3, analysis: 3, ideas: 3,
  agents: 4, activity: 4, audits: 4, references: 4, notes: 4 };
export const OWN_TAB_PRIORITY = 4;
const ID = /^[a-z0-9][a-z0-9-]*$/;
// a path inside the site, relative to nav.json: no scheme, no leading /, no .. (nav.json sits at the site's root)
const REL = /^(?![a-z][a-z0-9+.-]*:)(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[^\s<>"']*$/i;
const isObj = (o) => o && typeof o === 'object' && !Array.isArray(o);
const str = (s) => typeof s === 'string' && s.trim() !== '';

/** Every problem with a nav.json, as sentences. [] when it draws as written. */
export function validate(doc) {
  const out = [];
  if (!isObj(doc)) return ['nav.json must be an object'];
  if (doc.schema !== SCHEMA) out.push(`schema is ${JSON.stringify(doc.schema)}, not ${SCHEMA}`);
  const site = doc.site;
  if (!isObj(site)) out.push('site: an object {name, landing, home}');
  else {
    if (!str(site.name)) out.push('site.name: the box\'s name');
    if (site.landing !== undefined && !(str(site.landing) && REL.test(site.landing))) out.push(`site.landing: ${JSON.stringify(site.landing)} is not a relative path inside the site`);
    if (site.repo !== undefined && !/^https?:\/\/\S+$/.test(String(site.repo))) out.push(`site.repo: ${JSON.stringify(site.repo)} is not an http(s) URL`);
  }
  const groups = Array.isArray(doc.groups) ? doc.groups : [];
  if (!Array.isArray(doc.groups) || !groups.length) out.push('groups: at least one {id, label, kind}');
  const gids = new Set();
  for (const g of groups) {
    if (!isObj(g) || !ID.test(g.id || '')) { out.push(`group ${JSON.stringify(g && g.id)}: an id of lowercase letters, digits and -`); continue; }
    if (gids.has(g.id)) out.push(`group ${g.id}: listed twice`);
    gids.add(g.id);
    if (!str(g.label)) out.push(`group ${g.id}: a label`);
    if (g.kind !== 'box' && g.kind !== 'domain') out.push(`group ${g.id}: kind is box or domain`);
  }
  const dashboards = Array.isArray(doc.dashboards) ? doc.dashboards : [];
  if (!Array.isArray(doc.dashboards) || !dashboards.length) out.push('dashboards: at least one');
  const ids = new Set();
  const claim = (id, where) => { if (ids.has(id)) out.push(`id ${id} twice (${where}): ids are unique across dashboards, tabs and pages`); ids.add(id); };
  for (const d of dashboards) {
    if (!isObj(d) || !ID.test(d.id || '')) { out.push(`dashboard ${JSON.stringify(d && d.id)}: an id of lowercase letters, digits and -`); continue; }
    claim(d.id, 'a dashboard');
    if (!str(d.label)) out.push(`${d.id}: a label`);
    if (!gids.has(d.group)) out.push(`${d.id}: no group ${JSON.stringify(d.group)}`);
    if (!(str(d.href) && REL.test(d.href))) out.push(`${d.id}: href ${JSON.stringify(d.href)} is not a relative path inside the site`);
    if (d.tabs !== undefined && d.pages !== undefined) out.push(`${d.id}: tabs (the viewer's) or pages (a drop-in's), not both`);
    if (d.tabs !== undefined && d.tabs !== 'viewer' && !Array.isArray(d.tabs)) out.push(`${d.id}: tabs is "viewer" or a list`);
    if (Array.isArray(d.tabs)) for (const t of d.tabs) {
      if (!isObj(t) || !ID.test(t.id || '')) { out.push(`${d.id}: a tab id of lowercase letters, digits and -`); continue; }
      if (t.id !== d.id) claim(t.id, `a tab of ${d.id}`);
      if (t.priority !== undefined && !(Number.isInteger(t.priority) && t.priority >= 1)) out.push(`${d.id}.${t.id}: priority is an integer ≥ 1`);
    }
    if (d.pages !== undefined) {
      if (!Array.isArray(d.pages) || !d.pages.length) out.push(`${d.id}: pages is a list of {id, label, href}`);
      else for (const p of d.pages) {
        if (!isObj(p) || !ID.test(p.id || '')) { out.push(`${d.id}: a page id of lowercase letters, digits and -`); continue; }
        claim(p.id, `a page of ${d.id}`);
        if (!str(p.label)) out.push(`${d.id}.${p.id}: a label`);
        if (!(str(p.href) && REL.test(p.href))) out.push(`${d.id}.${p.id}: href ${JSON.stringify(p.href)} is not a relative path inside the site`);
        if (p.match !== undefined && !(str(p.match) && REL.test(p.match))) out.push(`${d.id}.${p.id}: match ${JSON.stringify(p.match)} is not a relative path prefix`);
      }
    }
  }
  const dashIds = dashboards.filter(isObj).map((d) => d.id);
  const order = Array.isArray(doc.order) ? doc.order : dashIds;
  if (order.length !== dashIds.length || !dashIds.every((id) => order.includes(id)) || new Set(order).size !== order.length)
    out.push('order must name every dashboard once');
  if (isObj(site) && site.home !== undefined && !dashIds.includes(site.home)) out.push(`site.home: no dashboard ${JSON.stringify(site.home)}`);
  return out;
}

/** A URL the way two pages compare: no query, no hash, a trailing index.html dropped. */
export function pagePath(url) {
  const u = new URL(url);
  return `${u.origin}${u.pathname.replace(/index\.html?$/i, '')}`;
}

/** The model: the dashboards in order, each with its row-2 tabs, every href absolute (resolved against nav.json's URL).
    `own` = the box's own tabs ({slug, label}, CONTRACT §17.3) for the viewer dashboard. */
export function makeModel(doc, navUrl, { own = [] } = {}) {
  const problems = validate(doc);
  if (problems.length) throw new Error(`nav.json: ${problems.join('; ')}`);
  const at = (p) => new URL(p, navUrl).href;
  const groups = Object.fromEntries(doc.groups.map((g) => [g.id, { ...g }]));
  const byId = Object.fromEntries(doc.dashboards.map((d) => [d.id, d]));
  const order = Array.isArray(doc.order) ? doc.order : doc.dashboards.map((d) => d.id);
  const dashboards = order.map((id, index) => {
    const d = byId[id];
    const dash = { id: d.id, label: d.label, short: d.short || d.label, icon: d.icon || null, group: groups[d.group], about: d.about || '',
      by: d.by || '', href: at(d.href), priority: d.priority ?? (index === 0 ? 1 : 2), index };
    if (d.tabs !== undefined) {
      dash.kind = 'viewer';
      const listed = Array.isArray(d.tabs) ? d.tabs.map((t) => ({ id: t.id, label: t.label || PAGE_LABELS[t.id] || t.id, short: t.short, priority: t.priority }))
        : PAGES.map((p) => ({ id: p, label: PAGE_LABELS[p] }));
      const tabs = listed.concat(own.filter((t) => !listed.some((x) => x.id === t.slug)).map((t) => ({ id: t.slug, label: t.label, own: true })));
      dash.tabs = tabs.map((t, i) => ({ id: t.id, label: t.label, short: t.short || t.label, own: !!t.own, index: i,
        priority: t.priority ?? (t.own ? OWN_TAB_PRIORITY : BOX_PRIORITY[t.id] ?? 2), href: `${dash.href}#${t.id}` }));
    } else {
      dash.kind = 'pages';
      const pages = d.pages || [{ id: d.id, label: d.label, href: d.href }];
      dash.tabs = pages.map((p, i) => ({ id: p.id, label: p.label, short: p.short || p.label, href: at(p.href), match: p.match ? at(p.match) : null,
        priority: p.priority ?? (i === 0 ? 1 : 2), index: i }));
    }
    return dash;
  });
  const home = dashboards.find((d) => d.id === doc.site.home) || dashboards[0];
  return { site: { name: doc.site.name, landing: at(doc.site.landing || 'index.html'), repo: doc.site.repo || null, home: home.id },
    groups: doc.groups, dashboards, overflow: { label: 'More', ...(doc.overflow || {}) } };
}

/** Where a page is: {dash, tab}. `current` (a dashboard id) and `page` (a tab or page id) win; else the URL picks: the
    page whose href is this page, then the longest `match` prefix, then the dashboard whose entry is this page. */
export function locate(model, { url = null, current = '', page = '' } = {}) {
  let dash = current ? model.dashboards.find((d) => d.id === current) : null;
  let tab = null;
  if (dash && page) tab = dash.tabs.find((t) => t.id === page) || null;
  if (!dash && page) for (const d of model.dashboards) { const t = d.tabs.find((x) => x.id === page); if (t) { dash = d; tab = t; break; } }
  if ((!dash || !tab) && url) {
    const here = pagePath(url);
    const cands = (dash ? [dash] : model.dashboards).flatMap((d) => d.tabs.filter(() => d.kind === 'pages').map((t) => ({ d, t })));
    let hit = cands.find(({ t }) => pagePath(t.href) === here);
    if (!hit) hit = cands.filter(({ t }) => t.match && here.startsWith(pagePath(t.match))).sort((a, b) => b.t.match.length - a.t.match.length)[0];
    if (hit) { dash = dash || hit.d; tab = tab || (hit.d === dash ? hit.t : null); }
    if (!dash) dash = model.dashboards.find((d) => pagePath(d.href) === here) || null;
  }
  if (dash && !tab && dash.kind === 'viewer') {
    const h = url ? decodeURIComponent(new URL(url).hash.slice(1)) : '';
    tab = dash.tabs.find((t) => t.id === h) || (h.startsWith('solution=') ? dash.tabs.find((t) => t.id === 'iterations') : null) || dash.tabs[0];
  }
  return { dash: dash || null, tab: tab || null };
}

/** The order a row's items fold into More ▾ when it does not fit: the highest priority number first, then right to
    left; the open item never folds (lane NAV's rule, nav.json `overflow.fold`). */
export function foldOrder(items, keepId) {
  return items.filter((t) => t.id !== keepId).slice().sort((a, b) => (b.priority - a.priority) || (b.index - a.index)).map((t) => t.id);
}
