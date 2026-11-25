/* <bb-needs-you>: the open asks only Zach can answer. Blocked first and amber (a problem); the rest calm. Each ask is
   shown whole: the full text one click away, never clipped (Zach's truthful-rendering rule). */
import { BBElement, esc } from '../core/element.js';
import { register } from '../core/registry.js';
import { md } from '../core/inline.js';
import schema from './bb-needs-you.schema.js';

const KIND = { blocked: 'Blocked', ruler: 'Ruler', test: 'Test', decision: 'Decision' };

export class BBNeedsYou extends BBElement {
  static schema = schema;
  static css = `
bb-needs-you .bbn-head { display: flex; align-items: baseline; gap: 8px; margin: 0 0 8px; }
bb-needs-you .bbn-head h3 { margin: 0; font-size: 16px; }
bb-needs-you .bbn-head .n { color: var(--bb-muted); font-size: 13px; }
bb-needs-you ol { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
bb-needs-you li { border: 1px solid var(--bb-border); border-radius: calc(var(--bb-radius) + 2px); padding: 8px 12px; min-width: 0; }
bb-needs-you li.blocked { border-color: color-mix(in srgb, var(--bb-warn) 60%, var(--bb-border)); background: color-mix(in srgb, var(--bb-warn) 8%, var(--bb-bg)); }
bb-needs-you summary { cursor: pointer; display: flex; gap: 8px; align-items: baseline; list-style: none; }
bb-needs-you summary::-webkit-details-marker { display: none; }
bb-needs-you summary .ask { font-weight: 550; overflow-wrap: anywhere; }
bb-needs-you .kind { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: var(--bb-muted); border: 1px solid var(--bb-border); border-radius: 6px; padding: 0 5px; flex: none; }
bb-needs-you li.blocked .kind { color: var(--bb-fg); border-color: var(--bb-warn); }
bb-needs-you .body { margin: 6px 0 0; color: var(--bb-fg); font-size: 13.5px; line-height: 1.5; overflow-wrap: anywhere; }
bb-needs-you .src { color: var(--bb-muted); font-size: 12px; margin-top: 4px; }
bb-needs-you .more { display: inline-block; margin-top: 8px; font-size: 13px; }
bb-needs-you .pill { display: inline-flex; gap: 8px; align-items: center; padding: 6px 12px; border-radius: 16px; border: 1px solid var(--bb-border); text-decoration: none; color: var(--bb-fg); }
bb-needs-you .pill.on { border-color: var(--bb-warn); background: color-mix(in srgb, var(--bb-warn) 10%, var(--bb-bg)); }
`;

  render() {
    const s = this.settings;
    const all = (this.data.needs || []).slice().sort((a, b) => (b.kind === 'blocked') - (a.kind === 'blocked'));
    this.id = this.id || 'needs';
    if (s.layout === 'pill') {
      const n = all.length;
      this.innerHTML = `<a class="pill${n ? ' on' : ''}" href="${esc(s.href || '#needs')}">${esc(s.title)} <b>${n}</b>${n ? '' : ' · nothing waiting'}</a>`;
      return;
    }
    if (!all.length) return this.empty(this.schema.empty, 'No open line under “Suggestions for Zach” in ideas.md, and status.json is not blocked.');
    const shown = all.slice(0, s.limit);
    this.innerHTML = `<div class="bbn-head"><h3>${esc(s.title)}</h3><span class="n">${all.length} open</span></div>
      <ol>${shown.map((n) => `<li class="${n.kind === 'blocked' ? 'blocked' : ''}"><details>
        <summary><span class="kind">${esc(KIND[n.kind] || n.kind || 'ask')}</span><span class="ask">${md(n.ask)}</span></summary>
        ${n.text && n.text !== n.ask ? `<div class="body">${md(n.text)}</div>` : ''}
        ${s.show_source ? `<div class="src bb-mono">${esc(n.source)}${n.section ? ` · ${esc(n.section)}` : ''}</div>` : ''}
      </details></li>`).join('')}</ol>
      ${all.length > shown.length ? `<a class="more" href="${esc(s.href || '#needs')}">${all.length - shown.length} more</a>` : ''}`;
  }
}
register(BBNeedsYou);
