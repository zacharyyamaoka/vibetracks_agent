// open_ms (OBJECTIVES §8, specs/S1.6): how long a track takes to show its page after a click, timed IN THE PAGE.
//
//   t0 = the `pointerdown` on the track's sidebar row: performance.timeOrigin + event.timeStamp, in the top page.
//   t1 = the first animation frame in which the box's content marker is visible inside the main pane: a text node
//        holding the marker, its element with a box inside its frame's viewport, not hidden (display, visibility,
//        opacity up the chain), topmost at its centre (elementFromPoint), in a frame that is itself shown and topmost
//        at that point, at every level up to the top page, right of the sidebar. Never the "building" page, a README
//        fallback (its own marker differs) or the previous box's page (its marker differs).
//   open_ms = t1 - t0 for one open; the KPI is the median over a fixed click sequence (groups/speed.mjs).
//
// WHY in the page, every frame: node-side polling adds 10-30 ms of jitter at a 100 ms scale, and the box's page is
// framed on another origin (vibetracks PEP 0024 §5), which the top page cannot read. So TIMER (below) runs in every
// frame before the page's own scripts (context.addInitScript reaches cross-origin frames too); each frame watches its
// own document on its own animation frames and tells its parent with postMessage when it shows a marker, with the
// epoch time of the first frame it did (performance.timeOrigin + the rAF timestamp: one clock across processes). The
// parent keeps, for each child frame, since when it has been shown and topmost; it passes the report up with
// max(child's time, shown since), until the top page, which records t1. Nothing runs while no open is armed.
//
// Also exported: timedOpen (one open: arm, hover, press, release, wait), NetLog (requests and bytes per open, from the
// browser's own network events), buildsBetween (the version's PEP 0028 build records), and the statistics.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export const TIMER = String.raw`(() => {
  // WHY per document, not per window: a frame's first page replaces its initial about:blank in the SAME window when
  // the two share an origin (the HTML spec reuses the Window), so a window-wide guard would leave the real page with the
  // blank page's timer, whose animation frames died with it. A newer install makes an older one inert (live()).
  if (window.__vtaTimer && window.__vtaTimer.doc === document) return
  const T = { armed: null, first: null, kids: new Map(), raf: 0, results: {}, n: { ticks: 0, found: 0, sent: 0, got: 0, dropped: {} } }
  const drop = (why) => { T.n.dropped[why] = (T.n.dropped[why] || 0) + 1 }
  let API = null
  const live = () => window.__vtaTimer === API
  const isTop = window.top === window
  const SKIP = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT', 'TITLE', 'HEAD'])
  const parentOf = (el) => el.parentElement || (el.getRootNode && el.getRootNode() instanceof ShadowRoot ? el.getRootNode().host : null)
  /** The part of el inside this frame's viewport, when el is shown there; else null. */
  function shown(el) {
    if (!el || !el.isConnected) return null
    const r = el.getBoundingClientRect()
    if (r.width <= 0 || r.height <= 0) return null
    const l = Math.max(r.left, 0), t = Math.max(r.top, 0), rr = Math.min(r.right, innerWidth), b = Math.min(r.bottom, innerHeight)
    if (rr <= l || b <= t) return null
    if (el.checkVisibility && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return null
    for (let a = el; a; a = parentOf(a)) { const cs = getComputedStyle(a); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return null }
    return { x: l, y: t, w: rr - l, h: b - t }
  }
  function deepHit(x, y) {
    let el = document.elementFromPoint(x, y)
    while (el && el.shadowRoot) { const inner = el.shadowRoot.elementFromPoint(x, y); if (!inner || inner === el) break; el = inner }
    return el
  }
  const holds = (a, b) => { for (let n = b; n; n = parentOf(n)) if (n === a) return true; return false }
  const centre = (box) => [box.x + box.w / 2, box.y + box.h / 2]
  function topmost(el, box) { const [x, y] = centre(box); const hit = deepHit(x, y); return !!hit && (holds(el, hit) || holds(hit, el)) }
  /** One walk of this document (shadow roots too): the child frames, and the first shown, topmost element whose text
   *  holds one of the markers (and passes keep, the top page's "right of the sidebar"). */
  function scan(markers, keep) {
    const frames = [], roots = [document]
    let found = null
    while (roots.length) {
      const root = roots.pop()
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT)
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (n.nodeType === 1) {
          if (n.shadowRoot) roots.push(n.shadowRoot)
          if (n.tagName === 'IFRAME' || n.tagName === 'FRAME') frames.push(n)
          continue
        }
        if (found || n.data.length < 6) continue
        for (const m of markers) {
          if (!n.data.includes(m)) continue
          const el = n.parentElement || (n.parentNode && n.parentNode.host)
          if (!el || SKIP.has(el.tagName)) continue
          const box = shown(el)
          if (box && topmost(el, box) && (!keep || keep(box))) { found = { marker: m, box }; break }
        }
      }
    }
    return { frames, found }
  }
  function frameOf(source) {
    const roots = [document]
    while (roots.length) {
      const root = roots.pop()
      for (const el of root.querySelectorAll('*')) {
        if (el.shadowRoot) roots.push(el.shadowRoot)
        if ((el.tagName === 'IFRAME' || el.tagName === 'FRAME') && el.contentWindow === source) return el
      }
    }
    return null
  }
  const send = (w, msg) => { try { w.postMessage(msg, '*') } catch (e) { /* gone */ } }
  const tell = (msg) => { for (let i = 0; i < window.frames.length; i++) send(window.frames[i], msg) }
  /** A marker is shown in this frame since time t (epoch ms), at box (this frame's viewport). */
  function candidate(t, box, marker) {
    const a = T.armed
    if (!a) return
    if (!isTop) { T.n.sent++; send(window.parent, { __vta: 'seen', id: a.id, t, box, marker }); return }
    if (a.t0 == null) return drop('before the press')
    if (box.x < a.left - 1) return drop('left of the main pane')
    if (T.results[a.id]) return
    T.results[a.id] = { t0: a.t0, t1: Math.max(t, a.t0), marker, box }
  }
  function tick(ts) {
    T.raf = 0
    const a = T.armed
    if (!a) return
    if (!live()) return drop('tick of a replaced timer')
    T.n.ticks++
    T.lastTick = performance.now()
    tell({ __vta: 'arm', arm: T.told })
    const now = performance.timeOrigin + ts
    const keep = isTop ? (box) => box.x >= a.left - 1 : null
    let frames = [], found = null
    // framesOnly (vta speed, whose marker is the track's title): the top page's own text never counts, only a frame's
    try { ({ frames, found } = scan(isTop && a.framesOnly ? [] : a.markers, keep)) } catch (e) { T.n.error = String(e && e.stack || e).slice(0, 300) }
    const since = new Map()
    for (const f of frames) {
      const box = shown(f)
      const ok = !!box && topmost(f, box)
      const was = T.kids.get(f)
      since.set(f, ok ? (was != null ? was : now) : null)
    }
    T.kids = since
    if (found) T.n.found++
    if (found) { if (T.first == null) T.first = now; candidate(T.first, found.box, found.marker) } else T.first = null
    T.raf = requestAnimationFrame(tick)
  }
  // WHY a parent tells its frames "arm" on every frame of its own, and arm() restarts the loop when it has stalled: a
  // frame's first page can take over its initial about:blank's Window (same origin), and then no init script runs
  // for the new page (the CDP hook fires on a new Window only), so the blank page's timer carries on in it, its
  // animation-frame loop dead with the blank document. Told again, it restarts on the page now in the window.
  function arm(a) {
    if (T.armed && T.armed.id === a.id) {
      if (T.doc !== document || performance.now() - T.lastTick > 200) {
        if (T.raf) cancelAnimationFrame(T.raf)
        T.doc = document
        T.raf = requestAnimationFrame(tick)
        T.n.restarts = (T.n.restarts || 0) + 1
      }
      return
    }
    T.armed = Object.assign({}, a, { t0: null })
    T.told = a
    T.first = null
    T.kids = new Map()
    T.doc = document
    T.lastTick = performance.now()
    tell({ __vta: 'arm', arm: a })
    if (T.raf) cancelAnimationFrame(T.raf)
    T.raf = requestAnimationFrame(tick)
  }
  function disarm(id) {
    if (T.armed && (id == null || T.armed.id === id)) T.armed = null
    if (T.raf) { cancelAnimationFrame(T.raf); T.raf = 0 }
    tell({ __vta: 'disarm', id })
  }
  addEventListener('message', (e) => {
    const d = e.data
    if (!d || typeof d !== 'object' || !d.__vta || !live()) return
    if (d.__vta === 'arm' && !isTop && e.source === window.parent) arm(d.arm)
    else if (d.__vta === 'disarm' && !isTop && e.source === window.parent) disarm(d.id)
    else if (d.__vta === 'hello') { if (T.armed) send(e.source, { __vta: 'arm', arm: T.armed }) }
    else if (d.__vta === 'seen') {
      const a = T.armed
      T.n.got++
      if (!a || d.id !== a.id) return drop('not armed for it')
      const f = frameOf(e.source)
      if (!f) return drop('no such frame')
      if (!shown(f)) return drop('its frame is not shown')
      const r = f.getBoundingClientRect(), cs = getComputedStyle(f)
      const ox = r.left + f.clientLeft + (parseFloat(cs.paddingLeft) || 0), oy = r.top + f.clientTop + (parseFloat(cs.paddingTop) || 0)
      const box = { x: d.box.x + ox, y: d.box.y + oy, w: d.box.w, h: d.box.h }
      const [x, y] = centre(box)
      if (deepHit(x, y) !== f) return drop('its frame is covered there')
      const since = T.kids.get(f)
      candidate(Math.max(d.t, since != null ? since : performance.timeOrigin + performance.now()), box, d.marker)
    }
  })
  if (isTop) {
    addEventListener('pointerdown', (e) => { if (live() && T.armed && T.armed.t0 == null) T.armed.t0 = performance.timeOrigin + e.timeStamp }, true)
  }
  /** Top page only: the sidebar row whose own text is title (scrolled into view; the viewport is not required, so a row
   *  below the fold is found), or null. */
  function revealRow(title, right) {
    const want = title.replace(/\s+/g, ' ').trim()
    const roots = [document]
    while (roots.length) {
      const root = roots.pop()
      for (const el of root.querySelectorAll('*')) {
        if (el.shadowRoot) roots.push(el.shadowRoot)
        if (SKIP.has(el.tagName)) continue
        const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.data).join(' ').replace(/\s+/g, ' ').trim()
        if (own !== want) continue
        const r = el.getBoundingClientRect()
        if (r.width <= 0 || r.height <= 0 || r.left >= right) continue
        let hidden = false
        for (let a = el; a; a = parentOf(a)) { const cs = getComputedStyle(a); if (cs.display === 'none' || cs.visibility === 'hidden') { hidden = true; break } }
        if (hidden) continue
        el.scrollIntoView({ block: 'nearest' })
        return true
      }
    }
    return false
  }
  API = {
    doc: document, arm, disarm, revealRow,
    result: (id) => T.results[id] || null,
    armed: () => (T.armed ? { id: T.armed.id, t0: T.armed.t0 } : null),
    counts: () => JSON.parse(JSON.stringify(T.n)),
  }
  window.__vtaTimer = API
  if (!isTop) send(window.parent, { __vta: 'hello' })
})()`

// ── one open ──────────────────────────────────────────────────────────────────────────────────────────────────────
// WHY these fixed times (a person's click, held the same for every version): the pointer moves onto the row, rests
// DWELL_MS, presses for PRESS_MS (a mouse click lasts about 100 ms), releases. A version that starts loading on hover or
// on press gains what it would gain for Zach; t0 is the press either way.
export const DWELL_MS = 150
export const PRESS_MS = 80
export const OPEN_TIMEOUT_MS = 10000

/**
 * Open one track by a real click on its sidebar row and time it in the page.
 * @returns {{ok, ms, t0, t1, why, marker}} ms null when its marker was not on screen within timeoutMs of the press.
 */
// WHY page errors are thrown, not read as "not found": a renderer killed under memory pressure makes every evaluate
// fail, and an open must not then read as "no row" (the speed group reloads the page and retries the open once)
const gone = (e) => /crash|closed|Target page|has been closed/i.test(String(e && e.message))
async function ask(page, fn, arg) {
  try { return await page.evaluate(fn, arg) } catch (e) { if (gone(e)) throw e; return null }
}

export async function timedOpen(page, { id, title, markers, left, timeoutMs = OPEN_TIMEOUT_MS, framesOnly = false }) {
  const found = await ask(page, ([t, right]) => window.__vtaTimer.revealRow(t, right), [title, left])
  if (!found) return { ok: false, ms: null, t0: null, t1: null, why: `no sidebar row for ${title}` }
  await sleep(60)
  const r = await ask(page, (t) => window.__vta.rowInfo(t), title)
  if (!r) return { ok: false, ms: null, t0: null, t1: null, why: `the row for ${title} is not on screen` }
  await page.evaluate(([i, m, l, f]) => window.__vtaTimer.arm({ id: i, markers: m, left: l, framesOnly: f }), [id, markers, left, framesOnly])
  await page.mouse.move(r.text.x + Math.min(12, r.text.w / 2), r.text.y + r.text.h / 2, { steps: 4 })
  await sleep(DWELL_MS)
  await page.mouse.down()
  await sleep(PRESS_MS)
  await page.mouse.up()
  const pressed = Date.now()
  let res = null
  while (Date.now() - pressed < timeoutMs) {
    res = await ask(page, (i) => window.__vtaTimer.result(i), id)
    if (res) break
    await sleep(40)
  }
  const armed = await ask(page, () => window.__vtaTimer.armed())
  await ask(page, (i) => window.__vtaTimer.disarm(i), id)
  if (!res) {
    const t0 = armed && armed.t0
    return { ok: false, ms: null, t0, t1: null, why: t0 ? `its page's marker was not on screen within ${timeoutMs / 1000} s of the press` : 'the press never reached the page' }
  }
  return { ok: true, ms: Math.round((res.t1 - res.t0) * 10) / 10, t0: res.t0, t1: res.t1, why: null, marker: res.marker }
}

