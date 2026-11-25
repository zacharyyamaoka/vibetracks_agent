// bb-needs-you: what only Zach can answer (viewer/CONTRACT.md §5.1). Pure: no DOM.
export default {
  tag: 'bb-needs-you', name: 'Needs you', version: 1, wave: 1,
  description: "The open asks for Zach (state.json needs: ideas.md's Suggestions for Zach and status.json blocked_on), blocked first.",
  reads: ['needs'],
  settings: [
    { id: 'title', type: 'text', label: 'Title', default: 'Needs you' },
    { id: 'limit', type: 'range', label: 'Show at most', min: 1, max: 20, step: 1, default: 5 },
    { id: 'layout', type: 'select', label: 'Layout', default: 'list', options: [{ value: 'list', label: 'List' }, { value: 'pill', label: 'Pill' }] },
    { id: 'show_source', type: 'checkbox', label: 'Show where each ask is written', default: true },
    { id: 'href', type: 'text', label: 'Link to the full list', default: '' },
  ],
  blocks: [],
  presets: [{ name: 'Needs you' }],
  empty: 'Nothing needs you.',
};
