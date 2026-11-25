/* The page.json validator and the component-schema check (viewer/CONTRACT.md §2, §6). Pure (no DOM): the same code runs
   in Node (tests, tools/validate_page.mjs) and in bb-page before it renders. Every problem comes back at once, each
   {path, message} with a sentence that says what to write instead. Shape rules follow Shopify's JSON templates
   (https://shopify.dev/docs/storefronts/themes/architecture/templates/json-templates): sections id -> {type, settings,
   blocks, block_order, disabled}, `order` lists each section once, at most 25 sections and 50 blocks per section. */

import { SETTING_TYPES, checkValue, resolve, suggest } from './settings.js';
import { SLICES, ROW_SLICES, PAGES } from './slices.js';

export const MAX_SECTIONS = 25;
export const MAX_BLOCKS = 50;
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const TAG = /^[a-z][a-z0-9]*-[a-z0-9-]+$/;
const SETTING_ID = /^[a-z][a-z0-9_]*$/;
const STOCK_UNPREFIXED = new Set(['custom-html', 'markdown']);
const PAGE_KEYS = new Set(['schema', 'name', 'page', 'links', 'imports', 'layout', 'wrapper', 'sections', 'order']);
const SECTION_KEYS = new Set(['type', 'settings', 'blocks', 'block_order', 'disabled', 'custom_css']);
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const q = (s) => JSON.stringify(s);

/** Problems with a component's static schema (bb-component/1). [] when it is sound. `stock`: a stock tag (bb-*). */
export function checkSchema(schema, { stock = null } = {}) {
  const errs = [];
  const at = (path, message) => errs.push({ path, message });
  if (!isObj(schema)) return [{ path: 'schema', message: 'a component schema must be an object' }];
  const tag = schema.tag;
  if (typeof tag !== 'string' || (!TAG.test(tag) && tag !== 'markdown')) at('tag', `${q(tag)} is not a custom element name (lowercase, with a hyphen)`);
  if (stock === false && typeof tag === 'string' && (tag.startsWith('bb-') || STOCK_UNPREFIXED.has(tag))) at('tag', `${q(tag)} is reserved for stock components; a box's own tag must not start with "bb-"`);
  if (typeof schema.name !== 'string' || !schema.name) at('name', 'a component needs a name');
  if (typeof schema.empty !== 'string' || !schema.empty) at('empty', 'a component needs its empty-state sentence');
  const reads = schema.reads;
  if (!Array.isArray(reads)) at('reads', 'reads must list the state.json slices it reads ([] for none)');
  else for (const [i, r] of reads.entries()) {
    const known = [...SLICES, ...ROW_SLICES, '*'];
    if (!known.includes(r)) at(`reads[${i}]`, `${q(r)} is not a state.json slice (known: ${SLICES.join(', ')})`);
  }
  const checkSettings = (defs, path) => {
    if (defs === undefined) return;
    if (!Array.isArray(defs)) { at(path, 'settings must be an array'); return; }
    const seen = new Set();
    defs.forEach((d, i) => {
      const p = `${path}[${i}]`;
      if (!isObj(d)) { at(p, 'a setting must be an object'); return; }
      if (!SETTING_ID.test(d.id || '')) at(`${p}.id`, `${q(d.id)} is not a setting id (lowercase letters, digits, _)`);
      if (seen.has(d.id)) at(`${p}.id`, `${q(d.id)} is declared twice`);
      seen.add(d.id);
      if (!SETTING_TYPES.includes(d.type)) at(`${p}.type`, `${q(d.type)} is not a setting type (${SETTING_TYPES.join(', ')})`);
      if (typeof d.label !== 'string' || !d.label) at(`${p}.label`, 'a setting needs a label');
      if (d.type === 'range') {
        if (typeof d.min !== 'number' || typeof d.max !== 'number' || !(d.min < d.max)) at(p, 'a range needs numbers min < max');
        if (d.default === undefined) at(`${p}.default`, 'a range needs a default (Shopify requires one)');
      }
      if ((d.type === 'select' || d.type === 'radio') && !(Array.isArray(d.options) && d.options.length)) at(`${p}.options`, `a ${d.type} needs options [{value, label}]`);
      if (d.default !== undefined && SETTING_TYPES.includes(d.type)) {
        const problem = checkValue(d, d.default);
        if (problem) at(`${p}.default`, problem);
      }
    });
  };
  checkSettings(schema.settings, 'settings');
  if (schema.blocks !== undefined) {
    if (!Array.isArray(schema.blocks)) at('blocks', 'blocks must be an array');
    else {
      const types = new Set();
      schema.blocks.forEach((b, i) => {
        if (!/^[a-z][a-z0-9_-]*$/.test(b?.type || '')) at(`blocks[${i}].type`, `${q(b?.type)} is not a block type`);
        if (types.has(b.type)) at(`blocks[${i}].type`, `block type ${q(b.type)} is declared twice`);
        types.add(b.type);
        if (!b.name) at(`blocks[${i}].name`, 'a block type needs a name');
        checkSettings(b.settings, `blocks[${i}].settings`);
      });
    }
  }
  if (schema.max_blocks !== undefined && !(Number.isInteger(schema.max_blocks) && schema.max_blocks >= 0 && schema.max_blocks <= MAX_BLOCKS))
    at('max_blocks', `max_blocks must be an integer 0–${MAX_BLOCKS}`);
  return errs;
}

