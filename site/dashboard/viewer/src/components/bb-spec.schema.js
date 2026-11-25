// bb-spec: the Spec tab, one row per requirement (state.json spec.requirements, CONTRACT §16.1) as one data-ui
// <data-views>: proposals-pages/spec's Requirement tree (the default), Requirements table, Requirement × test file matrix
// and By result board (viewer/CONTRACT.md §5.2, §16.3). Pure: no DOM.
export default {
  tag: 'bb-spec', name: 'Spec', version: 1, wave: 2,
  description: "OBJECTIVES.md's requirements and the tooling's contract as data-ui rows, each with the tests that prove it: the requirement tree (a table grouped by OBJECTIVES section), a flat table, a requirement × test file matrix and a board by result. The header counts the shalls that pass and the tests of the folded run, or says why there is none.",
  reads: ['spec', 'spec_history', 'iterations'],
  settings: [
    { id: 'view', type: 'select', label: 'Preset it opens on', default: 'tree',
      options: [{ value: 'tree', label: 'Requirement tree (by OBJECTIVES section)' }, { value: 'table', label: 'Table' },
        { value: 'matrix', label: 'Requirement × test file' }, { value: 'history', label: 'History: the nested gate matrix per commit' }],
      info: "By result (a board) is a fourth preset, one tab away. history (CONTRACT §16.8): data-ui's nested gate matrix over the gates .base's spec rows, section › requirement › test file › test per commit (the spec_history slice), the counting bar on top, x = commit / day / iteration; its table is the next tab. The reader flips Requirements / History above it." },
    { id: 'toggle', type: 'checkbox', label: 'Reader switch (Requirements / History)', default: true, info: 'shown when the state has spec_history' },
    { id: 'show_tests', type: 'checkbox', label: 'Test columns and counts', default: true,
      info: "the Tests / Pass / Fail / Passing columns and the header's test count; the matrix preset stays (it is the tests)" },
  ],
  blocks: [],
  presets: [{ name: 'Spec' }],
  empty: 'No test run folded.',
};
