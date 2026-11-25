// bb-data-page: a tab's stock body, a data-ui row view from one .base file over one state.json slice
// (viewer/CONTRACT.md §11, Zach's layout ruling). Pure: no DOM.
import { ROW_SLICES } from '../core/slices.js';

export default {
  tag: 'bb-data-page', name: 'Row view (data-ui)', version: 1, wave: 1,
  description: "A data-ui <data-views> over one state.json slice: the page's .base presets as view tabs, the facets rail, the side panel on row click. No .base = one table over every field.",
  reads: ['*'],
  settings: [
    { id: 'slice', type: 'select', label: 'Rows (state.json slice)', default: 'iterations', options: ROW_SLICES.map((s) => ({ value: s, label: s })) },
    { id: 'base', type: 'url', label: '.base file beside the page', default: '' },
    { id: 'base_text', type: 'textarea', label: 'Or the .base text inline', default: '' },
    { id: 'view', type: 'text', label: 'Preset to open first (empty = the first)', default: '' },
    { id: 'filters', type: 'text', label: 'Extra filter (a Bases expression, ANDed with the file\'s)', default: '',
      info: 'e.g. kind == "iteration" over costs (CONTRACT §16.3)' },
    { id: 'facets', type: 'checkbox', label: 'Facets rail', default: true },
    { id: 'height', type: 'range', label: 'Height', min: 240, max: 1400, step: 20, unit: 'px', default: 640 },
    { id: 'empty', type: 'text', label: 'When the slice has no rows', default: '',
      info: 'the empty state\'s sentence, e.g. how to add a row (CONTRACT §17); empty = "No rows in <slice> yet."' },
  ],
  blocks: [],
  presets: [{ name: 'Row view' }],
  empty: 'No rows in this slice yet.',
};
