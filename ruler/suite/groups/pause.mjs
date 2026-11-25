// S2.10 (ruler v2, docs/peps/0002-ruler-v2-pause-resume.md): pause a track. Pause / Resume in the ··· and right-click
// menus; a paused row that looks paused (a pause glyph in its status-dot slot, a muted title) through a reload and a
// `vt serve` restart; Resume putting the row's state colour and the menu's Pause back; the tree file's append-only
// `status` records saying who paused it (a person from the page or a shell, an agent from an agent's session) and, with
// --why, why; `vt pause` / `vt resume` agreeing with the page; and no box written.
//
// Measured as a person sees it (OBJECTIVES §7): menu labels from real pointer events, the row's painted boxes and
// computed colours, never a class name or test id; the records from the tree file vibetracks PEP 0024 names
// (`$VT_HOME/tree.json`, else `~/.vibetracks/tree.json`, under the run's HOME). Fail closed: a missing verb, menu item,
// glyph, file, entry or record fails its check.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { group, need, sleep, waitFor, openRowMenu, rightClickRow, closeMenus, labels, rowMenuAction, load, sidebar, hashTree, changedFiles } from '../lib.mjs'
import { one } from './common.mjs'

const S210 = [
  "S2.10 an active track's ··· and right-click menus show Pause",
  'S2.10 Pause in the ··· menu writes a person record to the tree file, with no agent and no why',
  "S2.10 a paused track's ··· and right-click menus show Resume",
  'S2.10 a paused row shows a pause glyph in its status-dot slot',
  "S2.10 a paused row's title is muted",
  'S2.10 the pause survives a reload',
  'S2.10 the pause survives a vt serve restart',
  'S2.10 Resume returns the row to its state colour and the menu to Pause',
  'S2.10 vt pause writes a person record via cli with no why',
  'S2.10 vt pause shows on the page within 5 s, with no reload',
  'S2.10 vt resume --why stores the text verbatim, and the page shows Pause within 5 s',
  'S2.10 vt pause --why inside an agent session writes an agent record with the text verbatim',
  'S2.10 the status list is append-only and a track never paused reads active',
  'S2.10 pausing and resuming leave every box untouched',
]

// The agent session the ruler plays for `vt pause` run "inside an agent's session": Claude Code's own session variable,
// which vibetracks' stamp() reads through its claude-code adapter (vibetracks/core/records.py agent_session). The
// stage's environment holds no session (stage.py), so every other verb here is a person's.
const SESSION_ENV = 'CLAUDE_CODE_SESSION_ID'
const SESSION_ID = '5e55a210-0000-4000-8000-00000000a210'
// --why texts with quotes, a colon and a non-ASCII letter: "verbatim" means byte for byte
const WHY_RESUME = 'back on: "the belt is fixed" (été)'
const WHY_AGENT = 'answer fixture-answer-7f3a: "Pause it"'
const WINDOW_MS = 5000   // "within one tick": the window S1.3 and S4.4 give a file change to show without a reload
const MUTED = 0.85       // a muted title: contrast with its row at most 85 % of its own active contrast
const SAME = 0.05        // Resume: contrast back within 5 %, the dot's colour within 3 per channel

