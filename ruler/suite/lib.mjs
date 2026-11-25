// The acceptance suite's shared parts (OBJECTIVES §7): the version's `vt serve` started and stopped by pid, HOME put
// back before each group, and the page read the way a person sees it: by visible text, ARIA roles and measured boxes
// (getBoundingClientRect, computed styles), never by a class name or test id of any one version. Pointer and keys are
// real (Playwright mouse and keyboard).
import { spawn, spawnSync } from 'node:child_process'
import { appendFileSync, existsSync, openSync, readFileSync, readdirSync, rmSync, statSync, closeSync } from 'node:fs'
import { join, relative } from 'node:path'
import { createHash } from 'node:crypto'

export class Fail extends Error {}
export const need = (ok, message) => { if (!ok) throw new Fail(message) }
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Poll fn until it returns a truthy value or the time runs out; returns the value or null. */
export async function waitFor(fn, timeoutMs = 5000, everyMs = 100) {
  const end = Date.now() + timeoutMs
  for (;;) {
    let v = null
    try { v = await fn() } catch (e) { v = null }
    if (v) return v
    if (Date.now() >= end) return null
    await sleep(everyMs)
  }
}

// ── the page helper, installed into every frame before the page's own scripts ────────────────────────────────
export const PAGE_HELPER = String.raw`(() => {
  if (window.__vta) return
  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim()
  const parentOf = (el) => el.parentElement || (el.getRootNode && el.getRootNode() instanceof ShadowRoot ? el.getRootNode().host : null)
  function* deep(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT)
    let n = walker.currentNode
    while (n) {
      if (n.nodeType === 1) { yield n; if (n.shadowRoot) yield* deep(n.shadowRoot) }
      n = walker.nextNode()
    }
  }
  const all = () => [...deep(document.documentElement)]
  const rect = (el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, l: r.left, t: r.top, r: r.right, b: r.bottom } }
  function vis(el) {
    if (!el || !el.isConnected) return false
    const r = el.getBoundingClientRect()
    if (r.width <= 0 || r.height <= 0) return false
    if (r.bottom <= 0 || r.right <= 0 || r.top >= innerHeight || r.left >= innerWidth) return false
    if (el.checkVisibility && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true })) return false
    for (let a = el; a; a = parentOf(a)) { const cs = getComputedStyle(a); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false }
    return true
  }
  const ownText = (el) => norm([...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.data).join(' '))
  const fullText = (el) => {
    const parts = []
    const walk = (n) => { for (const c of n.childNodes) { if (c.nodeType === 3) parts.push(c.data); else if (c.nodeType === 1) { const cs = getComputedStyle(c); if (cs.display !== 'none') walk(c) } } if (n.shadowRoot) walk(n.shadowRoot) }
    walk(el)
    return norm(parts.join(' '))
  }
  function findText(text, exact = true) {
    const want = norm(text), out = []
    for (const el of all()) {
      if (['SCRIPT', 'STYLE', 'TEMPLATE', 'TITLE', 'HEAD'].includes(el.tagName)) continue
      const own = ownText(el)
      let hit = exact ? own === want : own.includes(want)
      if (!hit && el.children.length && el.children.length <= 4) {
        const full = fullText(el)
        hit = exact ? full === want && ![...el.children].some((c) => fullText(c) === want) : false
      }
      if (hit && vis(el)) out.push(el)
    }
    return out
  }
  function sidebar() {
    const home = findText('Home').filter((e) => e.getBoundingClientRect().left < innerWidth * 0.4)
      .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)[0]
    if (home) {
      let best = null
      for (let a = home; a; a = parentOf(a)) {
        const r = a.getBoundingClientRect()
        if (r.width > innerWidth * 0.55) break
        if (r.height >= innerHeight * 0.6) best = a
      }
      if (best) return rect(best)
      return { x: 0, y: 0, w: home.getBoundingClientRect().right + 40, h: innerHeight, l: 0, t: 0, r: home.getBoundingClientRect().right + 40, b: innerHeight }
    }
    return { x: 0, y: 0, w: innerWidth * 0.3, h: innerHeight, l: 0, t: 0, r: innerWidth * 0.3, b: innerHeight }
  }
  const inside = (r, box, tol = 2) => r.l >= box.l - tol && r.r <= box.r + tol && r.t >= box.t - tol && r.b <= box.b + tol
  function rowOf(el, maxH = 48) {
    const side = sidebar()
    let row = el
    for (let a = parentOf(el); a; a = parentOf(a)) {
      const r = a.getBoundingClientRect()
      if (r.height > maxH || r.width > side.w + 2) break
      row = a
    }
    return row
  }
  function attrsUp(el, stop) {
    const out = {}
    for (let a = el; a && a !== stop; a = parentOf(a)) {
      for (const k of ['aria-selected', 'aria-current', 'aria-expanded', 'aria-level', 'role', 'draggable']) if (out[k] == null && a.getAttribute && a.getAttribute(k) != null) out[k] = a.getAttribute(k)
      if (a.getBoundingClientRect().height > 60) break
    }
    return out
  }
  function sideTitle(title) {
    const side = sidebar()
    const els = findText(title).filter((e) => inside(rect(e), side, 4))
    if (!els.length) return null
    const el = els[0], row = rowOf(el)
    return { el, row }
  }
  function rowInfo(title) {
    const f = sideTitle(title)
    if (!f) return null
    const tr = rect(f.el), rr = rect(f.row)
    return { title, text: tr, row: rr, attrs: attrsUp(f.el, null), rowText: fullText(f.row) }
  }
  const parseColor = (c) => { const m = (c || '').match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 } }
  function effBgAt(x, y) {
    let el = document.elementFromPoint(x, y)
    while (el && el.shadowRoot) { const inner = el.shadowRoot.elementFromPoint(x, y); if (!inner || inner === el) break; el = inner }
    const layers = []
    for (let a = el; a; a = parentOf(a)) { const c = parseColor(getComputedStyle(a).backgroundColor); if (c && c.a > 0) layers.push(c) }
    const scheme = getComputedStyle(document.documentElement).colorScheme || ''
    let base = /dark/.test(scheme) && !/light/.test(scheme) ? { r: 18, g: 18, b: 18 } : { r: 255, g: 255, b: 255 }
    for (const c of layers.reverse()) base = { r: c.r * c.a + base.r * (1 - c.a), g: c.g * c.a + base.g * (1 - c.a), b: c.b * c.a + base.b * (1 - c.a) }
    return { r: Math.round(base.r), g: Math.round(base.g), b: Math.round(base.b), el: el ? el.tagName.toLowerCase() : null }
  }
  function pillAt(x, y, maxH = 48) {
    let el = document.elementFromPoint(x, y)
    while (el && el.shadowRoot) { const inner = el.shadowRoot.elementFromPoint(x, y); if (!inner || inner === el) break; el = inner }
    for (let a = el; a; a = parentOf(a)) {
      const r = a.getBoundingClientRect()
      if (r.height > maxH) break
      const c = parseColor(getComputedStyle(a).backgroundColor)
      if (c && c.a > 0) { const cs = getComputedStyle(a); return { rect: rect(a), radius: parseFloat(cs.borderTopLeftRadius) || 0, bg: c } }
    }
    return null
  }
  const label = (el) => norm([el.getAttribute('aria-label'), el.getAttribute('title'), ownText(el), fullText(el)].filter(Boolean).join(' '))
  const buttonish = (el) => el.tagName === 'BUTTON' || ['button', 'menuitem'].includes(el.getAttribute('role')) || el.hasAttribute('aria-haspopup')
  function moreIn(box) {
    const out = []
    for (const el of all()) {
      if (!buttonish(el) || !vis(el)) continue
      const r = rect(el)
      if (!inside(r, box, 3)) continue
      const l = label(el)
      if (/more|option|action|menu|···|…|⋯|\.\.\./i.test(l) || (el.getAttribute('aria-haspopup') || '').match(/menu|true/)) out.push(r)
    }
    out.sort((a, b) => b.r - a.r)
    return out[0] || null
  }
  function dotIn(box, before) {
    const out = []
    for (const el of all()) {
      if (!vis(el)) continue
      const r = rect(el)
      if (!inside(r, box, 1) || r.w < 3 || r.w > 12 || r.h < 3 || r.h > 12 || Math.abs(r.w - r.h) > 1.5) continue
      if (before != null && r.r > before + 1) continue
      const cs = getComputedStyle(el)
      const round = parseFloat(cs.borderTopLeftRadius) >= r.w * 0.4 || el.tagName.toLowerCase() === 'circle' || (el.tagName.toLowerCase() === 'svg' && el.querySelector('circle'))
      const painted = (parseColor(cs.backgroundColor) || { a: 0 }).a > 0 || parseFloat(cs.borderTopWidth) > 0 || el.tagName.toLowerCase() === 'svg' || el.tagName.toLowerCase() === 'circle'
      if (round && painted) out.push(r)
    }
    out.sort((a, b) => a.l - b.l)
    return out[0] || null
  }
  function controlsIn(box, leftOf) {
    const out = []
    for (const el of all()) {
      if (!vis(el)) continue
      const r = rect(el)
      if (!inside(r, box, 2) || r.r > leftOf + 1 || r.w > 28 || r.h > 28) continue
      const tag = el.tagName.toLowerCase()
      if (buttonish(el) || el.hasAttribute('aria-expanded') || (tag === 'svg' && r.w >= 6)) out.push(r)
    }
    return out
  }
  function menuInfo(m) {
    const items = [], seps = []
    for (const el of deep(m)) {
      if (el === m || !vis(el)) continue
      const role = el.getAttribute('role')
      if (role === 'separator' || el.tagName === 'HR') { seps.push(rect(el)); continue }
      if (['menuitem', 'menuitemcheckbox', 'menuitemradio', 'option'].includes(role)) items.push(el)
    }
    let list = items
    if (!list.length) {
      list = [...m.children].filter((c) => vis(c) && fullText(c) && c.getBoundingClientRect().height >= 14 && c.getBoundingClientRect().height <= 60)
      for (const c of m.children) { const r = c.getBoundingClientRect(); if (vis(c) && r.height <= 3 && r.width >= m.getBoundingClientRect().width * 0.4) seps.push(rect(c)) }
    }
    const out = list.map((el) => {
      const tokens = []
      const walk = (n) => { for (const c of n.childNodes) { if (c.nodeType === 3) { const t = norm(c.data); if (t) tokens.push(t) } else if (c.nodeType === 1 && vis(c)) walk(c) } if (n.shadowRoot) walk(n.shadowRoot) }
      walk(el)
      const clean = tokens.filter((t) => !/^[›>▸❯→]$/.test(t))
      let shortcut = el.getAttribute('aria-keyshortcuts') || null
      if (clean.length > 1 && /^[A-Z]$/.test(clean[clean.length - 1])) shortcut = shortcut || clean.pop()
      else if (clean.length > 1 && shortcut && clean[clean.length - 1].toUpperCase() === shortcut.toUpperCase()) clean.pop()
      const cs = getComputedStyle(el)
      let color = parseColor(cs.color)
      const first = [...deep(el)].find((c) => vis(c) && ownText(c) === clean[0])
      if (first) color = parseColor(getComputedStyle(first).color)
      return { label: clean[0] || '', value: clean.slice(1).join(' '), shortcut, rect: rect(el), color,
        disabled: el.getAttribute('aria-disabled') === 'true' || el.disabled === true, hasPopup: el.hasAttribute('aria-haspopup') || /›|>|▸/.test(tokens.join(' ')) }
    })
    for (const it of out) it.sepBefore = seps.some((s) => s.t <= it.rect.t && s.t >= it.rect.t - 14)
    return { rect: rect(m), items: out, seps: seps.length }
  }
  const seen = new WeakSet()
  function menus() {
    const roleMenus = all().filter((el) => ['menu', 'listbox'].includes(el.getAttribute('role')) && vis(el) && el.getBoundingClientRect().height > 20)
    let list = roleMenus
    if (!list.length) {
      list = all().filter((el) => { if (!vis(el)) return false; const cs = getComputedStyle(el); const r = el.getBoundingClientRect(); return (cs.position === 'fixed' || cs.position === 'absolute') && r.width >= 80 && r.width <= 500 && r.height >= 40 && r.height <= 900 && el.children.length >= 2 && !seen.has(el) })
    }
    return list.map(menuInfo)
  }
  function markFloating() { for (const el of all()) { const cs = getComputedStyle(el); if (cs.position === 'fixed' || cs.position === 'absolute') seen.add(el) } }
  function dialogs() {
    return all().filter((el) => (el.getAttribute('role') === 'dialog' || el.getAttribute('role') === 'alertdialog' || el.getAttribute('aria-modal') === 'true' || (el.tagName === 'DIALOG' && el.open)) && vis(el))
      .map((el) => ({ rect: rect(el), text: fullText(el).slice(0, 2000) }))
  }
  window.__vta = { norm, all, vis, rect, findText, fullText, ownText, sidebar, rowOf, rowInfo, sideTitle, effBgAt, pillAt, moreIn, dotIn, controlsIn, menus, markFloating, dialogs, inside, parentOf, label }
})()`

