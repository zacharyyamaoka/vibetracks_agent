// bb-idea-preview: the next ideas from the queue, "next to try" and "for Zach" (viewer/CONTRACT.md §11). Pure: no DOM.
export default {
  tag: 'bb-idea-preview', name: 'Idea preview', version: 1, wave: 1,
  description: "The first open ideas in ideas.md's two lists: what the agent will try next, and the suggestions waiting for Zach. The whole queue is the Ideas tab.",
  reads: ['ideas'],
  settings: [
    { id: 'agent_limit', type: 'range', label: 'Next to try: show', min: 1, max: 10, step: 1, default: 3 },
    { id: 'human_limit', type: 'range', label: 'For Zach: show (0 = hide)', min: 0, max: 10, step: 1, default: 3 },
    { id: 'href', type: 'text', label: 'Link to the Ideas tab (empty = links.page)', default: '' },
  ],
  blocks: [],
  presets: [{ name: 'Idea preview' }],
  empty: 'The idea queue is empty.',
};
