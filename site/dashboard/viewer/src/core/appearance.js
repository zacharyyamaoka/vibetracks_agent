/* Light / Dark / System for the whole page: the viewer's --bb-* tokens and data-ui's --dv-* both answer `data-theme` on
   <html> (CONTRACT §7; data-ui CONTRACT §4), so one attribute is the whole switch. The reader's pick is remembered in
   localStorage, and every read and write is in try/catch: a private window, blocked storage or a sandboxed frame gives
   System, and the page still draws (CONTRACT §17). */

export const APPEARANCE_KEY = 'bb-viewer/appearance';
export const APPEARANCES = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

const store = (s) => { if (s !== undefined) return s; try { return globalThis.localStorage || null; } catch { return null; } };

/** What the page shows now: `light` / `dark` when <html> says so, else `system`. */
export function currentAppearance(doc = document) {
  const t = doc.documentElement.getAttribute('data-theme');
  return t === 'light' || t === 'dark' ? t : 'system';
}

/** The remembered pick, or null (nothing kept, or no storage). */
export function storedAppearance(storage) {
  try {
    const v = store(storage)?.getItem(APPEARANCE_KEY);
    return APPEARANCES.some((a) => a.value === v) ? v : null;
  } catch { return null; }
}

/** Show `mode` and remember it (System forgets the pick). Returns whether storage took it. */
export function setAppearance(mode, { doc = document, storage } = {}) {
  if (mode === 'light' || mode === 'dark') doc.documentElement.setAttribute('data-theme', mode);
  else doc.documentElement.removeAttribute('data-theme');
  try {
    const s = store(storage);
    if (!s) return false;
    if (mode === 'light' || mode === 'dark') s.setItem(APPEARANCE_KEY, mode);
    else s.removeItem(APPEARANCE_KEY);
    return true;
  } catch { return false; }
}

/** On load: the remembered pick, unless the host already themed the page (a data-theme on <html> wins). */
export function restoreAppearance({ doc = document, storage } = {}) {
  if (doc.documentElement.hasAttribute('data-theme')) return currentAppearance(doc);
  const m = storedAppearance(storage);
  if (m === 'light' || m === 'dark') doc.documentElement.setAttribute('data-theme', m);
  return currentAppearance(doc);
}
