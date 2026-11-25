/* The scene slot of bb-evidence (viewer/CONTRACT.md §14): one tiny interface any scene implements, so the picture beside
   the metrics can be a 3-D replay today and a video stream, several screens, or a box's own view tomorrow (Zach,
   2026-11-24: "Right now that's a 3D hero image, but possibly it could be a video stream or something else in the
   future, or even multiple screens! So this should be turned into a standard component that can be instrumented").

     scene.load(record, ctx)          the bb-run/1 record; ctx = {screen, mediaBase}; may return a promise
     scene.seek(t)                    the shared time cursor (record seconds); the host calls it every frame it moves
     scene.highlight(metricId, samples)   show where one metric's number came from (null, null clears it); `samples`
                                      is evidenceSamples() below: per-sample values, which count, where it failed, the peak
     scene.playing = true|false       the host's clock is running (a video plays natively, a 3-D replay ignores it)
     scene.resize?()  scene.dispose?()

   The host (bb-evidence) owns the clock, play/scrub, the metric cards and lanes; a scene owns only its picture. A
   scene reads nothing but the record it is handed, and loads nothing itself except media the record names, through
   mediaUrl() (a relative path beside the record, never `..`, never under solutions/). WHY no kinematics here or in
   any scene: the geometry is the box's, precomputed per frame in its own language; the browser only plays it back. */

/** The last frame at or before t (binary search over increasing times). */
export function frameIndex(times, t) {
  const n = times.length;
  if (!n) return -1;
  if (t <= times[0]) return 0;
  if (t >= times[n - 1]) return n - 1;
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (times[mid] <= t) lo = mid; else hi = mid;
  }
  return lo;
}

export const channelOf = (record, id) => (record?.channels || []).find((c) => c.id === id) || null;
export const timesOf = (record, channel) => (channel && channel.t) || record?.time?.t || [];

const MEDIA = /^(?![a-z][a-z0-9+.-]*:)(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))(?!.*(?:^|\/)solutions\/)[^?#]+\.(webm|mp4|ogv|mov|png|jpg|jpeg|webp)$/i;
/** A media file the record names (a video beside it): relative to the record, or refused. */
export function mediaUrl(src, base) {
  if (!MEDIA.test(String(src))) throw new Error(`refused media ${src}: a relative video or image beside the record (no .., never a solution's own folder)`);
  return new URL(src, base || (typeof document !== 'undefined' ? document.baseURI : 'http://localhost/')).href;
}
export const isMedia = (src) => MEDIA.test(String(src));

/** Which samples of a metric's evidence channel count, where it failed, and its peak: what a scene highlights. */
export function evidenceSamples(record, metric) {
  const ev = metric?.evidence;
  const ch = ev && ev.channel ? channelOf(record, ev.channel) : null;
  const t = timesOf(record, ch);
  const n = t.length;
  const counted = new Uint8Array(n);
  const c = ev?.counted || { all: true };
  if (c.mask) for (let i = 0; i < n; i++) counted[i] = c.mask[i] ? 1 : 0;
  else if (c.windows) for (let i = 0; i < n; i++) counted[i] = c.windows.some(([a, b]) => t[i] >= a - 1e-9 && t[i] < b - 1e-9) ? 1 : 0;
  else counted.fill(1);
  const flagged = new Uint8Array(n);
  for (const [a, b] of ev?.flags || []) for (let i = 0; i < n; i++) if (t[i] >= a - 1e-9 && t[i] < b - 1e-9) flagged[i] = 1;
  const values = ch && !ch.columns ? ch.values : null;
  let peak = ev?.peak || null;
  if (peak && peak.i === undefined && n) peak = { ...peak, i: frameIndex(t, peak.t) };
  return {
    metric: metric?.id || null, label: metric?.label || '', unit: ch?.unit ?? metric?.unit ?? '', channel: ch?.id || null,
    t, values, counted, flagged, flags: ev?.flags || [], threshold: ev?.threshold ?? null, peak, points: ev?.points || null,
    whiskers: ev?.whiskers || null, passed: metric?.passed ?? null, windows: c.windows || null,
  };
}