// ── requests and bytes per open ───────────────────────────────────────────────────────────────────────────────────
const bare = (u) => { try { const x = new URL(u); return x.origin + x.pathname } catch (e) { return String(u).split('?')[0] } }

/** Every finished or failed request of a browser context: {url, start (epoch ms, the browser's own), bytes}. */
export class NetLog {
  constructor(context) {
    this.rows = []
    this.background = new Set()
    const add = async (req, failed) => {
      let start = null, bytes = 0
      try { start = req.timing().startTime } catch (e) { /* none */ }
      if (!failed) { try { bytes = (await req.sizes()).responseBodySize || 0 } catch (e) { bytes = 0 } }
      this.rows.push({ url: req.url(), key: bare(req.url()), start, bytes, failed })
    }
    context.on('requestfinished', (req) => { add(req, false) })
    context.on('requestfailed', (req) => { add(req, true) })
  }
  /** The URLs (no query) the page asks for between t0 and t1 with no track being opened: its polls, left out of every
   *  open's count so a once-a-second poll landing inside an open never counts as that open's. */
  markBackground(t0, t1) { for (const r of this.rows) if (r.start != null && r.start >= t0 && r.start <= t1) this.background.add(r.key) }
  /** Requests started in [t0, t1], polls aside: {requests, bytes}. */
  between(t0, t1) {
    const mine = this.rows.filter((r) => r.start != null && r.start >= t0 - 1 && r.start <= t1 && !this.background.has(r.key))
    return { requests: mine.length, bytes: mine.reduce((a, r) => a + r.bytes, 0) }
  }
}

