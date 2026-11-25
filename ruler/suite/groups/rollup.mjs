// S3.1 Home is a stock data-ui table folding by parent with Active / Done / All tracks presets; S3.4 a parent rolls
// up its children's state and agents.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { group, need, sleep, waitFor, row, mainText, sidebar, settle } from '../lib.mjs'
import { one, descendants, clickSide } from './common.mjs'

const S31 = ['S3.1 Home holds a data-views element', 'S3.1 its presets are Active, Done, All tracks in that order',
  'S3.1 folding a parent hides exactly its descendants', 'S3.1 the Done preset shows only done boxes']
const S34 = ["S3.4 the parent's sidebar row shows a pip for its blocked child", 'S3.4 the parent shows 3 agents working in its subtree',
  "S3.4 a child's status.json changed on disk updates the parent within 5 s"]

async function dataViews(page) {
  return page.evaluate(() => {
    const V = window.__vta, side = V.sidebar()
    const el = V.all().find((e) => e.tagName.toLowerCase() === 'data-views' && V.vis(e) && V.rect(e).x >= side.r - 2)
    return el ? V.rect(el) : null
  })
}
/** Which fixture titles are on screen right of the sidebar (the Home table). */
async function shownInMain(page, titles) {
  const out = []
  for (const t of titles) if (await mainText(page, t, true)) out.push(t)
  return out
}
async function preset(page, name) {
  const r = await mainText(page, name, true)
  if (!r) return false
  await page.mouse.click(r.x + Math.min(10, r.w / 2), r.y + r.h / 2)
  await sleep(500)
  await settle(page, 250, 2500)
  return true
}
/** The parent row's dots and labels in the sidebar. */
async function pipLook(page, title) {
  const r = await row(page, title)
  if (!r) return null
  return page.evaluate(([bx, left, title]) => {
    const V = window.__vta
    let dots = 0, labels = []
    for (const el of V.all()) {
      if (!V.vis(el)) continue
      const rr = V.rect(el)
      if (!V.inside(rr, bx, 1)) continue
      const l = [el.getAttribute('aria-label'), el.getAttribute('title')].filter(Boolean).join(' ')
      if (l) labels.push(l)
      if (rr.w >= 3 && rr.w <= 12 && Math.abs(rr.w - rr.h) <= 1.5) {
        const cs = getComputedStyle(el)
        if (parseFloat(cs.borderTopLeftRadius) >= rr.w * 0.4 || el.tagName.toLowerCase() === 'circle') dots++
      }
    }
    return { dots, labels: labels.join(' | '), text: V.fullText(V.sideTitle(title).row) }
  }, [{ l: r.row.x, r: r.row.x + r.row.w, t: r.row.y, b: r.row.y + r.row.h }, r.text.x, title])
}

