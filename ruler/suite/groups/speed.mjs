// S1.6 Opening a track shows its page fast (ruler v3, docs/peps/0003): open_ms, timed in the page (../timer.mjs).
//
// The stage, in order: the package boxes and the extra box added with `vt add` and a fresh `vt serve` (common.mjs
// addStageBoxes); a fresh browser (its own process: no cache, no warm renderer from the groups before); the page loaded
// until the sidebar shows Home and a track row, then SETTLE_MS of nothing (the requests the page makes in that window
// are its polls, left out of every open's count). Round 1 opens every box once, in an order fixed by the seed (cold:
// nothing of any box has loaded yet; a package box may still be unbuilt). Then a commit lands in two boxes (one
// package box, one files box, picked by the seed), AFTER_COMMIT_MS pass, and WARM_ROUNDS more rounds open every box
// again, each in its own seeded order. Every open is a real click on the row (timer.mjs timedOpen); GAP_MS separate
// two opens.
//
// open_ms = the median of the package boxes' opens (every box of Zach's is a package box since blackbox-agent 0.1; the
// files boxes are the fixture's older layout); an open whose page never showed counts as OPEN_TIMEOUT_MS (fail
// closed). The checks judge each run on its own: open_ms against MEDIAN_MS, and the p95 of every open, any kind,
// against SLOWEST_MS. WHY p95 and not the single slowest open: of about a hundred opens on a shared machine, one stall
// (a GC pause, a busy core) decides the maximum, so it would flip run to run and the deterministic gate would make an
// improving version inadmissible; nineteen opens in twenty within a second is the same promise without that one.
// A kind that is slow every time (six package boxes are a quarter of the opens; their first opens alone are more than
// one in twenty) still fails it. The slowest open is reported.
// Diagnostics (reported, never selected on): every kind's median, cold and warm medians, p95, max, and per open the
// requests and bytes the browser fetched between the press and the page showing and the builds the version finished
// in that time.
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { group, need, sleep, waitFor, PAGE_HELPER } from '../lib.mjs'
import { TIMER, timedOpen, NetLog, buildsBetween, median, quantile, seededOrder, OPEN_TIMEOUT_MS, DWELL_MS, PRESS_MS } from '../timer.mjs'
import { addStageBoxes } from './common.mjs'

// WHY 400 and 1000 (defaults Zach can overrule, OBJECTIVES §10.7): Nielsen's limits (0.1 s feels instant, 1 s keeps
// the flow of thought unbroken) and Doherty's 400 ms threshold (below it a person and a computer keep pace).
export const MEDIAN_MS = 400
export const SLOWEST_MS = 1000
export const SETTLE_MS = 10000
export const GAP_MS = 1000
export const WARM_ROUNDS = 3
export const AFTER_COMMIT_MS = 2000
const VIEWPORT = { width: 1400, height: 900 }
const COMMIT_DATE = '1795521600 +0000' // 2026-11-24T12:00:00Z: after every fixture box's activity

const S16 = [`S1.6 the median open of a package box shows its page within ${MEDIAN_MS} ms`,
  `S1.6 nineteen opens in twenty, of any box, show their page within ${SLOWEST_MS} ms`]

/** The boxes in the click sequence, each with the one marker that means "its own page is on screen". */
function sequenceBoxes(F) {
  const kind = (b) => b.kind || (b.site ? 'files' : 'readme')
  return [...F.boxes, ...(F.package_boxes || []), F.extra].map((b) => ({
    title: b.title, slug: b.slug, kind: kind(b), path: b.path,
    // a box with no site shows its README (S1.1); every other box its own page, never its README
    markers: [kind(b) === 'readme' ? b.readme_marker : b.marker],
  }))
}

/** A commit in a box, as an agent at work makes one: a new ledger row (and, for a files box, its site's page gains a
 *  line, its marker kept). Fixed author and dates, so the commit's sha is the same every run. */
function commitIn(stage, F, box) {
  const dir = box.path.replace(F.home, stage.home)
  const ledger = join(dir, 'ledger.jsonl')
  writeFileSync(ledger, readFileSync(ledger, 'utf8') + JSON.stringify({ t: '2026-11-24T12:00:00Z', solution: 's2', parent: 's1', split: 'dev', ruler: 'v1', objective: 0.9, admissible: true }) + '\n')
  if (box.kind === 'files') {
    const page = join(dir, 'site', 'index.html')
    writeFileSync(page, readFileSync(page, 'utf8').replace('</body>', '<p>VTA second commit</p>\n</body>'))
  }
  const env = { ...stage.env, GIT_AUTHOR_DATE: COMMIT_DATE, GIT_COMMITTER_DATE: COMMIT_DATE }
  const git = (args) => spawnSync('git', ['-C', dir, ...args], { env, encoding: 'utf8' })
  git(['add', '-A'])
  const out = git(['commit', '-q', '-m', 'VTA: a second commit (S1.6 warm rounds)'])
  return { box: box.slug, kind: box.kind, code: out.status, sha: (git(['rev-parse', 'HEAD']).stdout || '').trim() }
}

