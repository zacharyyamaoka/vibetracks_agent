/* <bb-scene-video>: a stock HTML5 video synced to the shared cursor (viewer/CONTRACT.md §14, the ./scene.js interface).

   The record's scene.video names the file(s) beside the record ({sources: [{src, type}], t0, rate}): record time
   t = t0 + rate × video time. While the host plays, the video plays natively and is only re-synced when it drifts more
   than one frame; while scrubbing, every seek sets currentTime. highlight() writes the chosen metric's value at the
   cursor under the picture (its unit, counted or not, red where it failed), so a camera recording explains a number
   the same way the 3-D replay does. Media load only through mediaUrl(): a relative file beside the record. */
import { frameIndex, mediaUrl } from './scene.js';
import { adoptCss } from '../core/tokens.js';

const CSS = `
bb-scene-video { display: block; position: relative; width: 100%; height: 100%; min-height: 0; background: #0b0c0e; overflow: hidden; }
bb-scene-video video { display: block; width: 100%; height: 100%; object-fit: contain; background: #0b0c0e; }
bb-scene-video .bbs-cap { position: absolute; left: 8px; bottom: 8px; right: 8px; display: flex; gap: 6px; flex-wrap: wrap; pointer-events: none; }
bb-scene-video .bbs-cap span { font: 600 11.5px var(--bb-mono); padding: 2px 7px; border-radius: 6px; background: rgba(12, 13, 16, .78); color: #ececef; }
bb-scene-video .bbs-cap span.bad { background: color-mix(in srgb, var(--bb-bad) 85%, #000); color: #fff; }
bb-scene-video .bbs-cap span.rest { color: #a3a5ab; }
bb-scene-video .bbs-tag { position: absolute; left: 8px; top: 8px; font-size: 11.5px; color: #d6d6da; background: rgba(12, 13, 16, .6);
  padding: 1px 6px; border-radius: 6px; pointer-events: none; max-width: calc(100% - 16px); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
bb-scene-video .bbs-tag:empty { display: none; }
bb-scene-video .bbs-none { display: grid; place-items: center; height: 100%; color: #a3a5ab; font-size: 13px; padding: 16px; text-align: center; }
`;

export class BBSceneVideo extends HTMLElement {
  constructor() {
    super();
    this.t = 0;
    this._playing = false;
    this.samples = null;
  }

  connectedCallback() { adoptCss('bb-scene-video', CSS); }

  load(record, ctx = {}) {
    this.record = record;
    const v = record?.scene?.video;
    this.spec = v || null;
    if (!v || !v.sources?.length) {
      this.innerHTML = '<div class="bbs-none">This run has no video.</div>';
      this.video = null;
      return;
    }
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.disablePictureInPicture = true;
    video.setAttribute('aria-label', v.label || 'run video');
    for (const s of v.sources) {
      const source = document.createElement('source');
      source.src = mediaUrl(s.src, ctx.mediaBase);
      source.type = s.type;
      video.append(source);
    }
    this.video = video;
    this.cap = Object.assign(document.createElement('div'), { className: 'bbs-cap' });
    this.tag = Object.assign(document.createElement('div'), { className: 'bbs-tag' });
    this.tag.textContent = ctx.screen?.label || v.label || '';
    this.replaceChildren(video, this.tag, this.cap);
    this.ready = new Promise((done) => {
      if (video.readyState >= 1) done();
      video.addEventListener('loadedmetadata', () => done(), { once: true });
      video.addEventListener('error', () => done(), { once: true });
    });
    this.ready.then(() => {
      // WHY say so: a server without HTTP Range (python's http.server) serves a video Chromium cannot seek, so it would
      // silently stay at its first frame while the cursor moves; every real static host supports Range
      if (video.readyState >= 1 && !video.seekable.length) this.tag.textContent = `${this.tag.textContent} · this server cannot seek video (no HTTP Range), so it will not follow the cursor`;
      this.seek(this.t, true);
    });
  }

  /** Record time -> video time. */
  vt(t) { return Math.max(0, (t - (this.spec?.t0 || 0)) / (this.spec?.rate || 1)); }

  get playing() { return this._playing; }
  set playing(on) {
    this._playing = !!on;
    if (!this.video) return;
    this.video.playbackRate = Math.max(0.0625, Math.min(16, (this.speed || 1) / (this.spec?.rate || 1)));
    if (on) this.video.play().catch(() => { /* autoplay refused: scrubbing still works */ });
    else this.video.pause();
  }

  seek(t, force = false) {
    this.t = t;
    if (this.video && this.video.readyState >= 1) {
      const want = Math.min(this.vt(t), Math.max(0, (this.video.duration || 0) - 1e-3));
      const drift = Math.abs(this.video.currentTime - want);
      const frame = 1 / (this.spec?.fps || 30);
      if (force || !this._playing || drift > frame * 1.5) this.video.currentTime = want;
    }
    this.caption();
  }

  highlight(metricId, samples) {
    this.samples = metricId && samples ? samples : null;
    this.caption();
  }

  caption() {
    if (!this.cap) return;
    const S = this.samples;
    if (!S) { this.cap.innerHTML = ''; return; }
    const parts = [];
    const i = S.t.length ? frameIndex(S.t, this.t) : -1;
    const v = i >= 0 && S.values ? S.values[i] : null;
    const bad = i >= 0 && S.flagged[i];
    parts.push([`${S.label}${v !== null && v !== undefined ? `: ${+Number(v).toPrecision(3)}${S.unit ? ` ${S.unit}` : ''}` : ''}`, bad ? 'bad' : '']);
    if (i >= 0) parts.push([bad ? 'fails here' : S.counted[i] ? 'counted' : 'not counted', bad ? 'bad' : S.counted[i] ? '' : 'rest']);
    parts.push([`${Number(this.t).toFixed(2)} s`, '']);
    this.cap.innerHTML = parts.map(([, cls]) => `<span class="${cls}"></span>`).join('');
    [...this.cap.children].forEach((el, k) => { el.textContent = parts[k][0]; });
  }

  resize() {}

  dispose() { this.video?.pause(); this.video?.removeAttribute('src'); }
}

if (!customElements.get('bb-scene-video')) customElements.define('bb-scene-video', BBSceneVideo);