// ── the tree file (vibetracks PEP 0024 §2; PEP 0002 "The record") ────────────────────────────────────────────────
const treePath = (stage) => join(stage.env.VT_HOME || join(stage.home, '.vibetracks'), 'tree.json')
function statusOf(stage, box) {
  const path = treePath(stage)
  let data
  try { data = JSON.parse(readFileSync(path, 'utf8')) } catch (e) { return { error: `no readable tree file at ${path} (${String(e.message || e).slice(0, 120)})` } }
  const tracks = data && Array.isArray(data.tracks) ? data.tracks : null
  if (!tracks) return { error: `${path} holds no tracks list` }
  const expand = (p) => (typeof p === 'string' ? resolve(p.startsWith('~/') ? join(stage.home, p.slice(2)) : p) : null)
  const entry = tracks.find((t) => t && (t.id === box.slug || expand(t.path) === resolve(box.path)))
  if (!entry) return { error: `the tree file has no entry for ${box.slug}` }
  const list = entry.status === undefined ? [] : entry.status
  if (!Array.isArray(list)) return { error: `${box.slug}'s status is not a list: ${JSON.stringify(entry.status).slice(0, 160)}` }
  return { list, last: list.length ? list[list.length - 1] : null }
}
/** What is wrong with a status record, or null. want: {status, via, agent: bool, why: undefined | text}. */
function recordProblem(rec, want, F) {
  if (!rec || typeof rec !== 'object' || Array.isArray(rec)) return `no status record (latest: ${JSON.stringify(rec)})`
  const out = []
  if (rec.status !== want.status) out.push(`status ${JSON.stringify(rec.status)}, want "${want.status}"`)
  const at = typeof rec.at === 'string' ? Date.parse(rec.at) : NaN
  if (!Number.isFinite(at)) out.push(`at ${JSON.stringify(rec.at)} is not a time`)
  else if (Math.abs(at - Date.now()) > 3600e3) out.push(`at ${rec.at} is not the time it ran`)
  const by = rec.by
  if (!by || typeof by !== 'object') out.push(`no by: ${JSON.stringify(rec).slice(0, 200)}`)
  else {
    if (by.person !== F.person.email) out.push(`by.person ${JSON.stringify(by.person)}, want this machine's person ${F.person.email}`)
    if (by.via !== want.via) out.push(`by.via ${JSON.stringify(by.via)}, want "${want.via}"`)
    if (want.agent) {
      if (typeof by.agent !== 'string' || !by.agent) out.push(`no by.agent although the verb ran with ${SESSION_ENV} set`)
      if (typeof by.sid !== 'string' || !by.sid.includes(SESSION_ID)) out.push(`by.sid ${JSON.stringify(by.sid)} does not name the session ${SESSION_ID}`)
    } else {
      for (const k of ['agent', 'model', 'sid', 'account']) if (k in by) out.push(`by.${k} = ${JSON.stringify(by[k])} on a person's record`)
    }
  }
  if (want.why === undefined) { if ('why' in rec) out.push(`a why key without --why: ${JSON.stringify(rec.why)}`) }
  else if (rec.why !== want.why) out.push(`why ${JSON.stringify(rec.why)}, want ${JSON.stringify(want.why)} verbatim`)
  return out.length ? out.join('; ') : null
}
/** Wait until the track's latest record has `status`; returns statusOf's result (the last one read). */
async function recordAfter(stage, box, status, n0) {
  let got = statusOf(stage, box)
  await waitFor(async () => { got = statusOf(stage, box); return got.list && got.list.length > n0 && got.last && got.last.status === status ? true : null }, WINDOW_MS, 200)
  return got
}
const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// ── the row as it is painted ─────────────────────────────────────────────────────────────────────────────────────
/** In the page: the row of `title`: its leading status dot (box, colour), a pause glyph in the dot's slot (`slotDx`, px
 *  from the row's left edge, measured on the active row; else anywhere left of the title), and the title's contrast. */
