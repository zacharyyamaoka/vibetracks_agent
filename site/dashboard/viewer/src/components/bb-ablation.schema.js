// bb-ablation: the Ablation tab's body (viewer/CONTRACT.md §16.2, §16.3). Default = Zach's ruling of 2026-11-24 ~15:00
// (PICKS.md "Zach's rulings"): the single stock data-ui dashboard, proposals-ablation-page 1 (one <data-views> over the
// study's rows, the six views as preset tabs beside the table, drill into each in data-ui's side panel). The earlier
// pick stays a layout: 2 Overview grid + 3's answer sentences as the tile headers + 4's story card; and the older
// one-view picks. Pure: no DOM. Every pick is a setting, so switching it is a page.json edit.
export default {
  tag: 'bb-ablation', name: 'Ablation study', version: 1, wave: 2,
  description: "The box's newest ablation study (state.json ablation_study). Default: one data-ui <data-views> over the study's measured variants (facets rail, side panel) whose preset tabs are the table and six live views (Remix, Waterfall, Importance at both ends, Cost frontier, Overall importance, Changelog). Other layouts: the overview grid (one view the big tile, each tile headed by the answer it proves, the study's story card on top), or one view full width. Measured values and the surrogate's estimates are labelled apart everywhere; a solution id fires bb-open.",
  reads: ['ablation_study', 'ablations', 'iterations', 'costs'],
  settings: [
    { id: 'layout', type: 'select', label: 'Layout', default: 'dashboard',
      info: "dashboard = the stock data-ui dashboard (proposal 1, Zach's 15:00 ruling); grid = the overview grid (proposal 2 + 3's answers + 4's story card); changelog and pairs = one view full width (the older picks: 05 Changelog, 02 Importance with its pairs table)",
      options: [{ value: 'dashboard', label: 'data-ui dashboard' }, { value: 'grid', label: 'Overview grid' }, { value: 'changelog', label: 'Changelog, full width' },
        { value: 'pairs', label: 'Importance + pairs, full width' }] },
    { id: 'view', type: 'select', label: 'View it opens on', default: 'remix',
      info: "dashboard: the preset tab it opens on; grid: the big tile (a click on any small tile makes it big)",
      options: [{ value: 'remix', label: 'Remix' }, { value: 'waterfall', label: 'Waterfall' }, { value: 'importance', label: 'Importance at both ends' },
        { value: 'frontier', label: 'Cost frontier' }, { value: 'changelog', label: 'Changelog' }, { value: 'overall', label: 'Overall importance' }] },
    { id: 'story', type: 'checkbox', label: 'Story card on top (grid, changelog, pairs)', default: true,
      info: "proposal 4's card: the study, or the part you pick; the dashboard layout stays the stock data-ui page without it" },
    { id: 'study', type: 'text', label: 'Study name', default: '', placeholder: 'pass3-2026-11-24',
      info: 'reserved: "" = the folded study (the newest); any other name draws a note that only the newest study is folded' },
  ],
  blocks: [],
  presets: [{ name: 'Ablation study' }],
  empty: 'No ablation study yet.',
};
