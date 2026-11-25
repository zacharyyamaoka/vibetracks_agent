// S2.3 the ··· menu has Claude's items in Claude's order with its letters; S2.4 a right-click opens the same menu.
import { existsSync } from 'node:fs'
import { group, need, sleep, waitFor, row, rows, sideText, openRowMenu, rightClickRow, closeMenus, labels, menusNow, dialogs, clickItem } from '../lib.mjs'
import { one, byRole } from './common.mjs'
import { order } from '../lib.mjs'

const S24 = ['S2.4 a right-click on a track opens a menu at the pointer', "S2.4 the right-click menu's items equal the ··· menu's"]
const S23 = ["S2.3 a middle row's menu items are Claude's, in Claude's order", 'S2.3 Move up is absent on the first row',
  'S2.3 P pins the track', 'S2.3 U marks it unread or read', 'S2.3 R starts a rename', 'S2.3 F forks the box',
  'S2.3 A archives the track', 'S2.3 D deletes the track', "S2.3 Delete leaves the box's folder on disk"]

// Claude's row menu (Zach's screenshot, Nov 24; spec note S2.3), for an unpinned row; one entry may have two spellings
const CLAUDE = [['Open in'], ['Pin'], ['Mark as unread', 'Mark as read'], ['Rename'], ['Fork'], ['Move up'], ['Move down'],
  ['Move to section'], ['Archive'], ['Delete']]
function sameAsClaude(menu, { first = false } = {}) {
  const want = CLAUDE.filter(([w]) => !(first && w === 'Move up'))
  const got = menu.items.map((i) => i.label)
  const head = got.slice(0, want.length)
  const okHead = head.length === want.length && head.every((g, i) => want[i].includes(g))
  const extras = got.slice(want.length)
  const okTail = !extras.length || menu.items[want.length].sepBefore
  return { ok: okHead && okTail, got, want: want.map((w) => w.join(' / ')), why: okHead ? (okTail ? '' : 'items after Delete with no separator before them') : '' }
}