// ── the version's server, by pid ──────────────────────────────────────────────────────────────────────────────
export class Stage {
  constructor({ runDir, port, env, home, pristine, fixture }) {
    Object.assign(this, { runDir, port, env, home, pristine, fixture })
    this.vt = join(runDir, 'bin', 'vt')
    this.child = null
    this.base = `http://127.0.0.1:${port}/`
  }
  restore() {
    if (this.child) throw new Error('restore while vt serve runs')
    rmSync(this.home, { recursive: true, force: true })
    const out = spawnSync('cp', ['-a', this.pristine, this.home])
    if (out.status !== 0) throw new Error(`restore HOME: ${out.stderr}`)
  }
  async start() {
    const fd = openSync(join(this.runDir, 'serve.log'), 'a')
    appendFileSync(join(this.runDir, 'serve.log'), `\n=== vt serve --port ${this.port} at ${new Date().toISOString()}\n`)
    const child = spawn(this.vt, ['serve', '--port', String(this.port)], { cwd: this.home, env: this.env, detached: true, stdio: ['ignore', fd, fd] })
    closeSync(fd)
    this.child = child
    child.on('exit', () => { if (this.child === child) this.child = null })
    appendFileSync(join(this.runDir, 'pids.jsonl'), JSON.stringify({ pid: child.pid, what: 'vt serve', t: Date.now() }) + '\n')
    const end = Date.now() + 60000
    while (Date.now() < end) {
      if (child.exitCode != null || this.child !== child) throw new Error(`vt serve exited with ${child.exitCode} (serve.log)`)
      try { const r = await fetch(this.base, { signal: AbortSignal.timeout(2000) }); if (r.status < 500) return } catch (e) { /* not up */ }
      await sleep(150)
    }
    await this.stop()
    throw new Error(`vt serve did not answer on ${this.base} within 60 s`)
  }
  async stop() {
    const child = this.child
    if (!child) return
    const gone = new Promise((r) => child.once('exit', r))
    try { process.kill(-child.pid, 'SIGTERM') } catch (e) { try { child.kill('SIGTERM') } catch (e2) { /* gone */ } }
    const quiet = await Promise.race([gone.then(() => true), sleep(8000).then(() => false)])
    if (!quiet) { try { process.kill(-child.pid, 'SIGKILL') } catch (e) { /* gone */ } await Promise.race([gone, sleep(3000)]) }
    this.child = null
  }
  /** `vt <args>` with the run's environment, from HOME. */
  vtRun(args, timeoutMs = 120000) {
    const out = spawnSync(this.vt, args, { cwd: this.home, env: this.env, encoding: 'utf8', timeout: timeoutMs })
    return { code: out.status, out: `${out.stdout || ''}${out.stderr || ''}${out.error ? String(out.error) : ''}` }
  }
  git(dir, args) {
    const out = spawnSync('git', ['-C', dir, ...args], { env: this.env, encoding: 'utf8' })
    return { code: out.status, out: (out.stdout || '').trim(), err: (out.stderr || '').trim() }
  }
}

