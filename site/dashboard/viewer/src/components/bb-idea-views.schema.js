// bb-idea-views: the Ideas tab, the Lens board (viewer/CONTRACT.md §16.3; PICKS.md "Idea queue": proposals-ideas-v2
// 01 Lens board + 02's Agent / Zach split + 03's gate state). Pure: no DOM. Every pick is a setting, so switching it is
// a page.json edit.
export default {
  tag: 'bb-idea-views', name: 'Idea views (Lens board)', version: 1, wave: 2,
  description: "The idea queue as one data-ui <data-views> over state.json ideas, five presets on one row set: Roadmap (rungs as lanes, ideas as cards in implementation order, Needs: lines as the only edges; Ladder / Depth / Now · Next · Later; click a card for its zoom card), Table, Board, Lineage, Text. A fuel gauge above it. Inferred rungs and edges carry their mark.",
  reads: ['ideas', 'iterations', 'gates'],
  settings: [
    { id: 'preset', type: 'select', label: 'Preset it opens on', default: 'roadmap',
      options: [{ value: 'roadmap', label: 'Roadmap (lanes = rungs)' }, { value: 'table', label: 'Table' }, { value: 'board', label: 'Board (kanban)' },
        { value: 'lineage', label: 'Lineage (built on)' }, { value: 'text', label: 'Text (bb roadmap)' }] },
    { id: 'lens', type: 'select', label: 'Roadmap lens', default: 'ladder',
      options: [{ value: 'ladder', label: 'Ladder (implementation order)' }, { value: 'depth', label: 'Depth (steps of Needs:)' },
        { value: 'now-next-later', label: 'Now · Next · Later' }] },
    { id: 'cards', type: 'select', label: 'Roadmap cards', default: 'compact',
      options: [{ value: 'compact', label: 'Compact' }, { value: 'game', label: 'Game cards' }] },
    { id: 'split', type: 'checkbox', label: 'Split each rung Agent / Zach', default: false,
      info: "02's split: a rung gets one lane per owner, so a blocker of Zach's is an arrow into the agent's lane" },
    { id: 'gate_state', type: 'checkbox', label: 'Gate state in each lane header', default: true,
      info: "03's gate state: the rung in force reads climbing, its best and how many gates pass; the rest not started" },
    { id: 'fuel', type: 'checkbox', label: 'Fuel gauge above the views', default: true },
  ],
  blocks: [],
  presets: [{ name: 'Idea views' }],
  empty: 'The idea queue is empty.',
};
