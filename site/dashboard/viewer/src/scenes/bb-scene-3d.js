/* <bb-scene-3d>: the 3-D scene of bb-evidence (viewer/CONTRACT.md §14), the scene-slot interface of ./scene.js.

   Plays back PRECOMPUTED per-frame geometry from a bb-run/1 record's scene.geometry, never kinematics (Zach's playback
   rule): a layer is either `poses` (one [x, y, z, qw, qx, qy, qz] per shape per frame, e.g. MuJoCo geom poses the box's
   export computed natively) or a `chain` (points per frame, drawn as a stick-and-capsule figure between them). The
   measured layer is solid, the target a wider ghost; paths are xyz channels. highlight() colours the path by the
   metric's per-sample values (grey = not counted, red = where it failed), draws magnified whiskers between two paired
   xyz channels, pins the peak, and tints the measured layer red while the cursor sits in a failure.

   Ported from trajectory_tracking_agent site/assets/viewer3d.js (the geom-per-object drawing, the ghost 1.35x wider,
   paths drawn over the arm, the working-side three-quarter fit) and proposals/_shared/arm3d.js (the chain figure,
   the magnified error whiskers, HTML labels pinned to 3-D points). STOCK PART: three.js 0.186.1 (vendor/three). */
import * as THREE from './vendor/three/three.bundle.js';
import { frameIndex, channelOf, timesOf } from './scene.js';
import { adoptCss, onTheme, cssVar } from '../core/tokens.js';

const CSS = `
bb-scene-3d { display: block; position: relative; width: 100%; height: 100%; min-height: 0; overflow: hidden; }
bb-scene-3d canvas { display: block; width: 100%; height: 100%; touch-action: none; }
bb-scene-3d .bbs-labels { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
bb-scene-3d .bbs-lbl { position: absolute; left: 0; top: 0; white-space: nowrap; font: 600 11.5px var(--bb-mono); padding: 1px 6px;
  border-radius: 6px; border: 1px solid var(--bb-border); background: color-mix(in srgb, var(--bb-bg) 88%, transparent); color: var(--bb-fg); }
bb-scene-3d .bbs-lbl.bad { color: var(--bb-bad); border-color: var(--bb-bad); }
bb-scene-3d .bbs-badge { position: absolute; right: 8px; top: 8px; font: 600 11.5px var(--bb-mono); padding: 3px 7px; border-radius: 7px;
  border: 1px solid var(--bb-border); background: var(--bb-bg); color: var(--bb-muted); pointer-events: none; }
bb-scene-3d .bbs-badge:empty { display: none; }
bb-scene-3d .bbs-tag { position: absolute; left: 8px; bottom: 8px; font-size: 11.5px; color: var(--bb-muted); pointer-events: none;
  background: color-mix(in srgb, var(--bb-bg) 80%, transparent); padding: 1px 6px; border-radius: 6px; }
bb-scene-3d .bbs-tag:empty { display: none; }
bb-scene-3d .bbs-none { display: grid; place-items: center; height: 100%; color: var(--bb-muted); font-size: 13px; padding: 16px; text-align: center; }
`;
const GHOST = 1.35; // WHY wider: the target differs by millimetres, so a same-size ghost hides inside the solid arm
const UNIT = new THREE.Vector3(1, 1, 1);
const UP = new THREE.Vector3(0, 1, 0);
const MAGS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];

export class BBScene3D extends HTMLElement {
  constructor() {
    super();
    this.record = null;
    this.t = 0;
    this.samples = null;
    this.dirty = true;
    this._playing = false;
  }

  get playing() { return this._playing; }
  set playing(v) { this._playing = !!v; } // a replay needs no clock of its own: the host seeks it

  connectedCallback() {
    adoptCss('bb-scene-3d', CSS);
    if (!this.renderer && !this.failed) this.init();
    if (this.renderer && !this._raf) this.loop();
  }

  disconnectedCallback() {
    cancelAnimationFrame(this._raf); this._raf = 0;
  }

