// bb-markdown: a text section, inline or from a file beside the page (viewer/CONTRACT.md §5.1); §17 adds the Obsidian-parity
// viewer (a box's own .md tab uses it). Pure: no DOM.
export default {
  tag: 'bb-markdown', name: 'Markdown', version: 1, wave: 1,
  description: 'Markdown text, inline or from a .md file beside the page: marked 16.4.2, or the note as Obsidian draws it (data-ui\'s like-obsidian viewer).',
  reads: [],
  settings: [
    { id: 'markdown', type: 'markdown', label: 'Markdown', default: '' },
    { id: 'src', type: 'url', label: 'Or a .md file beside the page', default: '' },
    { id: 'viewer', type: 'select', label: 'Drawn by', default: 'marked',
      info: 'obsidian: the Obsidian-parity viewer (front matter as Properties, callouts, wikilinks), as the Notes tab draws a note',
      options: [{ value: 'marked', label: 'marked (plain HTML)' }, { value: 'obsidian', label: 'Obsidian viewer' }] },
    { id: 'title', type: 'text', label: 'Inline title (Obsidian viewer)', default: '' },
  ],
  blocks: [],
  presets: [{ name: 'Text' }],
  empty: 'Empty markdown section.',
};
