// The acceptance suite (OBJECTIVES §7): every check a junit test case named `S<id> <what>`, one junit XML per run.
//
//   node ruler/suite/run.mjs --run-dir <dir made by ruler/stage.py> [--port 4811] [--only S2.3,S2.4]
//   node ruler/suite/run.mjs --list            # every check id, as ruler/checks.json holds them
//
// The run dir holds fixture.json, env.json, bin/vt, home/ and pristine/ (ruler/stage.py). Each group of checks gets a
// fresh state: vt serve stopped, HOME put back from pristine/, vt serve started again, a new browser context. Every
// server is started detached in its own process group and stopped by that pid (SIGTERM, then SIGKILL); every pid is
// written to pids.jsonl so the evaluator can make sure none outlives the run. A check is `pass`, `fail` (what it looked
// for and what it found) or `error` (it crashed, or its group could not start or ran out of time); a check its group
// never reached is an error, so a junit never under-reports (OBJECTIVES §8, fail closed).
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs'
import { join } from 'node:path'
import { Fail, Stage, load, newPage, sleep } from './lib.mjs'
import { GROUPS } from './groups/index.mjs'

const args = process.argv.slice(2)
const opt = (name, dflt = null) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : dflt }
const CLASS = (g) => `ruler.suite.${g}`
const ID = (g, name) => `ruler/suite/${g}.py::${name}`
const GROUP_BUDGET_MS = Number(process.env.VTA_GROUP_BUDGET_MS || 240000)

if (args.includes('--list')) {
  const checks = GROUPS.flatMap((g) => g.checks.map((name) => ({ id: ID(g.name, name), group: g.name, name })))
  const names = checks.map((c) => c.id)
  if (new Set(names).size !== names.length) { console.error('duplicate check ids'); process.exit(2) }
  const bad = checks.filter((c) => !/^S\d+\.\d+ \S/.test(c.name))
  if (bad.length) { console.error(`check names must read "S<id> <what>": ${bad.map((c) => c.name).join(' | ')}`); process.exit(2) }
  process.stdout.write(JSON.stringify(checks, null, 1) + '\n')
  process.exit(0)
}

const runDir = opt('--run-dir')
const port = Number(opt('--port', '4811'))
if (port >= 4390 && port <= 4397) { console.error(`port ${port} is in 4390-4397 (Zach's Stable, Preview and lanes)`); process.exit(2) }
const only = (opt('--only', '') || '').split(',').map((s) => s.trim()).filter(Boolean)
const fixture = JSON.parse(readFileSync(join(runDir, 'fixture.json'), 'utf8'))
const env = JSON.parse(readFileSync(join(runDir, 'env.json'), 'utf8'))
const stage = new Stage({ runDir, port, env, home: join(runDir, 'home'), pristine: join(runDir, 'pristine'), fixture })
const results = []          // {group, name, state, message, time}
const diag = { port, groups: {}, style: {}, page_ready_ms: null, stock_tree: null, registration: null }
try { diag.registration = JSON.parse(readFileSync(join(runDir, 'registration.json'), 'utf8')).method } catch (e) { /* none */ }

function xml(s) { return String(s).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '') }
function writeJunit(final = true) {
  const byGroup = new Map()
  for (const r of results) { if (!byGroup.has(r.group)) byGroup.set(r.group, []); byGroup.get(r.group).push(r) }
  let body = ''
  for (const [g, rs] of byGroup) {
    const f = rs.filter((r) => r.state === 'fail').length, e = rs.filter((r) => r.state === 'error').length
    const time = rs.reduce((a, r) => a + (r.time || 0), 0)
    body += `  <testsuite name="${xml(CLASS(g))}" tests="${rs.length}" failures="${f}" errors="${e}" skipped="0" time="${time.toFixed(3)}">\n`
    for (const r of rs) {
      body += `    <testcase classname="${xml(CLASS(g))}" name="${xml(r.name)}" time="${(r.time || 0).toFixed(3)}"`
      if (r.state === 'pass') body += '/>\n'
      else body += `>\n      <${r.state === 'fail' ? 'failure' : 'error'} message="${xml((r.message || '').split('\n')[0].slice(0, 500))}">${xml(r.message || '')}</${r.state === 'fail' ? 'failure' : 'error'}>\n    </testcase>\n`
    }
    body += '  </testsuite>\n'
  }
  const n = results.length, f = results.filter((r) => r.state === 'fail').length, e = results.filter((r) => r.state === 'error').length
  const head = `<?xml version="1.0" encoding="UTF-8"?>\n<testsuites name="vibetracks_agent ruler v2" tests="${n}" failures="${f}" errors="${e}" seed="${fixture.seed}">\n`
  writeFileSync(join(runDir, final ? 'junit.xml' : 'junit.partial.xml'), head + body + '</testsuites>\n')
  writeFileSync(join(runDir, 'diagnostics.json'), JSON.stringify(diag, null, 1) + '\n')
}

