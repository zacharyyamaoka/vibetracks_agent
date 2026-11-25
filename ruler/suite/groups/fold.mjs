// S2.9 (a shall since ruler v3, docs/peps/0003; its row anatomy since ruler v4, docs/peps/0004): fold and unfold a
// track's sub-tracks the way Notion's sidebar folds a page's sub-pages. Each track is itself the folder: its fold
// chevron shows left of its title at rest (Obsidian's file explorer) and its status dot sits at the row's right end
// (Claude's sidebar); the chevron is labelled "Fold N sub-tracks (← →)" ("Unfold N sub-tracks" when folded); a chevron click folds every
// level below it and a second unfolds; the title still opens the track; ← and → fold and unfold a focused row; a fold
// survives a reload; a folded parent still shows its roll-up (S3.4). Measured on screen: boxes, computed styles,
// elementFromPoint, real pointer and keys.
//
// The parent is the fixture's package parent (fixture.json `package_boxes`): two sub-tracks, one with a sub-track of its
// own (so folding hides two levels), a blocked one with 2 agents and a working one with 1 below. The fold group adds
// the package boxes, then the extra box after them, with `vt add` (common.mjs addStageBoxes).
import { group, need, sleep, waitFor, row, rows, order, url, urlNames, settle, load } from '../lib.mjs'
import { addStageBoxes, clickTitle } from './common.mjs'

const S29 = [
  "S2.9 a parent shows its fold chevron left of its title at rest, and its status dot at the row's right end",
  'S2.9 the chevron reads "Fold N sub-tracks (← →)", and "Unfold N sub-tracks" when folded, N its sub-tracks',
  'S2.9 a chevron click folds every level below and the rows below move up; a second click unfolds',
  'S2.9 a title click on a parent opens it and leaves it unfolded',
  'S2.9 ← folds a focused row and → unfolds it',
  'S2.9 a fold survives a reload',
  'S2.9 a folded parent still shows its roll-up: a pip for its blocked sub-track and its 3 agents',
]

const boxOf = (r) => ({ l: r.row.x, r: r.row.x + r.row.w, t: r.row.y, b: r.row.y + r.row.h })
const away = async (page) => { await page.mouse.move(1380, 880); await sleep(300) }

/** The control at the leading slot's point (x, y), topmost there (shadow roots drilled), as a person would hit it: the
 *  nearest button-like element up from the hit, with its labels (aria-label and title, up to the row). Remembered in
 *  the page as window.__vtaChev so its visibility can be read again later. */
async function controlAt(page, x, y) {
  return page.evaluate(([x, y]) => {
    const V = window.__vta
    let el = document.elementFromPoint(x, y)
    while (el && el.shadowRoot) { const inner = el.shadowRoot.elementFromPoint(x, y); if (!inner || inner === el) break; el = inner }
    const button = (e) => e.tagName === 'BUTTON' || e.getAttribute('role') === 'button' || /fold|unfold|collapse|expand/i.test(`${e.getAttribute('aria-label') || ''} ${e.getAttribute('title') || ''}`)
    let c = null
    for (let a = el; a; a = V.parentOf(a)) { if (a.getBoundingClientRect().height > 48) break; if (a.getAttribute && button(a)) { c = a; break } }
    if (!c) return { found: false, hit: el ? el.tagName.toLowerCase() : null }
    window.__vtaChev = c
    const labels = []
    for (let a = c; a; a = V.parentOf(a)) { if (a.getBoundingClientRect().height > 48) break; for (const k of ['aria-label', 'title']) { const v = a.getAttribute && a.getAttribute(k); if (v) labels.push(v) } }
    const tips = V.all().filter((e) => e.getAttribute('role') === 'tooltip' && V.vis(e)).map((e) => V.fullText(e))
    return { found: true, rect: V.rect(c), visible: V.vis(c), labels: labels.concat(tips).join(' | ') }
  }, [x, y])
}
const chevVisible = (page) => page.evaluate(() => !!window.__vtaChev && window.__vta.vis(window.__vtaChev))

