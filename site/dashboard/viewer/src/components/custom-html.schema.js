// custom-html: the escape hatch, like Shopify's Custom Liquid section (viewer/CONTRACT.md §5.1). Pure: no DOM.
export default {
  tag: 'custom-html', name: 'Custom HTML', version: 1, wave: 1,
  description: "Anything: inline HTML (scripts run) or a file beside the page. Its scripts reach the state slices named in `reads` as document.currentScript.closest('custom-html').data.",
  reads: ['*'],
  settings: [
    { id: 'html', type: 'html', label: 'HTML', default: '' },
    { id: 'src', type: 'url', label: 'Or an HTML file beside the page', default: '' },
    { id: 'mode', type: 'select', label: 'Mode', default: 'inline',
      options: [{ value: 'inline', label: 'Inline (shares the page)' }, { value: 'iframe', label: 'Isolated (a sandboxed iframe)' }] },
    { id: 'height', type: 'range', label: 'Iframe height', min: 80, max: 1600, step: 20, unit: 'px', default: 360 },
    { id: 'reads', type: 'text', label: 'State slices its scripts may read (comma list)', default: '' },
  ],
  blocks: [],
  presets: [{ name: 'Custom HTML' }],
  empty: 'Empty custom HTML section.',
};
