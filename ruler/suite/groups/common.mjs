// What several groups share: the fixture's roles, the view menu, drags, the box files.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  Fail, need, sleep, waitFor, row, rows, order, under, sideText, sidebar, menusNow, closeMenus, itemOf, clickItem,
  submenu, settle, center,
} from '../lib.mjs'

export const byRole = (F, role) => F.boxes.filter((b) => b.roles.includes(role))
export const one = (F, role) => { const b = byRole(F, role)[0]; if (!b) throw new Error(`fixture has no ${role} box`); return b }
export const bySlug = (F, slug) => F.boxes.find((b) => b.slug === slug)
export const descendants = (F, slug) => {
  const out = []
  const walk = (s) => { for (const b of F.boxes) if (b.parent === s) { out.push(b); walk(b.slug) } }
  walk(slug)
  return out
}
export const topLevel = (F) => F.boxes.filter((b) => !b.parent)
export const leavesTop = (F) => F.boxes.filter((b) => !b.parent && (b.roles.includes('nosite') || b.roles.includes('top_leaf')))
export const fmt = (list) => list.map((r) => `${r.title}@${r.x}`).join(', ')
export const shape = (list) => list.map((r) => `${r.title}@${r.x}`).join('|')

/** Click a row's title (a real click) and give the page a moment. */
export async function clickTitle(page, title) {
  const r = await row(page, title)
  if (!r) return false
  await page.mouse.click(r.text.x + Math.min(12, r.text.w / 2), r.text.y + r.text.h / 2)
  await sleep(400)
  await settle(page, 250, 2500)
  return true
}
export async function clickSide(page, text) {
  const s = await sideText(page, text)
  if (!s) return false
  await page.mouse.click(s.text.x + Math.min(10, s.text.w / 2), s.text.y + s.text.h / 2)
  await sleep(400)
  await settle(page, 250, 2500)
  return true
}

// ── the view menu (S2.6) ────────────────────────────────────────────────────────────────────────────────────────
/** The tracks list's view button: a control in the sidebar, outside every track row, named filter/view/group/sort/
 *  display/options, nearest above the first track row (hovering the list header first, as Claude shows it on hover). */
export async function viewButton(page, titles) {
  const list = await rows(page, titles)
  const side = await sidebar(page)
  const firstY = list.length ? list[0].row.y : side.t + 200
  await page.mouse.move(side.l + side.w / 2, Math.max(side.t + 5, firstY - 14), { steps: 2 })
  await sleep(250)
  return page.evaluate(([firstY, rowBoxes]) => {
    const V = window.__vta, side = V.sidebar()
    const inRow = (r) => rowBoxes.some((b) => r.t >= b.y - 2 && r.b <= b.y + b.h + 2)
    const cands = []
    for (const el of V.all()) {
      if (!V.vis(el)) continue
      const isBtn = el.tagName === 'BUTTON' || el.getAttribute('role') === 'button' || el.hasAttribute('aria-haspopup')
      if (!isBtn) continue
      const r = V.rect(el)
      if (!V.inside(r, side, 2) || inRow(r)) continue
      const l = V.label(el)
      if (!/filter|view|group|sort|display|option|organi[sz]e/i.test(l)) continue
      if (/^(home|review|feedback|new track)$/i.test(V.fullText(el))) continue
      cands.push({ r, d: Math.abs(firstY - r.b), above: r.b <= firstY + 2 })
    }
    cands.sort((a, b) => (b.above - a.above) || a.d - b.d)
    return cands.length ? cands[0].r : null
  }, [firstY, list.map((x) => x.row)])
}
export async function openViewMenu(page, titles) {
  await closeMenus(page)
  await page.evaluate(() => window.__vta.markFloating())
  const b = await viewButton(page, titles)
  if (!b) return null
  await page.mouse.click(b.x + b.w / 2, b.y + b.h / 2)
  return waitFor(async () => (await menusNow(page)).slice(-1)[0], 2500)
}
/** Group by / Sort by: open the view menu, open the submenu, click the option. True when every step was found. */
export async function pickView(page, titles, what, option) {
  const m = await openViewMenu(page, titles)
  const it = itemOf(m, new RegExp(`^${what}$`, 'i'))
  if (!it) { await closeMenus(page); return false }
  const sub = await submenu(page, it)
  const opt = itemOf(sub, new RegExp(`^${option}$`, 'i'))
  if (!opt) { await closeMenus(page); return false }
  await clickItem(page, opt)
  await sleep(400)
  await closeMenus(page)
  await settle(page, 250, 2500)
  return true
}

// ── drags (S2.8) ────────────────────────────────────────────────────────────────────────────────────────────────
/** A real pointer drag: press on `from`, move in steps to `to`, call probe() mid-drag, release. */
export async function drag(page, from, to, probe = null) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x + 3, from.y + 6, { steps: 3 })
  await page.mouse.move(to.x, to.y, { steps: 14 })
  await sleep(350)
  await page.mouse.move(to.x, to.y + 0.5, { steps: 1 })
  await sleep(150)
  const mid = probe ? await probe() : null
  await page.mouse.up()
  await sleep(700)
  await settle(page, 300, 3000)
  return mid
}
/** Thin bars (a drop line) or newly outlined/filled rows near y, that were not there before the drag. */
export async function thinBars(page) {
  return page.evaluate(() => {
    const V = window.__vta, side = V.sidebar()
    return V.all().filter((el) => V.vis(el)).map((el) => V.rect(el)).filter((r) => V.inside(r, side, 4) && r.h <= 4 && r.w >= 40)
      .map((r) => ({ x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: r.h }))
  })
}

// ── the ruler v3 stage boxes (fold, speed) ──────────────────────────────────────────────────────────────────────
/** Ruler v3: stop vt serve, hand the version the four package boxes (a parent, two sub-tracks, a grandchild) and then
 *  the extra box with its own `vt add` (S1.5's verb, parents first, as ruler/stage.py hands over the rest), start a
 *  fresh vt serve. Only the fold and speed groups do this, so every v2 group sees the v2 tree. Returns each `vt add`'s
 *  {args, code, out}; a version without `vt add` gets nothing added (its checks fail saying so). */
export async function addStageBoxes(ctx) {
  const { stage, F } = ctx
  await stage.stop()
  const steps = []
  for (const box of [...(F.package_boxes || []), F.extra]) {
    const args = ['add', box.path.replace(F.home, stage.home), ...(box.parent ? ['--parent', box.parent] : [])]
    const out = stage.vtRun(args)
    steps.push({ args: args.slice(0, 1).concat(box.slug, args.slice(2)), code: out.code, out: out.out.slice(-300) })
  }
  await stage.start()
  return steps
}

// ── box files ───────────────────────────────────────────────────────────────────────────────────────────────────
export function walkNames(dir) {
  const out = []
  const walk = (d) => { let es = []; try { es = readdirSync(d, { withFileTypes: true }) } catch (e) { return } for (const e of es) { const p = join(d, e.name); out.push(p); if (e.isDirectory()) walk(p) } }
  walk(dir)
  return out
}
export const readText = (p) => { try { return readFileSync(p, 'utf8') } catch (e) { return null } }
export { Fail, need, sleep, waitFor, row, rows, order, under, center }