/** Builds the version finished between t0 and t1 (epoch ms), read from its PEP 0028 build records
 *  (<vt home>/cache/box-sites/<box>/build.json `at`, epoch s); null when it keeps none there. Read-only. */
export function buildsBetween(vtHome, t0, t1) {
  const root = join(vtHome, 'cache', 'box-sites')
  let dirs
  try { dirs = readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()) } catch (e) { return null }
  let n = 0
  for (const d of dirs) {
    try {
      const rec = JSON.parse(readFileSync(join(root, d.name, 'build.json'), 'utf8'))
      const at = Number(rec.at) * 1000
      if (Number.isFinite(at) && at >= t0 && at <= t1) n++
    } catch (e) { /* no record */ }
  }
  return n
}

// ── statistics ────────────────────────────────────────────────────────────────────────────────────────────────────
/** The q-quantile (0..1) by linear interpolation between order statistics (numpy's default); null for no values. */
export function quantile(values, q) {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b)
  if (!v.length) return null
  const pos = (v.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos)
  return Math.round((v[lo] + (v[hi] - v[lo]) * (pos - lo)) * 10) / 10
}
export const median = (values) => quantile(values, 0.5)

/** A seeded order (mulberry32): the same seed gives the same order, on any machine. */
export function seededOrder(items, seed) {
  let s = seed >>> 0
  const rand = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [out[i], out[j]] = [out[j], out[i]] }
  return out
}
