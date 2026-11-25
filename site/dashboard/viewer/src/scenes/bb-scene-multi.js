/* <bb-scene-multi>: several scenes side by side or in a grid, driven as one (viewer/CONTRACT.md §14, ./scene.js).

   Its screens come from the record's scene.screens ([{kind: '3d'|'video', view?, label?}]) or the host's `screens`
   property; each is a scene element of its own and gets the same load / seek / highlight / playing calls, so a 3-D
   replay next to the camera video, or two camera angles, stay on one cursor. layout = row (side by side; stacked on a
   phone) or grid (two columns). A box's own scene tag works as a screen too (`kind` = its tag). */
import { adoptCss } from '../core/tokens.js';
import './bb-scene-3d.js';
import './bb-scene-video.js';

const CSS = `
bb-scene-multi { display: grid; width: 100%; height: 100%; min-height: 0; gap: 6px; grid-auto-rows: minmax(0, 1fr); }
bb-scene-multi[data-layout="row"] { grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); }
bb-scene-multi[data-layout="grid"] { grid-template-columns: repeat(2, minmax(0, 1fr)); }
bb-scene-multi[data-narrow] { grid-auto-flow: row; grid-auto-columns: auto; grid-template-columns: minmax(0, 1fr); }
bb-scene-multi > * { min-width: 0; min-height: 0; border-radius: 8px; overflow: hidden; }
`;
export const SCENE_TAGS = { '3d': 'bb-scene-3d', video: 'bb-scene-video' };

export class BBSceneMulti extends HTMLElement {
  constructor() {
    super();
    this.screens = null;
    this.layout = 'row';
    this.kids = [];
    this._playing = false;
  }

  connectedCallback() {
    adoptCss('bb-scene-multi', CSS);
    this._ro ||= new ResizeObserver(() => this.toggleAttribute('data-narrow', this.clientWidth > 0 && this.clientWidth < 520 && this.layout === 'row'));
    this._ro.observe(this);
  }

  load(record, ctx = {}) {
    this.record = record;
    for (const k of this.kids) k.dispose?.();
    const list = this.screens || record?.scene?.screens || [{ kind: '3d' }];
    this.dataset.layout = this.layout;
    this.kids = list.map((screen) => {
      const tag = SCENE_TAGS[screen.kind] || screen.kind;
      const el = document.createElement(customElements.get(tag) ? tag : 'bb-scene-3d');
      el.dataset.screen = screen.kind;
      return [el, screen];
    }).map(([el, screen]) => { el._screen = screen; return el; });
    this.replaceChildren(...this.kids);
    for (const el of this.kids) {
      if (typeof el.load === 'function') el.load(record, { ...ctx, screen: el._screen });
      else el.run = record; // CONTRACT §4's older slot: `.run = record`
    }
  }

  seek(t) { for (const k of this.kids) k.seek?.(t); }
  highlight(id, samples) { for (const k of this.kids) k.highlight?.(id, samples); }
  get playing() { return this._playing; }
  set playing(on) { this._playing = !!on; for (const k of this.kids) if ('playing' in k) k.playing = on; }
  set speed(s) { for (const k of this.kids) k.speed = s; }
  resize() { for (const k of this.kids) k.resize?.(); }
  dispose() { this._ro?.disconnect(); for (const k of this.kids) k.dispose?.(); }
}

if (!customElements.get('bb-scene-multi')) customElements.define('bb-scene-multi', BBSceneMulti);