function stats(opens) {
  const value = (o) => (o.ok ? o.ms : OPEN_TIMEOUT_MS)
  const all = opens.map(value)
  const pkg = opens.filter((o) => o.kind === 'package')
  const cold = pkg.filter((o) => o.phase === 'cold').map(value)
  const warm = pkg.filter((o) => o.phase === 'warm').map(value)
  const num = (xs) => xs.filter((x) => Number.isFinite(x))
  const req = num(pkg.map((o) => o.requests)), builds = num(opens.map((o) => o.builds))
  const kinds = [...new Set(opens.map((o) => o.kind))]
  const perBox = {}
  for (const o of opens) (perBox[o.slug] = perBox[o.slug] || { kind: o.kind, ms: [], requests: [], bytes: [], failed: 0 }).ms.push(value(o))
  for (const o of opens) { const b = perBox[o.slug]; if (Number.isFinite(o.requests)) b.requests.push(o.requests); if (Number.isFinite(o.bytes)) b.bytes.push(o.bytes); if (!o.ok) b.failed++ }
  const boxes = Object.fromEntries(Object.entries(perBox).map(([slug, b]) => [slug, {
    kind: b.kind, opens: b.ms.length, failed: b.failed, p50: median(b.ms), p95: quantile(b.ms, 0.95), max: Math.max(...b.ms),
    cold: b.ms[0], cold_requests: b.requests[0] ?? null, cold_bytes: b.bytes[0] ?? null,
    warm_requests_p50: median(b.requests.slice(1)), warm_bytes_p50: median(b.bytes.slice(1)),
  }]))
  return {
    open_ms: median(pkg.map(value)), n_opens: opens.length, failed: opens.filter((o) => !o.ok).length,
    by_kind: Object.fromEntries(kinds.map((k) => [k, median(opens.filter((o) => o.kind === k).map(value))])),
    cold_p50: median(cold), warm_p50: median(warm), p95: quantile(all, 0.95), max: all.length ? Math.max(...all) : null,
    requests_per_open_p50: median(req),
    bytes_cold_p50: median(num(pkg.filter((o) => o.phase === 'cold').map((o) => o.bytes))),
    bytes_warm_p50: median(num(pkg.filter((o) => o.phase === 'warm').map((o) => o.bytes))),
    builds_waited: builds.length ? builds.reduce((a, x) => a + x, 0) : null,
    boxes,
  }
}

