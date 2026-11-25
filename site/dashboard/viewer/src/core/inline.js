/* One line of Markdown as HTML (marked's inline parser): ideas.md and the asks are Markdown, so **bold** and `code`
   render as such instead of showing their markers; every other character is kept. */
import { marked } from '../../vendor/marked/marked.esm.js';

export const md = (text) => marked.parseInline(String(text ?? ''), { async: false, gfm: true });
