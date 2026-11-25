// bb-notes: the Notes tab (viewer/CONTRACT.md §17): the box's free-form Markdown. A notes/ folder is data-ui's notes-folder
// rows (data-ui CONTRACT §54), each opening as the note in the Obsidian-parity viewer; one NOTES.md is one page. Pure: no DOM.
export default {
  tag: 'bb-notes', name: 'Notes', version: 1, wave: 2,
  description: "The box's notes: notes/*.md as data-ui's notes-folder rows (table + facets + side panel, each row opening as the note in the Obsidian-parity viewer), or one NOTES.md drawn as one page.",
  reads: ['notes'],
  settings: [
    { id: 'view', type: 'text', label: 'Preset to open first (empty = the first)', default: '' },
    { id: 'facets', type: 'checkbox', label: 'Facets rail', default: true },
    { id: 'height', type: 'range', label: 'Height', min: 240, max: 1400, step: 20, unit: 'px', default: 640 },
  ],
  blocks: [],
  limit: 1,
  presets: [{ name: 'Notes' }],
  empty: 'No notes yet.',
};
