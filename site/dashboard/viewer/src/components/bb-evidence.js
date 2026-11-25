/* <bb-evidence>: the standard metric explainer (viewer/CONTRACT.md §14). One saved run (a bb-run/1 record the state lists in
   playback.runs, loaded only through this.context.load) shown two ways over the same data and ONE shared time cursor:

   - Lens (proposal v1, Evidence Lens): the scene large, the metric cards beside it; click a card and the scene and the
     strip under it show where that number came from (which samples count, grey = not counted, red = where it failed,
     the peak pinned).
   - Recorder (proposal v4, Flight Recorder): every metric is a lane on one timeline with its score at the right and red
     flags at the moment it failed; the scene small at the top right; opening a lane shows its per-channel detail.

   Zach, 2026-11-24: "I really like v1 and v4 ... In some ways they are the exact same thing ... we can actually support
   both of these! Just have a toggle that helps you switch between them." The toggle is the `layout` setting (page.json
   sets the default) and a switch in the header; clicking a lane in Recorder = clicking its card in Lens.
   The scene slot (../scenes/scene.js) is instrumentable: a 3-D replay of precomputed geometry, a video synced to the
   cursor, several screens, none, or a box's own scene tag (state.playback.scene, CONTRACT §4).
   Ported from trajectory_tracking_agent site/proposals/01-evidence-lens and 04-flight-recorder (their layout, wording,
   colours and the magnified-whisker idea), generalised from one robot's ruler to any bb-run/1 record. */
import { BBElement, esc } from '../core/element.js';
import { makeContext } from '../core/context.js';
import { register } from '../core/registry.js';
import { onTheme, cssVar } from '../core/tokens.js';
import { frameIndex } from '../scenes/scene.js';
import { SCENE_TAGS } from '../scenes/bb-scene-multi.js';
import { makeModel, laneSeries, detailOf, readingAt, sceneKind, valueText, gateText, fmt, withUnit } from './bb-evidence.model.js';
import schema from './bb-evidence.schema.js';
import css from './bb-evidence.css.js';

const PALETTE = ['#2f6fd0', '#e8741c', '#2a9d3a', '#9b4dca', '#d62728', '#17a2b8', '#8c6d1f', '#e377c2'];
const PLAY = '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.5v9l7-4.5z" fill="currentColor"/></svg>';
const PAUSE = '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 1.5h2.5v9H2.5zM7 1.5h2.5v9H7z" fill="currentColor"/></svg>';
const icon = (m) => (m.passed === true ? ['✓', 'ok'] : m.passed === false ? ['✗', 'bad'] : ['·', '']);

export class BBEvidence extends BBElement {
  static schema = schema;
  static css = css;

  constructor() {
    super();
    this.records = new Map(); // path -> record (or a promise of it)
    this.t = 0;
    this.playing = false;
    this.layout = null;
    this.metricId = null;
    this.scene = null;
  }

  connectedCallback() {
    super.connectedCallback();
    this._stopTheme ||= onTheme(() => this.redraw());
    this._ro ||= new ResizeObserver(() => {
      const box = this.querySelector('.bbe');
      if (box) box.toggleAttribute('data-narrow', this.clientWidth > 0 && this.clientWidth < 720);
      if (box && this.scene && 'inset' in this.scene) {
        const want = this.layout === 'lens' && !box.hasAttribute('data-narrow') && this.kind === '3d' ? 0.17 : 0;
        if (want !== this.scene.inset) this.scene.inset = want;
      }
      this.redraw();
      this.scene?.resize?.();
    });
    this._ro.observe(this);
  }

  teardown() {
    this._stopTheme?.(); this._stopTheme = null;
    this._ro?.disconnect(); this._ro = null;
    this.stop();
    this.scene?.dispose?.();
    this.scene = null;
  }

  get runs() { return this.data?.playback?.runs || []; }

  /* Standalone (<bb-evidence state-src="state.json">, no bb-page): the default context must know the listed runs, or
     context.load refuses them all; it is rebuilt from the slice this element holds (playback only). A host's context wins. */
  get context() {
    if (!this._context || this._context.bbeOwn) {
      const runs = this.data?.playback?.runs || [];
      if (!this._context || this._context.bbeRuns !== runs) {
        const links = this.getAttribute('links');
        this._context = Object.assign(makeContext({ state: this.data, stateUrl: this._stateUrl, links: links ? JSON.parse(links) : {} }),
          { follow: !!links, bbeOwn: true, bbeRuns: runs });
      }
    }
    return this._context;
  }
  set context(ctx) { this._context = ctx; this.update(); }