export default group('rollup', [...S31, ...S34], async (ctx, t) => {
  const { page, F, stage } = ctx
  const titles = F.boxes.map((b) => b.title)
  const parent = one(F, 'rollup_parent'), blocked = one(F, 'rollup_blocked')
  const idleLeaf = F.boxes.find((b) => !b.parent && b.state === parent.state && !F.boxes.some((k) => k.parent === b.slug) && b.slug !== parent.slug)

  // ── S3.4 first, on the sidebar as loaded ──
  let pip = false
  await t(S34[0], async () => {
    const p = await pipLook(page, parent.title)
    need(p, `no sidebar row for ${parent.title}`)
    const ref = idleLeaf ? await pipLook(page, idleLeaf.title) : null
    pip = /block/i.test(p.labels) || (ref && p.dots > ref.dots)
    need(pip, `${parent.title} (own state ${parent.state}) with a blocked child shows ${p.dots} dot(s) ${ref ? `(a ${parent.state} leaf shows ${ref.dots})` : ''} and no label naming it blocked (labels: ${p.labels || 'none'})`)
  })
  await t(S34[1], async () => {
    const p = await pipLook(page, parent.title)
    const side = p && new RegExp(`(^|\\D)3(\\D|$)`).test(p.text.replace(parent.title, ' '))
    let home = false
    if (!side) {
      await clickSide(page, 'Home')
      await preset(page, 'All tracks')
      const title = await mainText(page, parent.title, true)
      if (title) {
        home = await page.evaluate((y) => {
          const V = window.__vta, side = V.sidebar()
          const band = V.all().filter((e) => V.vis(e) && V.ownText(e) && V.rect(e).x >= side.r && Math.abs(V.rect(e).y + V.rect(e).h / 2 - y) <= 12).map((e) => V.ownText(e)).join(' | ')
          return /(^|\D)3\s*(agents?|working)?(\D|$)/i.test(band) ? band : null
        }, title.y + title.h / 2)
      }
    }
    need(side || home, `neither ${parent.title}'s sidebar row ("${p ? p.text : 'no row'}") nor its Home row shows 3 agents (2 + 1 working in its children)`)
    return side ? 'sidebar' : `Home: ${home}`
  })
  await t(S34[2], async () => {
    need(pip, 'there is no pip to begin with (the first S3.4 check)')
    const file = join(blocked.path, 'status.json')
    const s = JSON.parse(readFileSync(file, 'utf8'))
    s.status = parent.state
    s.updated_t = Date.now() / 1000
    writeFileSync(file, JSON.stringify(s, null, 2) + '\n')
    const ref = idleLeaf ? await pipLook(page, idleLeaf.title) : null
    const gone = await waitFor(async () => {
      const p = await pipLook(page, parent.title)
      return p && !/block/i.test(p.labels) && (!ref || p.dots <= ref.dots) ? true : null
    }, 5000, 200)
    need(gone, `5 s after ${blocked.slug}/status.json went from blocked to ${parent.state}, ${parent.title} still shows a pip`)
  })

  // ── S3.1 ──
  await clickSide(page, 'Home')
  let dv = null
  await t(S31[0], async () => {
    dv = await dataViews(page)
    need(dv, 'no visible <data-views> element right of the sidebar on Home')
  })
  await t(S31[1], async () => {
    const names = ['Active', 'Done', 'All tracks']
    const at = []
    for (const n of names) at.push([n, await mainText(page, n, true)])
    const missing = at.filter(([, r]) => !r).map(([n]) => n)
    need(!missing.length, `no ${missing.join(', ')} preset on Home`)
    const rs = at.map(([, r]) => r)
    need(rs.every((r, i) => i === 0 || (r.x > rs[i - 1].x && Math.abs(r.y - rs[0].y) <= 8)), `not left to right on one line: ${at.map(([n, r]) => `${n}@${Math.round(r.x)},${Math.round(r.y)}`).join(' ')}`)
    need(dv, 'they are not presets of a data-views element (there is none)')
    need(rs.every((r) => r.x >= dv.x - 2 && r.x + r.w <= dv.x + dv.w + 2 && r.y >= dv.y - 2 && r.y + r.h <= dv.y + dv.h + 2), 'the presets sit outside the data-views element')
  })
  await t(S31[2], async () => {
    need(await preset(page, 'All tracks'), 'no All tracks preset to show every row')
    const before = await shownInMain(page, titles)
    need(before.includes(parent.title), `${parent.title} is not on Home`)
    const title = await mainText(page, parent.title, true)
    const ctl = await page.evaluate((r) => {
      const V = window.__vta, side = V.sidebar(), out = []
      for (const el of V.all()) {
        if (!V.vis(el)) continue
        const rr = V.rect(el)
        if (rr.x < side.r || rr.r > r.x + 1 || Math.abs(rr.y + rr.h / 2 - (r.y + r.h / 2)) > 14 || rr.w > 32) continue
        if (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button' || el.hasAttribute('aria-expanded') || el.tagName.toLowerCase() === 'svg') out.push(rr)
      }
      out.sort((a, b) => b.r - a.r)
      return out[0] || null
    }, title)
    need(ctl, `no fold control left of ${parent.title} on Home`)
    await page.mouse.click(ctl.x + ctl.w / 2, ctl.y + ctl.h / 2)
    await sleep(600)
    const after = await shownInMain(page, titles)
    const kids = descendants(F, parent.slug).map((b) => b.title).filter((x) => before.includes(x))
    const hidden = before.filter((x) => !after.includes(x))
    need(kids.length, `${parent.title}'s children were not on Home to begin with`)
    need(hidden.sort().join('|') === kids.sort().join('|'), `folding hid ${hidden.join(', ') || 'nothing'}; its descendants are ${kids.join(', ')}`)
    await page.mouse.click(ctl.x + ctl.w / 2, ctl.y + ctl.h / 2)
    await sleep(300)
  })
  await t(S31[3], async () => {
    need(await preset(page, 'Done'), 'no Done preset')
    const shown = await shownInMain(page, titles)
    const done = F.boxes.filter((b) => b.state === 'done').map((b) => b.title)
    const extra = shown.filter((x) => !done.includes(x)), missing = done.filter((x) => !shown.includes(x))
    need(!extra.length && !missing.length, `Done shows ${shown.join(', ') || 'nothing'}; the done boxes are ${done.join(', ')}`)
  })
})