function lookIn([title, slotDx]) {
  const V = window.__vta
  const f = V.sideTitle(title)
  if (!f) return null
  const row = V.rect(f.row), text = V.rect(f.el)
  const parse = (c) => { const m = (c || '').match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 } }
  const inRow = (r) => r.l >= row.l - 1 && r.r <= row.r + 1 && r.t >= row.t - 1 && r.b <= row.b + 1
  const SHAPES = ['circle', 'rect', 'path', 'line', 'polygon', 'polyline', 'ellipse']
  function paint(el) {
    const cs = getComputedStyle(el), tag = el.tagName.toLowerCase()
    const bg = parse(cs.backgroundColor)
    if (bg && bg.a > 0) return bg
    if (parseFloat(cs.borderTopWidth) > 0) { const bc = parse(cs.borderTopColor); if (bc && bc.a > 0) return bc }
    const shape = tag === 'svg' ? el.querySelector(SHAPES.join(',')) : SHAPES.includes(tag) ? el : null
    if (shape) {
      const s = getComputedStyle(shape), fill = parse(s.fill), stroke = parse(s.stroke)
      if (fill && fill.a > 0) return fill
      if (stroke && stroke.a > 0 && parseFloat(s.strokeWidth) > 0) return stroke
    }
    // a CSS-drawn icon: a ::before / ::after box with a painted background or border
    for (const pseudo of ['::before', '::after']) {
      const ps = getComputedStyle(el, pseudo)
      if (!ps.content || ps.content === 'none' || ps.content === 'normal') continue
      const pb = parse(ps.backgroundColor)
      if (pb && pb.a > 0) return pb
      if (parseFloat(ps.borderLeftWidth) > 0) { const bc = parse(ps.borderLeftColor); if (bc && bc.a > 0) return bc }
    }
    return null
  }
  const PAUSE_CHAR = /⏸|‖|❚|▮|\|\|/
  const pseudoText = (el) => ['::before', '::after'].map((x) => getComputedStyle(el, x).content).filter((c) => c && c !== 'none' && c !== 'normal').join(' ')
  const els = V.all().filter((el) => V.vis(el) && inRow(V.rect(el)))
  // the status dot, as S2.9 reads it (round, painted, 3-12 px, left of the title), with its colour
  const dots = els.filter((el) => {
    const r = V.rect(el)
    if (r.w < 3 || r.w > 12 || r.h < 3 || r.h > 12 || Math.abs(r.w - r.h) > 1.5 || r.r > text.l + 1) return false
    const cs = getComputedStyle(el), tag = el.tagName.toLowerCase()
    const round = parseFloat(cs.borderTopLeftRadius) >= r.w * 0.4 || tag === 'circle' || (tag === 'svg' && !!el.querySelector('circle'))
    return round && !!paint(el)
  }).map((el) => ({ rect: V.rect(el), color: paint(el) })).sort((a, b) => a.rect.l - b.rect.l)
  const dot = dots[0] || null
  // the slot: the active row's dot centre, else the lead (left of the title)
  const cx = slotDx != null ? row.l + slotDx : dot ? dot.rect.l + dot.rect.w / 2 : null
  const near = (r) => (cx != null ? Math.abs(r.l + r.w / 2 - cx) <= 8 : r.l + r.w / 2 < text.l) && r.l + r.w / 2 < text.l + 2
  // a pause glyph: (a) a pause character painted in the slot, (b) an icon there named paused, (c) two vertical bars there
  let glyph = null
  for (const el of els) {
    const r = V.rect(el)
    if (r.w > 24 || r.h > 24 || !near(r)) continue
    const own = V.ownText(el)
    const color = parse(getComputedStyle(el).color)
    const chars = `${own} ${pseudoText(el)}`
    if (PAUSE_CHAR.test(chars) && color && color.a > 0) { glyph = { kind: 'a pause character', text: chars.trim(), rect: r }; break }
    const tl = el.tagName.toLowerCase() === 'svg' ? el.querySelector('title') : null
    const name = [el.getAttribute('aria-label'), el.getAttribute('title'), tl ? tl.textContent : null].filter(Boolean).join(' ')
    if (/\bpaused?\b/i.test(name) && (paint(el) || (color && color.a > 0 && own))) { glyph = { kind: 'an icon named paused', text: name, rect: r }; break }
  }
  if (!glyph) {
    const bars = els.map((el) => ({ el, r: V.rect(el) })).filter(({ el, r }) => r.w >= 1 && r.w <= 6 && r.h >= 4 && r.h <= 16 && r.h >= 1.6 * r.w && near(r) && paint(el))
    for (let i = 0; i < bars.length && !glyph; i++) {
      for (let j = 0; j < bars.length; j++) {
        const a = bars[i].r, b = bars[j].r
        if (i === j || a.l >= b.l) continue
        const gap = b.l - a.r
        if (Math.abs((a.t + a.b) / 2 - (b.t + b.b) / 2) <= 1.5 && Math.abs(a.h - b.h) <= 1.5 && gap >= 0.5 && gap <= 6) { glyph = { kind: 'two vertical bars', rect: { l: a.l, t: Math.min(a.t, b.t), r: b.r, b: Math.max(a.b, b.b) } }; break }
      }
    }
  }
  // the title's contrast with what is behind it (WCAG ratio), its colour's alpha and every opacity above it applied
  const cs = getComputedStyle(f.el)
  const color = parse(cs.color) || { r: 0, g: 0, b: 0, a: 1 }
  let op = 1
  for (let a = f.el; a; a = V.parentOf(a)) {
    const s = getComputedStyle(a)
    const o = parseFloat(s.opacity)
    if (Number.isFinite(o)) op *= o
    const m = (s.filter || '').match(/opacity\(\s*([\d.]+)(%?)\s*\)/)
    if (m) op *= m[2] ? parseFloat(m[1]) / 100 : parseFloat(m[1])
  }
  const bg = V.effBgAt(text.l + Math.min(6, text.w / 2), text.t + text.h / 2)
  const alpha = color.a * op
  const fg = { r: color.r * alpha + bg.r * (1 - alpha), g: color.g * alpha + bg.g * (1 - alpha), b: color.b * alpha + bg.b * (1 - alpha) }
  const lum = (c) => { const ch = [c.r, c.g, c.b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }); return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2] }
  const L1 = lum(fg), L2 = lum(bg)
  const contrast = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)
  return { row, text, dot, slotDx: cx == null ? null : cx - row.l, glyph, title: { color: cs.color, opacity: op, bg: [bg.r, bg.g, bg.b], contrast } }
}
/** The row's look with the pointer off it (no hover fill), after the page settled. */
async function look(page, title, slotDx = null) {
  const s = await sidebar(page)
  await page.mouse.move(s.r + 300, 860, { steps: 2 })
  await sleep(350)
  return page.evaluate(lookIn, [title, slotDx])
}
const rgb = (c) => (c ? `rgb(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)})` : 'none')
const near3 = (a, b) => !!a && !!b && ['r', 'g', 'b'].every((k) => Math.abs(a[k] - b[k]) <= 3)
function pausedProblem(L, L0) {
  if (!L) return 'its row is not in the sidebar'
  if (L0 && L0.glyph) return `the active row already shows ${L0.glyph.kind} in that slot, so it marks no pause`
  if (!L.glyph) return `no pause glyph in the status-dot slot (${L0 && L0.slotDx != null ? `${L0.slotDx.toFixed(1)} px into the row` : 'left of the title'}; looked for a pause character, an icon named paused, or two vertical bars)`
  return null
}
function mutedProblem(L, L0) {
  if (!L || !L0) return 'its row is not in the sidebar'
  const ratio = L.title.contrast / L0.title.contrast
  return ratio <= MUTED ? null : `title contrast ${L.title.contrast.toFixed(2)}:1 paused vs ${L0.title.contrast.toFixed(2)}:1 active (${(ratio * 100).toFixed(0)} %; muted is at most ${MUTED * 100} %; colour ${L.title.color}, opacity ${L.title.opacity.toFixed(2)})`
}

