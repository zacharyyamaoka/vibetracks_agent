/* <custom-html>: the escape hatch (Shopify's Custom Liquid section, here plain HTML). Inline mode shares the page and
   runs the HTML's scripts; iframe mode isolates it in a sandboxed frame. Either way its scripts see only the state
   slices named in the `reads` setting: document.currentScript.closest('custom-html').data inline, window.bb.data in
   the iframe. It loads at most one file, a page asset beside page.json, through the page context. */
import { BBElement, esc } from '../core/element.js';
import { register } from '../core/registry.js';
import { SLICES } from '../core/slices.js';
import { cssVar } from '../core/tokens.js';
import schema from './custom-html.schema.js';

export class CustomHtml extends BBElement {
  static schema = schema;
  static css = `custom-html.bb-el iframe { width: 100%; border: 1px solid var(--bb-border); border-radius: calc(var(--bb-radius) + 4px); background: var(--bb-bg); display: block; }`;

  /** The slices named in `reads` (set settings before state, as bb-page does). */
  readList() {
    return String(this.settings.reads || '').split(',').map((x) => x.trim()).filter((x) => SLICES.includes(x));
  }

  async render() {
    const s = this.settings;
    const html = s.html || (s.src ? await this.context.asset(s.src) : '');
    if (!html.trim()) return this.empty();
    if (s.mode === 'iframe') {
      const bg = cssVar(this, '--bb-bg'), fg = cssVar(this, '--bb-fg'), font = cssVar(this, '--bb-font');
      const doc = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{margin:12px;background:${bg};color:${fg};font:14px/1.5 ${font}}</style>
<script>window.bb={data:${JSON.stringify(this.data).replace(/</g, '\\u003c')}};</script>${html}`;
      this.innerHTML = `<iframe sandbox="allow-scripts" title="${esc(this.schema.name)}" style="height:${s.height}px"></iframe>`;
      this.querySelector('iframe').srcdoc = doc;
      return;
    }
    this.innerHTML = html;
    // WHY re-created: scripts set through innerHTML never run; a fresh <script> does (in document order)
    for (const old of [...this.querySelectorAll('script')]) {
      const s2 = document.createElement('script');
      for (const a of old.attributes) s2.setAttribute(a.name, a.value);
      s2.textContent = old.textContent;
      old.replaceWith(s2);
    }
  }
}
register(CustomHtml);
