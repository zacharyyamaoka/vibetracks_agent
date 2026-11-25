// bb-catalog: the Iterations catalogue as one data-ui <data-views> over the iterations (+ ablation runs, + solutions
// waiting for a score), its presets proposals-pages/iterations/iterations.base's "Iterations" and "Kept only" tables
// plus a cards view (viewer/CONTRACT.md §5.2, §11, §16.3). Pure: no DOM.
export default {
  tag: 'bb-catalog', name: 'Iterations catalogue', version: 1, wave: 2,
  description: "Every iteration as data-ui rows: the Iterations table (newest first), Kept only, and Cards, one <data-views> with an inline .base; click a row for its side panel, whose title opens the solution's page. Ablation runs behind a toggle; registered solutions with no dev score yet read \"waiting for a score\".",
  reads: ['iterations', 'ablations', 'unscored'],
  settings: [
    { id: 'view', type: 'select', label: 'Preset it opens on', default: 'table',
      options: [{ value: 'table', label: 'Table (Iterations)' }, { value: 'cards', label: 'Cards' }],
      info: 'Kept only is the third preset, one tab away' },
    { id: 'show_ablations', type: 'checkbox', label: 'Show the ablation runs', default: false,
      info: 'study variants, not search steps: listed after the iteration they were evaluated after, never numbered' },
    { id: 'sort', type: 'select', label: 'Sort by', default: 'n',
      options: [{ value: 'n', label: 'Iteration number (newest first)' }, { value: 'objective', label: 'Objective (best first)' }],
      info: "objective: best first by the box's direction (lower or higher); rows with no score last" },
  ],
  blocks: [],
  presets: [{ name: 'Iterations catalogue' }],
  empty: 'No iterations yet.',
};