export default group('speed', S16, async (ctx, t) => {
  const { stage, F, diag } = ctx
  if (ctx.context) { await ctx.context.close().catch(() => {}); ctx.context = null; ctx.page = null }
  const added = await addStageBoxes(ctx)
  const browser = await ctx.browser.browserType().launch({ headless: true })
  appendFileSync(join(stage.runDir, 'pids.jsonl'), JSON.stringify({ pid: browser.process ? browser.process().pid : null, what: 'chromium (speed)', t: Date.now() }) + '\n')
  const vtHome = stage.env.VT_HOME || join(stage.env.HOME, '.vibetracks')
  const report = { definition: { median_ms: MEDIAN_MS, slowest_ms: SLOWEST_MS, settle_ms: SETTLE_MS, gap_ms: GAP_MS, warm_rounds: WARM_ROUNDS,
    after_commit_ms: AFTER_COMMIT_MS, dwell_ms: DWELL_MS, press_ms: PRESS_MS, timeout_ms: OPEN_TIMEOUT_MS, viewport: VIEWPORT },
    added: added.map((s) => `${s.args.join(' ')}: exit ${s.code}`), commits: [], opens: [], skipped: null }
  diag.speed = report
  try {
    const context = await browser.newContext({ viewport: VIEWPORT, colorScheme: 'light' })
    await context.addInitScript({ content: PAGE_HELPER })
    await context.addInitScript({ content: TIMER })
    const net = new NetLog(context)
    const boxes = sequenceBoxes(F)
    const titles = boxes.map((b) => b.title)
    let page = null
    const openPage = async () => {
      page = await context.newPage()
      page.on('pageerror', (e) => { stage.pageErrors = (stage.pageErrors || 0) + 1; appendFileSync(join(stage.runDir, 'page-errors.log'), `[speed] ${e.message}\n`) })
      await page.goto(stage.base, { waitUntil: 'domcontentloaded', timeout: 30000 })
      return !!(await waitFor(() => page.evaluate((ts) => !!window.__vta && window.__vta.findText('Home').length > 0 && ts.some((x) => window.__vta.rowInfo(x)), titles), 30000, 200))
    }
    report.page_ready = await openPage()
    report.crashes = 0
    const quietFrom = Date.now()
    await sleep(SETTLE_MS)
    net.markBackground(quietFrom, Date.now())
    report.background = [...net.background].map((u) => u.replace(stage.base.replace(/\/$/, ''), '')).slice(0, 20)
    const left = (await page.evaluate(() => window.__vta.sidebar())).r
    const opens = []
    const round = async (n, phase) => {
      let order = seededOrder(boxes, F.seed * 1000 + n)
      if (opens.length && order[0].slug === opens[opens.length - 1].slug) order = [...order.slice(1), order[0]]
      for (const box of order) {
        let r
        try {
          r = await timedOpen(page, { id: `${n}:${box.slug}`, title: box.title, markers: box.markers, left })
        } catch (e) {
          // WHY one retry on a fresh page: under memory pressure the OOM killer takes Chrome's renderer first (its
          // oom_score_adj is raised on purpose), which says nothing about the version; a second crash counts as a
          // failed open (fail closed). Every crash is counted in the report.
          report.crashes++
          appendFileSync(join(stage.runDir, 'page-errors.log'), `[speed] the page crashed opening ${box.slug}: ${e.message}\n`)
          await page.close().catch(() => {})
          try {
            await openPage()
            await sleep(2000)
            r = await timedOpen(page, { id: `${n}:${box.slug}:retry`, title: box.title, markers: box.markers, left })
          } catch (e2) {
            report.crashes++
            r = { ok: false, ms: null, t0: null, t1: null, why: `the page crashed twice: ${String(e2.message || e2).slice(0, 120)}` }
            await page.close().catch(() => {})
            await openPage().catch(() => {})
          }
        }
        opens.push({ round: n, phase, slug: box.slug, kind: box.kind, ok: r.ok, ms: r.ms, t0: r.t0, t1: r.t1, why: r.why })
        await sleep(GAP_MS)
      }
    }
    await round(1, 'cold')
    // WHY skip the warm rounds when most cold opens failed: each would wait out its 10 s again, past the group's
    // budget; they count as failed opens all the same (fail closed)
    const coldFailed = opens.filter((o) => !o.ok).length
    if (coldFailed * 2 > opens.length) {
      report.skipped = `the warm rounds: ${coldFailed} of ${opens.length} cold opens failed`
      for (let n = 2; n < 2 + WARM_ROUNDS; n++) for (const box of boxes) opens.push({ round: n, phase: 'warm', slug: box.slug, kind: box.kind, ok: false, ms: null, t0: null, t1: null, why: 'not run (the cold round mostly failed)' })
    } else {
      const pkg = seededOrder(boxes.filter((b) => b.kind === 'package'), F.seed * 7 + 1)[0]
      const files = seededOrder(boxes.filter((b) => b.kind === 'files'), F.seed * 7 + 2)[0]
      for (const box of [pkg, files].filter(Boolean)) report.commits.push(commitIn(stage, F, box))
      await sleep(AFTER_COMMIT_MS)
      for (let n = 2; n < 2 + WARM_ROUNDS; n++) await round(n, 'warm')
    }
    await sleep(2000) // the last responses land before their bytes are counted
    for (const o of opens) {
      if (o.t0 == null) { o.requests = null; o.bytes = null; o.builds = null; continue }
      const end = o.t1 != null ? o.t1 : o.t0 + OPEN_TIMEOUT_MS
      Object.assign(o, net.between(o.t0, end))
      o.builds = buildsBetween(vtHome, o.t0, end)
    }
    report.opens = opens.map((o) => ({ round: o.round, phase: o.phase, box: o.slug, kind: o.kind, ms: o.ms, requests: o.requests, bytes: o.bytes, builds: o.builds, ...(o.ok ? {} : { why: o.why }) }))
    Object.assign(report, stats(opens))
    await context.close().catch(() => {})
  } finally {
    await browser.close().catch(() => {})
  }
  const s = report
  const kinds = () => Object.entries(s.by_kind || {}).map(([k, v]) => `${k} ${v}`).join(', ')
  const sum = () => `${s.n_opens} opens: package boxes' median ${s.open_ms} ms (first opens ${s.cold_p50}, later ${s.warm_p50}); every kind's median: ${kinds()}; p95 ${s.p95}, slowest ${s.max}; ${s.failed} not shown within ${OPEN_TIMEOUT_MS / 1000} s`
  const worst = () => { const o = report.opens.filter((x) => x.ms == null || x.ms > SLOWEST_MS).sort((a, b) => (b.ms ?? 1e9) - (a.ms ?? 1e9)).slice(0, 5); return o.length ? `; over ${SLOWEST_MS} ms: ${report.opens.filter((x) => x.ms == null || x.ms > SLOWEST_MS).length}, e.g. ` + o.map((x) => `${x.box} (${x.phase}) ${x.ms == null ? x.why : x.ms + ' ms'}`).join(', ') : '' }
  await t(S16[0], async () => {
    need(Number.isFinite(s.open_ms), `no open was timed (${report.added.join('; ')})`)
    need(s.open_ms <= MEDIAN_MS, `${sum()}`)
    return sum()
  })
  await t(S16[1], async () => {
    need(Number.isFinite(s.p95), 'no open was timed')
    need(s.p95 <= SLOWEST_MS, `${sum()}${worst()}`)
    return sum()
  })
}, { budgetMs: 420000 })
