/* The viewer's colours and shapes, once (viewer/CONTRACT.md §7). Components use `--bb-*`; each one reads data-ui's
   `--data-*` token first (a host that themes data-ui themes the viewer too), then shadcn's name, then the same literal
   data-ui uses, in light and dark (data-ui docs/CONTRACT.md §4). Five extra meanings are the progress chart's
   (proposals-headliner/_shared/hl.css): best so far, new best, admissible, a gate failure, the holdout. */

const LIGHT = `
  --bb-bg: var(--data-bg, var(--background, #ffffff));
  --bb-fg: var(--data-fg, var(--foreground, #18181b));
  --bb-muted: var(--data-muted, var(--muted-foreground, #71717a));
  --bb-subtle: var(--data-subtle, var(--muted, #f4f4f5));
  --bb-border: var(--data-border, var(--border, #e4e4e7));
  --bb-rule: var(--data-rule, var(--border, #ececef));
  --bb-hover: var(--data-hover, var(--accent, #f4f4f5));
  --bb-accent: var(--data-accent, var(--primary, #2563eb));
  --bb-on-accent: var(--data-on-accent, var(--primary-foreground, #ffffff));
  --bb-warn: var(--data-warn, #c98a0c);
  --bb-good: var(--data-good, #1a8a5a);
  --bb-card: var(--bb-bg);
  --bb-grid: rgba(20, 24, 31, 0.08);
  --bb-faint: #8a929c;
  --bb-best: #e8741c;
  --bb-best-fill: rgba(232, 116, 28, 0.12);
  --bb-newbest: #2a9d3a;
  --bb-adm: #9aa1aa;
  --bb-bad: #d62728;
  --bb-holdout: #3f88d8;
  --bb-radius: var(--data-radius, var(--radius, 8px));
  --bb-font: var(--data-font, var(--font-sans, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif));
  --bb-mono: var(--data-mono, var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace));`;
const DARK = `
  --bb-bg: var(--data-bg, var(--background, #111113));
  --bb-fg: var(--data-fg, var(--foreground, #ececef));
  --bb-muted: var(--data-muted, var(--muted-foreground, #9a9aa3));
  --bb-subtle: var(--data-subtle, var(--muted, #1c1c20));
  --bb-border: var(--data-border, var(--border, #2c2c31));
  --bb-rule: var(--data-rule, var(--border, #222226));
  --bb-hover: var(--data-hover, var(--accent, #1d1d22));
  --bb-accent: var(--data-accent, var(--primary, #7aa7f2));
  --bb-on-accent: var(--data-on-accent, var(--primary-foreground, #0b1220));
  --bb-warn: var(--data-warn, #e5a93b);
  --bb-good: var(--data-good, #4cc38a);
  --bb-card: var(--bb-bg);
  --bb-grid: rgba(230, 232, 235, 0.09);
  --bb-faint: #7d858f;
  --bb-best: #f28c28;
  --bb-best-fill: rgba(242, 140, 40, 0.10);
  --bb-newbest: #4cbb5a;
  --bb-adm: #8f969e;
  --bb-bad: #ef5350;
  --bb-holdout: #6aa9e9;`;

export const TOKENS_CSS = `
:root {${LIGHT}}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {${DARK} color-scheme: dark; } }
:root[data-theme="dark"] {${DARK} color-scheme: dark; }
.bb-el { font-family: var(--bb-font); color: var(--bb-fg); display: block; min-width: 0; box-sizing: border-box; }
.bb-el *, .bb-el *::before, .bb-el *::after { box-sizing: border-box; }
.bb-el a { color: var(--bb-accent); }
.bb-card { background: var(--bb-card); border: 1px solid var(--bb-border); border-radius: calc(var(--bb-radius) + 4px); padding: 16px; min-width: 0; }
.bb-h { font-size: 13px; font-weight: 600; letter-spacing: .02em; color: var(--bb-muted); margin: 0 0 10px; text-transform: uppercase; }
.bb-empty { border: 1px dashed var(--bb-border); border-radius: calc(var(--bb-radius) + 4px); padding: 18px; color: var(--bb-muted); font-size: 14px; }
.bb-empty b { color: var(--bb-fg); font-weight: 600; }
.bb-error { border: 1px solid var(--bb-bad); border-radius: calc(var(--bb-radius) + 4px); padding: 12px 14px; font-size: 13px; color: var(--bb-fg);
  background: color-mix(in srgb, var(--bb-bad) 8%, var(--bb-bg)); }
.bb-error pre { white-space: pre-wrap; font: 12px/1.5 var(--bb-mono); margin: 6px 0 0; }
.bb-mono { font-family: var(--bb-mono); font-size: .92em; }
.bb-muted { color: var(--bb-muted); }
`;

const adopted = new Set();
/** Add a stylesheet to the document once, under a name (a component's tag). */
export function adoptCss(name, css) {
  if (adopted.has(name) || typeof document === 'undefined') return;
  adopted.add(name);
  if (document.querySelector(`style[data-bb="${name}"]`)) return;
  const el = document.createElement('style');
  el.dataset.bb = name;
  el.textContent = css;
  document.head.appendChild(el);
}
adoptCss('bb-tokens', TOKENS_CSS);

/** Is the page dark right now (data-theme wins, else the system's scheme)? */
export function isDark() {
  const t = document.documentElement.dataset.theme;
  return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Call `fn` whenever the theme changes (data-theme on <html>, or the system scheme). Returns a stop function. */
export function onTheme(fn) {
  const mo = new MutationObserver(() => fn());
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] });
  const mq = matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', fn);
  return () => { mo.disconnect(); mq.removeEventListener('change', fn); };
}

/** A resolved CSS custom property, as text. */
export const cssVar = (el, name) => getComputedStyle(el).getPropertyValue(name).trim();
