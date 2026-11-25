// bb-page: renders a page.json template (viewer/CONTRACT.md §2, §5.1). Pure: no DOM.
export default {
  tag: 'bb-page', name: 'Page', version: 1, wave: 1,
  description: "Renders a page.json template: its sections in `order`, each a component fed only its state slices.",
  reads: ['*'],
  settings: [
    { id: 'width', type: 'select', label: 'Page width', default: 'normal',
      options: [{ value: 'narrow', label: 'Narrow (960 px)' }, { value: 'normal', label: 'Normal (1200 px)' }, { value: 'wide', label: 'Wide (1600 px)' }] },
    { id: 'gap', type: 'range', label: 'Gap between sections', min: 8, max: 48, step: 4, unit: 'px', default: 20 },
  ],
  blocks: [],
  presets: [{ name: 'Page' }],
  empty: 'This page has no sections.',
};