/** Every problem with a page template, against a catalogue {tag: schema}. [] when it renders as written. */
export function validatePage(page, catalogue) {
  const errs = [];
  const at = (path, message) => errs.push({ path, message });
  if (!isObj(page)) return [{ path: '', message: 'page.json must be a JSON object {schema, name, sections, order}' }];
  if (page.schema !== 'bb-page/1') at('schema', `must be "bb-page/1" (got ${q(page.schema)})`);
  if (typeof page.name !== 'string' || !page.name) at('name', 'a page needs a name (its title)');
  for (const k of Object.keys(page)) if (!PAGE_KEYS.has(k)) {
    const near = suggest(k, [...PAGE_KEYS]);
    at(k, `unknown key ${q(k)}${near ? ` (did you mean ${q(near)}?)` : ''}; a page has ${[...PAGE_KEYS].join(', ')}`);
  }
  if (page.page !== undefined && !(typeof page.page === 'string' && /^[a-z0-9-]+$/.test(page.page)))
    at('page', `${q(page.page)} is not a page id (${PAGES.join(', ')}, or a box's own [a-z0-9-]+)`);
  if (page.links !== undefined) {
    if (!isObj(page.links)) at('links', 'links must be {page?, solution?}');
    else for (const [k, v] of Object.entries(page.links)) {
      if (!['page', 'solution'].includes(k)) at(`links.${k}`, `unknown link ${q(k)} (page, solution)`);
      else if (typeof v !== 'string') at(`links.${k}`, 'a link pattern is text, e.g. "{page}.html"');
    }
  }
  if (page.imports !== undefined && !(Array.isArray(page.imports) && page.imports.every((p) => typeof p === 'string' && /^\.{1,2}\/.+\.m?js$/.test(p))))
    at('imports', 'imports lists relative module URLs ("./components/x.js")');
  const sections = page.sections;
  if (!isObj(sections)) { at('sections', 'sections must be an object: section id -> {type, settings, blocks, block_order}'); return errs; }
  const ids = Object.keys(sections);
  if (!ids.length) at('sections', 'a page needs at least one section');
  if (ids.length > MAX_SECTIONS) at('sections', `${ids.length} sections: a page holds at most ${MAX_SECTIONS} (Shopify's limit)`);
  const order = page.order;
  if (!Array.isArray(order)) at('order', 'order must list the section ids in the order they render');
  else {
    const seen = new Set();
    order.forEach((id, i) => {
      if (!sections[id]) {
        const near = suggest(String(id), ids);
        at(`order[${i}]`, `${q(id)} is not a section id${near ? ` (did you mean ${q(near)}?)` : ''}; sections: ${ids.join(', ')}`);
      }
      if (seen.has(id)) at(`order[${i}]`, `${q(id)} is listed twice`);
      seen.add(id);
    });
    for (const id of ids) if (!seen.has(id)) at(`sections.${id}`, `section ${q(id)} is not in order, so it would never render: add it to order, or set "disabled": true and list it`);
  }
  const known = Object.keys(catalogue || {});
  for (const id of ids) {
    const p = `sections.${id}`;
    const s = sections[id];
    if (!ID.test(id)) at(p, `${q(id)} is not a section id (letters, digits, _ and -, at most 64)`);
    if (!isObj(s)) { at(p, 'a section must be an object {type, settings, blocks, block_order}'); continue; }
    for (const k of Object.keys(s)) if (!SECTION_KEYS.has(k)) {
      const near = suggest(k, [...SECTION_KEYS]);
      at(`${p}.${k}`, `unknown key ${q(k)}${near ? ` (did you mean ${q(near)}?)` : ''}; a section has ${[...SECTION_KEYS].join(', ')}`);
    }
    if (s.disabled !== undefined && typeof s.disabled !== 'boolean') at(`${p}.disabled`, 'disabled is true or false');
    const schema = catalogue?.[s.type];
    if (!schema) {
      const near = suggest(String(s.type), known);
      at(`${p}.type`, `unknown section type ${q(s.type)}${near ? ` (did you mean ${q(near)}?)` : ''}; known: ${known.join(', ')}`);
      continue;
    }
    if (s.settings !== undefined && !isObj(s.settings)) at(`${p}.settings`, 'settings must be an object: setting id -> value');
    else for (const e of resolve(schema.settings, s.settings).errors)
      at(`${p}.settings.${e.id}`, e.message.startsWith('no setting') ? `${s.type} has ${e.message}` : e.message);
    const blockTypes = Object.fromEntries((schema.blocks || []).map((b) => [b.type, b]));
    const blocks = s.blocks;
    if (blocks !== undefined) {
      if (!isObj(blocks)) { at(`${p}.blocks`, 'blocks must be an object: block id -> {type, settings}'); continue; }
      const bids = Object.keys(blocks);
      const max = Math.min(MAX_BLOCKS, schema.max_blocks ?? MAX_BLOCKS);
      if (bids.length > max) at(`${p}.blocks`, `${bids.length} blocks: ${s.type} takes at most ${max}`);
      const count = {};
      for (const bid of bids) {
        const b = blocks[bid];
        const bp = `${p}.blocks.${bid}`;
        if (!ID.test(bid)) at(bp, `${q(bid)} is not a block id`);
        if (!isObj(b)) { at(bp, 'a block must be an object {type, settings}'); continue; }
        const def = blockTypes[b.type];
        if (!def) {
          const names = Object.keys(blockTypes);
          const near = suggest(String(b.type), names);
          at(`${bp}.type`, `${s.type} has no block type ${q(b.type)}${near ? ` (did you mean ${q(near)}?)` : ''}; block types: ${names.join(', ') || 'none'}`);
          continue;
        }
        count[b.type] = (count[b.type] || 0) + 1;
        if (def.limit && count[b.type] === def.limit + 1) at(`${bp}.type`, `${s.type} takes at most ${def.limit} ${q(b.type)} block${def.limit === 1 ? '' : 's'}`);
        if (b.settings !== undefined && !isObj(b.settings)) at(`${bp}.settings`, 'settings must be an object');
        else for (const e of resolve(def.settings, b.settings).errors) at(`${bp}.settings.${e.id}`, e.message.startsWith('no setting') ? `block ${q(b.type)} has ${e.message}` : e.message);
      }
      if (s.block_order !== undefined) {
        if (!Array.isArray(s.block_order)) at(`${p}.block_order`, 'block_order lists block ids');
        else {
          const seen = new Set();
          s.block_order.forEach((bid, i) => {
            if (!blocks[bid]) at(`${p}.block_order[${i}]`, `${q(bid)} is not a block id; blocks: ${bids.join(', ')}`);
            if (seen.has(bid)) at(`${p}.block_order[${i}]`, `${q(bid)} is listed twice`);
            seen.add(bid);
          });
          for (const bid of bids) if (!seen.has(bid)) at(`${p}.blocks.${bid}`, `block ${q(bid)} is not in block_order, so it would never render`);
        }
      }
    } else if (s.block_order !== undefined && (!Array.isArray(s.block_order) || s.block_order.length)) {
      at(`${p}.block_order`, 'block_order names blocks, but the section has none');
    }
  }
  return errs;
}

/** One readable paragraph for a list of problems (the CLI and the error card print it). */
export const formatErrors = (errs) => errs.map((e) => `${e.path || '(page)'}: ${e.message}`).join('\n');

/** The ordered blocks of a section as [{id, type, settings}] (settings merged over the block type's defaults). */
export function orderedBlocks(section, schema) {
  const blocks = section.blocks || {};
  const ids = Array.isArray(section.block_order) ? section.block_order.filter((b) => blocks[b]) : Object.keys(blocks);
  const types = Object.fromEntries((schema?.blocks || []).map((b) => [b.type, b]));
  return ids.filter((id) => !blocks[id].disabled).map((id) => ({ id, type: blocks[id].type,
    settings: resolve(types[blocks[id].type]?.settings || [], blocks[id].settings).values }));
}
