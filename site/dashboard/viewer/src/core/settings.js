/* Settings: the input types of a component's schema, their defaults and their checks (viewer/CONTRACT.md §6).
   Pure (no DOM): the validator in Node, the elements in the browser and Storybook's controls all read this one file.
   The types and their rules are Shopify's input settings (checkbox, number, range, select, radio, text, textarea,
   url, html), with `liquid` replaced by `markdown`: https://shopify.dev/docs/storefronts/themes/architecture/settings/input-settings */

export const SETTING_TYPES = ['checkbox', 'number', 'range', 'select', 'radio', 'text', 'textarea', 'url', 'html', 'markdown'];
const STRINGY = new Set(['text', 'textarea', 'url', 'html', 'markdown']);

/** The value a setting takes when a template leaves it out (Shopify: checkbox false, select/radio the first option). */
export function settingDefault(def) {
  if (def.default !== undefined) return def.default;
  if (def.type === 'checkbox') return false;
  if ((def.type === 'select' || def.type === 'radio') && def.options?.length) return def.options[0].value;
  if (STRINGY.has(def.type)) return '';
  return null;
}

export function defaults(defs = []) {
  return Object.fromEntries(defs.map((d) => [d.id, settingDefault(d)]));
}

const fmt = (v) => (typeof v === 'string' ? JSON.stringify(v) : String(v));

/** null when `value` is valid for `def`, else one sentence that says what to write instead. */
export function checkValue(def, value) {
  const t = def.type;
  if (t === 'checkbox') return typeof value === 'boolean' ? null : `${fmt(value)} is not true or false (a checkbox)`;
  if (t === 'number' || t === 'range') {
    if (typeof value !== 'number' || !Number.isFinite(value)) return `${fmt(value)} is not a number`;
    if (def.min !== undefined && value < def.min) return `${value} is below the minimum ${def.min}${t === 'range' ? ` (range ${def.min}–${def.max}, step ${def.step ?? 1})` : ''}`;
    if (def.max !== undefined && value > def.max) return `${value} is above the maximum ${def.max}${t === 'range' ? ` (range ${def.min}–${def.max}, step ${def.step ?? 1})` : ''}`;
    if (t === 'range') {
      const step = def.step ?? 1;
      const k = (value - def.min) / step;
      if (Math.abs(k - Math.round(k)) > 1e-9) return `${value} is not on the step grid (range ${def.min}–${def.max}, step ${step})`;
    }
    return null;
  }
  if (t === 'select' || t === 'radio') {
    const values = (def.options || []).map((o) => o.value);
    if (values.includes(value)) return null;
    const near = suggest(String(value), values);
    return `${fmt(value)} is not one of ${values.map(fmt).join(', ')}${near ? ` (did you mean ${fmt(near)}?)` : ''}`;
  }
  if (STRINGY.has(t)) {
    if (typeof value !== 'string') return `${fmt(value)} is not text`;
    if (t === 'url' && value && !/^https?:\/\//.test(value) && (value.startsWith('/') || value.split(/[?#]/)[0].split('/').includes('..')))
      return `${fmt(value)} must be "", an http(s) URL, or a relative path without ".." (a file beside the page)`;
    return null;
  }
  return `unknown setting type "${t}"`;
}

/** Merge given settings over the defaults. Invalid or unknown values are reported and fall back to the default. */
export function resolve(defs = [], given = {}) {
  const values = defaults(defs);
  const errors = [];
  const byId = Object.fromEntries(defs.map((d) => [d.id, d]));
  for (const [id, value] of Object.entries(given || {})) {
    const def = byId[id];
    if (!def) {
      const near = suggest(id, Object.keys(byId));
      errors.push({ id, message: `no setting "${id}"${near ? ` (did you mean "${near}"?)` : ''}; settings: ${Object.keys(byId).join(', ') || 'none'}` });
      continue;
    }
    const problem = checkValue(def, value);
    if (problem) errors.push({ id, message: problem });
    else values[id] = value;
  }
  return { values, errors };
}

/** The closest candidate by edit distance (at most a third of the word, min 2), or null. */
export function suggest(word, candidates) {
  let best = null, bestD = Infinity;
  for (const c of candidates) {
    const d = distance(String(word).toLowerCase(), String(c).toLowerCase());
    if (d < bestD) { bestD = d; best = c; }
  }
  return best !== null && bestD <= Math.max(2, Math.floor(String(word).length / 3)) ? best : null;
}

function distance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
  }
  return row[b.length];
}
