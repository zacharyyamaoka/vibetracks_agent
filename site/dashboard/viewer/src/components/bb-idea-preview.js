/* <bb-idea-preview>: the head of the idea queue (state.json ideas, folded from ideas.md by the idea-queue lane's
   lossless parser): the next open "I'll try" lines and the open "Suggestions for Zach", in the file's order. */
import { BBElement, esc } from '../core/element.js';
import { register } from '../core/registry.js';
import { md } from '../core/inline.js';
import { fill } from '../core/context.js';
import schema from './bb-idea-preview.schema.js';

export class BBIdeaPreview extends BBElement {
  static schema = schema;
  static css = `
bb-idea-preview .bbi { display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
bb-idea-preview h3 { margin: 0 0 6px; font-size: 16px; display: flex; gap: 8px; align-items: baseline; }
bb-idea-preview h3 .n { font-size: 13px; font-weight: 400; color: var(--bb-muted); }
bb-idea-preview ol { margin: 0; padding-left: 20px; display: grid; gap: 6px; }
bb-idea-preview li { overflow-wrap: anywhere; }
bb-idea-preview li .t { font-weight: 550; }
bb-idea-preview li .x { color: var(--bb-muted); font-size: 13px; }
bb-idea-preview .none { color: var(--bb-muted); font-size: 14px; }
bb-idea-preview .all { display: inline-block; margin-top: 8px; font-size: 13px; }
`;

  render() {
    const ideas = this.data.ideas;
    if (!Array.isArray(ideas) || !ideas.length) return this.empty();
    const s = this.settings;
    const open = (lane) => ideas.filter((i) => i.open && i.lane === lane);
    const agent = open('agent'), human = open('human');
    const list = (rows, limit) => (rows.length ? `<ol>${rows.slice(0, limit).map((i) => `<li><span class="t">${md(i.title)}</span>${i.expect ? `<div class="x">expect: ${md(i.expect)}</div>` : ''}</li>`).join('')}</ol>` : '<div class="none">none open</div>');
    const href = s.href || fill(this.context.links.page, { page: 'ideas' });
    this.innerHTML = `<div class="bbi">
      <section><h3>Next to try <span class="n">${agent.length} open</span></h3>${list(agent, s.agent_limit)}</section>
      ${s.human_limit ? `<section><h3>For Zach <span class="n">${human.length} open</span></h3>${list(human, s.human_limit)}</section>` : ''}
    </div><a class="all" href="${esc(href)}">The whole queue (${ideas.length} ideas, ${ideas.filter((i) => !i.open).length} crossed off) →</a>`;
  }
}
register(BBIdeaPreview);