export default group('menu', [...S24, ...S23], async (ctx, t) => {
  const { page, F } = ctx
  // the first track row and a top-level row with rows above and below, as the sidebar shows them
  const shown = await order(page, F.boxes.map((b) => b.title))
  const topX = shown.length ? Math.min(...shown.map((r) => r.x)) : 0
  const topRows = shown.filter((r) => r.x <= topX + 1)
  const first = { title: shown.length ? shown[0].title : one(F, 'rollup_parent').title }
  const middle = { title: topRows.length >= 3 ? topRows[1].title : one(F, 'chain_top').title }
  let dotsMenu = null
  await t(S24[0], async () => {
    dotsMenu = await openRowMenu(page, middle.title)
    await closeMenus(page)
    const r = await rightClickRow(page, middle.title)
    need(r, `no row for ${middle.title}`)
    need(r.menu, 'a right-click on the row opened no menu')
    need(r.prevented, "the page did not stop the browser's own menu (contextmenu not prevented)")
    const m = r.menu.rect
    const corners = [[m.l, m.t], [m.r, m.t], [m.l, m.b], [m.r, m.b]]
    const d = Math.min(...corners.map(([x, y]) => Math.hypot(x - r.at.x, y - r.at.y)))
    ctx.rightMenu = r.menu
    need(d <= 4, `the menu's nearest corner is ${d.toFixed(1)} px from the pointer (${r.at.x},${r.at.y}); menu at ${Math.round(m.l)},${Math.round(m.t)}`)
    return `${d.toFixed(1)} px`
  })
  await t(S24[1], async () => {
    need(ctx.rightMenu, 'the right-click opened no menu')
    need(dotsMenu, `${middle.title}'s ··· opened no menu`)
    const a = labels(ctx.rightMenu), b = labels(dotsMenu)
    need(a.join('|') === b.join('|'), `right-click: ${a.join(', ')}; ···: ${b.join(', ')}`)
  })
  await closeMenus(page)
  await t(S23[0], async () => {
    need(dotsMenu, `no ··· menu on ${middle.title} (looked for a button named more/options/actions/··· in the hovered row)`)
    const v = sameAsClaude(dotsMenu)
    need(v.ok, `items: ${v.got.join(', ') || 'none'}; Claude's: ${v.want.join(', ')}${v.why ? '; ' + v.why : ''}`)
  })
  await t(S23[1], async () => {
    const m = await openRowMenu(page, first.title)
    await closeMenus(page)
    need(m, `no ··· menu on the first row ${first.title}`)
    const v = sameAsClaude(m, { first: true })
    need(v.ok, `first row: ${v.got.join(', ') || 'none'}; want ${v.want.join(', ')}`)
  })

  // each letter on its own row, the menu open, a real key press
  const pool = F.boxes.filter((b) => b.state !== 'done' && b.title !== first.title && b.title !== middle.title && !b.roles.includes('rollup_parent') && !b.roles.includes('chain_top'))
  const pick = (i) => pool[i % pool.length]
  const others = (b) => F.boxes.filter((x) => x.slug !== b.slug).map((x) => x.title)
  async function withMenu(box, key) {
    const m = await openRowMenu(page, box.title)
    need(m, `no ··· menu on ${box.title}`)
    await page.keyboard.press(key)
    await sleep(500)
    return m
  }
  await t(S23[2], async () => {
    const box = pick(0)
    await withMenu(box, 'p')
    const ok = await waitFor(async () => {
      const h = await sideText(page, 'Pinned'), r = await row(page, box.title)
      if (!h || !r || r.row.y < h.text.y) return null
      const rest = await rows(page, others(box))
      return rest.every((x) => x.row.y > r.row.y) ? true : null
    }, 3000)
    await closeMenus(page)
    need(ok, `after P, ${box.title} is not under a Pinned header above the other tracks`)
  })
  await t(S23[3], async () => {
    const box = pick(1)
    const m = await openRowMenu(page, box.title)
    need(m, `no ··· menu on ${box.title}`)
    const it = m.items.find((i) => /^Mark as (un)?read$/.test(i.label))
    need(it, `no Mark as unread / read item: ${labels(m).join(', ')}`)
    await page.keyboard.press('u')
    await sleep(600)
    await closeMenus(page)
    const m2 = await openRowMenu(page, box.title)
    await closeMenus(page)
    const it2 = m2 && m2.items.find((i) => /^Mark as (un)?read$/.test(i.label))
    need(it2 && it2.label !== it.label, `U did not flip it: before "${it.label}", after "${it2 ? it2.label : 'no item'}"`)
  })
  await t(S23[4], async () => {
    const box = pick(2)
    const r = await row(page, box.title)
    need(r, `no row for ${box.title}`)
    await withMenu(box, 'r')
    const editing = await waitFor(() => page.evaluate((y) => {
      let a = document.activeElement
      while (a && a.shadowRoot && a.shadowRoot.activeElement) a = a.shadowRoot.activeElement
      if (!a) return null
      const editable = a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable
      const rr = a.getBoundingClientRect()
      return editable && Math.abs(rr.top + rr.height / 2 - y) <= 24 ? true : null
    }, r.row.y + r.row.h / 2), 2000)
    await page.keyboard.press('Escape')
    await sleep(200)
    need(editing, `after R no text field has focus on ${box.title}'s row`)
  })
  await t(S23[5], async () => {
    const box = pick(3)
    const count = () => page.evaluate((title) => { const V = window.__vta, side = V.sidebar(); return V.findText(title, false).filter((e) => V.inside(V.rect(e), side, 4)).length }, box.title)
    const n0 = await count()
    const d0 = (await dialogs(page)).length
    await withMenu(box, 'f')
    const ok = await waitFor(async () => (await count()) > n0 || (await dialogs(page)).length > d0, 10000, 250)
    await page.keyboard.press('Escape')
    await sleep(200)
    need(ok, `after F no new row naming ${box.title} and no dialog appeared within 10 s`)
  })
  await t(S23[6], async () => {
    const box = pick(4)
    await withMenu(box, 'a')
    const gone = await waitFor(async () => !(await row(page, box.title)), 5000)
    await closeMenus(page)
    need(gone, `after A ${box.title} is still in the sidebar`)
  })
  const deleted = pick(5)
  let deletedOk = false
  await t(S23[7], async () => {
    await withMenu(deleted, 'd')
    // a confirmation is part of Delete (Claude asks); confirm it with its Delete button
    const confirm = await waitFor(async () => (await dialogs(page)).length ? true : null, 1500)
    if (confirm) {
      const b = await page.evaluate(() => {
        const V = window.__vta
        const el = V.all().find((e) => (e.tagName === 'BUTTON' || e.getAttribute('role') === 'button') && V.vis(e) && /^delete/i.test(V.fullText(e)) && e.closest && e.closest('[role="dialog"],[role="alertdialog"],dialog,[aria-modal="true"]'))
        return el ? V.rect(el) : null
      })
      if (b) await page.mouse.click(b.x + b.w / 2, b.y + b.h / 2)
    }
    const gone = await waitFor(async () => !(await row(page, deleted.title)), 5000)
    await closeMenus(page)
    need(gone, `after D ${deleted.title} is still in the sidebar`)
    deletedOk = true
  })
  await t(S23[8], async () => {
    need(deletedOk, 'Delete did not run (the check before), so there is nothing to look at')
    need(existsSync(deleted.path), `${deleted.path} is gone`)
    const st = ctx.stage.git(deleted.path, ['status', '--porcelain'])
    const head = ctx.stage.git(deleted.path, ['rev-parse', 'HEAD'])
    need(head.out === deleted.head, `its HEAD moved: ${deleted.head.slice(0, 7)} → ${head.out.slice(0, 7)}`)
    need(st.code === 0 && st.out === '', `its working tree changed: ${st.out || st.err}`)
  })
})