// ── the menus ───────────────────────────────────────────────────────────────────────────────────────────────────
async function menuWords(page, title) {
  const dots = await openRowMenu(page, title)
  await closeMenus(page)
  const right = await rightClickRow(page, title)
  await closeMenus(page)
  return { dots: dots ? labels(dots) : null, right: right && right.menu ? labels(right.menu) : null }
}
function menuProblem(words, want, not) {
  const out = []
  for (const [k, name] of [['dots', '···'], ['right', 'right-click']]) {
    const l = words[k]
    if (!l) { out.push(`no ${name} menu`); continue }
    if (!l.includes(want) || l.includes(not)) out.push(`${name} menu: ${l.join(', ') || 'no items'} (want ${want}, not ${not})`)
  }
  return out.length ? out.join('; ') : null
}
async function dotsSays(page, title, want) {
  const m = await openRowMenu(page, title)
  await closeMenus(page)
  return m ? labels(m).includes(want) : false
}

export default group('pause', S210, async (ctx, t) => {
  const { page, F, stage } = ctx
  // three leaf tracks that are not done, each with its own dot: A for the page, B for a person's shell, C for an agent
  const hasKids = (b) => F.boxes.some((x) => x.parent === b.slug)
  const A = one(F, 'rollup_working')
  const leaves = F.boxes.filter((b) => b.slug !== A.slug && b.state !== 'done' && !hasKids(b) && b.site)
  const B = leaves[0], C = leaves[1]
  need(B && C, 'the fixture has fewer than three open leaf tracks')
  const before = Object.fromEntries(F.boxes.map((b) => [b.slug, hashTree(b.path, ['.git'])]))
  const A0 = await look(page, A.title)
  const B0 = await look(page, B.title)
  const brief = (L) => (L ? { slot_dx: L.slotDx, dot: L.dot ? rgb(L.dot.color) : null, contrast: +L.title.contrast.toFixed(2), glyph: L.glyph ? L.glyph.kind : null } : null)
  ctx.diag.pause = { page: A.slug, shell: B.slug, agent: C.slug, active: { [A.slug]: brief(A0), [B.slug]: brief(B0) } }
  const snaps = { A: [], B: [], C: [] }
  let pausedA = false, pausedAny = false

  // ── from the page ──
  await t(S210[0], async () => {
    need(A0, `no row for ${A.title}`)
    const p = menuProblem(await menuWords(page, A.title), 'Pause', 'Resume')
    need(!p, `${A.title} (active): ${p}`)
  })
  await t(S210[1], async () => {
    const n0 = (statusOf(stage, A).list || []).length
    need(await rowMenuAction(page, A.title, /^Pause$/), `no Pause item in ${A.title}'s ··· menu`)
    pausedA = true
    await closeMenus(page)
    const got = await recordAfter(stage, A, 'paused', n0)
    need(!got.error, got.error)
    snaps.A.push(got.list)
    if (got.last && got.last.status === 'paused') pausedAny = true
    need(got.list.length === n0 + 1, `the status list went ${n0} → ${got.list.length} records after one Pause`)
    const p = recordProblem(got.last, { status: 'paused', via: 'page', agent: false }, F)
    need(!p, `${A.slug}'s latest record: ${p}`)
  })
  await t(S210[2], async () => {
    need(pausedA, 'Pause did not run (the check before)')
    const p = menuProblem(await menuWords(page, A.title), 'Resume', 'Pause')
    need(!p, `${A.title} (paused): ${p}`)
  })
  await t(S210[3], async () => {
    need(pausedA, 'Pause did not run')
    const L = await waitFor(async () => { const l = await look(page, A.title, A0 && A0.slotDx); return l && l.glyph ? l : null }, 3000, 250) || await look(page, A.title, A0 && A0.slotDx)
    const p = pausedProblem(L, A0)
    need(!p, `${A.title}: ${p}`)
    return `${L.glyph.kind} at ${Math.round(L.glyph.rect.l)}-${Math.round(L.glyph.rect.r)} px`
  })
  await t(S210[4], async () => {
    need(pausedA, 'Pause did not run')
    need(A0, `no row for ${A.title} before the pause`)
    const p = mutedProblem(await look(page, A.title, A0.slotDx), A0)
    need(!p, `${A.title}: ${p}`)
  })
  async function stillPaused(when) {
    const L = await waitFor(async () => { const l = await look(page, A.title, A0 && A0.slotDx); return l && l.glyph ? l : null }, 3000, 250) || await look(page, A.title, A0 && A0.slotDx)
    const problems = [pausedProblem(L, A0), mutedProblem(L, A0)].filter(Boolean)
    if (!(await dotsSays(page, A.title, 'Resume'))) problems.push('its ··· menu does not read Resume')
    const got = statusOf(stage, A)
    if (got.error) problems.push(got.error)
    else if (!got.last || got.last.status !== 'paused') problems.push(`the latest record reads ${JSON.stringify(got.last && got.last.status)}`)
    need(!problems.length, `after ${when}, ${A.title}: ${problems.join('; ')}`)
  }
  await t(S210[5], async () => {
    need(pausedA, 'Pause did not run')
    await load(page, stage, ctx.titles)
    await stillPaused('a reload')
  })
  await t(S210[6], async () => {
    need(pausedA, 'Pause did not run')
    await ctx.restart()
    await stillPaused('a vt serve restart')
  })
  await t(S210[7], async () => {
    need(pausedA, 'Pause did not run')
    const prev = statusOf(stage, A)
    const n0 = (prev.list || []).length
    need(await rowMenuAction(page, A.title, /^Resume$/), `no Resume item in the paused ${A.title}'s ··· menu`)
    await closeMenus(page)
    const got = await recordAfter(stage, A, 'active', n0)
    if (got.list) snaps.A.push(got.list)
    const problems = []
    if (got.error) problems.push(got.error)
    else {
      if (got.list.length !== n0 + 1) problems.push(`the status list went ${n0} → ${got.list.length} records after one Resume`)
      const p = recordProblem(got.last, { status: 'active', via: 'page', agent: false }, F)
      if (p) problems.push(`latest record: ${p}`)
    }
    const L = await waitFor(async () => { const l = await look(page, A.title, A0 && A0.slotDx); return l && !l.glyph && l.dot ? l : null }, 3000, 250) || await look(page, A.title, A0 && A0.slotDx)
    if (!L) problems.push('its row is gone')
    else {
      if (L.glyph) problems.push(`the pause glyph is still there (${L.glyph.kind})`)
      if (!A0 || !A0.dot) problems.push('no status dot on the active row to compare with')
      else if (!L.dot || !near3(L.dot.color, A0.dot.color)) problems.push(`status dot ${L.dot ? rgb(L.dot.color) : 'gone'}, was ${rgb(A0.dot.color)}`)
      if (A0 && Math.abs(L.title.contrast / A0.title.contrast - 1) > SAME) problems.push(`title contrast ${L.title.contrast.toFixed(2)}:1, was ${A0.title.contrast.toFixed(2)}:1`)
    }
    if (!(await dotsSays(page, A.title, 'Pause'))) problems.push('its ··· menu does not read Pause')
    need(!problems.length, `after Resume, ${A.title}: ${problems.join('; ')}`)
  })

  // ── from a shell: the same verbs, a person's (the stage runs in no agent session) ──
  let pausedB = false
  await t(S210[8], async () => {
    need(B0, `no row for ${B.title}`)
    await page.evaluate(() => { window.__vtaStay = 'S2.10' })
    const n0 = (statusOf(stage, B).list || []).length
    const r = stage.vtRun(['pause', B.slug])
    need(r.code === 0, `vt pause ${B.slug} exited ${r.code}: ${r.out.slice(-300)}`)
    pausedB = true
    const got = statusOf(stage, B)
    need(!got.error, got.error)
    snaps.B.push(got.list)
    if (got.last && got.last.status === 'paused') pausedAny = true
    need(got.list.length === n0 + 1, `the status list went ${n0} → ${got.list.length} records after one vt pause`)
    const p = recordProblem(got.last, { status: 'paused', via: 'cli', agent: false }, F)
    need(!p, `${B.slug}'s latest record: ${p}`)
  })
  await t(S210[9], async () => {
    need(pausedB, 'vt pause did not run (the check before)')
    const t0 = Date.now()
    const L = await waitFor(async () => { const l = await look(page, B.title, B0 && B0.slotDx); return l && l.glyph ? l : null }, WINDOW_MS, 250)
    const ms = Date.now() - t0
    const menu = await dotsSays(page, B.title, 'Resume')
    const stay = await page.evaluate(() => window.__vtaStay)
    const problems = []
    if (!L) problems.push(`no pause glyph on ${B.title}'s row within ${WINDOW_MS / 1000} s`)
    if (!menu) problems.push(`${B.title}'s ··· menu does not read Resume`)
    if (stay !== 'S2.10') problems.push('the page reloaded')
    need(!problems.length, problems.join('; '))
    return `${ms} ms`
  })
  await t(S210[10], async () => {
    need(pausedB, 'vt pause did not run')
    const n0 = (statusOf(stage, B).list || []).length
    const r = stage.vtRun(['resume', B.slug, '--why', WHY_RESUME])
    need(r.code === 0, `vt resume ${B.slug} --why … exited ${r.code}: ${r.out.slice(-300)}`)
    const got = statusOf(stage, B)
    need(!got.error, got.error)
    snaps.B.push(got.list)
    const problems = []
    if (got.list.length !== n0 + 1) problems.push(`the status list went ${n0} → ${got.list.length} records after one vt resume`)
    const p = recordProblem(got.last, { status: 'active', via: 'cli', agent: false, why: WHY_RESUME }, F)
    if (p) problems.push(`latest record: ${p}`)
    const back = await waitFor(async () => { const l = await look(page, B.title, B0 && B0.slotDx); return l && !l.glyph ? l : null }, WINDOW_MS, 250)
    if (!back) problems.push(`${B.title}'s pause glyph still shows after ${WINDOW_MS / 1000} s`)
    if (!(await dotsSays(page, B.title, 'Pause'))) problems.push(`${B.title}'s ··· menu does not read Pause`)
    if ((await page.evaluate(() => window.__vtaStay)) !== 'S2.10') problems.push('the page reloaded')
    need(!problems.length, problems.join('; '))
  })

  // ── from an agent's session ──
  await t(S210[11], async () => {
    const n0 = (statusOf(stage, C).list || []).length
    const out = spawnSync(stage.vt, ['pause', C.slug, '--why', WHY_AGENT], { cwd: stage.home, env: { ...stage.env, [SESSION_ENV]: SESSION_ID }, encoding: 'utf8', timeout: 120000 })
    const text = `${out.stdout || ''}${out.stderr || ''}${out.error ? String(out.error) : ''}`
    need(out.status === 0, `${SESSION_ENV}=… vt pause ${C.slug} --why … exited ${out.status}: ${text.slice(-300)}`)
    const got = statusOf(stage, C)
    need(!got.error, got.error)
    snaps.C.push(got.list)
    if (got.last && got.last.status === 'paused') pausedAny = true
    need(got.list.length === n0 + 1, `the status list went ${n0} → ${got.list.length} records after one vt pause`)
    const p = recordProblem(got.last, { status: 'paused', via: 'cli', agent: true, why: WHY_AGENT }, F)
    need(!p, `${C.slug}'s latest record: ${p}`)
  })

  // ── the records over all of it, and the boxes ──
  await t(S210[12], async () => {
    const problems = []
    for (const [k, box, n] of [['A', A, 2], ['B', B, 2], ['C', C, 1]]) {
      const lists = snaps[k]
      if (lists.length < n) { problems.push(`${box.slug}: ${lists.length} of its ${n} verbs left a list to compare`); continue }
      for (let i = 1; i < lists.length; i++) {
        const a = lists[i - 1], b = lists[i]
        if (b.length !== a.length + 1 || !a.every((rec, j) => sameJson(rec, b[j]))) problems.push(`${box.slug}: ${JSON.stringify(a).slice(0, 200)} is not kept at the head of ${JSON.stringify(b).slice(0, 300)}`)
      }
      const now = statusOf(stage, box)
      if (now.error) problems.push(now.error)
      else if (!sameJson(now.list, lists[lists.length - 1])) problems.push(`${box.slug}: its list changed after its last verb`)
    }
    for (const box of F.boxes) {
      if ([A, B, C].includes(box)) continue
      const s = statusOf(stage, box)
      if (s.error) { if (!/no entry/.test(s.error)) problems.push(s.error); continue }
      if (s.last && s.last.status !== 'active') problems.push(`${box.slug} was never paused and reads ${JSON.stringify(s.last.status)}`)
    }
    need(!problems.length, problems.join('; '))
  })
  await t(S210[13], async () => {
    need(pausedAny, 'no pause took effect (no paused record from the page or vt pause), so untouched boxes prove nothing')
    const problems = []
    for (const box of F.boxes) {
      const changed = changedFiles(before[box.slug], hashTree(box.path, ['.git']))
      if (changed.length) problems.push(`${box.slug}: ${changed.join(', ')}`)
      const st = stage.git(box.path, ['status', '--porcelain'])
      if (st.code !== 0 || st.out !== '') problems.push(`${box.slug} git status: ${st.out || st.err}`)
      const head = stage.git(box.path, ['rev-parse', 'HEAD'])
      if (head.out !== box.head) problems.push(`${box.slug} HEAD ${box.head.slice(0, 7)} → ${head.out.slice(0, 7)}`)
    }
    need(!problems.length, problems.join('; '))
  })
})