  /** The record base URL (for media the record names): the context's stateUrl (bb-page's, a host's, or this element's
      own state-src), else the page. */
  recordUrl(path) {
    const base = this.context.stateUrl || this._stateUrl || document.baseURI;
    return new URL(path, base).href;
  }

  load(path) {
    if (!this.records.has(path)) this.records.set(path, this.context.load(path).then((r) => { this.records.set(path, r); return r; }));
    return Promise.resolve(this.records.get(path));
  }

  async render() {
    const s = this.settings;
    const runs = this.runs;
    if (!runs.length) { this.scene?.dispose?.(); this.scene = null; return this.empty(); }
    if (this._layoutSetting !== s.layout) { this.layout = s.layout; this._layoutSetting = s.layout; } // page.json's default; the switch then wins
    const want = s.run ? runs.find((r) => r.path === s.run || r.solution === s.run) : null;
    if (!this.path || !runs.some((r) => r.path === this.path)) this.path = (want || runs[0]).path;
    this.innerHTML = '<div class="bb-muted" style="font-size:13px;padding:12px">Loading the run record…</div>';
    const rec = await this.load(this.path);
    this.show(rec);
    // colour the other runs' chips by their verdicts (each record loads once, through the context)
    for (const r of runs) if (r.path !== this.path) this.load(r.path).then(() => this.chips(), () => {});
  }

  show(rec) {
    const s = this.settings;
    this.stop();
    this.rec = rec;
    this.m = makeModel(rec);
    const m = this.m;
    if (this.metricId && !m.byId[this.metricId]) this.metricId = null;
    this.metricId ||= (s.metric && m.byId[s.metric] ? s.metric : m.objective?.id) || null;
    const pk = this.metricId ? m.byId[this.metricId]?.evidence?.peak : null;
    this.t = this._keepT !== undefined ? Math.min(Math.max(this._keepT, m.t0), m.t1) : pk ? pk.t : m.t0;
    this._keepT = undefined;
    if (m.empty) {
      this.scene?.dispose?.(); this.scene = null;
      this.innerHTML = `<div class="bbe">${this.head()}<div class="bbe-empty-run">${'<div class="bb-empty" data-empty="bb-evidence"><b>This run record has no samples and no metrics.</b><div style="margin-top:4px">'
        + `${esc(rec.source?.note || 'Nothing was saved for it.')}</div></div>`}</div></div>`;
      this.wire();
      return;
    }
    this.kind = sceneKind(rec, this.boxScene() ? 'box' : s.scene);
    this.makeScene();
    this.draw();
  }

  /** A box's own scene tag named by state.playback.scene and registered on the page (CONTRACT §4, §8). */
  boxScene() {
    const tag = this.data?.playback?.scene;
    return this.settings.scene === 'auto' && tag && customElements.get(tag) ? tag : null;
  }

  makeScene() {
    this.scene?.dispose?.();
    this.scene = null;
    const s = this.settings;
    const box = this.boxScene();
    if (this.kind === 'none' && !box) return;
    const tag = box || (this.kind === 'multi' ? 'bb-scene-multi' : SCENE_TAGS[this.kind]);
    const el = document.createElement(tag);
    if (this.kind === 'multi') {
      el.layout = s.screens;
      el.screens = this.rec.scene.screens || [{ kind: '3d', label: '3-D replay' }, { kind: 'video', label: 'video' }];
    }
    el.speed = s.speed;
    this.scene = el;
    this._sceneLoaded = false;
  }

  /* ── drawing ──────────────────────────────────────────────────────────────────────────────────────────── */

