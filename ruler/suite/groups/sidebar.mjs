// S2.1 top rows, S2.2 pixel parity with Claude's sidebar (ruler/reference/claude-sidebar.json), S2.9 row anatomy,
// and the page_ready_ms diagnostic.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { group, need, sleep, waitFor, row, rows, order, sideText, sidebar, url, urlNames, hoverRow, dialogs, closeMenus, settle, rowMenuAction } from '../lib.mjs'
import { byRole, one, clickTitle, clickSide } from './common.mjs'

const REF = JSON.parse(readFileSync(join(fileURLToPath(new URL('../../reference/', import.meta.url)), 'claude-sidebar.json'), 'utf8'))
const THEMES = ['light', 'dark']
const styleName = (theme, c) => `S2.2 ${theme}: ${c.name}`
const STYLE_CHECKS = THEMES.flatMap((theme) => REF.checks.filter((c) => c.themes.includes(theme)).map((c) => ({ theme, c, name: styleName(theme, c) })))
const TOPS = ['Home', 'Review', 'Feedback', 'New track']

const S21 = ['S2.1 Home, Review, Feedback, New track in this order above the first track row', 'S2.1 Feedback shows its open count',
  'S2.1 each top row opens its page']
// ruler v4 (PEP 0004): the chevron at rest left of a parent's title (Obsidian), the status dot at the row's right end (Claude)
const S29 = ["S2.9 the status dot is at the row's right end, nothing left of a leaf's title", "S2.9 a parent's fold chevron shows left of its title at rest",
  'S2.9 a title click opens the track', 'S2.9 a chevron click folds without opening']

const rgb = (c) => (c ? `rgb(${c.r},${c.g},${c.b})` : 'none')
const near = (c, want, tol) => !!c && Math.abs(c.r - want[0]) <= tol && Math.abs(c.g - want[1]) <= tol && Math.abs(c.b - want[2]) <= tol

async function pageReady(ctx) {
  const { page, stage } = ctx
  const t0 = Date.now()
  await page.goto(stage.base, { waitUntil: 'commit', timeout: 30000 }).catch(() => {})
  const done = await waitFor(async () => {
    const r = await sideText(page, 'Review')
    if (!r) return null
    const before = page.url()
    await page.mouse.click(r.text.x + 4, r.text.y + r.text.h / 2)
    const moved = await waitFor(async () => page.url() !== before, 400, 50)
    return moved ? Date.now() - t0 : null
  }, 30000, 100)
  ctx.diag.page_ready_ms = done
}

