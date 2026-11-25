// <bb-frontier>'s stylesheet (proposals-frontier/_shared/fr.css, on the viewer's --bb-* tokens). Pure module.
export default `
bb-frontier .bbf { background: var(--bb-card); border: 1px solid var(--bb-border); border-radius: 16px; padding: 18px 18px 12px; position: relative; min-width: 0; }
bb-frontier .bbf-box { font-size: 12.5px; color: var(--bb-muted); overflow-wrap: anywhere; }
bb-frontier .bbf-box b { color: var(--bb-fg); font-weight: 600; }
bb-frontier .bbf-title { font-size: 20px; font-weight: 650; margin: 2px 0 0; letter-spacing: -0.2px; overflow-wrap: anywhere; }
bb-frontier .bbf-title .vs { color: var(--bb-muted); font-weight: 400; }
bb-frontier .bbf-bar { display: flex; align-items: center; justify-content: space-between; gap: 8px 14px; flex-wrap: wrap; margin: 10px 0 6px; }
bb-frontier .bbf-chips { display: flex; gap: 4px; flex-wrap: wrap; min-width: 0; }
bb-frontier .chip { border: 1px solid var(--bb-border); background: var(--bb-card); color: var(--bb-muted); font: inherit; font-size: 12.5px; font-weight: 500;
  padding: 5px 11px; border-radius: 16px; cursor: pointer; white-space: nowrap; }
bb-frontier .chip:hover { background: var(--bb-subtle); color: var(--bb-fg); }
bb-frontier .chip[aria-pressed="true"] { background: var(--bb-fg); border-color: var(--bb-fg); color: var(--bb-bg); font-weight: 600; }
bb-frontier .chip.none { border-style: dashed; }
bb-frontier .chip.none .nil { margin-left: 5px; color: var(--bb-faint); }
bb-frontier .chip.none[aria-pressed="true"] .nil { color: inherit; opacity: .7; }
bb-frontier .bbf-abl { display: inline-flex; align-items: center; gap: 7px; font-size: 12.5px; color: var(--bb-muted); cursor: pointer; user-select: none; max-width: 100%; }
bb-frontier .bbf-abl input { width: 15px; height: 15px; margin: 0; accent-color: var(--bb-fg); cursor: pointer; flex: none; }
bb-frontier .bbf-abl b { color: var(--bb-fg); font-weight: 600; }
bb-frontier .bbf-abl:hover { color: var(--bb-fg); }
bb-frontier .bbf-front { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; font-size: 12.5px; color: var(--bb-muted); margin: 6px 0 4px; min-height: 26px; }
bb-frontier .bbf-front a { text-decoration: none; color: var(--bb-fg); background: var(--bb-subtle); border-radius: 8px; padding: 2px 7px; border: 1px solid var(--bb-border); white-space: nowrap; max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
bb-frontier .bbf-front a:hover { border-color: var(--bb-faint); }
bb-frontier .bbf-front .arrow { color: var(--bb-faint); }
bb-frontier .bbf-front .lead { color: var(--bb-fg); font-weight: 600; margin-right: 2px; }
bb-frontier .bbf-front .more { border: 1px dashed var(--bb-border); background: transparent; color: var(--bb-muted); border-radius: 8px; padding: 2px 7px; font: inherit; font-size: 12px; cursor: pointer; }
bb-frontier .bbf-front .more:hover { color: var(--bb-fg); border-color: var(--bb-faint); }
bb-frontier .bbf-front .count { color: var(--bb-faint); font-size: 11.5px; margin-left: 4px; }
bb-frontier .bbf-ylabel { font-size: 11.5px; color: var(--bb-muted); margin: 6px 0 0 4px; }
bb-frontier .bbf-chart { position: relative; width: 100%; touch-action: pan-y; }
bb-frontier .bbf-xlabel { font-size: 11.5px; color: var(--bb-muted); text-align: center; margin-top: 2px; overflow-wrap: anywhere; }
bb-frontier .bbf-nocost { border: 1px dashed var(--bb-border); border-radius: 12px; padding: 18px; color: var(--bb-muted); font-size: 13.5px; display: flex; flex-direction: column; justify-content: center; gap: 4px; }
bb-frontier .bbf-nocost b { color: var(--bb-fg); font-weight: 600; }
bb-frontier .bbf-ring { position: absolute; width: 18px; height: 18px; margin: -9px 0 0 -9px; border-radius: 50%; border: 2px solid var(--bb-fg); pointer-events: none; display: none; z-index: 2; }
bb-frontier .bbf-foot { display: flex; justify-content: space-between; align-items: flex-start; gap: 6px 14px; flex-wrap: wrap; margin-top: 8px; }
bb-frontier .bbf-legend { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 12px; color: var(--bb-muted); align-items: center; min-width: 0; }
bb-frontier .bbf-legend > span { display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; min-width: 0; }
bb-frontier .bbf-legend i { display: inline-block; flex: none; }
bb-frontier .lg-ramp { width: 96px; height: 10px; border-radius: 5px; background: linear-gradient(to right, color-mix(in srgb, var(--bb-fg) 14%, transparent), var(--bb-fg)); }
bb-frontier .lg-line { width: 18px; height: 0; border-top: 2.2px solid var(--bb-best); }
bb-frontier .lg-tide { width: 18px; height: 0; border-top: 1.6px solid color-mix(in srgb, var(--bb-best) 40%, transparent); }
bb-frontier .lg-dash { width: 18px; height: 0; border-top: 2px dashed color-mix(in srgb, var(--bb-best) 60%, transparent); }
bb-frontier .lg-front { width: 12px; height: 12px; border-radius: 50%; border: 2px solid var(--bb-best); }
bb-frontier .lg-best { width: 10px; height: 10px; border-radius: 50%; background: var(--bb-newbest); }
bb-frontier .lg-ring { width: 10px; height: 10px; border-radius: 50%; border: 1.8px solid var(--bb-bad); }
bb-frontier .lg-abl { width: 10px; height: 10px; border-radius: 50%; border: 1.4px dashed var(--bb-faint); }
bb-frontier .bbf-hint { font-size: 12px; color: var(--bb-faint); }
bb-frontier .bbf-notes { font-size: 11.5px; color: var(--bb-muted); margin-top: 4px; display: grid; gap: 2px; overflow-wrap: anywhere; }
bb-frontier .bbf-notes b { color: var(--bb-fg); font-weight: 600; }
bb-frontier .bbf-tip { position: fixed; z-index: 50; max-width: min(340px, calc(100vw - 16px)); background: var(--bb-card); color: var(--bb-fg);
  border: 1px solid var(--bb-border); border-radius: 10px; padding: 8px 10px; font-size: 12.5px; line-height: 1.45; box-shadow: 0 6px 24px rgba(0,0,0,.14); pointer-events: none; }
bb-frontier .bbf-tip .k { color: var(--bb-muted); }
bb-frontier .bbf-tip .tag { display: inline-block; font-size: 11px; border-radius: 6px; padding: 0 5px; margin-left: 6px; border: 1px solid var(--bb-border); color: var(--bb-muted); }
bb-frontier .bbf-tip .tag.front { border-color: var(--bb-best); color: var(--bb-best); }
bb-frontier .bbf-tip .tag.new { border-color: var(--bb-newbest); color: var(--bb-newbest); }
bb-frontier .bbf-tip .tag.no { border-color: var(--bb-bad); color: var(--bb-bad); }
bb-frontier .bbf-tip .go { color: var(--bb-accent); margin-top: 2px; }
@media (max-width: 560px) {
  bb-frontier .bbf { padding: 14px 12px 10px; border-radius: 12px; }
  bb-frontier .bbf-title { font-size: 17px; }
  bb-frontier .chip { padding: 5px 9px; font-size: 12px; }
}
`;
