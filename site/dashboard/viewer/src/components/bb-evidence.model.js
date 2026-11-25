// bb-evidence's model: a bb-run/1 record read once into what both layouts draw (pure: no DOM; tests import it).
import { evidenceSamples, frameIndex, channelOf, timesOf } from '../scenes/scene.js';

export const GROUPS = [
  { kind: 'objective', label: 'Objective' },
  { kind: 'gate', label: 'Gates · every task must pass every gate' },
  { kind: 'diagnostic', label: 'Diagnostics · reported, not scored' },
];
const OP = { '<=': '≤', '<': '<', '>=': '≥', '>': '>', '==': '=', is: 'is' };

/** A number as the viewer shows it: 3 significant digits, integers whole, never scientific. */
export function fmt(v, digits = 3) {
  if (v === null || v === undefined || (typeof v === 'number' && !Number.isFinite(v))) return '—';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (typeof v !== 'number') return String(v);
  if (Number.isInteger(v)) return v.toLocaleString('en-CA');
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a >= 1000) return v.toLocaleString('en-CA', { maximumFractionDigits: 0 });
  const d = Math.max(0, digits - 1 - Math.floor(Math.log10(a)));
  return v.toFixed(Math.min(d, 6));
}

export const withUnit = (v, unit) => (v === null || v === undefined ? '—' : `${fmt(v)}${unit ? `${unit === '%' || unit === '°' ? '' : ' '}${unit}` : ''}`);
export const valueText = (m) => (m.display ? m.display : typeof m.value === 'boolean' ? (m.value ? 'yes' : 'no') : withUnit(m.value, m.unit));
export const gateText = (m) => (m.gate ? `${OP[m.gate.op] || m.gate.op} ${typeof m.gate.threshold === 'boolean' ? (m.gate.threshold ? 'true' : 'false') : withUnit(m.gate.threshold, m.unit)}` : '');

/** The record, read once: time span, groups of metrics, the verdict. Empty when it has no samples and no metrics. */
export function makeModel(rec) {
  const t = rec?.time?.t || [];
  const metrics = rec?.metrics || [];
  const empty = !t.length && !metrics.length;
  const gates = metrics.filter((m) => m.kind === 'gate');
  const failed = gates.filter((m) => m.passed === false);
  const t0 = t.length ? t[0] : 0;
  let t1 = t.length ? t[t.length - 1] : 1;
  for (const c of rec?.channels || []) if (c.t && c.t.length) t1 = Math.max(t1, c.t[c.t.length - 1]);
  if (t.length > 1) t1 += t[t.length - 1] - t[t.length - 2]; // the last sample owns its slot
  const groups = GROUPS.map((g) => ({ ...g, metrics: metrics.filter((m) => m.kind === g.kind) })).filter((g) => g.metrics.length);
  const objective = metrics.find((m) => m.kind === 'objective') || metrics[0] || null;
  return {
    rec, empty, t, t0, t1: t1 > t0 ? t1 : t0 + 1, metrics, groups, objective, gates, failed,
    byId: Object.fromEntries(metrics.map((m) => [m.id, m])),
    verdict: !gates.length ? null : failed.length ? { ok: false, text: `Fails ${failed.length} of ${gates.length} gates`, names: failed.map((m) => m.label) }
      : { ok: true, text: `All ${gates.length} gates pass`, names: [] },
    windows: rec?.time?.windows || [],
    events: rec?.events || [],
    samples: (m) => evidenceSamples(rec, m),
  };
}

/** The 1-D series a lane draws for a metric: values, which count, where it failed, its scale. */
export function laneSeries(model, m) {
  const S = evidenceSamples(model.rec, m);
  if (!S.values) return { S, values: null, lo: 0, hi: 1 };
  let lo = 0, hi = 0;
  for (let i = 0; i < S.values.length; i++) {
    const v = S.values[i];
    if (v === null || v === undefined) continue;
    lo = Math.min(lo, v); hi = Math.max(hi, v);
  }
  if (S.threshold !== null && Number.isFinite(S.threshold)) { hi = Math.max(hi, S.threshold); lo = Math.min(lo, S.threshold); }
  const ref = m.evidence?.reference?.value;
  if (Number.isFinite(ref)) hi = Math.max(hi, ref);
  if (hi === lo) hi = lo + 1;
  return { S, values: S.values, lo, hi: hi + (hi - lo) * 0.08 };
}

/** The detail channel (per joint, per axis) under an opened lane, with its pair (target vs measured) when it has one. */
export function detailOf(model, m) {
  const id = m?.evidence?.detail;
  const ch = id ? channelOf(model.rec, id) : null;
  if (!ch || !ch.columns) return null;
  const pair = ch.pair ? channelOf(model.rec, ch.pair) : null;
  return { ch, pair: pair && pair.columns?.length === ch.columns.length ? pair : null, t: timesOf(model.rec, ch) };
}

/** A metric's reading at the cursor: its channel's value at t. */
export function readingAt(model, m, t) {
  const S = evidenceSamples(model.rec, m);
  if (!S.values || !S.t.length) return null;
  const i = frameIndex(S.t, t);
  return { i, value: S.values[i], counted: !!S.counted[i], flagged: !!S.flagged[i], unit: S.unit };
}

/** The scene kind to draw: a setting, else the record's own, never one the record has no data for. */
export function sceneKind(rec, setting) {
  const s = rec?.scene || {};
  const has = { '3d': !!s.geometry, video: !!s.video, multi: (s.screens || []).length > 1 || (!!s.geometry && !!s.video) };
  const want = setting && setting !== 'auto' ? setting : s.kind || 'none';
  if (want === 'none') return 'none';
  if (has[want]) return want;
  return has['3d'] ? '3d' : has.video ? 'video' : 'none';
}
