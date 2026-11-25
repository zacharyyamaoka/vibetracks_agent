// bb-lineage: who descends from whom, data-ui's `lineage` view over the iterations (viewer/CONTRACT.md §5.2, §16.3),
// proposals-pages/iterations/iterations.base's Lineage preset: parents = parent, focus = the best's holder, kept =
// admissible. Pure: no DOM.
export default {
  tag: 'bb-lineage', name: 'Lineage', version: 1, wave: 2,
  description: "Every iteration hung from its parent with data-ui's lineage view (d3-hierarchy): the best's ancestry is the trunk, lines with no admissible descendant are extinct stubs, marks coloured by verdict or depth; click a mark for its side panel, whose title opens the solution's page.",
  reads: ['iterations'],
  settings: [
    { id: 'color', type: 'select', label: 'Colour the marks by', default: 'verdict',
      options: [{ value: 'verdict', label: 'Verdict (kept · discarded · failed)' }, { value: 'gen', label: 'Generation (depth from a root)' }],
      info: "data-ui's lineage view has no colour key (2587b04); the marks are tinted by a stylesheet over its marks, keyed by row id" },
    { id: 'orientation', type: 'select', label: 'Direction', default: 'down',
      options: [{ value: 'down', label: 'Down (roots at the top)' }, { value: 'right', label: 'Right (roots at the left)' }],
      info: "INERT: data-ui's lineage view (2587b04) has no orientation key; its rectangular layout always runs left to right (layout: rectangular | radial is the only shape key, below). Kept so a page.json written against CONTRACT §5.2 validates; it takes effect when data-ui adds a top-down layout" },
    { id: 'layout', type: 'select', label: 'Layout', default: 'rectangular',
      options: [{ value: 'rectangular', label: 'Rectangular (a column per depth)' }, { value: 'radial', label: 'Radial (a ring per depth)' }],
      info: "the lineage view's own `layout` key; the reader can flip it in the view's bar" },
  ],
  blocks: [],
  presets: [{ name: 'Lineage' }],
  empty: 'No parents recorded.',
};
