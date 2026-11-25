// bb-headliner: the Ticker (proposals-headliner/01-ticker) as a section (viewer/CONTRACT.md §5.1). Pure: no DOM.
export default {
  tag: 'bb-headliner', name: 'Headliner (Ticker)', version: 1, wave: 1,
  description: 'One big number (the best admissible objective in the window) and the best-so-far curve: admissible only on the line, red rings for gate failures, log or linear, x = iteration, date or commit, range chips, click a dot to open the solution.',
  reads: ['iterations', 'ablations'],
  settings: [
    { id: 'x', type: 'select', label: 'x axis', default: 'number',
      options: [{ value: 'number', label: 'Solution #' }, { value: 'date', label: 'Date' }, { value: 'commit', label: 'Commit' }] },
    { id: 'range', type: 'select', label: 'Range', default: 'All',
      options: ['1H', '1D', '5D', '1M', 'All'].map((r) => ({ value: r, label: r })) },
    { id: 'y', type: 'select', label: 'y scale', default: 'auto',
      options: [{ value: 'auto', label: 'Auto (log past 20×)' }, { value: 'log', label: 'Log' }, { value: 'linear', label: 'Linear' }] },
    { id: 'ablations', type: 'checkbox', label: 'Show ablations (greyed, never on the line)', default: false },
    { id: 'height', type: 'range', label: 'Chart height', min: 200, max: 640, step: 10, unit: 'px', default: 330 },
    { id: 'title', type: 'text', label: 'Title above the number', default: '' },
    { id: 'controls', type: 'checkbox', label: 'Show the chips and switches', default: true },
  ],
  blocks: [],
  limit: 2,
  presets: [{ name: 'Ticker' }],
  events: ['bb-open'],
  empty: 'No solution scored yet: the line starts at the first admissible solution.',
};