// ── the page ──────────────────────────────────────────────────────────────────────────────────────────────────
export async function newPage(browser, stage, { width = 1400, height = 900, scheme = 'light' } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, colorScheme: scheme, bypassCSP: true })
  await context.addInitScript({ content: PAGE_HELPER })
  try { await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: stage.base.replace(/\/$/, '') }) } catch (e) { /* older browsers */ }
  const page = await context.newPage()
  page.on('pageerror', (e) => { stage.pageErrors = (stage.pageErrors || 0) + 1; appendFileSync(join(stage.runDir, 'page-errors.log'), `${e.message}\n`) })
  return { context, page }
}

/** Load the page and wait until the sidebar shows "Home" and, when the tree was handed over, a box's row. */
export async function load(page, stage, titles = []) {
  await page.goto(stage.base, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await waitFor(() => page.evaluate((ts) => {
    if (!window.__vta) return false
    if (!window.__vta.findText('Home').length) return false
    return !ts.length || ts.some((t) => window.__vta.rowInfo(t))
  }, titles), 25000, 200)
  await settle(page)
}

/** Wait until the page has not changed its DOM for `quietMs` (at most `capMs`). */
export async function settle(page, quietMs = 300, capMs = 4000) {
  await page.evaluate(([quiet, cap]) => new Promise((resolve) => {
    let timer = setTimeout(done, quiet)
    const obs = new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(done, quiet) })
    const stop = setTimeout(done, cap)
    function done() { obs.disconnect(); clearTimeout(stop); clearTimeout(timer); resolve() }
    obs.observe(document.documentElement, { childList: true, subtree: true, attributes: true })
  }), [quietMs, capMs]).catch(() => {})
}