  head() {
    const s = this.settings, rec = this.rec, m = this.m;
    const sub = rec.subject || {};
    const v = m?.verdict;
    const verdict = v ? `<span class="bbe-verdict ${v.ok ? 'ok' : 'bad'}">${v.ok ? '✓' : '✗'} ${esc(v.text)}</span>` : '';
    const what = [sub.label, sub.kind, sub.split].filter(Boolean).map(esc).join(' · ');
    const runs = this.runs.length > 1 && s.picker ? `<div class="bbe-runs" role="group" aria-label="Run">${this.runs.map((r) => `<button data-run="${esc(r.path)}" aria-pressed="${r.path === this.path}" title="${esc(r.label || '')}"><i class="dot"></i>${esc(r.solution)}</button>`).join('')}</div>` : '';
    const sw = s.toggle ? `<div class="bbe-seg" role="group" aria-label="Layout">${[['lens', 'Lens'], ['recorder', 'Recorder']].map(([id, label]) => `<button data-layout="${id}" aria-pressed="${this.layout === id}" title="${id === 'lens' ? 'The scene large, metric cards beside it' : 'Every metric a lane on one timeline'}">${label}</button>`).join('')}</div>` : '';
    return `<header class="bbe-head"><div class="bbe-who">${verdict}<span class="bbe-title"><b>${esc(sub.solution || '')}</b>${sub.task ? ` on <code>${esc(sub.task)}</code>` : ''}</span>${what ? `<span class="bbe-sub">${what}</span>` : ''}</div>
      <div class="bbe-ctl">${runs}${sw}</div></header>`;
  }

  chips() {
    for (const b of this.querySelectorAll('.bbe-runs button')) {
      const r = this.records.get(b.dataset.run);
      if (!r || typeof r.then === 'function') continue;
      const gates = (r.metrics || []).filter((x) => x.kind === 'gate');
      const bad = gates.some((x) => x.passed === false);
      b.querySelector('.dot').className = `dot ${gates.length ? (bad ? 'bad' : 'ok') : ''}`;
      b.title = `${r.subject?.label || ''} · ${r.subject?.verdict || ''}`;
    }
  }

  note() {
    const s = this.settings, rec = this.rec;
    const notes = [];
    if (s.scene !== 'auto' && s.scene !== this.kind) notes.push(`This run has no ${s.scene === 'video' ? 'video' : s.scene === 'multi' ? 'second screen' : '3-D geometry'}; showing ${this.kind === 'none' ? 'the metrics only' : `the ${this.kind === '3d' ? '3-D replay' : this.kind}`}.`);
    if (rec.subject?.rerun) notes.push('A re-run: this episode was run again with the box\'s own code because its grade saved no samples; the scores are the ledger\'s, the re-run\'s own beside them.');
    return notes.length ? `<div class="bbe-note">${notes.map(esc).join(' ')}</div>` : '';
  }

  foot() {
    const src = this.rec.source || {};
    const from = (src.from || []).slice(0, 3).map((f) => `<code>${esc(f)}</code>`).join(', ');
    return `<footer class="bbe-foot">Record <code>${esc(this.rec.id || '')}</code> (bb-run/1)${from ? ` from ${from}` : ''}${src.by ? ` · folded by <code>${esc(src.by)}</code>` : ''}${src.note ? ` · ${esc(src.note)}` : ''}</footer>`;
  }

  draw() {
    const s = this.settings;
    const scene = this.scene;
    if (scene && scene.parentNode) scene.remove(); // kept across re-draws: a WebGL context survives a move
    const body = this.layout === 'recorder' ? this.recorder() : this.lens();
    this.innerHTML = `<div class="bbe" data-layout="${this.layout}" style="--bbe-h:${s.height}px">${this.head()}${this.note()}${body}${this.foot()}</div>`;
    const box = this.querySelector('.bbe');
    box.toggleAttribute('data-narrow', this.clientWidth > 0 && this.clientWidth < 720);
    const host = this.querySelector('.bbe-scene');
    if (host && scene) {
      host.prepend(scene);
      if (!this._sceneLoaded) {
        this._sceneLoaded = true;
        const ctx = { mediaBase: this.recordUrl(this.path), screen: { kind: this.kind } };
        if (typeof scene.load === 'function') scene.load(this.rec, ctx);
        else scene.run = this.rec; // CONTRACT §4's slot
      }
      // Lens lays the explain card over the left of a single 3-D scene: keep that part of the picture clear
      if ('inset' in scene) scene.inset = this.layout === 'lens' && !box.hasAttribute('data-narrow') && this.kind === '3d' ? 0.17 : 0;
      scene.resize?.();
    }
    this.wire();
    this.chips();
    this.select(this.metricId, { quiet: true });
    this.seek(this.t); // the scene starts where the cursor is (the chosen metric's peak)
  }

