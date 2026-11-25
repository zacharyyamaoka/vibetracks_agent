// S2.5 pin a track; pinned tracks sit in a Pinned section at the top, fold with it, survive a restart, unpin back.
import { group, need, sleep, waitFor, row, rows, order, sideText, rowMenuAction, closeMenus } from '../lib.mjs'
import { one, byRole, shape } from './common.mjs'

const S25 = ['S2.5 two pinned tracks sit under Pinned, in pin order, above the rest', 'S2.5 folding Pinned hides them',
  'S2.5 pins survive a vt serve restart', 'S2.5 unpin returns each to its old parent and place']

export default group('pin', S25, async (ctx, t) => {
  const { page, F } = ctx
  const titles = F.boxes.map((b) => b.title)
  const a = one(F, 'rollup_working')        // nested: has an old parent to go back to
  const b = byRole(F, 'top_leaf')[0]
  const original = await order(page, titles)
  const others = titles.filter((x) => x !== a.title && x !== b.title)
  let pinned = false
  async function pinnedLook() {
    const h = await sideText(page, 'Pinned')
    const ra = await row(page, a.title), rb = await row(page, b.title)
    if (!h) return 'no Pinned header in the sidebar'
    if (!ra || !rb) return `pinned rows not shown (${a.title}: ${!!ra}, ${b.title}: ${!!rb})`
    if (!(h.text.y < ra.row.y && ra.row.y < rb.row.y)) return `not Pinned, ${a.title}, ${b.title} top to bottom (y ${Math.round(h.text.y)}, ${Math.round(ra.row.y)}, ${Math.round(rb.row.y)})`
    const rest = await rows(page, others)
    const above = rest.filter((r) => r.row.y < rb.row.y)
    if (above.length) return `other tracks sit above the pinned ones: ${above.map((r) => r.title).join(', ')}`
    return null
  }
  await t(S25[0], async () => {
    need(original.length, 'no track rows to begin with')
    need(await rowMenuAction(page, a.title, /^pin$/i), `no Pin item in ${a.title}'s ··· menu`)
    await closeMenus(page)
    need(await rowMenuAction(page, b.title, /^pin$/i), `no Pin item in ${b.title}'s ··· menu`)
    await closeMenus(page)
    const why = await waitFor(async () => ((await pinnedLook()) === null ? 'ok' : null), 3000)
    need(why, await pinnedLook())
    pinned = true
  })
  await t(S25[1], async () => {
    need(pinned, 'nothing pinned (the check before)')
    const h = await sideText(page, 'Pinned')
    await page.mouse.click(h.text.x + Math.min(10, h.text.w / 2), h.text.y + h.text.h / 2)
    const hidden = await waitFor(async () => (await rows(page, [a.title, b.title])).length === 0, 2000)
    const rest = await rows(page, others)
    const h2 = await sideText(page, 'Pinned')
    if (h2) { await page.mouse.click(h2.text.x + Math.min(10, h2.text.w / 2), h2.text.y + h2.text.h / 2); await sleep(400) }
    need(hidden, 'clicking the Pinned header left the pinned rows showing')
    need(rest.length >= others.length - 2, `folding Pinned also hid other rows (${rest.length} of ${others.length} left)`)
  })
  await t(S25[2], async () => {
    need(pinned, 'nothing pinned (the first check)')
    await ctx.restart()
    const why = await waitFor(async () => ((await pinnedLook()) === null ? 'ok' : null), 5000)
    need(why, `after the restart: ${await pinnedLook()}`)
  })
  await t(S25[3], async () => {
    need(pinned, 'nothing pinned (the first check)')
    need(await rowMenuAction(page, a.title, /^unpin$/i), `no Unpin item in ${a.title}'s ··· menu`)
    await closeMenus(page)
    need(await rowMenuAction(page, b.title, /^unpin$/i), `no Unpin item in ${b.title}'s ··· menu`)
    await closeMenus(page)
    const back = await waitFor(async () => (shape(await order(page, titles)) === shape(original) ? true : null), 3000)
    need(back, `before: ${shape(original)}\nafter: ${shape(await order(page, titles))}`)
  })
})