export const H = (page, fn, arg) => page.evaluate(fn, arg)
export const row = (page, title) => page.evaluate((t) => window.__vta.rowInfo(t), title)
export async function rows(page, titles) {
  const out = await page.evaluate((ts) => ts.map((t) => window.__vta.rowInfo(t)).filter(Boolean), titles)
  return out.sort((a, b) => a.row.y - b.row.y)
}
export const center = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 })
export const sidebar = (page) => page.evaluate(() => window.__vta.sidebar())
export async function sideText(page, text) {
  return page.evaluate((t) => {
    const side = window.__vta.sidebar()
    const els = window.__vta.findText(t).filter((e) => window.__vta.inside(window.__vta.rect(e), side, 4))
    return els.length ? { text: window.__vta.rect(els[0]), row: window.__vta.rect(window.__vta.rowOf(els[0])), rowText: window.__vta.fullText(window.__vta.rowOf(els[0])) } : null
  }, text)
}
/** Visible text anywhere right of the sidebar, in the page or any frame; boxes in page coordinates. */
export async function mainText(page, text, exact = false) {
  const side = await sidebar(page)
  for (const frame of page.frames()) {
    let offset = { x: 0, y: 0 }
    if (frame !== page.mainFrame()) {
      try {
        const handle = await frame.frameElement()
        const box = await handle.boundingBox()
        if (!box) continue
        offset = { x: box.x, y: box.y }
      } catch (e) { continue }
    }
    let hits = []
    try {
      hits = await frame.evaluate(([t, ex]) => (window.__vta ? window.__vta.findText(t, ex).map((e) => window.__vta.rect(e)) : []), [text, exact])
    } catch (e) { continue }
    for (const h of hits) {
      const r = { x: h.x + offset.x, y: h.y + offset.y, w: h.w, h: h.h }
      if (r.x >= side.r - 2 && r.w > 0 && r.h > 0 && r.y < 2000) return r
    }
  }
  return null
}
export const url = (page) => decodeURIComponent(page.url())
export const nameForms = (box) => [box.slug, box.slug.replace(/_/g, '-'), box.title, box.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')].map((s) => s.toLowerCase())
export const urlNames = (u, box) => { const l = u.toLowerCase(); return nameForms(box).some((n) => l.includes(n)) }

export async function hoverRow(page, title) {
  const r = await row(page, title)
  if (!r) return null
  await page.mouse.move(r.row.x + 12, r.row.y + r.row.h / 2, { steps: 3 })
  await sleep(250)
  return row(page, title)
}
export async function moreButton(page, title) {
  const r = await hoverRow(page, title)
  if (!r) return null
  const box = { l: r.row.x, r: r.row.x + r.row.w, t: r.row.y, b: r.row.y + r.row.h }
  return page.evaluate((b) => window.__vta.moreIn(b), box)
}
export async function menusNow(page) { return page.evaluate(() => window.__vta.menus()) }
export async function closeMenus(page) {
  for (let i = 0; i < 3; i++) {
    if (!(await menusNow(page)).length) return
    await page.keyboard.press('Escape')
    await sleep(150)
  }
  if ((await menusNow(page)).length) { const s = await sidebar(page); await page.mouse.click(s.r + 200, 880); await sleep(200) }
}
/** Open a row's ··· menu with a real click; returns the menu (labels, shortcuts, separators, boxes) or null. */
export async function openRowMenu(page, title) {
  await closeMenus(page)
  await page.evaluate(() => window.__vta.markFloating())
  const b = await moreButton(page, title)
  if (!b) return null
  await page.mouse.click(b.x + b.w / 2, b.y + b.h / 2)
  const m = await waitFor(async () => (await menusNow(page)).slice(-1)[0], 2500)
  return m ? { ...m, button: b } : null
}
/** Right-click a row's title with a real pointer; returns {menu, at, prevented}. */
export async function rightClickRow(page, title) {
  await closeMenus(page)
  await page.evaluate(() => window.__vta.markFloating())
  const r = await row(page, title)
  if (!r) return null
  await page.evaluate(() => { window.__vtaCtx = null; window.addEventListener('contextmenu', (e) => { window.__vtaCtx = { prevented: e.defaultPrevented } }, { once: true }) })
  const at = { x: Math.round(r.text.x + Math.min(20, r.text.w / 2)), y: Math.round(r.row.y + r.row.h / 2) }
  await page.mouse.click(at.x, at.y, { button: 'right' })
  const m = await waitFor(async () => (await menusNow(page)).slice(-1)[0], 2500)
  const ctx = await page.evaluate(() => window.__vtaCtx)
  return { menu: m, at, prevented: !!(ctx && ctx.prevented) }
}
export const labels = (menu) => (menu ? menu.items.map((i) => i.label) : [])
export function itemOf(menu, re) { return menu ? menu.items.find((i) => re.test(i.label)) || null : null }
export async function clickItem(page, item) { await page.mouse.click(item.rect.x + Math.min(30, item.rect.w / 2), item.rect.y + item.rect.h / 2) }
/** Hover a submenu item and read the menu that opens beside it. */
export async function submenu(page, item) {
  const before = (await menusNow(page)).length
  await page.mouse.move(item.rect.x + 20, item.rect.y + item.rect.h / 2, { steps: 4 })
  let m = await waitFor(async () => { const ms = await menusNow(page); return ms.length > before ? ms[ms.length - 1] : null }, 1500)
  if (!m) {
    await page.mouse.click(item.rect.x + 20, item.rect.y + item.rect.h / 2)
    m = await waitFor(async () => { const ms = await menusNow(page); return ms.length > before ? ms[ms.length - 1] : null }, 1500)
  }
  return m
}
/** Run a row menu item by its label (first match of re); returns true when the item was found and clicked. */
export async function rowMenuAction(page, title, re) {
  const m = await openRowMenu(page, title)
  const it = itemOf(m, re)
  if (!it) { await closeMenus(page); return false }
  await clickItem(page, it)
  await sleep(300)
  return true
}
export async function dialogs(page) { return page.evaluate(() => window.__vta.dialogs()) }

/** The visible sidebar rows of the given titles, ordered by y, each with its indent (the title's left edge). */
export async function order(page, titles) { return (await rows(page, titles)).map((r) => ({ title: r.title, x: Math.round(r.text.x), y: r.row.y, row: r.row })) }
/** True when child sits in parent's block, indented under it. */
export function under(list, child, parent) {
  const i = list.findIndex((r) => r.title === child), p = list.findIndex((r) => r.title === parent)
  if (i < 0 || p < 0 || i <= p) return false
  if (!(list[i].x > list[p].x + 4)) return false
  for (let k = p + 1; k < i; k++) if (list[k].x <= list[p].x + 1) return false
  return true
}
export const indentOf = (list, title) => { const r = list.find((x) => x.title === title); return r ? r.x : null }

// ── files ─────────────────────────────────────────────────────────────────────────────────────────────────────
/** {relative path: sha256} of every file under dir (skipping the named top-level folders). */
export function hashTree(dir, skip = []) {
  const out = {}
  const walk = (d) => {
    let entries = []
    try { entries = readdirSync(d, { withFileTypes: true }) } catch (e) { return }
    for (const e of entries) {
      const p = join(d, e.name)
      const rel = relative(dir, p)
      if (skip.some((s) => rel === s || rel.startsWith(s + '/'))) continue
      if (e.isDirectory()) walk(p)
      else if (e.isFile()) { try { out[rel] = createHash('sha256').update(readFileSync(p)).digest('hex') } catch (err) { /* vanished */ } }
    }
  }
  walk(dir)
  return out
}
export function changedFiles(a, b) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  return [...keys].filter((k) => a[k] !== b[k]).sort()
}
export function listFiles(dir) { return Object.keys(hashTree(dir, ['.git'])).sort() }
export function readmeHeading(dir) {
  try { const line = readFileSync(join(dir, 'README.md'), 'utf8').split('\n').find((l) => l.startsWith('# ')); return line ? line.slice(2).trim() : null } catch (e) { return null }
}
/** Git repos under HOME (two levels) whose README's first heading is `title`. */
export function boxesTitled(home, title) {
  const out = []
  const look = (d, depth) => {
    let entries = []
    try { entries = readdirSync(d, { withFileTypes: true }) } catch (e) { return }
    for (const e of entries) {
      if (!e.isDirectory() || e.name === '.git' || e.name === 'node_modules') continue
      const p = join(d, e.name)
      if (existsSync(join(p, '.git')) && readmeHeading(p) === title) out.push(p)
      if (depth < 2 && !e.name.startsWith('.')) look(p, depth + 1)
    }
  }
  look(home, 0)
  return out
}
export const isDir = (p) => { try { return statSync(p).isDirectory() } catch (e) { return false } }

// ── checks ────────────────────────────────────────────────────────────────────────────────────────────────────
/** A group of checks that share one fresh state (HOME restored, a new vt serve, a new page). */
export function group(name, checks, run) { return { name, checks, run } }
