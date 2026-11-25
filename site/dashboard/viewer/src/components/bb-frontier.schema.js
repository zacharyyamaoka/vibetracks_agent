// bb-frontier: performance vs a cost, with time (viewer/CONTRACT.md §12, §16.3; PICKS: 1 Fade + Tide Lines' earlier
// fronts as faint lines, proposals-frontier/). Pure: no DOM.
export default {
  tag: 'bb-frontier', name: 'Frontier (performance vs cost)', version: 1, wave: 2,
  description: 'The objective against one cost the box records per solution (motor energy, host compute, code size, identified parameters), with the Pareto front over admissible iterations and time on top: Fade = a dot\'s opacity by creation order (old faint, new solid), Tide Lines = the front as it stood at the search\'s quarters, drawn faintly. Red rings for gate failures (never on the front), ablation runs behind a labelled toggle, hover a dot for its card, click to open the solution.',
  reads: ['iterations', 'ablations', 'costs'],
  settings: [
    { id: 'cost', type: 'text', label: 'Cost on x (a costs field; "" = the first the box records)', default: '',
      info: 'energy_j, host_compute_ms_p95, code_lines, identified_params, or any other field the costs slice carries' },
    { id: 'picker', type: 'checkbox', label: 'Show the cost chips (energy / compute / code / parameters)', default: true },
    { id: 'time', type: 'select', label: 'Time encoding', default: 'both',
      options: [{ value: 'fade', label: 'Fade: opacity by creation order' }, { value: 'tide', label: 'Tide Lines: earlier fronts as faint lines' },
        { value: 'both', label: 'Both: Fade + earlier fronts (PICKS)' }, { value: 'none', label: 'None: the front now only' }] },
    { id: 'log_x', type: 'checkbox', label: 'Log x (the cost)', default: false },
    { id: 'log_y', type: 'select', label: 'y scale', default: 'auto',
      options: [{ value: 'auto', label: 'Auto (log past 20×)' }, { value: 'log', label: 'Log' }, { value: 'linear', label: 'Linear' }] },
    { id: 'ablations', type: 'checkbox', label: 'Show ablation runs (hollow grey, never on the front)', default: false },
    { id: 'toggle', type: 'checkbox', label: 'Show the ablation toggle', default: true },
    { id: 'height', type: 'range', label: 'Chart height', min: 220, max: 640, step: 20, unit: 'px', default: 340 },
    { id: 'title', type: 'text', label: 'Title ("" = "Performance vs <cost>")', default: '' },
  ],
  blocks: [],
  limit: null,
  presets: [{ name: 'Energy', settings: { cost: 'energy_j' } }, { name: 'Compute', settings: { cost: 'host_compute_ms_p95' } },
    { name: 'Code size', settings: { cost: 'code_lines' } }],
  events: ['bb-open'],
  empty: 'No cost recorded per solution.',
};