  card(m) {
    const [ic, tone] = icon(m);
    const fail = m.passed === false;
    return `<button class="bbe-card${m.kind === 'objective' ? ' objective' : ''}${fail ? ' fail' : ''}" data-metric="${esc(m.id)}" aria-pressed="${m.id === this.metricId}">
      <span class="ic ${tone}">${ic}</span><span class="nm">${esc(m.label)}</span><span class="val">${esc(valueText(m))}</span>
      ${m.rule ? `<span class="rule">${esc(m.rule)}${m.gate ? '' : ''}</span>` : ''}<span class="id">${esc(m.id)}${m.gate ? ` · gate ${esc(gateText(m))}` : ''}${m.scope ? ` · ${esc(m.scope)}` : ''}</span></button>`;
  }

  lens() {
    const m = this.m;
    const cards = m.groups.map((g) => `<div class="bbe-sec">${esc(g.label)}${g.kind === 'objective' && m.objective?.direction ? ` · ${m.objective.direction === 'higher' ? 'higher' : 'lower'} is better` : ''}</div>${g.metrics.map((x) => this.card(x)).join('')}`).join('');
    const noscene = !this.scene;
    const flat = this.kind === 'video' || this.kind === 'multi'; // a video's picture is not ours to cover: the card sits under it
    return `<div class="bbe-lens${noscene ? ' noscene' : ''}${flat ? ' flat' : ''}"><aside class="bbe-cards" aria-label="Metrics">${cards}</aside>
      <section class="bbe-stage">${noscene ? '' : '<div class="bbe-scene"></div>'}<div class="bbe-explain" aria-live="polite"></div>
        <div class="bbe-strip"><button class="bbe-play" aria-label="Play">${PLAY}</button><div class="bbe-track" data-kind="strip"><canvas></canvas><div class="bbe-cursor"></div></div><span class="bbe-time"></span></div>
      </section></div>`;
  }

  recorder() {
    const m = this.m;
    const v = m.verdict;
    const flags = m.metrics.reduce((n, x) => n + (x.evidence?.flags?.length || 0), 0);
    const big = v ? `<div class="big ${v.ok ? 'ok' : 'bad'}"><b>${v.ok ? '✓' : '✗'} ${esc(v.text)}</b>${v.ok ? ` · ${flags ? `${flags} flags` : 'no flags on the timeline'}` : `: ${esc(v.names.join(', '))}`}</div>` : '<div class="big">Reported metrics</div>';
    const obj = m.objective;
    const sub = `${esc(this.rec.subject?.solution || '')}${this.rec.subject?.task ? ` on <code>${esc(this.rec.subject.task)}</code>` : ''}${obj ? ` · ${esc(obj.label)} ${esc(valueText(obj))}` : ''} · ${fmt(m.t1 - m.t0)} s, ${m.t.length} samples`;
    const lanes = m.groups.map((g) => `<div class="bbe-gh">${esc(g.label)}</div>${g.metrics.map((x) => this.lane(x)).join('')}`).join('');
    return `<div class="bbe-rec${this.scene ? '' : ' noscene'}"><div class="bbe-top"><div class="bbe-summary">${big}<div class="sub">${sub}</div>
        <div class="bbe-explain-inline sub" style="margin-top:6px"></div></div>${this.scene ? '<div class="bbe-scene"></div>' : ''}</div>
      <div class="bbe-tl" role="listbox" aria-label="Metric lanes"><div class="bbe-row axis"><div class="bbe-lh"><button class="bbe-play" aria-label="Play">${PLAY}</button><span class="bbe-time"></span></div>
        <div class="bbe-track" data-kind="axis"><canvas></canvas><div class="bbe-cursor"></div></div><div class="bbe-sc">score</div></div>${lanes}</div></div>`;
  }

  lane(x) {
    const [, tone] = icon(x);
    const open = x.id === this.metricId && detailOf(this.m, x);
    const pf = x.passed === true ? '<span class="pf ok">✓ pass</span>' : x.passed === false ? '<span class="pf bad">✗ fail</span>' : '';
    return `<div class="bbe-row bbe-lane${open ? ' open' : ''}" role="option" data-metric="${esc(x.id)}" aria-selected="${x.id === this.metricId}">
      <button class="bbe-lh" data-metric="${esc(x.id)}"><b>${x.evidence?.detail ? (open ? '▾ ' : '▸ ') : ''}${esc(x.label)}</b><small>${esc(x.id)}</small></button>
      <div class="bbe-track" data-kind="lane" data-metric="${esc(x.id)}"><canvas></canvas><div class="bbe-cursor"></div></div>
      <div class="bbe-sc">${pf}<span class="v ${tone === 'bad' ? 'bad' : ''}">${esc(valueText(x))}</span>${x.gate ? `<span class="g">${esc(gateText(x))}</span>` : ''}</div></div>`;
  }

