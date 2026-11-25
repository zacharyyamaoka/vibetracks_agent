#!/usr/bin/env node
// `vta speed`: how fast each track's page appears on a RUNNING vt serve, timed exactly as S1.6's ruler times it
// (ruler/suite/timer.mjs: t0 the row's pointerdown, t1 the first animation frame showing the box's content, both
// stamped in the page). For measuring what Zach feels in his own Preview or Stable.
//
//   node tools/speed.mjs --base http://127.0.0.1:4396/ [--rounds 2] [--json] [--vt-home ~/.vibetracks]
//
// Read-only: it starts no server (any port, 4394-4397 included, is only ever connected to) and its own headless
// browser (a fresh profile, nothing of his) clicks track rows and nothing else: no menu, chevron, drag, button or key.
// Opening a track sends no write in Vibe Tracks (every write is a POST act/<verb> behind a menu or a form); the report
// still counts any request that is not a GET or HEAD, so a version that writes on open shows up.
//
// What differs from the ruler, because a live vt serve's boxes are not the fixture's: the tracks are the sidebar's
// visible tree rows (role="treeitem") as the page loads, folded children left out. A package box's content marker is
// its objective's name, read from its own OBJECTIVES.md (the folder vt serve's tree.json names; a file read, nothing
// written), which its built landing and dashboard print, as the ruler's package boxes do, when that name is
// distinctive (it has an underscore, and no other track has it: "score" would match another page's "scored") and is
// not already on screen when the row is pressed (then the previous page would count). Any other track's marker is
// its title, counted only inside a frame of the main pane (a box's page shows its name: the site bar, the landing's
// heading, a README's title), never in the top page; that one shows before a dashboard's charts, so it is a lower
// bound, and a README fallback counts there.
import { chromium } from 'playwright'
import { homedir } from 'node:os'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PAGE_HELPER, waitFor } from '../ruler/suite/lib.mjs'
import { TIMER, timedOpen, NetLog, buildsBetween, median, quantile, seededOrder, sleep, OPEN_TIMEOUT_MS } from '../ruler/suite/timer.mjs'

const args = process.argv.slice(2)
const opt = (name, dflt = null) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : dflt }
const base = opt('--base')
const rounds = Math.max(1, Number(opt('--rounds', '2')) || 2)
const json = args.includes('--json')
const vtHome = opt('--vt-home') || join(homedir(), '.vibetracks')
const SETTLE_MS = 5000, GAP_MS = 1000
if (!base || !/^https?:\/\//.test(base)) { console.error('usage: node tools/speed.mjs --base http://127.0.0.1:<port>/ [--rounds N] [--json]'); process.exit(2) }

/** The objective's name in a box's OBJECTIVES.md, as blackbox_agent's fold reads it (its two spellings); null if none. */
function objectiveName(folder) {
  let text
  try { text = readFileSync(join(folder, 'OBJECTIVES.md'), 'utf8') } catch (e) { return null }
  const m = text.match(/\*\*Objective \(one number, (?:lower|higher) is better\): `([A-Za-z_0-9]+)`\*\*/) || text.match(/\*\*`([A-Za-z_0-9]+)`\*\*\s*\(the objective\)/)
  return m ? m[1] : null
}

/** vt serve's tree.json (the page polls it every second): title -> {kind, objective}. Empty when it is not there. */
async function boxFacts(base) {
  const out = new Map()
  try {
    const tree = await (await fetch(new URL('tree.json', base), { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) })).json()
    for (const t of tree.tracks || []) {
      const kind = (t.site_build && t.site_build.kind) || (t.site ? 'files' : 'readme')
      const folder = t.folder || (t.path ? t.path.replace(/^~/, homedir()) : null)
      const facts = { kind, objective: kind === 'package' && folder ? objectiveName(folder) : null }
      for (const name of [t.label, t.title]) if (name) out.set(name, facts)
    }
  } catch (e) { /* not a vt serve with tree.json: titles only */ }
  const seen = new Map()
  for (const f of new Set(out.values())) if (f.objective) seen.set(f.objective, (seen.get(f.objective) || 0) + 1)
  for (const f of out.values()) if (f.objective && (!f.objective.includes('_') || seen.get(f.objective) > 1)) f.objective = null
  return out
}

/** Whether a frame of the page (never the top page) shows the text now. */
async function onScreen(page, text) {
  for (const frame of page.frames()) {
    if (frame === page.mainFrame()) continue
    try { if (await frame.evaluate((t) => !!window.__vta && window.__vta.findText(t, false).length > 0, text)) return true } catch (e) { /* gone */ }
  }
  return false
}

/** The sidebar's visible tree rows, each by its title (the first element in the row whose own text is a word, not a
 *  count or a glyph). */
async function trackTitles(page) {
  return page.evaluate(() => {
    const V = window.__vta, side = V.sidebar()
    const out = []
    for (const row of V.all()) {
      if (row.getAttribute('role') !== 'treeitem' || !V.vis(row) || !V.inside(V.rect(row), side, 4)) continue
      let title = null
      for (const el of row.querySelectorAll('*')) {
        const own = V.ownText(el)
        if (own && own.length > 1 && /[A-Za-z]/.test(own) && V.vis(el)) { title = own; break }
      }
      if (title && !out.includes(title)) out.push(title)
    }
    return out
  })
}

