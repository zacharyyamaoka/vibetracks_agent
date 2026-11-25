// S1.1 a track is a box and opening it shows the box's own site; S1.4 a box's data changing on disk shows live.
import { renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { group, need, sleep, waitFor, mainText, url, urlNames } from '../lib.mjs'
import { byRole, one, clickTitle } from './common.mjs'

const S11 = ["S1.1 each of three boxes opens its own site in the main pane", 'S1.1 the address bar names the track',
  "S1.1 a box with no site shows its README's first heading"]
const S14 = ["S1.4 a box's site changed on disk shows on its page within 5 s",
  'S1.4 no reload: history length and the sidebar scroll position are kept']

export default group('open', [...S11, ...S14], async (ctx, t) => {
  const { page, F } = ctx
  const sites = [one(F, 'rollup_parent'), one(F, 'chain_top'), byRole(F, 'top_leaf')[0]]
  const urls = []
  await t(S11[0], async () => {
    const shown = []
    for (const box of sites) {
      need(await clickTitle(page, box.title), `no sidebar row for ${box.title}`)
      const r = await waitFor(() => mainText(page, box.marker), 10000, 200)
      urls.push([box, url(page)])
      need(r, `${box.title}: its site's marker "${box.marker}" is not on screen right of the sidebar after the click (address ${url(page)})`)
      shown.push(`${box.title} at ${Math.round(r.x)},${Math.round(r.y)}`)
    }
    return shown.join('; ')
  })
  await t(S11[1], async () => {
    need(urls.length === sites.length, 'the boxes were not all opened')
    const bad = urls.filter(([box, u]) => !urlNames(u, box))
    need(!bad.length, `the address bar does not name the track: ${bad.map(([b, u]) => `${b.title} → ${u}`).join('; ')}`)
  })
  await t(S11[2], async () => {
    const box = one(F, 'nosite')
    need(await clickTitle(page, box.title), `no sidebar row for ${box.title}`)
    const body = await waitFor(() => mainText(page, box.readme_marker), 10000, 200)
    const head = await mainText(page, box.title, true)
    need(body && head, `${box.title} (no site/): its README (heading "${box.title}" and the line "${box.readme_marker}") is not shown right of the sidebar; heading ${head ? 'shown' : 'not shown'}, README line ${body ? 'shown' : 'not shown'}`)
  })

  // S1.4: a short window so the sidebar scrolls; the box open, the sidebar scrolled, its site rewritten on disk
  const box = one(F, 'chain_top')
  let opened = false, before = null
  await t(S14[0], async () => {
    await page.setViewportSize({ width: 1400, height: 420 })
    await sleep(300)
    need(await clickTitle(page, box.title), `no sidebar row for ${box.title}`)
    opened = !!(await waitFor(() => mainText(page, box.marker), 10000, 200))
    need(opened, `${box.title}'s site is not shown to begin with (S1.1), so there is no page to watch`)
    before = await page.evaluate(() => {
      const V = window.__vta, side = V.sidebar()
      const scroller = V.all().find((el) => { const r = V.rect(el); const cs = getComputedStyle(el); return V.inside(r, side, 2) && /(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 10 })
      if (scroller) { scroller.scrollTop = Math.min(40, scroller.scrollHeight - scroller.clientHeight); window.__vtaScroller = scroller }
      window.__vtaMark = 'vta-' + Math.random()
      return { history: history.length, scroll: scroller ? scroller.scrollTop : null, mark: window.__vtaMark }
    })
    const fresh = `VTA live marker ${box.slug} ${Date.now() % 100000}`
    ctx.liveMarker = fresh
    const file = join(box.path.replace(F.home, ctx.stage.home), 'site', 'index.html')
    writeFileSync(file + '.vta-tmp', `<!doctype html>\n<html><head><meta charset="utf-8"><title>${box.title}</title></head>\n<body>\n<h1>${box.title}</h1>\n<p id="vta-marker">${fresh}</p>\n</body></html>\n`)
    renameSync(file + '.vta-tmp', file)
    const t0 = Date.now()
    const seen = await waitFor(() => mainText(page, fresh), 5000, 150)
    need(seen, `the new text "${fresh}" was not on screen within 5 s of the file changing`)
    return `${Date.now() - t0} ms`
  })
  await t(S14[1], async () => {
    need(opened && before, "the box's page was not open (S1.4's first check)")
    const after = await page.evaluate(() => ({ history: history.length, scroll: window.__vtaScroller ? window.__vtaScroller.scrollTop : null, mark: window.__vtaMark }))
    need(after.mark === before.mark, 'the page reloaded')
    need(after.history === before.history, `history.length went ${before.history} → ${after.history}`)
    need(after.scroll === before.scroll, `the sidebar's scroll went ${before.scroll} → ${after.scroll}`)
    return before.scroll == null ? 'the sidebar did not scroll at 420 px' : `scroll ${before.scroll}`
  })
})