  explain() {
    const x = this.m.byId[this.metricId];
    const el = this.querySelector('.bbe-explain');
    const inline = this.querySelector('.bbe-explain-inline');
    if (!x) { if (el) el.innerHTML = ''; return; }
    const S = this.m.samples(x);
    const n = S.counted.length, k = S.counted.reduce((a, b) => a + b, 0);
    const ref = x.evidence?.reference;
    const read = !x.evidence ? 'Score only: this run saved no samples of it.'
      : ref ? `${ref.label} over ${k} of ${n} samples = ${withUnit(ref.value, S.unit)}`
        : `${k === n ? `all ${n}` : `${k} of ${n}`} samples count${x.evidence.flags?.length ? ` · fails in ${x.evidence.flags.length} span${x.evidence.flags.length === 1 ? '' : 's'}` : ''}`;
    const legend = !x.evidence ? '' : `<div class="bbe-legend">${S.values ? `<span><i class="${this.scene && this.kind !== 'video' ? 'ramp' : 'on'}"></i>${esc(this.rec.channels.find((c) => c.id === S.channel)?.label || 'counted')}${S.unit ? ` (${esc(S.unit)})` : ''}</span>` : ''}
      ${k < n ? '<span><i class="rest"></i>not counted</span>' : ''}${x.evidence.flags?.length ? '<span><i class="bad"></i>fails here</span>' : ''}
      ${S.threshold !== null ? `<span><i class="gate"></i>limit ${esc(withUnit(S.threshold, S.unit))}</span>` : ''}${ref ? `<span><i class="ref"></i>${esc(ref.label)}</span>` : ''}</div>`;
    if (el) el.innerHTML = `<h3>${esc(x.label)} <span class="mono" style="font-weight:500">${esc(valueText(x))}</span></h3>${x.rule ? `<p>${esc(x.rule)}</p>` : ''}<div class="read">${esc(read)}</div>${legend}`;
    if (inline) inline.innerHTML = `<b>${esc(x.label)}</b> · ${esc(read)}<span class="bbe-at"></span>${legend}`;
  }

  /* ── interaction ──────────────────────────────────────────────────────────────────────────────────────── */