const browser = await chromium.launch({ headless: true })
const report = { base, rounds, at: new Date().toISOString(), tracks: [], opens: [], writes: [], background: [] }
try {
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 }, colorScheme: 'light' })
  await context.addInitScript({ content: PAGE_HELPER })
  await context.addInitScript({ content: TIMER })
  context.on('request', (req) => { if (!['GET', 'HEAD'].includes(req.method())) report.writes.push(`${req.method()} ${req.url()}`) })
  const net = new NetLog(context)
  const page = await context.newPage()
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 30000 })
  const ready = await waitFor(() => page.evaluate(() => !!window.__vta && window.__vta.findText('Home').length > 0), 30000, 200)
  if (!ready) throw new Error(`${base} shows no sidebar with Home within 30 s`)
  await waitFor(async () => (await trackTitles(page)).length > 0, 15000, 300)
  const quiet = Date.now()
  await sleep(SETTLE_MS)
  net.markBackground(quiet, Date.now())
  report.background = [...net.background]
  const titles = await trackTitles(page)
  report.tracks = titles
  const facts = await boxFacts(base)
  const markerOf = (title) => { const f = facts.get(title); return f && f.objective ? { markers: [f.objective], by: 'objective', kind: f.kind } : { markers: [title], by: 'title', kind: f ? f.kind : null } }
  report.markers = Object.fromEntries(titles.map((x) => [x, markerOf(x)]))
  if (!titles.length) throw new Error('no track rows (role="treeitem") in the sidebar')
  const left = (await page.evaluate(() => window.__vta.sidebar())).r
  for (let n = 1; n <= rounds; n++) {
    let order = seededOrder(titles, 1000 + n)
    if (report.opens.length && order[0] === report.opens[report.opens.length - 1].title) order = [...order.slice(1), order[0]]
    for (const title of order) {
      let markers = report.markers[title].markers
      if (report.markers[title].by === 'objective' && (await onScreen(page, markers[0]))) { markers = [title]; report.markers[title].fellBack = (report.markers[title].fellBack || 0) + 1 }
      const r = await timedOpen(page, { id: `${n}:${title}`, title, markers, left, framesOnly: true })
      report.opens.push({ round: n, title, ok: r.ok, ms: r.ms, t0: r.t0, t1: r.t1, why: r.why })
      if (!json) process.stderr.write(`${n}  ${(r.ok ? `${Math.round(r.ms)} ms` : 'not shown').padStart(9)}  ${title}\n`)
      await sleep(GAP_MS)
    }
  }
  await sleep(2000)
  for (const o of report.opens) {
    if (o.t0 == null) continue
    const end = o.t1 != null ? o.t1 : o.t0 + OPEN_TIMEOUT_MS
    Object.assign(o, net.between(o.t0, end))
    o.builds = existsSync(vtHome) ? buildsBetween(vtHome, o.t0, end) : null
  }
} finally {
  await browser.close().catch(() => {})
}

const value = (o) => (o.ok ? o.ms : OPEN_TIMEOUT_MS)
const all = report.opens.map(value)
const summary = {
  open_ms: median(all), opens: all.length, failed: report.opens.filter((o) => !o.ok).length,
  cold_p50: median(report.opens.filter((o) => o.round === 1).map(value)),
  warm_p50: median(report.opens.filter((o) => o.round > 1).map(value)),
  p95: quantile(all, 0.95), max: all.length ? Math.max(...all) : null,
  requests_per_open: median(report.opens.map((o) => o.requests).filter(Number.isFinite)),
  bytes_per_open: median(report.opens.map((o) => o.bytes).filter(Number.isFinite)),
  writes: report.writes.length,
}
const rows = report.tracks.map((title) => {
  const mine = report.opens.filter((o) => o.title === title)
  const ms = mine.map(value)
  return { title, kind: report.markers[title].kind, marker: report.markers[title].by, opens: mine.length, failed: mine.filter((o) => !o.ok).length, cold: mine[0] ? value(mine[0]) : null,
    p50: median(ms), p95: quantile(ms, 0.95), requests: median(mine.map((o) => o.requests).filter(Number.isFinite)),
    bytes: median(mine.map((o) => o.bytes).filter(Number.isFinite)) }
})
if (json) {
  process.stdout.write(JSON.stringify({ ...report, summary, per_track: rows }, null, 1) + '\n')
} else {
  const kb = (b) => (b == null ? '—' : b >= 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.round(b / 1e3)} kB`)
  const ms = (x) => (x == null ? '—' : x >= OPEN_TIMEOUT_MS ? '≥10 s' : `${Math.round(x)}`)
  const w = Math.max(5, ...rows.map((r) => r.title.length))
  console.log(`\n${base}: ${summary.opens} opens over ${rounds} round${rounds === 1 ? '' : 's'}, ${report.tracks.length} tracks`)
  console.log(`open_ms ${ms(summary.open_ms)} (first round ${ms(summary.cold_p50)}, later ${ms(summary.warm_p50)}), p95 ${ms(summary.p95)}, slowest ${ms(summary.max)}; ${summary.failed} not shown within ${OPEN_TIMEOUT_MS / 1000} s; per open ${summary.requests_per_open ?? '—'} requests, ${kb(summary.bytes_per_open)}; writes sent: ${summary.writes}\n`)
  console.log(`${'track'.padEnd(w)}  ${'kind'.padEnd(7)}  ${'marker'.padEnd(9)}  ${'first'.padStart(6)}  ${'p50'.padStart(6)}  ${'p95'.padStart(6)}  ${'requests'.padStart(8)}  ${'bytes'.padStart(8)}`)
  for (const r of rows) console.log(`${r.title.padEnd(w)}  ${String(r.kind || '?').padEnd(7)}  ${r.marker.padEnd(9)}  ${ms(r.cold).padStart(6)}  ${ms(r.p50).padStart(6)}  ${ms(r.p95).padStart(6)}  ${String(r.requests ?? '—').padStart(8)}  ${kb(r.bytes).padStart(8)}`)
  if (report.writes.length) console.log(`\nWRITES SENT (opening a track should send none): ${report.writes.slice(0, 5).join('; ')}`)
}