let browser = null
let stopping = false
async function shutdown(code) {
  if (stopping) return
  stopping = true
  try { await stage.stop() } catch (e) { /* best effort */ }
  try { if (browser) await browser.close() } catch (e) { /* best effort */ }
  process.exit(code)
}
process.on('SIGTERM', () => { for (const g of GROUPS) for (const name of g.checks) if (!results.some((r) => r.group === g.name && r.name === name)) results.push({ group: g.name, name, state: 'error', message: 'the run was stopped (SIGTERM) before this check', time: 0 }); writeJunit(); shutdown(143) })
process.on('SIGINT', () => shutdown(130))

const { chromium } = await import('playwright')
browser = await chromium.launch({ headless: true })
appendFileSync(join(runDir, 'pids.jsonl'), JSON.stringify({ pid: browser.process ? browser.process().pid : null, what: 'chromium', t: Date.now() }) + '\n')
const titles = fixture.boxes.map((b) => b.title)

for (const g of GROUPS) {
  const selected = !only.length || g.checks.some((c) => only.some((o) => c.startsWith(o + ' ')))
  if (!selected) continue
  const started = Date.now()
  const reported = new Set()
  let closed = false
  const record = (name, state, message, time) => {
    if (closed || reported.has(name)) return
    if (!g.checks.includes(name)) throw new Error(`group ${g.name} reported an undeclared check: ${name}`)
    reported.add(name)
    results.push({ group: g.name, name, state, message, time })
    console.log(`${state === 'pass' ? 'ok  ' : state === 'fail' ? 'FAIL' : 'ERR '} ${name}${state === 'pass' ? '' : ' :: ' + (message || '').split('\n')[0].slice(0, 220)}`)
  }
  const t = async (name, body) => {
    const t0 = Date.now()
    try {
      const note = await body()
      record(name, 'pass', note || null, (Date.now() - t0) / 1000)
    } catch (e) {
      record(name, e instanceof Fail ? 'fail' : 'error', e instanceof Fail ? e.message : `${e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e}`, (Date.now() - t0) / 1000)
    }
  }
  t.fail = (name, message) => record(name, 'fail', message, 0)
  t.done = (name) => reported.has(name)
  const ctx = { stage, browser, F: fixture, diag, titles, page: null, context: null, scripts: [] }
  ctx.open = async (opts = {}) => {
    if (ctx.context) await ctx.context.close().catch(() => {})
    const { context, page } = await newPage(browser, stage, opts)
    ctx.context = context
    ctx.page = page
    ctx.scripts = []
    let bytes = 0
    context.on('response', async (res) => {
      try {
        const type = (res.headers()['content-type'] || '').toLowerCase()
        const u = res.url()
        if (!/javascript|ecmascript|text\/html/.test(type) && !/\.(m?js)(\?|$)/.test(u)) return
        const text = await res.text()
        if (bytes + text.length > 40e6) { ctx.scripts.push({ url: u, body: '' }); return }
        bytes += text.length
        ctx.scripts.push({ url: u, body: text })
      } catch (e) { /* a body we cannot read */ }
    })
    await load(page, stage, titles)
    return page
  }
  ctx.restart = async () => {
    await stage.stop()
    await stage.start()
    await load(ctx.page, stage, titles)
  }
  let setupError = null
  console.log(`\n== group ${g.name} (${g.checks.length} checks)`)
  try {
    await stage.stop()
    stage.restore()
    await stage.start()
    await ctx.open()
    let timer
    const budget = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`group ${g.name} ran out of its ${GROUP_BUDGET_MS / 1000} s`)), GROUP_BUDGET_MS) })
    try { await Promise.race([g.run(ctx, t), budget]) } finally { clearTimeout(timer) }
  } catch (e) {
    setupError = e
  } finally {
    closed = false
    for (const name of g.checks) if (!reported.has(name)) record(name, 'error', setupError ? `${setupError.message || setupError}` : `group ${g.name} ended without running this check`, 0)
    closed = true
    if (ctx.context) await ctx.context.close().catch(() => {})
    await stage.stop()
    diag.groups[g.name] = { s: Math.round((Date.now() - started) / 100) / 10, error: setupError ? String(setupError.message || setupError) : null, page_errors: stage.pageErrors || 0 }
    stage.pageErrors = 0
    writeJunit(false)
  }
}

writeJunit(true)
const n = results.length, passed = results.filter((r) => r.state === 'pass').length
console.log(`\n${passed} of ${n} checks passed; junit: ${join(runDir, 'junit.xml')}`)
await shutdown(0)
