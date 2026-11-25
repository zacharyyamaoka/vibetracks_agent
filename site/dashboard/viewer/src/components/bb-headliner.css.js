// <bb-headliner>'s stylesheet, a pure module so the standalone build can also ship it as dist/bb-headliner.css.
export default `
bb-headliner .bbh { background: var(--bb-card); border: 1px solid var(--bb-border); border-radius: 16px; padding: 18px 18px 12px; position: relative; min-width: 0; }
bb-headliner .bbh-box { font-size: 13px; color: var(--bb-muted); margin-bottom: 2px; overflow-wrap: anywhere; }
bb-headliner .bbh-box b { color: var(--bb-fg); font-weight: 600; }
bb-headliner .bbh-headline { min-height: 50px; display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 10px; }
bb-headliner .bbh-headline .value { font-size: 40px; font-weight: 650; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; line-height: 1.15; }
bb-headliner .bbh-headline .unit { font-size: 18px; color: var(--bb-muted); margin-left: -4px; }
bb-headliner .bbh-headline .delta { font-size: 14px; font-weight: 600; padding: 2px 8px; border-radius: 8px; font-variant-numeric: tabular-nums; }
bb-headliner .bbh-headline .delta.good { background: color-mix(in srgb, var(--bb-good) 14%, var(--bb-bg)); color: var(--bb-good); }
bb-headliner .bbh-headline .delta.bad { background: color-mix(in srgb, var(--bb-bad) 12%, var(--bb-bg)); color: var(--bb-bad); }
bb-headliner .bbh-headline .delta.flat { background: var(--bb-subtle); color: var(--bb-muted); }
bb-headliner .bbh-headline .delta-text { font-size: 14px; color: var(--bb-muted); }
bb-headliner .bbh-headline .delta-text.good { color: var(--bb-good); }
bb-headliner .bbh-headline .delta-text.bad { color: var(--bb-bad); }
bb-headliner .bbh-headline .why { font-size: 14px; color: var(--bb-muted); }
bb-headliner .bbh-sub { font-size: 13px; color: var(--bb-muted); min-height: 19px; overflow-wrap: anywhere; }
bb-headliner .bbh-sub .who { color: var(--bb-fg); }
bb-headliner .bbh-bar { display: flex; align-items: center; justify-content: space-between; gap: 8px 12px; flex-wrap: wrap; margin: 12px 0 4px;
  border-bottom: 1px solid var(--bb-border); padding-bottom: 6px; }
bb-headliner .bbh-right { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
bb-headliner .bbh-ctl { font-size: 12px; color: var(--bb-muted); display: inline-flex; gap: 4px; align-items: center; }
bb-headliner .chips { display: flex; gap: 2px; overflow-x: auto; scrollbar-width: none; max-width: 100%; }
bb-headliner .chip { border: 0; background: transparent; color: var(--bb-muted); font: inherit; font-size: 13px; font-weight: 500; padding: 6px 12px;
  border-radius: 16px; cursor: pointer; white-space: nowrap; }
bb-headliner .chip:hover { background: var(--bb-subtle); color: var(--bb-fg); }
bb-headliner .chip[aria-pressed="true"] { background: var(--bb-subtle); color: var(--bb-fg); font-weight: 650; box-shadow: inset 0 0 0 1px var(--bb-border); }
bb-headliner .chip.custom { font-style: italic; }
bb-headliner .seg { display: inline-flex; border: 1px solid var(--bb-border); border-radius: 9px; overflow: hidden; background: var(--bb-card); }
bb-headliner .seg button { border: 0; background: transparent; color: var(--bb-muted); font: inherit; font-size: 12.5px; padding: 5px 10px; cursor: pointer; white-space: nowrap; }
bb-headliner .seg button + button { border-left: 1px solid var(--bb-border); }
bb-headliner .seg button[aria-pressed="true"] { background: var(--bb-subtle); color: var(--bb-fg); font-weight: 600; }
bb-headliner .bbh-abl { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--bb-muted); margin: 6px 0 0; cursor: pointer; width: fit-content; max-width: 100%; }
bb-headliner .bbh-abl input { margin: 0; accent-color: var(--bb-fg); }
bb-headliner .bbh-abl b { color: var(--bb-fg); font-weight: 600; }
bb-headliner .bbh-chart { position: relative; width: 100%; margin-top: 4px; touch-action: pan-y; }
bb-headliner .bbh-chart .u-select { background: var(--bb-best-fill); }
bb-headliner .bbh-ring { position: absolute; width: 16px; height: 16px; margin: -8px 0 0 -8px; border-radius: 50%; border: 2px solid var(--bb-fg); pointer-events: none; display: none; z-index: 2; }
bb-headliner .bbh-foot { display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; margin-top: 6px; }
bb-headliner .bbh-legend { display: flex; gap: 4px 14px; flex-wrap: wrap; font-size: 12px; color: var(--bb-muted); align-items: center; }
bb-headliner .bbh-legend > span { display: inline-flex; gap: 6px; align-items: center; }
bb-headliner .bbh-legend i { display: inline-block; flex: none; }
bb-headliner .lg-line { width: 18px; height: 0; border-top: 2px solid var(--bb-best); }
bb-headliner .lg-dot { width: 9px; height: 9px; border-radius: 50%; background: var(--bb-newbest); }
bb-headliner .lg-dot.adm { background: var(--bb-adm); width: 8px; height: 8px; }
bb-headliner .lg-ring { width: 10px; height: 10px; border-radius: 50%; border: 1.6px solid var(--bb-bad); }
bb-headliner .lg-dia { width: 8px; height: 8px; background: var(--bb-holdout); transform: rotate(45deg); opacity: .85; }
bb-headliner .lg-abl { width: 9px; height: 9px; border-radius: 50%; border: 1.4px solid var(--bb-faint); }
bb-headliner .bbh-hint { font-size: 12px; color: var(--bb-faint); }
bb-headliner .bbh-tip { position: fixed; z-index: 50; max-width: min(360px, calc(100vw - 16px)); background: var(--bb-card); color: var(--bb-fg);
  border: 1px solid var(--bb-border); border-radius: 10px; padding: 8px 10px; font-size: 12.5px; line-height: 1.45; box-shadow: 0 6px 24px rgba(0,0,0,.12); pointer-events: none; }
bb-headliner .bbh-tip .k { color: var(--bb-muted); }
bb-headliner .bbh-tip .tag { display: inline-block; font-size: 11px; border-radius: 6px; padding: 0 5px; margin-left: 6px; border: 1px solid var(--bb-border); color: var(--bb-muted); }
bb-headliner .bbh-tip .tag.ok { color: var(--bb-fg); }
bb-headliner .bbh-tip .tag.new { border-color: var(--bb-newbest); color: var(--bb-newbest); }
bb-headliner .bbh-tip .tag.no { border-color: var(--bb-bad); color: var(--bb-bad); }
bb-headliner .bbh-tip .go { color: var(--bb-accent); margin-top: 2px; }
@media (max-width: 520px) { bb-headliner .bbh { padding: 14px 12px 10px; } bb-headliner .bbh-headline .value { font-size: 32px; } }
`;
