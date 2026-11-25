// <bb-ablation>'s stylesheet: proposals-ablation-page/_shared/site.css's view kit and 02-grid / 04-linked's own rules,
// every selector under the tag, colours from the --bb-* tokens. The four series colours and the estimate colour are the
// study pages' own (--ab-*, light and dark below); the focus highlight is the accent (calm UI: amber only for problems).
const SERIES_DARK = `--ab-s1: #4a90e8; --ab-s2: #e06a35; --ab-s3: #22b07e; --ab-est: #a69cf0;`;
export default `
bb-ablation { --ab-s1: #2a78d6; --ab-s2: #eb6834; --ab-s3: #1baf7a; --ab-est: #6250d6;
  --ab-est-soft: color-mix(in srgb, var(--ab-est) 9%, transparent); --ab-hl: color-mix(in srgb, var(--bb-accent) 13%, transparent);
  --ab-grid: var(--bb-rule); --ab-faint: var(--bb-faint); font-size: 14px; line-height: 1.5; position: relative; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) bb-ablation { ${SERIES_DARK} } }
:root[data-theme="dark"] bb-ablation { ${SERIES_DARK} }
bb-ablation code { font-family: var(--bb-mono); font-size: .88em; background: var(--bb-subtle); padding: .05em .3em; border-radius: 4px; overflow-wrap: anywhere; }
bb-ablation a { color: var(--bb-accent); text-decoration: none; }
bb-ablation a:hover { text-decoration: underline; }
bb-ablation h3, bb-ablation h4 { margin: 0; line-height: 1.25; }
bb-ablation .muted { color: var(--bb-muted); }
bb-ablation .small { font-size: 13px; }
bb-ablation .label { font-size: 12px; color: var(--bb-muted); }
bb-ablation .h4 { margin: 0 0 6px; font-size: 15px; }

/* measured beside estimated: the one distinction every number carries */
bb-ablation .basis { display: inline-block; font: 600 10px/1.5 var(--bb-font); letter-spacing: .05em; text-transform: uppercase; padding: 0 6px; border-radius: 4px; white-space: nowrap; vertical-align: 1px; }
bb-ablation .basis.measured { color: var(--bb-fg); border: 1px solid var(--bb-fg); }
bb-ablation .basis.estimate { color: var(--ab-est); border: 1px dashed var(--ab-est); background: var(--ab-est-soft); }

/* links that stay inside the viewer: a solution (bb-open) and a part (the focus) */
bb-ablation a.ab-sol code { color: var(--bb-accent); white-space: nowrap; overflow-wrap: normal; }
bb-ablation a.ab-part { color: inherit; text-decoration: underline; text-decoration-color: color-mix(in srgb, var(--bb-accent) 55%, transparent);
  text-decoration-thickness: 2px; text-underline-offset: 3px; }
bb-ablation a.ab-part:hover { text-decoration-color: var(--bb-accent); }
bb-ablation a.ab-part.on { background: var(--ab-hl); border-radius: 3px; }

/* the study note (a study name that is not the folded one) and the newer-best note */
bb-ablation .ab-note { border: 1px dashed var(--bb-border); border-radius: calc(var(--bb-radius) + 4px); padding: 8px 12px; color: var(--bb-muted); font-size: 13px; margin: 0 0 12px; }

/* the default layout: proposal 1, data-ui's dashboard (01-data-ui/index.html's .catalog) */
bb-ablation .ab-wait { font-size: 13px; }
bb-ablation .ab-lede { color: var(--bb-muted); margin: 0 0 12px; max-width: 110ch; font-size: 14px; }
bb-ablation .ab-dash { display: grid; grid-template-columns: 228px minmax(0, 1fr); gap: 12px; align-items: start; }
bb-ablation .ab-dash > data-facets { max-height: 780px; overflow: auto; min-width: 0; }
bb-ablation .ab-dash > data-views { min-width: 0; min-height: 520px; --data-height: 780px; } /* WHY no display: data-views is data-ui's flex column */
bb-ablation[data-w="phone"] .ab-dash, bb-ablation[data-w="mid"] .ab-dash { grid-template-columns: minmax(0, 1fr); }
bb-ablation[data-w="phone"] .ab-dash > data-facets, bb-ablation[data-w="mid"] .ab-dash > data-facets { max-height: none; }
bb-ablation[data-w="phone"] .ab-dash > data-views { --data-height: 640px; }
bb-ablation .dv-ablation { padding: 12px; overflow: auto; min-width: 0; }
bb-ablation .ab-status { margin: 10px 0 0; }

/* 04's story card */
bb-ablation .ab-story { margin: 0 0 12px; padding: 14px 16px; }
bb-ablation .ab-story-grid { display: grid; grid-template-columns: minmax(0, 1.3fr) repeat(4, minmax(0, 1fr)); gap: 10px 16px; align-items: start; }
bb-ablation .ab-story h2 { font-size: 21px; margin: 0; line-height: 1.2; }
bb-ablation .ab-story .idea { color: var(--bb-muted); font-size: 13.5px; margin-top: 4px; }
bb-ablation .ab-story .stat .big { font-size: 21px; font-weight: 650; font-variant-numeric: tabular-nums; line-height: 1.2; }
bb-ablation .ab-story .stat .small { color: var(--bb-muted); }
bb-ablation .ab-story details { margin-top: 10px; }
bb-ablation .ab-story details summary { cursor: pointer; color: var(--bb-muted); font-size: 13px; }
bb-ablation .ab-story details ul { margin: 6px 0 0; padding-left: 18px; font-size: 13px; color: var(--bb-fg); max-width: 110ch; }
bb-ablation .ab-story details li { margin: 3px 0; }
bb-ablation .ab-pick { display: flex; gap: 4px 8px; flex-wrap: wrap; margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--bb-rule); align-items: center; }
bb-ablation .ab-pick .lbl { font-size: 12px; color: var(--bb-muted); }
bb-ablation .ab-picker { display: flex; gap: 4px; flex-wrap: wrap; align-items: center; min-width: 0; max-width: 100%; }
bb-ablation .ab-picker button { font: 13px var(--bb-font); color: var(--bb-fg); background: var(--bb-bg); border: 1px solid var(--bb-border); border-radius: 999px;
  padding: 3px 10px; cursor: pointer; white-space: nowrap; display: inline-flex; gap: 6px; align-items: baseline; }
bb-ablation .ab-picker button .v { font-size: 11.5px; color: var(--bb-muted); font-variant-numeric: tabular-nums; }
bb-ablation .ab-picker button:hover { background: var(--bb-hover); }
bb-ablation .ab-picker button[aria-pressed="true"] { border-color: var(--bb-accent); box-shadow: inset 0 0 0 1px var(--bb-accent); background: var(--ab-hl); }

/* 02's grid: the big tile beside a column of two, then a row of three */
bb-ablation .ab-top { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: 12px; align-items: start; }
bb-ablation .ab-side { display: grid; gap: 12px; min-width: 0; }
bb-ablation .ab-rest { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 12px; align-items: start; }
bb-ablation[data-w="mid"] .ab-top { grid-template-columns: minmax(0, 1fr); }
bb-ablation[data-w="mid"] .ab-side, bb-ablation[data-w="mid"] .ab-rest { grid-template-columns: repeat(2, minmax(0, 1fr)); }
bb-ablation[data-w="phone"] .ab-top, bb-ablation[data-w="phone"] .ab-side, bb-ablation[data-w="phone"] .ab-rest { grid-template-columns: minmax(0, 1fr); }
bb-ablation[data-w="phone"] .ab-story-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
bb-ablation[data-w="phone"] .ab-story-grid > :first-child, bb-ablation[data-w="mid"] .ab-story-grid > :first-child { grid-column: 1 / -1; }
bb-ablation[data-w="mid"] .ab-story-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
bb-ablation[data-w="phone"] .ab-pick .lbl { flex-basis: 100%; }
bb-ablation[data-w="phone"] .ab-picker { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: thin; padding-bottom: 4px; }

bb-ablation .ab-tile { background: var(--bb-card); border: 1px solid var(--bb-border); border-radius: calc(var(--bb-radius) + 4px); display: flex; flex-direction: column; min-width: 0; overflow: hidden; }
bb-ablation .ab-tile > header { display: flex; align-items: flex-start; gap: 8px; padding: 10px 12px 8px; border-bottom: 1px solid var(--bb-rule); }
bb-ablation .ab-tile.small > header { cursor: pointer; }
bb-ablation .ab-tile.small:hover > header { background: var(--bb-hover); }
bb-ablation .ab-tile > header .t { flex: 1; min-width: 0; }
bb-ablation .ab-tile .ask { font-size: 11.5px; text-transform: uppercase; letter-spacing: .06em; color: var(--bb-faint); margin: 0 0 1px; }
bb-ablation .ab-tile h3 { font-size: 15px; display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; }
bb-ablation .ab-tile .answer-line { font-size: 13.5px; margin-top: 3px; color: var(--bb-fg); overflow-wrap: anywhere; }
bb-ablation .ab-tile.big .answer-line { font-size: 17px; font-weight: 600; line-height: 1.35; max-width: 70ch; }
bb-ablation .ab-tile .grow { font: 12.5px var(--bb-font); color: var(--bb-fg); background: var(--bb-bg); border: 1px solid var(--bb-border); border-radius: 8px;
  padding: 4px 9px; cursor: pointer; white-space: nowrap; }
bb-ablation .ab-tile .grow:hover { border-color: var(--bb-accent); }
bb-ablation .ab-tile-body { position: relative; padding: 6px 10px 10px; min-width: 0; }
bb-ablation .ab-tile.small .ab-tile-body { max-height: 300px; overflow: hidden; padding-bottom: 0; cursor: pointer; }
bb-ablation .ab-tile.small .ab-tile-body > * { pointer-events: none; }
bb-ablation .ab-tile.small .ab-tile-body::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 46px; background: linear-gradient(transparent, var(--bb-card)); pointer-events: none; }
bb-ablation .ab-single { min-width: 0; }
bb-ablation .ab-single > .av { background: var(--bb-card); border: 1px solid var(--bb-border); border-radius: calc(var(--bb-radius) + 4px); padding: 14px 16px; }

/* the view kit (site.css): controls, cards, legends, tables */
bb-ablation .card { background: var(--bb-card); border: 1px solid var(--bb-border); border-radius: calc(var(--bb-radius) + 2px); padding: 14px; min-width: 0; }
bb-ablation .row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
bb-ablation .seg { display: inline-flex; border: 1px solid var(--bb-border); border-radius: 8px; overflow: hidden; background: var(--bb-card); max-width: 100%; flex-wrap: wrap; }
bb-ablation .seg button { font: 13px var(--bb-font); color: var(--bb-muted); background: transparent; border: 0; padding: 6px 10px; cursor: pointer; }
bb-ablation .seg button + button { border-left: 1px solid var(--bb-border); }
bb-ablation .seg button[aria-pressed="true"] { background: var(--bb-fg); color: var(--bb-bg); }
bb-ablation .seg button:hover { outline: 1px solid var(--bb-accent); outline-offset: -1px; }
bb-ablation .chip { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: var(--bb-muted); background: var(--bb-subtle); border-radius: 999px; padding: 1px 8px; white-space: nowrap; }
bb-ablation .legend { display: flex; gap: 6px 14px; flex-wrap: wrap; font-size: 12.5px; color: var(--bb-muted); }
bb-ablation .legend i { display: inline-block; width: 12px; height: 12px; border-radius: 3px; margin-right: 5px; vertical-align: -2px; }
bb-ablation .av svg { display: block; }
bb-ablation .av svg text { fill: var(--bb-muted); font-family: var(--bb-font); }
bb-ablation .av svg .ink { fill: var(--bb-fg); }
bb-ablation .av svg .sol { fill: var(--bb-accent); }
bb-ablation .av svg .grid { stroke: var(--ab-grid); }
bb-ablation .av svg .axis { stroke: var(--bb-faint); }
bb-ablation .av svg .pick { cursor: pointer; }
bb-ablation .av svg .pick:hover { text-decoration: underline; }
bb-ablation table.data { border-collapse: collapse; width: 100%; font-size: 13px; }
bb-ablation table.data th, bb-ablation table.data td { text-align: left; padding: 4px 6px; border-bottom: 1px solid var(--bb-rule); vertical-align: top; }
bb-ablation table.data td.num, bb-ablation table.data th.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
bb-ablation table.data tr.hl { background: var(--ab-hl); }
bb-ablation .scroll-x { overflow-x: auto; max-width: 100%; }
bb-ablation details.more { margin-top: 10px; }
bb-ablation details.more summary { cursor: pointer; color: var(--bb-muted); font-size: 13px; }
bb-ablation .ab-tip { position: fixed; pointer-events: none; z-index: 90; background: var(--bb-bg); color: var(--bb-fg); border: 1px solid var(--bb-border); border-radius: 8px;
  padding: 8px 10px; font-size: 12.5px; line-height: 1.45; box-shadow: 0 4px 16px rgb(0 0 0 / 0.18); max-width: 320px; }

/* one mounted view */
bb-ablation .av { min-width: 0; }
bb-ablation .av-head { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; margin: 0 0 4px; }
bb-ablation .av-head h3 { font-size: 16px; }
bb-ablation .av-head .q { color: var(--bb-muted); font-size: 13px; }
bb-ablation .av-controls { margin: 6px 0 8px; gap: 10px; }
bb-ablation .av-chart { width: 100%; overflow-x: auto; overflow-y: hidden; }
bb-ablation .av-split { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 12px; align-items: start; }
bb-ablation .av.narrow .av-split { grid-template-columns: minmax(0, 1fr); }
bb-ablation .av-note { margin-top: 6px; }
bb-ablation .av.compact .av-extra, bb-ablation .av.compact .legend, bb-ablation .av.compact .remix-panel, bb-ablation .av.compact .front, bb-ablation .av.compact .summary { display: none; }
bb-ablation .av.compact .av-split { grid-template-columns: minmax(0, 1fr); }
bb-ablation .av.compact .card { padding: 4px 0; border: 0; }
bb-ablation .remix-panel h4 { font-size: 15px; margin: 0 0 6px; }
bb-ablation .toggles { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
bb-ablation .toggles button { font: 12.5px var(--bb-font); border: 1px solid var(--bb-border); background: var(--bb-card); color: var(--bb-muted); border-radius: 999px; padding: 4px 10px; cursor: pointer; }
bb-ablation .toggles button[aria-pressed="true"] { background: var(--ab-s1); border-color: var(--ab-s1); color: #fff; }
bb-ablation .answer .big { font-size: 24px; font-weight: 600; font-variant-numeric: tabular-nums; }
bb-ablation .answer pre { font: 11.5px/1.4 var(--bb-mono); background: var(--bb-subtle); padding: 8px; border-radius: 6px; white-space: pre-wrap; word-break: break-all; }
bb-ablation .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; margin: 8px 0; }
bb-ablation .summary .card { padding: 10px 12px; }
bb-ablation .summary .big { font-size: 20px; font-weight: 600; font-variant-numeric: tabular-nums; line-height: 1.25; }
bb-ablation .multiples { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 10px; }
bb-ablation .steps-list { display: grid; gap: 8px; }
bb-ablation .step { display: grid; grid-template-columns: 30px minmax(0, 1.25fr) minmax(0, 1fr) minmax(0, 1fr); gap: 12px; align-items: start; }
bb-ablation .step.focus { outline: 2px solid var(--bb-accent); outline-offset: 1px; }
bb-ablation .step .n { font-size: 13px; color: var(--bb-faint); font-variant-numeric: tabular-nums; padding-top: 2px; }
bb-ablation .step h4 { font-size: 15px; margin: 0 0 2px; }
bb-ablation .step .ids { font-size: 12px; color: var(--bb-muted); }
bb-ablation .step .delta { font-size: 18px; font-weight: 600; font-variant-numeric: tabular-nums; }
bb-ablation .step .bar { height: 8px; border-radius: 4px; background: var(--bb-subtle); margin: 6px 0; position: relative; overflow: hidden; }
bb-ablation .step .bar span { position: absolute; top: 0; bottom: 0; border-radius: 4px; }
bb-ablation .step .chips { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
bb-ablation .step .note { grid-column: 2 / -1; color: var(--bb-muted); border-top: 1px dashed var(--bb-rule); padding-top: 6px; }
bb-ablation .step.filtered { opacity: 0.55; }
bb-ablation .step .tag { font-size: 11px; padding: 1px 7px; border-radius: 999px; background: var(--bb-subtle); color: var(--bb-muted); margin-left: 6px; font-weight: 400; }
bb-ablation .side-branch { margin-left: 42px; font-size: 12.5px; color: var(--bb-faint); border-left: 2px solid var(--bb-rule); padding: 2px 0 2px 10px; }
bb-ablation .av.narrow .step { grid-template-columns: 26px minmax(0, 1fr); }
bb-ablation .av.narrow .step > .c3, bb-ablation .av.narrow .step > .c4, bb-ablation .av.narrow .step .note { grid-column: 2; }
bb-ablation .sums td.bar-cell { width: 40%; }
bb-ablation .sums .sbar { height: 10px; background: var(--bb-subtle); border-radius: 3px; position: relative; overflow: hidden; }
bb-ablation .sums .sbar span { position: absolute; top: 0; bottom: 0; left: 0; border-radius: 3px; }
bb-ablation .sums .sbar .target { position: absolute; top: -2px; bottom: -2px; width: 2px; background: var(--bb-fg); }
bb-ablation[data-w="phone"] .card { padding: 10px; }
bb-ablation[data-w="phone"] .ab-single > .av { padding: 10px; }
bb-ablation[data-w="phone"] .ab-tile.big .answer-line { font-size: 15px; }
`;
