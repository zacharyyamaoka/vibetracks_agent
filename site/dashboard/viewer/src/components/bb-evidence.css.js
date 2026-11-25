// <bb-evidence>'s stylesheet, a pure module so the standalone build can also ship it as dist/bb-evidence.css.
// The sequential evidence ramp (--bbe-err-0..4) is the proposals' (trajectory_tracking_agent site/proposals/_shared/kit.css).
export default `
:root { --bbe-err-0: #f3e9b5; --bbe-err-1: #e9b45a; --bbe-err-2: #cf6d3a; --bbe-err-3: #8e2f5a; --bbe-err-4: #3b1550; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bbe-err-0: #4b3f1a; --bbe-err-1: #a8792a; --bbe-err-2: #e3893f; --bbe-err-3: #f2a3c0; --bbe-err-4: #fbe6ff; } }
:root[data-theme="dark"] { --bbe-err-0: #4b3f1a; --bbe-err-1: #a8792a; --bbe-err-2: #e3893f; --bbe-err-3: #f2a3c0; --bbe-err-4: #fbe6ff; }
bb-evidence .bbe { background: var(--bb-card); border: 1px solid var(--bb-border); border-radius: 16px; overflow: hidden; min-width: 0; font-size: 13.5px; }
bb-evidence button { font: inherit; color: inherit; }
bb-evidence code, bb-evidence .mono { font-family: var(--bb-mono); font-size: .9em; }
bb-evidence .bbe-head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; padding: 12px 14px; border-bottom: 1px solid var(--bb-border); }
bb-evidence .bbe-who { flex: 1 1 320px; min-width: 0; display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 10px; }
bb-evidence .bbe-title { font-size: 15px; overflow-wrap: anywhere; }
bb-evidence .bbe-title b { font-weight: 650; }
bb-evidence .bbe-sub { color: var(--bb-muted); font-size: 12.5px; overflow-wrap: anywhere; }
bb-evidence .bbe-verdict { font-weight: 650; font-size: 13px; padding: 2px 9px; border-radius: 8px; white-space: nowrap; }
bb-evidence .bbe-verdict.ok { color: var(--bb-good); background: color-mix(in srgb, var(--bb-good) 12%, var(--bb-bg)); }
bb-evidence .bbe-verdict.bad { color: var(--bb-bad); background: color-mix(in srgb, var(--bb-bad) 11%, var(--bb-bg)); }
bb-evidence .bbe-ctl { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; min-width: 0; max-width: 100%; }
bb-evidence .bbe-runs { display: flex; gap: 4px; overflow-x: auto; scrollbar-width: none; max-width: 100%; }
bb-evidence .bbe-runs button { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--bb-border); background: var(--bb-bg); border-radius: 999px;
  padding: 3px 10px; cursor: pointer; white-space: nowrap; font-size: 12.5px; }
bb-evidence .bbe-runs button[aria-pressed="true"] { border-color: var(--bb-accent); box-shadow: inset 0 0 0 1px var(--bb-accent); font-weight: 600; }
bb-evidence .bbe-runs .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--bb-adm); flex: none; }
bb-evidence .bbe-runs .dot.ok { background: var(--bb-good); }
bb-evidence .bbe-runs .dot.bad { background: var(--bb-bad); }
bb-evidence .bbe-seg { display: inline-flex; border: 1px solid var(--bb-border); border-radius: 9px; overflow: hidden; background: var(--bb-bg); flex: none; }
bb-evidence .bbe-seg button { border: 0; background: transparent; color: var(--bb-muted); padding: 5px 11px; cursor: pointer; font-size: 12.5px; }
bb-evidence .bbe-seg button[aria-pressed="true"] { background: var(--bb-subtle); color: var(--bb-fg); font-weight: 650; }
bb-evidence .bbe-note { padding: 6px 14px; font-size: 12.5px; color: var(--bb-muted); border-bottom: 1px solid var(--bb-border); background: var(--bb-subtle); }
bb-evidence .bbe-foot { padding: 8px 14px; border-top: 1px solid var(--bb-border); color: var(--bb-muted); font-size: 12px; overflow-wrap: anywhere; }
bb-evidence .bbe-empty-run { padding: 18px; }

/* the scene slot */
bb-evidence .bbe-scene { position: relative; min-height: 0; min-width: 0; background: radial-gradient(ellipse at 50% 30%, var(--bb-bg), var(--bb-subtle)); }
bb-evidence .bbe-scene > :is(bb-scene-3d, bb-scene-video, bb-scene-multi) { position: absolute; inset: 0; }
bb-evidence .bbe-scene > .bbe-noscene { position: absolute; inset: 0; display: grid; place-items: center; color: var(--bb-muted); font-size: 13px; }

/* Lens */
bb-evidence .bbe-lens { display: grid; grid-template-columns: minmax(250px, 330px) minmax(0, 1fr); height: var(--bbe-h, 560px); }
bb-evidence .bbe-lens.noscene { grid-template-columns: minmax(250px, 380px) minmax(0, 1fr); }
bb-evidence .bbe-cards { border-right: 1px solid var(--bb-border); padding: 12px; overflow: auto; display: flex; flex-direction: column; gap: 8px; min-height: 0; }
bb-evidence .bbe-sec { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: var(--bb-muted); margin: 6px 0 -2px; }
bb-evidence .bbe-card { display: grid; grid-template-columns: 16px minmax(0, 1fr) auto; gap: 2px 8px; align-items: baseline; text-align: left; width: 100%;
  border: 1px solid var(--bb-border); background: var(--bb-bg); border-radius: 9px; padding: 8px 10px; cursor: pointer; }
bb-evidence .bbe-card:hover { border-color: var(--bb-accent); }
bb-evidence .bbe-card[aria-pressed="true"] { border-color: var(--bb-accent); box-shadow: inset 3px 0 0 var(--bb-accent); background: color-mix(in srgb, var(--bb-accent) 6%, var(--bb-bg)); }
bb-evidence .bbe-card .ic { font-weight: 700; color: var(--bb-muted); }
bb-evidence .bbe-card .ic.ok { color: var(--bb-good); }
bb-evidence .bbe-card .ic.bad { color: var(--bb-bad); }
bb-evidence .bbe-card .nm { font-weight: 600; min-width: 0; overflow-wrap: anywhere; }
bb-evidence .bbe-card .val { font-family: var(--bb-mono); font-size: 12.5px; white-space: nowrap; }
bb-evidence .bbe-card.fail { border-color: color-mix(in srgb, var(--bb-bad) 60%, var(--bb-border)); }
bb-evidence .bbe-card.fail .val { color: var(--bb-bad); font-weight: 650; }
bb-evidence .bbe-card .rule { grid-column: 2 / 4; color: var(--bb-muted); font-size: 12px; overflow-wrap: anywhere; }
bb-evidence .bbe-card .id { grid-column: 2 / 4; color: var(--bb-faint); font: 11px var(--bb-mono); overflow-wrap: anywhere; }
bb-evidence .bbe-card.objective .val { font-size: 19px; font-weight: 650; }
bb-evidence .bbe-card.objective .nm { font-size: 14.5px; }
bb-evidence .bbe-stage { display: flex; flex-direction: column; min-width: 0; min-height: 0; position: relative; }
bb-evidence .bbe-stage .bbe-scene { flex: 1 1 auto; }
bb-evidence .bbe-explain { position: absolute; left: 12px; top: 12px; z-index: 2; max-width: min(400px, calc(100% - 24px)); background: color-mix(in srgb, var(--bb-bg) 92%, transparent);
  border: 1px solid var(--bb-border); border-radius: 10px; padding: 10px 12px; font-size: 12.5px; box-shadow: 0 1px 2px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.06); }
bb-evidence .bbe-explain h3 { font-size: 14px; margin: 0 0 4px; }
bb-evidence .bbe-explain p { color: var(--bb-muted); margin: 0 0 6px; }
bb-evidence .bbe-explain .read { font-family: var(--bb-mono); font-size: 12.5px; }
bb-evidence .bbe-lens.noscene .bbe-explain { position: static; max-width: none; margin: 12px; box-shadow: none; }
bb-evidence .bbe-lens.flat .bbe-explain { position: static; max-width: none; margin: 0; border-width: 1px 0 0; border-radius: 0; box-shadow: none; order: 1; }
bb-evidence .bbe-lens.flat .bbe-explain p { display: none; }
bb-evidence .bbe-lens.flat .bbe-strip { order: 2; }
bb-evidence .bbe-legend { display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: center; margin-top: 6px; color: var(--bb-muted); font-size: 11.5px; }
bb-evidence .bbe-legend i { display: inline-block; width: 16px; height: 8px; border-radius: 3px; vertical-align: middle; margin-right: 4px; }
bb-evidence .bbe-legend i.ramp { width: 64px; background: linear-gradient(90deg, var(--bbe-err-0), var(--bbe-err-1), var(--bbe-err-2), var(--bbe-err-3), var(--bbe-err-4)); }
bb-evidence .bbe-legend i.on { background: var(--bb-accent); }
bb-evidence .bbe-legend i.rest { background: var(--bb-adm); opacity: .55; }
bb-evidence .bbe-legend i.bad { background: var(--bb-bad); }
bb-evidence .bbe-legend i.gate { height: 0; border-top: 2px dashed var(--bb-bad); border-radius: 0; }
bb-evidence .bbe-legend i.ref { height: 0; border-top: 2px dashed var(--bb-fg); border-radius: 0; }
bb-evidence .bbe-strip { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 10px; align-items: center; padding: 8px 12px 10px; border-top: 1px solid var(--bb-border); }
bb-evidence .bbe-strip .bbe-track { height: 64px; }
bb-evidence .bbe-time { font: 12px var(--bb-mono); color: var(--bb-muted); min-width: 108px; text-align: right; white-space: nowrap; }
bb-evidence .bbe-play { width: 30px; height: 30px; border-radius: 50%; border: 1px solid var(--bb-border); background: var(--bb-bg); cursor: pointer; display: grid; place-items: center; flex: none; }
bb-evidence .bbe-play:hover { border-color: var(--bb-accent); }
bb-evidence .bbe-track { position: relative; min-width: 0; cursor: ew-resize; touch-action: none; }
bb-evidence .bbe-track canvas { display: block; width: 100%; height: 100%; }
bb-evidence .bbe-cursor { position: absolute; top: 0; bottom: 0; width: 0; border-left: 2px solid var(--bb-accent); pointer-events: none; }

/* Recorder */
bb-evidence .bbe-rec { display: flex; flex-direction: column; min-width: 0; }
bb-evidence .bbe-top { display: grid; grid-template-columns: minmax(0, 1fr) minmax(220px, 34%); gap: 12px; padding: 12px; }
bb-evidence .bbe-rec.noscene .bbe-top { grid-template-columns: minmax(0, 1fr); }
bb-evidence .bbe-top .bbe-scene { height: 220px; border: 1px solid var(--bb-border); border-radius: 10px; overflow: hidden; }
bb-evidence .bbe-summary { border: 1px solid var(--bb-border); border-radius: 10px; padding: 12px 14px; min-width: 0; }
bb-evidence .bbe-summary .big { font-size: 17px; margin-bottom: 4px; overflow-wrap: anywhere; }
bb-evidence .bbe-summary .big.ok b { color: var(--bb-good); }
bb-evidence .bbe-summary .big.bad b { color: var(--bb-bad); }
bb-evidence .bbe-summary .sub { color: var(--bb-muted); font-size: 12.5px; overflow-wrap: anywhere; }
bb-evidence .bbe-tl { border-top: 1px solid var(--bb-border); }
bb-evidence .bbe-row { display: grid; grid-template-columns: var(--bbe-lw, 190px) minmax(0, 1fr) var(--bbe-sw, 118px); border-bottom: 1px solid var(--bb-rule); min-width: 0; }
bb-evidence .bbe-row.axis { background: var(--bb-subtle); position: sticky; top: 0; z-index: 3; }
bb-evidence .bbe-row.axis .bbe-track { height: 30px; cursor: ew-resize; }
bb-evidence .bbe-row.axis .bbe-lh { display: flex; align-items: center; gap: 8px; padding: 0 10px; min-width: 0; }
bb-evidence .bbe-row.axis .bbe-time { min-width: 0; text-align: left; }
bb-evidence .bbe-row.axis .bbe-play { width: 26px; height: 26px; }
bb-evidence .bbe-gh { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: var(--bb-muted); padding: 6px 10px 3px; border-bottom: 1px solid var(--bb-rule); background: var(--bb-subtle); }
bb-evidence .bbe-lane .bbe-lh { text-align: left; border: 0; background: transparent; padding: 7px 10px; cursor: pointer; min-width: 0; border-right: 1px solid var(--bb-rule); }
bb-evidence .bbe-lane .bbe-lh b { display: block; font-size: 12.5px; overflow-wrap: anywhere; }
bb-evidence .bbe-lane .bbe-lh small { display: block; color: var(--bb-faint); font: 10.5px var(--bb-mono); overflow-wrap: anywhere; }
bb-evidence .bbe-lane .bbe-track { height: 46px; }
bb-evidence .bbe-lane.open .bbe-track { height: 128px; }
bb-evidence .bbe-lane[aria-selected="true"] { box-shadow: inset 0 0 0 2px var(--bb-accent); border-radius: 4px; }
bb-evidence .bbe-lane:hover .bbe-lh { background: var(--bb-hover); }
bb-evidence .bbe-sc { padding: 6px 10px; text-align: right; font: 12px var(--bb-mono); border-left: 1px solid var(--bb-rule); min-width: 0; overflow-wrap: anywhere; }
bb-evidence .bbe-sc .pf { display: block; font-size: 11.5px; color: var(--bb-muted); }
bb-evidence .bbe-sc .pf.ok { color: var(--bb-good); }
bb-evidence .bbe-sc .pf.bad { color: var(--bb-bad); font-weight: 650; }
bb-evidence .bbe-sc .v { display: block; font-weight: 600; }
bb-evidence .bbe-sc .v.bad { color: var(--bb-bad); }
bb-evidence .bbe-sc .g { display: block; color: var(--bb-faint); font-size: 10.5px; }

/* phone and narrow hosts */
bb-evidence [data-narrow] .bbe-lens { grid-template-columns: minmax(0, 1fr); height: auto; }
bb-evidence [data-narrow] .bbe-stage { order: -1; }
bb-evidence [data-narrow] .bbe-stage .bbe-scene { height: 280px; flex: none; }
bb-evidence [data-narrow] .bbe-cards { border-right: 0; border-top: 1px solid var(--bb-border); max-height: none; }
bb-evidence [data-narrow] .bbe-explain { position: static; max-width: none; margin: 8px 12px 0; box-shadow: none; order: 1; }
bb-evidence [data-narrow] .bbe-strip { order: 2; }
bb-evidence [data-narrow] .bbe-card .rule { display: none; }
bb-evidence [data-narrow] .bbe-card.objective .rule { display: block; }
bb-evidence [data-narrow] .bbe-top { grid-template-columns: minmax(0, 1fr); }
bb-evidence [data-narrow] .bbe-top .bbe-scene { height: 210px; }
bb-evidence [data-narrow] .bbe-row { --bbe-lw: 96px; --bbe-sw: 78px; }
bb-evidence [data-narrow] .bbe-lane .bbe-lh small { display: none; }
bb-evidence [data-narrow] .bbe-time { min-width: 0; }
bb-evidence [data-narrow] .bbe-strip { grid-template-columns: auto minmax(0, 1fr); row-gap: 4px; }
bb-evidence [data-narrow] .bbe-strip .bbe-time { grid-column: 1 / -1; text-align: left; }
`;
