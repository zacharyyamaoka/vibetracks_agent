// <bb-solution-detail>'s stylesheet (proposals-headliner/_detail, on the viewer's --bb-* tokens). Pure module.
export default `
bb-solution-detail .bbs { min-width: 0; }
bb-solution-detail .kicker { font-size: 12px; color: var(--bb-faint); text-transform: uppercase; letter-spacing: .05em; overflow-wrap: anywhere; }
bb-solution-detail h1 { font-size: 28px; margin: 2px 0 4px; font-weight: 650; overflow-wrap: anywhere; }
bb-solution-detail .change { color: var(--bb-muted); font-size: 14.5px; margin-bottom: 10px; overflow-wrap: anywhere; }
bb-solution-detail .verdict { font-size: 14px; margin: 0 0 14px; overflow-wrap: anywhere; }
bb-solution-detail .verdict b { font-weight: 650; }
bb-solution-detail .badge { display: inline-block; font-size: 12px; padding: 1px 8px; border-radius: 8px; font-weight: 600; margin-right: 4px; white-space: nowrap; }
bb-solution-detail .badge.ok { background: color-mix(in srgb, var(--bb-good) 14%, var(--bb-bg)); color: var(--bb-good); }
bb-solution-detail .badge.no { background: color-mix(in srgb, var(--bb-bad) 12%, var(--bb-bg)); color: var(--bb-bad); }
bb-solution-detail .badge.abl, bb-solution-detail .badge.plain { background: var(--bb-subtle); color: var(--bb-muted); }
bb-solution-detail .badge.best { background: color-mix(in srgb, var(--bb-newbest) 14%, var(--bb-bg)); color: var(--bb-newbest); }
bb-solution-detail .nums { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-bottom: 14px; }
bb-solution-detail .num { border: 1px solid var(--bb-border); border-radius: 12px; padding: 10px 12px; background: var(--bb-card); min-width: 0; }
bb-solution-detail .num .l { font-size: 12px; color: var(--bb-muted); overflow-wrap: anywhere; }
bb-solution-detail .num .v { font-size: 24px; font-variant-numeric: tabular-nums; line-height: 1.2; margin-top: 2px; overflow-wrap: anywhere; }
bb-solution-detail .num .v small { font-size: 13px; color: var(--bb-muted); }
bb-solution-detail .num .s { font-size: 12px; color: var(--bb-muted); margin-top: 2px; overflow-wrap: anywhere; }
bb-solution-detail .good { color: var(--bb-good); }
bb-solution-detail .bad { color: var(--bb-bad); }
bb-solution-detail .fails { border: 1px solid var(--bb-bad); border-radius: 12px; padding: 10px 12px; margin-bottom: 12px; font-size: 13.5px; overflow-wrap: anywhere;
  background: color-mix(in srgb, var(--bb-bad) 5%, var(--bb-bg)); }
bb-solution-detail section.blk { margin-top: 16px; min-width: 0; }
bb-solution-detail section.blk h2 { font-size: 15px; margin: 0 0 8px; font-weight: 650; }
bb-solution-detail .chain { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; font-size: 13px; }
bb-solution-detail .chain a, bb-solution-detail .chain .me, bb-solution-detail .chain .gone { border: 1px solid var(--bb-border); border-radius: 9px; padding: 4px 9px; text-decoration: none; color: var(--bb-fg);
  background: var(--bb-card); max-width: 100%; overflow-wrap: anywhere; }
bb-solution-detail .chain a:hover { border-color: var(--bb-faint); }
bb-solution-detail .chain .me { border-color: var(--bb-fg); font-weight: 650; }
bb-solution-detail .chain .gone { color: var(--bb-muted); border-style: dashed; }
bb-solution-detail .chain .lead { color: var(--bb-muted); }
bb-solution-detail .chain .d { font-size: 11.5px; margin-left: 4px; }
bb-solution-detail .chain .f { color: var(--bb-faint); margin-left: 4px; }
bb-solution-detail .chain .arr { color: var(--bb-faint); }
bb-solution-detail .chain .more { border: 1px dashed var(--bb-border); background: transparent; color: var(--bb-muted); border-radius: 9px; padding: 4px 9px; font: inherit; font-size: 12.5px; cursor: pointer; }
bb-solution-detail .twocol { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: 16px; }
bb-solution-detail .scroll { overflow-x: auto; }
bb-solution-detail table { width: 100%; border-collapse: collapse; font-size: 13px; }
bb-solution-detail th, bb-solution-detail td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--bb-rule); vertical-align: top; }
bb-solution-detail th { font-weight: 600; color: var(--bb-muted); font-size: 12px; }
bb-solution-detail td.n, bb-solution-detail th.n { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
bb-solution-detail td .sub { color: var(--bb-muted); font-size: 12px; }
bb-solution-detail td .gname { font-family: var(--bb-mono); font-size: 12px; font-weight: 600; overflow-wrap: anywhere; }
bb-solution-detail .ok-mark { color: var(--bb-good); font-weight: 700; }
bb-solution-detail .note { color: var(--bb-muted); font-size: 13px; border: 1px dashed var(--bb-border); border-radius: 12px; padding: 12px 14px; overflow-wrap: anywhere; }
bb-solution-detail .note b { color: var(--bb-fg); font-weight: 600; }
bb-solution-detail dl.prov { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 4px 14px; font-size: 13px; margin: 0; }
bb-solution-detail dl.prov dt { color: var(--bb-muted); }
bb-solution-detail dl.prov dd { margin: 0; overflow-wrap: anywhere; }
bb-solution-detail code { font-family: var(--bb-mono); font-size: 12px; background: var(--bb-subtle); padding: 0 4px; border-radius: 4px; }
bb-solution-detail .faint { color: var(--bb-faint); }
bb-solution-detail .pager { display: flex; justify-content: space-between; gap: 12px; margin-top: 18px; font-size: 13px; flex-wrap: wrap; }
bb-solution-detail .pager a { text-decoration: none; }
@media (max-width: 720px) {
  bb-solution-detail .nums { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  bb-solution-detail .twocol { grid-template-columns: minmax(0, 1fr); }
  bb-solution-detail h1 { font-size: 23px; }
  bb-solution-detail .num .v { font-size: 20px; }
  bb-solution-detail dl.prov { grid-template-columns: minmax(0, 1fr); }
  bb-solution-detail dl.prov dd { margin-bottom: 4px; }
}
`;