/** Everything S2.2 measures in one theme, as {check id: {value, ok, note}}. */
async function measure(ctx, theme) {
  const { page, F } = ctx
  const out = {}
  await page.emulateMedia({ colorScheme: theme })
  await page.mouse.move(1300, 880)
  await sleep(400)
  await settle(page, 250, 2000)
  // two adjacent rows at one depth, as shown (b is hovered below; a was opened before, so it is the selected row)
  const leaves = F.boxes.filter((x) => !x.parent && (x.roles.includes('nosite') || x.roles.includes('top_leaf')))
  const a = leaves[0]
  // top-level rows only: Claude's reference row has no indent
  const all0 = await order(page, F.boxes.map((x) => x.title))
  const topX = all0.length ? Math.min(...all0.map((r) => r.x)) : 0
  const shown = all0
  const pair = shown.findIndex((r, i) => i + 1 < shown.length && r.x <= topX + 1 && shown[i + 1].x <= topX + 1 && r.title !== a.title && shown[i + 1].title !== a.title)
  const b = pair >= 0 ? F.boxes.find((x) => x.title === shown[pair + 1].title) : leaves[1]
  const ra = pair >= 0 ? await row(page, shown[pair].title) : null, rb = await row(page, b.title)
  // pitch
  out.row_pitch = ra && rb ? { value: Math.round((rb.row.y - ra.row.y) * 10) / 10, note: `${shown[pair].title} → ${b.title}` } : { value: null, note: 'no two adjacent rows at one depth' }
  // the status dot of a plain row (neither hovered nor selected), anywhere in the row: Claude 3.6556.1 draws it at the
  // row's right end, and since ruler v4 S2.9 asks for the same place (PEP 0004); this check is its size only
  if (ra) {
    const box = { l: ra.row.x, r: ra.row.x + ra.row.w, t: ra.row.y, b: ra.row.y + ra.row.h }
    const dot = await page.evaluate((bx) => window.__vta.dotIn(bx, null), box)
    out.dot_size = dot ? { value: Math.round(Math.max(dot.w, dot.h) * 10) / 10, note: `on ${ra.title}` } : { value: null, note: `no round status dot in ${ra.title}'s row` }
  } else out.dot_size = { value: null, note: 'no plain row' }
  // font
  const font = await page.evaluate((t) => { const f = window.__vta.sideTitle(t); if (!f) return null; const cs = getComputedStyle(f.el); return { size: parseFloat(cs.fontSize), family: cs.fontFamily } }, b.title)
  out.title_font_size = font ? { value: font.size } : { value: null, note: 'no row title found' }
  out.title_font_family = font ? { value: font.family.split(',')[0].replace(/["']/g, '').toLowerCase().replace(/[\s_-]+/g, ''), raw: font.family } : { value: null, note: 'no row title found' }
  // hovered row: pill, radius, inset, fill, ··· button, dot
  const hb = await hoverRow(page, b.title)
  if (hb) {
    const cy = hb.row.y + hb.row.h / 2
    const pill = await page.evaluate(([x, y]) => window.__vta.pillAt(x, y), [hb.row.x + 4, cy])
    out.row_height = pill ? { value: Math.round(pill.rect.h * 10) / 10 } : { value: null, note: 'the hovered row paints no fill' }
    out.row_radius = pill ? { value: pill.radius } : { value: null, note: 'the hovered row paints no fill' }
    out.title_inset = pill ? { value: Math.round((hb.text.x - pill.rect.x) * 10) / 10 } : { value: null, note: 'the hovered row paints no fill' }
    const fill = await page.evaluate(([x, y]) => window.__vta.effBgAt(x, y), [(pill ? pill.rect.x : hb.row.x) + 3, cy])
    out.hover_fill = { value: fill ? [fill.r, fill.g, fill.b] : null, rgb: rgb(fill) }
    const box = { l: hb.row.x, r: hb.row.x + hb.row.w, t: hb.row.y, b: hb.row.y + hb.row.h }
    const more = await page.evaluate((bx) => window.__vta.moreIn(bx), box)
    if (more) {
      const right = pill ? pill.rect.x + pill.rect.w : box.r
      const ok = Math.abs(more.w - 24) <= 2 && Math.abs(more.h - 24) <= 2 && right - (more.x + more.w) <= 8 && right - (more.x + more.w) >= -1 && Math.abs(more.y + more.h / 2 - cy) <= 2
      out.more_button = { value: Math.round(more.w), ok, note: `${Math.round(more.w)}×${Math.round(more.h)} px, ${Math.round(right - (more.x + more.w))} px from the pill's right edge, centre ${Math.round(more.y + more.h / 2 - cy)} px off the row's` }
      await page.mouse.move(more.x + more.w / 2, more.y + more.h / 2, { steps: 2 })
      await sleep(250)
      const mf = await page.evaluate(([x, y]) => window.__vta.effBgAt(x, y), [more.x + 2, more.y + 2])
      out.more_hover_fill = { value: mf ? [mf.r, mf.g, mf.b] : null, rgb: rgb(mf) }
    } else {
      out.more_button = { value: null, note: 'no ··· button in the hovered row' }
      out.more_hover_fill = { value: null, note: 'no ··· button in the hovered row' }
    }
  } else {
    for (const k of ['row_height', 'row_radius', 'title_inset', 'hover_fill', 'more_button', 'more_hover_fill']) out[k] = { value: null, note: `no row for ${b.title}` }
  }
  // selected row (opened before measuring), pointer away
  await page.mouse.move(1300, 880)
  await sleep(300)
  const sel = await row(page, a.title)
  if (sel) {
    const cy = sel.row.y + sel.row.h / 2
    const pill = await page.evaluate(([x, y]) => window.__vta.pillAt(x, y), [sel.row.x + 4, cy])
    const f = await page.evaluate(([x, y]) => window.__vta.effBgAt(x, y), [(pill ? pill.rect.x : sel.row.x) + 3, cy])
    out.selected_fill = { value: f ? [f.r, f.g, f.b] : null, rgb: rgb(f) }
  } else out.selected_fill = { value: null, note: `no row for ${a.title}` }
  // sidebar background, below the last row
  const all = await rows(page, F.boxes.map((x) => x.title))
  const side = await sidebar(page)
  const lastB = all.length ? Math.max(...all.map((r) => r.row.y + r.row.h)) : side.t + 300
  const y = Math.min(lastB + 24, side.b - 80)
  const bg = await page.evaluate(([x, yy]) => window.__vta.effBgAt(x, yy), [side.l + 6, y])
  out.sidebar_bg = { value: bg ? [bg.r, bg.g, bg.b] : null, rgb: rgb(bg) }
  // a section header: Pinned (pinned in the group's setup), else the tracks list's own header
  const header = await page.evaluate(() => {
    const V = window.__vta, side = V.sidebar()
    for (const t of ['Pinned', 'Recents', 'Tracks', 'All tracks', 'Projects']) {
      const el = V.findText(t).find((e) => V.inside(V.rect(e), side, 4))
      if (el) return { text: t, size: parseFloat(getComputedStyle(el).fontSize) }
    }
    return null
  })
  out.header_font_size = header ? { value: header.size, note: `header "${header.text}"` } : { value: null, note: 'no section header (Pinned, Recents, Tracks) in the sidebar' }
  const shot = await sidebar(page)
  await page.screenshot({ path: join(ctx.stage.runDir, `sidebar-${theme}.png`), clip: { x: Math.max(0, shot.x), y: Math.max(0, shot.y), width: Math.max(10, Math.min(shot.w, 600)), height: Math.max(10, Math.min(shot.h, 900)) } }).catch(() => {})
  return out
}

/** On hover: the control left of a row's title that is not its status dot (its fold chevron), or null. */
async function foldControl(page, title) {
  const r = await hoverRow(page, title)
  if (!r) return null
  const box = { l: r.row.x, r: r.row.x + r.row.w, t: r.row.y, b: r.row.y + r.row.h }
  const dot = await page.evaluate(([bx, before]) => window.__vta.dotIn(bx, before), [box, r.text.x])
  const list = (await page.evaluate(([bx, left]) => window.__vta.controlsIn(bx, left), [box, r.text.x]))
    .filter((c) => !dot || Math.abs(c.x - dot.x) > 1 || Math.abs(c.w - dot.w) > 1)
  return list.length ? list[list.length - 1] : null
}

function judge(c, m) {
  if (!m || m.value == null) return { ok: false, why: m && m.note ? m.note : 'not measured' }
  if (c.id === 'more_button') return { ok: !!m.ok, why: m.note }
  if (c.unit === 'rgb') return { ok: near({ r: m.value[0], g: m.value[1], b: m.value[2] }, c.value, c.tol), why: `${m.rgb}` }
  if (c.unit === 'family') return { ok: m.value === c.value, why: `font-family ${m.raw}` }
  return { ok: Math.abs(m.value - c.value) <= c.tol, why: `${m.value} ${c.unit}${m.note ? ' (' + m.note + ')' : ''}` }
}

export default group('sidebar', [...S21, ...STYLE_CHECKS.map((s) => s.name), ...S29], async (ctx, t) => {
  const { page, F } = ctx
  const titles = F.boxes.map((b) => b.title)
  await pageReady(ctx)
  await page.goto(ctx.stage.base, { waitUntil: 'domcontentloaded' })
  await waitFor(() => page.evaluate((ts) => ts.some((x) => window.__vta && window.__vta.rowInfo(x)), titles), 20000, 200)
  await settle(page)

  // ── S2.1 ──
  await t(S21[0], async () => {
    const tops = []
    for (const name of TOPS) tops.push([name, await sideText(page, name)])
    const missing = tops.filter(([, r]) => !r).map(([n]) => n)
    need(!missing.length, `no sidebar row reads ${missing.join(', ')}`)
    const ys = tops.map(([, r]) => r.text.y)
    need(ys.every((y, i) => i === 0 || y > ys[i - 1]), `top rows out of order: ${tops.map(([n, r]) => `${n}@${Math.round(r.text.y)}`).join(', ')}`)
    const list = await rows(page, titles)
    need(list.length, "no track row in the sidebar (looked for the fixture boxes' titles)")
    need(ys[3] < list[0].row.y, `New track (y ${Math.round(ys[3])}) is not above the first track row ${list[0].title} (y ${Math.round(list[0].row.y)})`)
  })
  await t(S21[1], async () => {
    const n = F.boxes.reduce((a, b) => a + b.feedback.length, 0)
    const r = await sideText(page, 'Feedback')
    need(r, 'no Feedback row')
    const rest = r.rowText.replace(/feedback/i, ' ')
    need(new RegExp(`(^|\\D)${n}(\\D|$)`).test(rest), `the Feedback row reads "${r.rowText}"; the fixture has ${n} open feedback notes`)
  })
  await t(S21[2], async () => {
    const seen = []
    for (const name of ['Home', 'Review', 'Feedback']) {
      const before = page.url()
      need(await clickSide(page, name), `no ${name} row`)
      const after = await waitFor(async () => (page.url() !== before || name === 'Home' ? page.url() : null), 3000)
      seen.push([name, after || page.url()])
    }
    const urls = seen.map(([, u]) => u)
    need(new Set(urls).size === 3, `Home, Review and Feedback do not open three pages: ${seen.map(([n, u]) => `${n} → ${u}`).join('; ')}`)
    const before = page.url()
    need(await clickSide(page, 'New track'), 'no New track row')
    const opened = await waitFor(async () => (await dialogs(page)).length || page.url() !== before, 3000)
    need(opened, 'New track opened no dialog and no page')
    await page.keyboard.press('Escape')
    await sleep(200)
  })

  // ── S2.2 ──: pin one done box (a section header to measure), open one row (the selected one)
  const leaves = F.boxes.filter((b) => !b.parent && (b.roles.includes('nosite') || b.roles.includes('top_leaf')))
  const pinMe = byRole(F, 'done_box').find((b) => !b.parent) || byRole(F, 'done_box')[0]
  await rowMenuAction(page, pinMe.title, /^pin$/i).catch(() => false)
  await closeMenus(page)
  await clickTitle(page, leaves[0].title)
  for (const theme of THEMES) {
    const m = await measure(ctx, theme)
    ctx.diag.style[theme] = m
    for (const s of STYLE_CHECKS.filter((x) => x.theme === theme)) {
      await t(s.name, async () => {
        const v = judge(s.c, m[s.c.id])
        need(v.ok, `measured ${v.why}; Claude's is ${Array.isArray(s.c.value) ? `rgb(${s.c.value.join(',')})` : s.c.value + ' ' + s.c.unit} (±${s.c.tol ?? 0})`)
        return v.why
      })
    }
  }
  await page.emulateMedia({ colorScheme: 'light' })
  await sleep(200)

  // ── S2.9 ──
  const leaf = byRole(F, 'top_leaf')[0]
  const parent = one(F, 'rollup_parent')
  const kids = F.boxes.filter((b) => b.parent === parent.slug).map((b) => b.title)
  await t(S29[0], async () => {
    await page.mouse.move(1300, 880)
    await sleep(300)
    const r = await row(page, leaf.title)
    need(r, `no row for ${leaf.title}`)
    const box = { l: r.row.x, r: r.row.x + r.row.w, t: r.row.y, b: r.row.y + r.row.h }
    const dot = await page.evaluate((bx) => window.__vta.dotIn(bx, null), box)
    need(dot, `no round status dot in ${leaf.title}'s row`)
    const gap = box.r - (dot.x + dot.w)
    need(dot.x > r.text.x && gap <= 40, `the dot's right edge is ${Math.round(gap)} px from the row's right end (x ${Math.round(dot.x)}, the title at ${Math.round(r.text.x)}), not at the row's right end`)
    const left = await page.evaluate(([bx, l]) => window.__vta.controlsIn(bx, l), [box, r.text.x])
    need(!left.length, `a leaf shows ${left.length} control(s) left of its title, so it reads as foldable`)
    return `dot ${Math.round(dot.w)} px, ${Math.round(gap)} px from the row's right end`
  })
  let chevron = null
  await t(S29[1], async () => {
    // at rest: the pointer away from the sidebar, nothing hovered or focused there
    await page.mouse.move(1300, 880)
    await sleep(300)
    const r = await row(page, parent.title)
    need(r, `no row for ${parent.title}`)
    const box = { l: r.row.x, r: r.row.x + r.row.w, t: r.row.y, b: r.row.y + r.row.h }
    const dot = await page.evaluate(([bx, before]) => window.__vta.dotIn(bx, before), [box, r.text.x])
    const notDot = (c) => !dot || Math.abs(c.x - dot.x) > 1 || Math.abs(c.w - dot.w) > 1
    const atRest = (await page.evaluate(([bx, left]) => window.__vta.controlsIn(bx, left), [box, r.text.x])).filter(notDot)
    if (atRest.length) chevron = atRest[atRest.length - 1]
    need(atRest.length, `at rest no fold control shows left of ${parent.title}'s title: which rows fold cannot be read from the outside`)
    return `${atRest.length} control(s) left of the title at rest`
  })
  await t(S29[2], async () => {
    const box = byRole(F, 'top_leaf')[1] || leaf
    await clickSide(page, 'Home')
    need(await clickTitle(page, box.title), `no row for ${box.title}`)
    const ok = await waitFor(async () => urlNames(url(page), box), 3000)
    need(ok, `the address bar does not name ${box.title} after a title click: ${url(page)}`)
  })
  await t(S29[3], async () => {
    need(chevron, 'no fold control was found on hover')
    await clickSide(page, 'Home')
    const before = page.url()
    const visible = await rows(page, kids)
    need(visible.length, `${parent.title}'s children are not shown to begin with`)
    const r = await hoverRow(page, parent.title)
    need(r, `no row for ${parent.title}`)
    const fresh = await foldControl(page, parent.title)
    if (fresh) chevron = fresh
    await page.mouse.click(chevron.x + chevron.w / 2, chevron.y + chevron.h / 2)
    const folded = await waitFor(async () => (await rows(page, kids)).length === 0, 2000)
    const after = page.url()
    need(folded, `the chevron click left ${parent.title}'s children showing`)
    need(after === before, `the chevron click also opened a page (${before} → ${after})`)
    await page.mouse.click(chevron.x + chevron.w / 2, chevron.y + chevron.h / 2)
    await sleep(300)
  })
})
