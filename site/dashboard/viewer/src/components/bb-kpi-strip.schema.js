// bb-kpi-strip: the KPIs as data-ui <data-kpi> cards with sparklines (viewer/CONTRACT.md §5.1), or as data-ui's table
// over the same kpis with a Cards / Table switch (§16.6, wave 2; additive). Pure: no DOM.
export default {
  tag: 'bb-kpi-strip', name: 'KPI strip', version: 1, wave: 1,
  description: "The box's KPIs (state.json kpis) as data-ui <data-kpi> cards: value, unit, delta, sparkline, where it comes from; or the same KPIs as a data-ui table, with a Cards / Table switch.",
  reads: ['kpis'],
  settings: [
    { id: 'columns', type: 'range', label: 'Cards per row (at most)', min: 1, max: 6, step: 1, default: 4 },
    { id: 'spark', type: 'checkbox', label: 'Sparklines', default: true },
    { id: 'show_source', type: 'checkbox', label: 'Show each source file', default: false },
    { id: 'limit', type: 'range', label: 'At most this many cards', min: 1, max: 12, step: 1, default: 8 },
    // wave 2 (CONTRACT §16.6, Zach's evening spec): added, nothing above renamed
    { id: 'view', type: 'select', label: 'Show as', default: 'cards',
      options: [{ value: 'cards', label: 'Cards' }, { value: 'table', label: 'Table (data-ui)' }],
      info: 'the table is data-ui\'s table over the same KPIs: label, value with its unit and decimals, the sparkline, delta, from, source' },
    { id: 'toggle', type: 'checkbox', label: 'Cards / Table switch', default: true,
      info: 'a small switch the reader flips; the flip is remembered by this element until the page reloads' },
  ],
  blocks: [{ type: 'kpi', name: 'KPI', settings: [
    { id: 'id', type: 'text', label: 'KPI id (state.json kpis[].id)', default: '' },
    { id: 'label', type: 'text', label: 'Label (empty = the KPI\'s own)', default: '' }] }],
  max_blocks: 12,
  presets: [{ name: 'All KPIs' }, { name: 'Best and admissible', blocks: [{ type: 'kpi', settings: { id: 'best' } }, { type: 'kpi', settings: { id: 'admissible' } }] }],
  empty: 'No KPIs yet.',
};