export default group('fold', S29, async (ctx, t) => {
  const { F } = ctx
  const pkg = F.package_boxes || []
  const parent = pkg.find((b) => b.roles.includes('pkg_parent'))
  const kids = pkg.filter((b) => b.parent === parent.slug)
  const below = []
  const walk = (slug) => { for (const b of pkg) if (b.parent === slug) { below.push(b); walk(b.slug) } }
  walk(parent.slug)
  const belowTitles = below.map((b) => b.title)
  const added = await addStageBoxes(ctx)
  const bad = added.filter((s) => s.code !== 0)
  await ctx.open()
  const page = ctx.page
  const allTitles = [...F.boxes, ...pkg, F.extra].map((b) => b.title)
  await waitFor(async () => (await rows(page, belowTitles)).length === below.length, 8000, 200)
  const why = bad.length ? ` (vt add: ${bad.map((s) => `${s.args.join(' ')} exit ${s.code}: ${s.out.split('\n').slice(-1)[0]}`).join('; ')})` : ''
  const shownBelow = async () => (await rows(page, belowTitles)).map((r) => r.title)
  const want = (folded) => `${folded ? 'Unfold' : 'Fold'} ${kids.length} sub-track${kids.length === 1 ? '' : 's'}`

  // the parent's fold chevron: found at rest, left of its title (ruler v4: no hover needed to see it), then hit at that
  // place the way a person's pointer would, after resting on the row
  let slot = null
  const findChevron = async () => {
    const r = await row(page, parent.title)
    if (!r) return null
    if (!slot) {
      await away(page)
      const rest = await row(page, parent.title)
      const list = await page.evaluate(([bx, left]) => window.__vta.controlsIn(bx, left), [boxOf(rest), rest.text.x])
      if (!list.length) return null
      const c = list[list.length - 1]
      slot = { x: c.x + c.w / 2, y: c.y + c.h / 2, w: c.w, dx: c.x + c.w / 2 - rest.row.x }
    }
    const now = await row(page, parent.title)
    await page.mouse.move(now.text.x + Math.min(40, now.text.w / 2), now.row.y + now.row.h / 2, { steps: 2 })
    await sleep(350)
    const at = { x: now.row.x + slot.dx, y: now.row.y + now.row.h / 2 }
    const c = await controlAt(page, at.x, at.y)
    return c.found ? { ...c, at } : null
  }
  const clickChevron = async () => {
    const c = await findChevron()
    if (!c) return null
    await page.mouse.click(c.rect.x + c.rect.w / 2, c.rect.y + c.rect.h / 2)
    await sleep(300)
    return c
  }

  await t(S29[0], async () => {
    need(!bad.length && (await shownBelow()).length === below.length, `${parent.title}'s sub-tracks are not all in the sidebar (shown: ${(await shownBelow()).join(', ') || 'none'})${why}`)
    await away(page)
    const r = await row(page, parent.title)
    need(r, `no row for ${parent.title}`)
    const box = boxOf(r)
    const rest = await page.evaluate(([bx, left]) => window.__vta.controlsIn(bx, left), [box, r.text.x])
    need(rest.length, `at rest nothing button-like shows left of ${parent.title}'s title: which rows fold cannot be read from the outside`)
    const dot = await page.evaluate((bx) => window.__vta.dotIn(bx, null), box)
    need(dot, `${parent.title} shows no round status dot in its row`)
    const gap = box.r - (dot.x + dot.w)
    need(dot.x > r.text.x && gap <= 40, `its dot's right edge is ${Math.round(gap)} px from the row's right end (x ${Math.round(dot.x)}, the title at ${Math.round(r.text.x)}), not at the row's right end`)
    const c = await findChevron()
    need(c, `nothing button-like is at the chevron's place (${Math.round(slot ? slot.x : 0)}, ${Math.round(slot ? slot.y : 0)})`)
    need(c.visible, 'the chevron is not visible with the pointer on the row')
    const cx = c.rect.x + c.rect.w / 2, cy = c.rect.y + c.rect.h / 2
    need(cx < r.text.x, `the control hit at the chevron's place (centre x ${Math.round(cx)}) is not left of the title (x ${Math.round(r.text.x)})`)
    await away(page)
    need(await chevVisible(page), 'the chevron hides once the pointer leaves the row: it must show at rest')
    return `chevron ${Math.round(c.rect.w)}×${Math.round(c.rect.h)} at x ${Math.round(cx)} (title at ${Math.round(r.text.x)}); dot ${Math.round(dot.w)} px, ${Math.round(gap)} px from the row's right end`
  })

  await t(S29[1], async () => {
    const open = await findChevron()
    need(open, 'no chevron on hover (the first S2.9 fold check)')
    need(open.labels.includes(want(false)), `the chevron's labels read "${open.labels || 'nothing'}", not "${want(false)} (← →)"`)
    need(/←\s*→/.test(open.labels), `the chevron's labels read "${open.labels}", with no "(← →)"`)
    await page.mouse.click(open.rect.x + open.rect.w / 2, open.rect.y + open.rect.h / 2)
    const folded = await waitFor(async () => (await shownBelow()).length === 0, 2500)
    need(folded, `the chevron click did not fold ${parent.title}`)
    const shut = await findChevron()
    need(shut, 'no chevron on hover once folded')
    const ok = shut.labels.includes(want(true))
    await page.mouse.click(shut.rect.x + shut.rect.w / 2, shut.rect.y + shut.rect.h / 2)
    await waitFor(async () => (await shownBelow()).length === below.length, 2500)
    need(ok, `folded, the chevron's labels read "${shut.labels || 'nothing'}", not "${want(true)}"`)
    return `${open.labels} → ${shut.labels}`
  })

  await t(S29[2], async () => {
    await away(page)
    const before = await order(page, allTitles)
    const p = before.find((r) => r.title === parent.title)
    need(p, `no row for ${parent.title}`)
    const last = Math.max(...before.filter((r) => belowTitles.includes(r.title)).map((r) => before.indexOf(r)))
    const next = before.slice(last + 1).find((r) => r.x <= p.x + 1)
    need(next, `no row sits below ${parent.title}'s sub-tracks to watch move`)
    const h = p.row.h
    const address = page.url()
    need(await clickChevron(), 'no chevron on hover')
    const gone = await waitFor(async () => (await shownBelow()).length === 0, 2500)
    need(gone, `after the chevron click these still show: ${(await shownBelow()).join(', ')}`)
    await away(page)
    const mid = await order(page, allTitles)
    const n = mid.find((r) => r.title === next.title), pp = mid.find((r) => r.title === parent.title)
    need(n && pp, `${next.title} or ${parent.title} left the sidebar when it folded`)
    need(n.y <= next.y - 2 * h, `${next.title} moved from y ${Math.round(next.y)} to ${Math.round(n.y)}, not up past the ${below.length} folded rows`)
    need(n.y - (pp.row.y + pp.row.h) <= h * 0.6, `a gap of ${Math.round(n.y - (pp.row.y + pp.row.h))} px is left under the folded ${parent.title}`)
    need(page.url() === address, `the chevron click also opened a page (${address} → ${page.url()})`)
    need(await clickChevron(), 'no chevron on hover once folded')
    const back = await waitFor(async () => (await shownBelow()).length === below.length, 2500)
    need(back, `the second click brought back only: ${(await shownBelow()).join(', ') || 'none'}`)
    await away(page)
    const after = (await order(page, allTitles)).find((r) => r.title === next.title)
    need(after && Math.abs(after.y - next.y) <= 2, `${next.title} came back to y ${after ? Math.round(after.y) : 'nowhere'}, not ${Math.round(next.y)}`)
    need(page.url() === address, `the second chevron click opened a page (${page.url()})`)
    return `${next.title}: y ${Math.round(next.y)} → ${Math.round(n.y)} → ${Math.round(after.y)}`
  })

  await t(S29[3], async () => {
    need((await shownBelow()).length === below.length, `${parent.title} is not unfolded to begin with`)
    need(await clickTitle(page, parent.title), `no row for ${parent.title}`)
    const opened = await waitFor(async () => urlNames(url(page), parent), 3000)
    need(opened, `the address bar does not name ${parent.title} after a title click: ${url(page)}`)
    const still = await shownBelow()
    need(still.length === below.length, `the title click also folded it (shown: ${still.join(', ') || 'none'})`)
  })

  await t(S29[4], async () => {
    need(await clickTitle(page, parent.title), `no row for ${parent.title}`)
    await page.keyboard.press('ArrowLeft')
    const folded = await waitFor(async () => (await shownBelow()).length === 0, 2000)
    need(folded, `← on the focused ${parent.title} left these showing: ${(await shownBelow()).join(', ')}`)
    await page.keyboard.press('ArrowRight')
    const open = await waitFor(async () => (await shownBelow()).length === below.length, 2000)
    need(open, `→ brought back only: ${(await shownBelow()).join(', ') || 'none'}`)
  })

  await t(S29[5], async () => {
    if ((await shownBelow()).length) need(await clickChevron(), 'no chevron on hover')
    need(await waitFor(async () => (await shownBelow()).length === 0, 2500), `${parent.title} did not fold`)
    await load(page, ctx.stage, ctx.titles)
    await sleep(500)
    need(await row(page, parent.title), `no row for ${parent.title} after the reload`)
    const shown = await shownBelow()
    need(!shown.length, `after a reload these show again: ${shown.join(', ')}`)
  })

  await t(S29[6], async () => {
    if ((await shownBelow()).length) { await clickChevron(); await waitFor(async () => (await shownBelow()).length === 0, 2500) }
    need(!(await shownBelow()).length, `${parent.title} could not be folded`)
    await away(page)
    const r = await row(page, parent.title)
    need(r, `no row for ${parent.title}`)
    const look = await page.evaluate(([bx, title]) => {
      const V = window.__vta
      let dots = 0
      const labels = []
      for (const el of V.all()) {
        if (!V.vis(el)) continue
        const rr = V.rect(el)
        if (!V.inside(rr, bx, 1)) continue
        const l = [el.getAttribute('aria-label'), el.getAttribute('title')].filter(Boolean).join(' ')
        if (l) labels.push(l)
        if (rr.w >= 3 && rr.w <= 12 && Math.abs(rr.w - rr.h) <= 1.5) { const cs = getComputedStyle(el); if (parseFloat(cs.borderTopLeftRadius) >= rr.w * 0.4 || el.tagName.toLowerCase() === 'circle') dots++ }
      }
      return { dots, labels: labels.join(' | '), text: V.fullText(V.sideTitle(title).row) }
    }, [boxOf(r), parent.title])
    const leaf = F.boxes.find((b) => !b.parent && b.state === parent.state && !F.boxes.some((k) => k.parent === b.slug))
    let ref = null
    if (leaf) { const lr = await row(page, leaf.title); if (lr) ref = await page.evaluate(([bx]) => { const V = window.__vta; let d = 0; for (const el of V.all()) { if (!V.vis(el)) continue; const rr = V.rect(el); if (!V.inside(rr, bx, 1)) continue; if (rr.w >= 3 && rr.w <= 12 && Math.abs(rr.w - rr.h) <= 1.5) { const cs = getComputedStyle(el); if (parseFloat(cs.borderTopLeftRadius) >= rr.w * 0.4 || el.tagName.toLowerCase() === 'circle') d++ } } return d }, [boxOf(lr)]) }
    const pip = /block/i.test(look.labels) || (ref != null && look.dots > ref)
    const agents = new RegExp('(^|\\D)3(\\D|$)').test(look.text.replace(parent.title, ' '))
    need(pip, `folded, ${parent.title} shows ${look.dots} dot(s)${ref != null ? ` (an ${parent.state} leaf shows ${ref})` : ''} and no label naming its blocked sub-track (labels: ${look.labels || 'none'})`)
    need(agents, `folded, ${parent.title}'s row reads "${look.text}": no 3 for the agents working below it`)
    return `${look.dots} dots; "${look.text}"`
  })
})
