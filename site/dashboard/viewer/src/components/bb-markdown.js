/* <bb-markdown>: Markdown text, inline or from a .md file beside the page (marked, pinned and vendored), or with
   `viewer: obsidian` the note in data-ui's Obsidian-parity viewer (CONTRACT §17). The text is the box author's own,
   trusted like custom-html. */
import { BBElement } from '../core/element.js';
import { register } from '../core/registry.js';
import { marked } from '../../vendor/marked/marked.esm.js';
import { mountNotePage } from '../core/notes.js';
import schema from './bb-markdown.schema.js';

export class BBMarkdown extends BBElement {
  static schema = schema;
  static css = `
bb-markdown { line-height: 1.55; font-size: 15px; overflow-wrap: anywhere; }
bb-markdown > .bbm > :first-child { margin-top: 0; }
bb-markdown > .bbm > :last-child { margin-bottom: 0; }
bb-markdown pre { overflow-x: auto; background: var(--bb-subtle); padding: 10px 12px; border-radius: var(--bb-radius); font: 13px/1.5 var(--bb-mono); }
bb-markdown code { font-family: var(--bb-mono); font-size: .92em; }
bb-markdown table { border-collapse: collapse; display: block; overflow-x: auto; max-width: 100%; }
bb-markdown th, bb-markdown td { border: 1px solid var(--bb-border); padding: 4px 8px; text-align: left; }
bb-markdown blockquote { margin: 0; padding: 2px 14px; border-left: 3px solid var(--bb-border); color: var(--bb-muted); }
`;

  teardown() { this._note?.destroy(); this._note = null; }

  async render() {
    const s = this.settings;
    const text = s.markdown || (s.src ? await this.context.asset(s.src) : '');
    this.teardown();
    if (!text.trim()) return this.empty();
    if (s.viewer === 'obsidian') { // CONTRACT §17: the note as Obsidian draws it (a box's own .md tab)
      this.replaceChildren();
      this._note = mountNotePage(this, { text, title: s.title });
      await this._note.ready;
      this.dataset.drew = 'obsidian';
      return;
    }
    this.innerHTML = `<div class="bbm">${marked.parse(text, { async: false, gfm: true })}</div>`;
  }
}
register(BBMarkdown);