  /** One set of listeners on the element itself (delegation), so a re-drawn lane or card never doubles a handler. */
  wire() {
    if (this._wired) return;
    this._wired = true;
    this.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || !this.contains(b)) return;
      if (b.dataset.layout) this.setLayout(b.dataset.layout);
      else if (b.dataset.run) this.openRun(b.dataset.run);
      else if (b.dataset.metric) this.select(b.dataset.metric);
      else if (b.classList.contains('bbe-play')) (this.playing ? this.stop() : this.play());
    });
    this.addEventListener('pointerdown', (e) => {
      const track = e.target.closest('.bbe-track');
      if (!track || !this.m || this.m.empty) return;
      if (track.dataset.metric && track.dataset.metric !== this.metricId) this.select(track.dataset.metric);
      // the lanes were re-drawn by select(): follow the gesture on the live track
      const live = (track.isConnected ? track : this.querySelector(`.bbe-track[data-metric="${CSS.escape(track.dataset.metric || '')}"]`)) || track;
      this.stop();
      live.setPointerCapture?.(e.pointerId);
      const at = (ev) => {
        const r = live.getBoundingClientRect();
        this.seek(this.m.t0 + Math.max(0, Math.min(1, (ev.clientX - r.left) / Math.max(1, r.width))) * (this.m.t1 - this.m.t0));
      };
      at(e);
      const up = () => { live.removeEventListener('pointermove', at); live.removeEventListener('pointerup', up); live.removeEventListener('pointercancel', up); };
      live.addEventListener('pointermove', at);
      live.addEventListener('pointerup', up);
      live.addEventListener('pointercancel', up);
    });
  }

  setLayout(layout) {
    if (layout === this.layout) return;
    this.layout = layout;
    this.dispatchEvent(new CustomEvent('bb-evidence-layout', { bubbles: true, composed: true, detail: { layout } }));
    this.draw();
  }

  async openRun(path) {
    if (path === this.path) return;
    this._keepT = this.t;
    this.path = path;
    const rec = await this.load(path);
    this._sceneLoaded = false;
    this.show(rec);
  }

  /** Clicking a card (Lens) or a lane (Recorder): the scene, the strip and the lanes show this metric's evidence. */
  select(id, { quiet = false } = {}) {
    const x = this.m?.byId[id];
    if (!x) return;
    const changed = id !== this.metricId;
    this.metricId = id;
    this.querySelectorAll('.bbe-card').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.metric === id)));
    if (this.layout === 'recorder' && changed) {
      // re-open lanes: the chosen one expands to its per-channel detail
      const tl = this.querySelector('.bbe-tl');
      if (tl) {
        for (const row of tl.querySelectorAll('.bbe-lane')) row.outerHTML = this.lane(this.m.byId[row.dataset.metric]);
      }
    }
    this.querySelectorAll('.bbe-lane').forEach((r) => r.setAttribute('aria-selected', String(r.dataset.metric === id)));
    this.scene?.highlight?.(id, this.m.samples(x));
    this.explain();
    this.redraw();
    if (!quiet && changed) this.dispatchEvent(new CustomEvent('bb-evidence-select', { bubbles: true, composed: true, detail: { metric: id, run: this.path } }));
  }

  play() {
    if (this.playing || !this.m) return;
    if (this.t >= this.m.t1 - 1e-6) this.t = this.m.t0;
    this.playing = true;
    if (this.scene) this.scene.playing = true;
    this.querySelectorAll('.bbe-play').forEach((b) => { b.innerHTML = PAUSE; b.setAttribute('aria-label', 'Pause'); });
    let last = performance.now();
    const tick = (now) => {
      if (!this.playing) return;
      const dt = ((now - last) / 1000) * this.settings.speed;
      last = now;
      const t = this.t + dt;
      if (t >= this.m.t1) { this.seek(this.m.t1); this.stop(); return; }
      this.seek(t);
      this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
  }

  stop() {
    cancelAnimationFrame(this._raf);
    if (!this.playing) return;
    this.playing = false;
    if (this.scene) this.scene.playing = false;
    this.querySelectorAll('.bbe-play').forEach((b) => { b.innerHTML = PLAY; b.setAttribute('aria-label', 'Play'); });
  }

  /** The one shared cursor: scene, strip, lanes and the readout follow it. */
  seek(t) {
    if (!this.m) return;
    this.t = Math.min(Math.max(t, this.m.t0), this.m.t1);
    this.scene?.seek?.(this.t);
    this.cursor();
  }

  cursor() {
    const f = (this.t - this.m.t0) / (this.m.t1 - this.m.t0);
    this.querySelectorAll('.bbe-track').forEach((tr) => { const c = tr.querySelector('.bbe-cursor'); if (c) c.style.left = `${(f * 100).toFixed(3)}%`; });
    const x = this.m.byId[this.metricId];
    const r = x ? readingAt(this.m, x, this.t) : null;
    const text = `${this.t.toFixed(2)} s${r && r.value !== null && r.value !== undefined ? ` · ${withUnit(r.value, r.unit)}${r.flagged ? ' · fails' : ''}` : ''}`;
    this.querySelectorAll('.bbe-time').forEach((el) => { el.textContent = el.closest('.axis') ? `${this.t.toFixed(2)} s` : text; });
    const at = this.querySelector('.bbe-at');
    if (at) at.textContent = r && r.value !== null && r.value !== undefined ? ` · at ${this.t.toFixed(2)} s: ${withUnit(r.value, r.unit)}${r.flagged ? ', fails here' : r.counted ? '' : ', not counted'}` : '';
  }

  /* ── canvases ─────────────────────────────────────────────────────────────────────────────────────────── */

  colors() {
    const c = (n) => cssVar(this, n);
    return { fg: c('--bb-fg'), muted: c('--bb-muted'), faint: c('--bb-faint'), grid: c('--bb-grid'), accent: c('--bb-accent'), bad: c('--bb-bad'),
      good: c('--bb-good'), rest: c('--bb-adm'), bg: c('--bb-bg'), subtle: c('--bb-subtle'), font: c('--bb-font'), mono: c('--bb-mono') };
  }

  redraw() {
    if (!this.m || this.m.empty) return;
    const C = this.colors();
    for (const tr of this.querySelectorAll('.bbe-track')) {
      const canvas = tr.querySelector('canvas');
      const w = tr.clientWidth, h = tr.clientHeight;
      if (!w || !h) continue;
      const dpr = Math.min(2, devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const kind = tr.dataset.kind;
      if (kind === 'axis') this.drawAxis(ctx, w, h, C);
      else {
        const x = this.m.byId[kind === 'strip' ? this.metricId : tr.dataset.metric];
        if (x) this.drawLane(ctx, w, h, x, C, { strip: kind === 'strip', open: kind === 'lane' && x.id === this.metricId });
      }
    }
    this.cursor();
  }

  X(t, w) { return ((t - this.m.t0) / (this.m.t1 - this.m.t0)) * w; }

  drawWindows(ctx, w, h, C, label) {
    for (const win of this.m.windows) {
      const a = this.X(win.t0, w), b = this.X(win.t1, w);
      ctx.fillStyle = C.grid; ctx.fillRect(a, 0, b - a, h);
      if (label) { ctx.fillStyle = C.muted; ctx.font = `10.5px ${C.mono}`; ctx.fillText(win.label || '', a + 3, 11); }
    }
  }

  drawAxis(ctx, w, h, C) {
    this.drawWindows(ctx, w, h, C, false);
    const span = this.m.t1 - this.m.t0;
    const step = [0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10, 20, 30, 60, 120, 300].find((s) => (span / s) * 70 <= w) || 600;
    ctx.fillStyle = C.muted; ctx.strokeStyle = C.faint; ctx.font = `10.5px ${C.mono}`; ctx.lineWidth = 1;
    for (let s = Math.ceil(this.m.t0 / step) * step; s <= this.m.t1 + 1e-9; s += step) {
      const x = this.X(s, w);
      ctx.beginPath(); ctx.moveTo(x + 0.5, h - 7); ctx.lineTo(x + 0.5, h); ctx.stroke();
      ctx.fillText(`${+s.toFixed(2)} s`, Math.min(x + 3, w - 34), h - 10);
    }
    for (const win of this.m.windows) { ctx.fillStyle = C.muted; ctx.fillText(win.label || '', this.X(win.t0, w) + 3, 10); }
    for (const e of this.m.events) if (e.kind === 'fail') { ctx.fillStyle = C.bad; ctx.fillRect(this.X(e.t, w) - 1, 0, 3, 6); }
  }

  drawLane(ctx, w, h, x, C, { strip = false, open = false } = {}) {
    const top = strip ? 14 : 4;
    const detail = open ? detailOf(this.m, x) : null;
    const barsH = detail ? 46 : h - top - 3;
    const base = top + barsH;
    if (strip) this.drawWindows(ctx, w, h, C, true);
    if (!x.evidence) {
      ctx.strokeStyle = C.faint; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(0, base - 0.5); ctx.lineTo(w, base - 0.5); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = C.muted; ctx.font = `11.5px ${C.font}`;
      ctx.fillText('score only: this run saved no samples of it', 8, top + barsH / 2 + 4);
      return;
    }
    const L = laneSeries(this.m, x);
    const S = L.S;
    // counted windows and failures behind the bars
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = C.accent;
    for (const [a, b] of S.windows || []) ctx.fillRect(this.X(a, w), top, this.X(b, w) - this.X(a, w), barsH);
    ctx.globalAlpha = 0.13;
    ctx.fillStyle = C.bad;
    for (const [a, b] of S.flags) { const xa = this.X(a, w); ctx.fillRect(xa, top, Math.max(2, this.X(b, w) - xa), barsH); }
    ctx.globalAlpha = 1;
    for (const [a, b] of S.flags) { const xa = this.X(a, w); ctx.fillRect(xa, top, Math.max(2, this.X(b, w) - xa), 3); }
    const y = (v) => base - ((v - L.lo) / (L.hi - L.lo)) * barsH;
    if (L.values) {
      const n = S.t.length;
      const y0 = y(Math.max(L.lo, 0));
      for (let i = 0; i < n; i++) {
        const v = L.values[i];
        if (v === null || v === undefined) continue;
        const a = this.X(S.t[i], w), b = this.X(i + 1 < n ? S.t[i + 1] : this.m.t1, w);
        ctx.fillStyle = S.flagged[i] ? C.bad : S.counted[i] ? C.accent : C.rest;
        ctx.globalAlpha = S.flagged[i] ? 0.9 : S.counted[i] ? (strip || x.id === this.metricId ? 0.85 : 0.55) : 0.4;
        const yy = y(v);
        ctx.fillRect(a, Math.min(yy, y0), Math.max(1, b - a + 0.4), Math.max(1, Math.abs(y0 - yy)));
      }
      ctx.globalAlpha = 1;
      const hline = (v, color, text) => {
        const yy = Math.round(y(v)) + 0.5;
        ctx.strokeStyle = color; ctx.lineWidth = 1.2; ctx.setLineDash([4, 3]);
        ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(w, yy); ctx.stroke(); ctx.setLineDash([]);
        ctx.font = `10.5px ${C.mono}`;
        const tw = ctx.measureText(text).width, ty = Math.max(top + 9, yy - 3);
        ctx.globalAlpha = 0.85; ctx.fillStyle = C.bg; ctx.fillRect(w - tw - 7, ty - 9, tw + 6, 12); ctx.globalAlpha = 1;
        ctx.fillStyle = color;
        ctx.fillText(text, w - tw - 4, ty);
      };
      if (S.threshold !== null) hline(S.threshold, x.passed === false ? C.bad : C.muted, `limit ${withUnit(S.threshold, S.unit)}`);
      const ref = x.evidence.reference;
      if (ref && Number.isFinite(ref.value)) hline(ref.value, C.fg, `${ref.label} ${withUnit(ref.value, S.unit)}`);
      const pk = S.peak;
      if (pk && pk.i !== undefined && L.values[pk.i] !== null && L.values[pk.i] !== undefined) {
        ctx.fillStyle = x.passed === false ? C.bad : C.fg;
        ctx.beginPath(); ctx.arc(this.X(pk.t, w), y(L.values[pk.i]), 3, 0, Math.PI * 2); ctx.fill();
      }
      if (strip || open) { ctx.fillStyle = C.muted; ctx.font = `10.5px ${C.mono}`; ctx.fillText(`${fmt(L.lo)} – ${fmt(L.hi)} ${S.unit || ''}`, 4, top + 9); }
    } else {
      ctx.fillStyle = C.muted; ctx.font = `11.5px ${C.font}`;
      ctx.fillText(S.flags.length ? '' : 'no failures on the timeline', 8, top + barsH / 2 + 4);
    }
    if (detail) this.drawDetail(ctx, w, h, base + 6, detail, C);
  }

  /** The opened lane's per-channel detail: one line per column, the pair (target) dashed under it. */
  drawDetail(ctx, w, h, top, d, C) {
    const bottom = h - 14;
    let lo = Infinity, hi = -Infinity;
    for (const ch of [d.ch, d.pair].filter(Boolean)) for (const row of ch.values) for (const v of row) if (v !== null) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    if (!(hi > lo)) { hi = lo + 1; }
    const y = (v) => bottom - ((v - lo) / (hi - lo)) * (bottom - top);
    const draw = (ch, dashed, alpha) => ch.columns.forEach((_, j) => {
      ctx.strokeStyle = PALETTE[j % PALETTE.length]; ctx.globalAlpha = alpha; ctx.lineWidth = dashed ? 1 : 1.4; ctx.setLineDash(dashed ? [3, 3] : []);
      ctx.beginPath();
      ch.values.forEach((row, i) => { const v = row[j]; if (v === null) return; const px = this.X(d.t[i], w), py = y(v); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
      ctx.stroke();
    });
    if (d.pair) draw(d.pair, true, 0.6);
    draw(d.ch, false, 1);
    ctx.globalAlpha = 1; ctx.setLineDash([]);
    ctx.font = `10px ${C.font}`;
    let px = 4;
    d.ch.columns.forEach((name, j) => { ctx.fillStyle = PALETTE[j % PALETTE.length]; ctx.fillText(name, px, h - 3); px += ctx.measureText(name).width + 10; });
    ctx.fillStyle = C.muted;
    const range = `${d.ch.label}${d.pair ? ` (dashed: ${d.pair.label.toLowerCase()})` : ''} · ${fmt(lo)} – ${fmt(hi)} ${d.ch.unit || ''}`;
    ctx.fillText(range, Math.max(px + 6, w - ctx.measureText(range).width - 4), h - 3);
  }

  /* ── for headless checks ─────────────────────────────────────────────────────────────────────────────── */

  /** Where a time sits on a track, in client pixels. */
  locate(t, kind = null) {
    const tr = this.querySelector(kind ? `.bbe-track[data-kind="${kind}"]` : '.bbe-track');
    if (!tr) return null;
    const r = tr.getBoundingClientRect();
    return { x: r.left + this.X(t, r.width), y: r.top + r.height / 2 };
  }

  frame(t) { return this.m ? frameIndex(this.m.t, t) : -1; }
}
register(BBEvidence);