  init() {
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    } catch (e) {
      this.failed = true;
      this.innerHTML = '<div class="bbs-none">This browser has no WebGL, so the 3-D replay cannot draw. The metrics and the timeline still work.</div>';
      return;
    }
    const r = this.renderer;
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.replaceChildren(r.domElement);
    this.labels = Object.assign(document.createElement('div'), { className: 'bbs-labels' });
    this.badge = Object.assign(document.createElement('div'), { className: 'bbs-badge' });
    this.tag = Object.assign(document.createElement('div'), { className: 'bbs-tag' });
    this.append(this.labels, this.badge, this.tag);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.01, 60);
    this.controls = new THREE.OrbitControls(this.camera, r.domElement);
    this.controls.enableDamping = false;
    this.controls.addEventListener('change', () => { this.dirty = true; });
    this.controls.addEventListener('start', () => { this._userMoved = true; });
    this.world = new THREE.Group(); // the record's own frame inside (z-up by default)
    this.scene.add(this.world);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f96, 1.9));
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(2, 4, 3);
    this.scene.add(sun);
    this.floor = new THREE.Group();
    this.world.add(this.floor);
    this.hl = new THREE.Group();
    this.hl.renderOrder = 7;
    this.world.add(this.hl);
    this.layers = [];
    this.paths = new THREE.Group();
    this.world.add(this.paths);
    this.marker = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ depthTest: false, transparent: true }));
    this.marker.renderOrder = 9;
    this.marker.visible = false;
    this.world.add(this.marker);
    this.pins = [];
    this._ro = new ResizeObserver(() => this.resize());
    this._ro.observe(this);
    this._stopTheme = onTheme(() => this.theme());
    this.resize();
  }

  loop() {
    this._raf = requestAnimationFrame(() => this.loop());
    if (this.dirty && this.renderer) this.render();
  }

  render() {
    this.dirty = false;
    this.renderer.render(this.scene, this.camera);
    this.placeLabels();
  }

  resize() {
    if (!this.renderer) return;
    const w = this.clientWidth, h = this.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.applyInset();
    if (this._fitPending || !this._userMoved) this.fit();
    this.dirty = true;
  }

  /** Keep the left `inset` fraction of the width clear for a card the host lays over the scene (arm3d.js's shift). */
  get inset() { return this._inset || 0; }
  set inset(f) { this._inset = Math.max(0, Math.min(0.45, +f || 0)); if (this.renderer) { this.applyInset(); this.fit(); } }

  applyInset() {
    const w = this.clientWidth, h = this.clientHeight;
    if (this._inset && w && h) this.camera.setViewOffset(w, h, -w * this._inset, 0, w, h);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    this._ro?.disconnect();
    this._stopTheme?.();
    cancelAnimationFrame(this._raf); this._raf = 0;
    if (this.renderer) { this.renderer.dispose(); this.renderer.forceContextLoss?.(); this.renderer = null; }
  }

  color(name, fallback = '#888') {
    const v = cssVar(this, name);
    return new THREE.Color(v || fallback);
  }

  armColor() { return this.color('--bb-fg').lerp(this.color('--bb-bg'), 0.38); }

  theme() {
    if (!this.renderer || !this.record) return;
    this.buildFloor();
    for (const L of this.layers) for (const m of L.meshes) { m.material.color.copy(L.ghost ? this.color('--bb-holdout') : this.armColor()); m.userData.base = m.material.color.clone(); }
    this.buildPaths();
    if (this.samples) this.drawHighlight();
    this.dirty = true;
  }

  /* ── load ─────────────────────────────────────────────────────────────────────────────────────────────── */

  load(record, ctx = {}) {
    this.record = record;
    this.screen = ctx.screen || {};
    if (!this.renderer) return;
    const g = record?.scene?.geometry;
    for (const L of this.layers) for (const m of L.meshes) { this.world.remove(m); m.geometry.dispose(); m.material.dispose(); }
    this.layers = [];
    if (!g) { this.tag.textContent = 'This run has no 3-D geometry.'; this.dirty = true; return; }
    // the record's up axis -> three's y-up world
    this.world.rotation.set(g.up === 'y' ? 0 : -Math.PI / 2, 0, g.up === 'x' ? Math.PI / 2 : 0);
    for (const spec of g.layers || []) this.layers.push(this.makeLayer(spec, g));
    this.buildFloor();
    this.buildPaths();
    this.tag.textContent = this.screen.label || '';
    this._fitPending = true;
    this.fit();
    this.seek(this.t || record.time?.t?.[0] || 0);
  }

  makeLayer(spec, g) {
    const ghost = spec.style === 'ghost';
    const mat = () => (ghost
      ? new THREE.MeshStandardMaterial({ color: this.color('--bb-holdout'), transparent: true, opacity: 0.2, depthWrite: false, roughness: 0.9 })
      : new THREE.MeshStandardMaterial({ color: this.armColor(), roughness: 0.55, metalness: 0.05 }));
    const L = { spec, ghost, meshes: [], times: spec.t || this.record.time.t };
    if (spec.poses) {
      for (const s of g.shapes || []) {
        const k = ghost ? GHOST : 1;
        const geo = s.type === 'capsule' ? new THREE.CapsuleGeometry(k * s.size[0], 2 * s.size[1], 8, 20).rotateX(Math.PI / 2)
          : s.type === 'cylinder' ? new THREE.CylinderGeometry(k * s.size[0], k * s.size[0], 2 * s.size[1], 24).rotateX(Math.PI / 2)
            : s.type === 'sphere' ? new THREE.SphereGeometry(k * s.size[0], 20, 14)
              : new THREE.BoxGeometry(2 * s.size[0], 2 * s.size[1], 2 * (s.size[2] ?? s.size[1]));
        const m = new THREE.Mesh(geo, mat());
        m.matrixAutoUpdate = false;
        m.renderOrder = ghost ? 2 : 1;
        m.userData.base = m.material.color.clone();
        this.world.add(m);
        L.meshes.push(m);
      }
    } else if (spec.chain) {
      const radii = spec.chain.radii || [];
      const nseg = (spec.chain.points[0] || []).length - 1;
      const cyl = new THREE.CylinderGeometry(1, 1, 1, 18, 1);
      const sph = new THREE.SphereGeometry(1, 18, 12);
      L.radii = Array.from({ length: nseg }, (_, i) => (radii[i] ?? radii.at(-1) ?? 0.03) * (ghost ? GHOST : 1));
      L.segs = L.radii.map(() => new THREE.Mesh(cyl, mat()));
      L.joints = L.radii.map(() => new THREE.Mesh(sph, mat()));
      for (const m of [...L.segs, ...L.joints]) { m.renderOrder = ghost ? 2 : 1; m.userData.base = m.material.color.clone(); this.world.add(m); L.meshes.push(m); }
    }
    return L;
  }

  pose(L, t) {
    const k = frameIndex(L.times, t);
    if (k < 0) return;
    if (L.spec.poses) {
      const frame = L.spec.poses[k];
      if (!frame) return;
      L.meshes.forEach((m, i) => {
        const p = frame[i];
        if (!p || p[0] === null) return;
        m.matrix.compose(new THREE.Vector3(p[0], p[1], p[2]), new THREE.Quaternion(p[4], p[5], p[6], p[3]).normalize(), UNIT);
      });
    } else {
      const pts = L.spec.chain.points[k];
      if (!pts) return;
      for (let i = 0; i < L.segs.length; i++) {
        const a = new THREE.Vector3(...pts[i]), b = new THREE.Vector3(...pts[i + 1]);
        const d = b.clone().sub(a);
        const len = Math.max(1e-6, d.length());
        const s = L.segs[i];
        s.position.copy(a).add(b).multiplyScalar(0.5);
        s.scale.set(L.radii[i], len, L.radii[i]);
        s.quaternion.setFromUnitVectors(UP, d.normalize());
        L.joints[i].position.copy(b);
        L.joints[i].scale.setScalar(L.radii[Math.min(i + 1, L.radii.length - 1)] * 1.12);
      }
    }
  }

  buildFloor() {
    for (const c of [...this.floor.children]) { this.floor.remove(c); c.geometry?.dispose(); c.material?.dispose(); }
    const g = this.record?.scene?.geometry;
    if (!g || g.floor === null) return;
    const grid = new THREE.GridHelper(2.4, 24, this.color('--bb-border'), this.color('--bb-rule'));
    grid.rotation.x = Math.PI / 2;
    grid.position.z = (g.floor?.z ?? 0) - 0.001;
    grid.material.transparent = true;
    grid.material.opacity = 0.8;
    this.floor.add(grid);
  }

  points(id) {
    const ch = channelOf(this.record, id);
    return ch && ch.columns && ch.columns.length === 3 ? { ch, t: timesOf(this.record, ch), xyz: ch.values } : null;
  }

  line(points, color, { dashed = false, opacity = 1 } = {}) {
    const geo = new THREE.BufferGeometry().setFromPoints(points.filter((p) => p && p[0] !== null).map((p) => new THREE.Vector3(p[0], p[1], p[2])));
    const mat = dashed ? new THREE.LineDashedMaterial({ color, dashSize: 0.012, gapSize: 0.008, transparent: true, opacity })
      : new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity });
    mat.depthTest = false; // WHY: a path is what the view is for; drawn over the arm, never hidden in it
    const l = new THREE.Line(geo, mat);
    l.renderOrder = 5;
    if (dashed) l.computeLineDistances();
    return l;
  }

  buildPaths() {
    for (const c of [...this.paths.children]) { this.paths.remove(c); c.geometry?.dispose(); c.material?.dispose(); }
    for (const p of this.record?.scene?.geometry?.paths || []) {
      const P = this.points(p.channel);
      if (!P) continue;
      const role = P.ch.role;
      const color = role === 'target' || p.style === 'dashed' ? this.color('--bb-muted') : this.color('--bb-accent');
      this.paths.add(this.line(P.xyz, color, { dashed: p.style === 'dashed', opacity: this.samples ? 0.45 : 0.9 }));
    }
  }

  /** Every point the run visits (sampled): the base origin, each layer's positions, the paths. */
  extent() {
    const box = new THREE.Box3();
    box.expandByPoint(new THREE.Vector3(0, 0, 0));
    for (const L of this.layers) {
      const frames = L.spec.poses || L.spec.chain.points;
      const step = Math.max(1, Math.floor(frames.length / 40));
      for (let k = 0; k < frames.length; k += step) for (const p of frames[k] || []) if (p && p[0] !== null) box.expandByPoint(new THREE.Vector3(p[0], p[1], p[2]));
    }
    for (const p of this.record?.scene?.geometry?.paths || []) {
      const P = this.points(p.channel);
      if (P) for (const q of P.xyz) if (q && q[0] !== null) box.expandByPoint(new THREE.Vector3(q[0], q[1], q[2]));
    }
    // a pose is a shape's centre and a chain point a joint: pad by the largest shape so its ends stay in view
    const g = this.record?.scene?.geometry || {};
    const pad = 0.5 * Math.max(0, ...(g.shapes || []).map((s) => (s.size[1] || 0) + (s.size[0] || 0)),
      ...(g.layers || []).flatMap((L) => (L.chain?.radii || []).map((r) => r * GHOST)));
    return box.expandByScalar(pad);
  }

  /** Look at the work from the screen's view: iso (the working side, 50° around, a little above), top, front, side. */
  fit() {
    if (!this.clientWidth || !this.clientHeight || !this.layers.length) return;
    this._fitPending = false;
    const box = this.extent();
    const local = box.getCenter(new THREE.Vector3());
    const radius = Math.max(0.3, box.getSize(new THREE.Vector3()).length() / 2);
    this.world.updateMatrixWorld(true);
    const center = local.clone().applyMatrix4(this.world.matrixWorld);
    const aspect = this.camera.aspect * (1 - 2 * (this._inset || 0));
    const half = Math.min((this.camera.fov * Math.PI) / 360, Math.atan(Math.tan((this.camera.fov * Math.PI) / 360) * aspect));
    const distance = (radius / Math.sin(half)) * 0.82; // a bounding sphere overstates a box: frame a little tighter
    const side = Math.atan2(local.y, local.x); // the record frame's working side (z-up: x, y on the floor)
    const view = this.screen?.view || 'iso';
    const dirLocal = view === 'top' ? new THREE.Vector3(0.05, -0.3, 1) : view === 'front' ? new THREE.Vector3(0, -1, 0.12)
      : view === 'side' ? new THREE.Vector3(1, 0, 0.12)
        : new THREE.Vector3(Math.cos(side - (50 * Math.PI) / 180), Math.sin(side - (50 * Math.PI) / 180), 0.62);
    const dir = dirLocal.normalize().applyQuaternion(this.world.quaternion);
    this.camera.position.copy(center).addScaledVector(dir, distance);
    this.camera.up.set(0, 1, 0);
    this.controls.target.copy(center);
    this.controls.update();
    this.dirty = true;
  }

  /* ── the cursor ───────────────────────────────────────────────────────────────────────────────────────── */

  seek(t) {
    this.t = t;
    if (!this.renderer || !this.record) return;
    for (const L of this.layers) this.pose(L, t);
    const S = this.samples;
    let tint = null;
    if (S && S.t.length) {
      const i = frameIndex(S.t, t);
      if (S.flagged[i]) tint = this.color('--bb-bad');
      const P = this.hlPoints;
      if (P) {
        const k = frameIndex(P.t, t);
        const p = P.xyz[k];
        if (p && p[0] !== null) {
          this.marker.position.set(p[0], p[1], p[2]);
          this.marker.scale.setScalar(this.mm * 3.2);
          this.marker.material.color.copy(tint || this.color('--bb-accent'));
          this.marker.visible = true;
        }
      }
    } else this.marker.visible = false;
    for (const L of this.layers) if (!L.ghost) for (const m of L.meshes) {
      m.material.color.copy(tint ? m.userData.base.clone().lerp(tint, 0.55) : m.userData.base);
      if (m.material.emissive) m.material.emissive.copy(tint ? tint.clone().multiplyScalar(0.18) : new THREE.Color(0));
    }
    this.dirty = true;
  }

  /* ── the evidence ─────────────────────────────────────────────────────────────────────────────────────── */

  highlight(metricId, samples) {
    this.samples = metricId && samples ? samples : null;
    if (!this.renderer || !this.record) return;
    this.buildPaths();
    this.drawHighlight();
    this.seek(this.t);
  }

  ramp(f) {
    const stops = [0, 1, 2, 3, 4].map((i) => this.color(`--bbe-err-${i}`, ['#f3e9b5', '#e9b45a', '#cf6d3a', '#8e2f5a', '#3b1550'][i]));
    const x = Math.max(0, Math.min(1, f)) * 4;
    const i = Math.min(3, Math.floor(x));
    return stops[i].clone().lerp(stops[i + 1], x - i);
  }

  drawHighlight() {
    for (const c of [...this.hl.children]) { this.hl.remove(c); c.geometry?.dispose(); c.material?.dispose(); }
    this.pins = [];
    // WHY with the pins: placeLabels() walks the label elements by the pins' index, so a clear (highlight(null, null))
    // that kept the old elements threw on the first frame after it (tests/bb-scene-3d.test.mjs)
    if (this.labels) this.labels.innerHTML = '';
    this.badge.textContent = '';
    this.hlPoints = null;
    const S = this.samples;
    const box = this.extent();
    this.mm = Math.max(0.0012, box.getSize(new THREE.Vector3()).length() * 0.0016); // a tube radius that reads at this scale
    if (!S) { this.placeLabels(); this.dirty = true; return; }
    const pathId = S.points || (this.record.scene.geometry.paths || []).find((p) => this.points(p.channel)?.ch.role !== 'target')?.channel;
    const P = pathId ? this.points(pathId) : null;
    this.hlPoints = P;
    if (!P) { this.placeLabels(); this.dirty = true; return; }
    const vals = S.values;
    let vmax = 0;
    if (vals) for (let i = 0; i < vals.length; i++) if (S.counted[i] && vals[i] !== null) vmax = Math.max(vmax, Math.abs(vals[i]));
    const rest = this.color('--bb-adm'), bad = this.color('--bb-bad'), acc = this.color('--bb-accent');
    const colorAt = (k) => {
      const i = S.t.length === P.t.length ? k : frameIndex(S.t, P.t[k]);
      if (S.flagged[i]) return bad;
      if (!S.counted[i]) return rest;
      return vals && vmax > 0 && vals[i] !== null ? this.ramp(Math.abs(vals[i]) / vmax) : acc;
    };
    // the path, coloured by the evidence: a tube (a 1-px line is lost on a metre-sized arm)
    const pts = [], cols = [];
    P.xyz.forEach((p, k) => { if (p && p[0] !== null) { pts.push(new THREE.Vector3(p[0], p[1], p[2])); cols.push(colorAt(k)); } });
    if (pts.length > 1) {
      const n = pts.length - 1, radial = 8;
      const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), n, this.mm, radial, false);
      const col = new Float32Array(geo.attributes.position.count * 3);
      for (let i = 0; i <= n; i++) { const c = cols[Math.min(i, cols.length - 1)]; for (let j = 0; j <= radial; j++) col.set([c.r, c.g, c.b], (i * (radial + 1) + j) * 3); }
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const tube = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, depthTest: false }));
      tube.renderOrder = 6;
      this.hl.add(tube);
    }
    // whiskers: from one xyz channel to its pair at every counted sample, magnified by a round factor, always labelled
    if (S.whiskers) {
      const A = this.points(S.whiskers[0]), B = this.points(S.whiskers[1]);
      if (A && B) {
        let dmax = 0;
        for (let i = 0; i < A.xyz.length; i++) if (S.counted[i] && A.xyz[i] && B.xyz[i]) dmax = Math.max(dmax, Math.hypot(B.xyz[i][0] - A.xyz[i][0], B.xyz[i][1] - A.xyz[i][1], B.xyz[i][2] - A.xyz[i][2]));
        const want = box.getSize(new THREE.Vector3()).length() * 0.06;
        const mag = dmax > 0 ? MAGS.filter((m) => m * dmax <= want).at(-1) || 1 : 1;
        const pos = [], col = [];
        for (let i = 0; i < A.xyz.length; i++) {
          if (!S.counted[i] || !A.xyz[i] || !B.xyz[i]) continue;
          const a = A.xyz[i], b = B.xyz[i];
          pos.push(a[0], a[1], a[2], a[0] + mag * (b[0] - a[0]), a[1] + mag * (b[1] - a[1]), a[2] + mag * (b[2] - a[2]));
          const c = colorAt(i);
          col.push(c.r, c.g, c.b, c.r, c.g, c.b);
        }
        if (pos.length) {
          const geo = new THREE.BufferGeometry();
          geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
          geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col), 3));
          const seg = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false }));
          seg.renderOrder = 7;
          this.hl.add(seg);
          this.badge.textContent = mag > 1 ? `error drawn ×${mag}` : 'true scale';
        }
      }
    }
    // the peak: a ball and its label, where the number came from
    const pk = S.peak;
    if (pk) {
      let p = null;
      if (pk.at && pk.unit_at === 'mm') p = pk.at.map((v) => v / 1000);
      else if (pk.at) p = pk.at;
      else { const k = frameIndex(P.t, pk.t); p = P.xyz[k]; }
      if (p && p[0] !== null) {
        const ball = new THREE.Mesh(new THREE.SphereGeometry(this.mm * 4.2, 18, 12),
          new THREE.MeshBasicMaterial({ color: S.passed === false ? bad : this.color('--bb-fg'), depthTest: false, transparent: true, opacity: 0.9 }));
        ball.position.set(p[0], p[1], p[2]);
        ball.renderOrder = 8;
        this.hl.add(ball);
        const v = pk.value !== null && pk.value !== undefined ? `${+Number(pk.value).toPrecision(3)}${S.unit ? ` ${S.unit}` : ''}` : '';
        this.pins.push({ pos: p, text: `${pk.label || `peak ${v}`} · ${Number(pk.t).toFixed(2)} s`, bad: S.passed === false });
      }
    }
    this.labels.innerHTML = this.pins.map((l) => `<div class="bbs-lbl${l.bad ? ' bad' : ''}"></div>`).join('');
    [...this.labels.children].forEach((el, i) => { el.textContent = this.pins[i].text; });
    this.dirty = true;
  }

  placeLabels() {
    if (!this.labels || !this.renderer) return;
    const w = this.clientWidth, h = this.clientHeight;
    this.world.updateMatrixWorld(true);
    [...this.labels.children].forEach((el, i) => {
      const p = new THREE.Vector3(...this.pins[i].pos).applyMatrix4(this.world.matrixWorld).project(this.camera);
      const vis = p.z < 1 && Math.abs(p.x) < 1.2 && Math.abs(p.y) < 1.2;
      el.style.display = vis ? 'block' : 'none';
      const x = ((p.x + 1) / 2) * w, y = ((1 - p.y) / 2) * h;
      const lw = el.offsetWidth || 160;
      const left = Math.max(4, Math.min(w - lw - 4, x + 10 + lw > w - 4 ? x - lw - 10 : x + 10));
      el.style.transform = `translate(${left}px, ${y}px) translate(0, -50%)`;
    });
  }
}

if (!customElements.get('bb-scene-3d')) customElements.define('bb-scene-3d', BBScene3D);
