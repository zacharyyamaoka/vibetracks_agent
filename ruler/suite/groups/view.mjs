// S2.6 the view menu (Group by, Sort by, Show, New section, Reset to defaults, View all); S2.7 the groupings.
import { group, need, sleep, waitFor, row, rows, order, under, sideText, closeMenus, itemOf, submenu, labels, clickItem, settle } from '../lib.mjs'
import { openViewMenu, pickView, clickTitle, shape } from './common.mjs'

const S26 = ["S2.6 the view menu's entries in order", 'S2.6 Group by offers None, Parent, State',
  'S2.6 Sort by offers Manual, Last updated, Created, Name', 'S2.6 Show offers archived and done',
  'S2.6 each submenu shows its current pick on the right', 'S2.6 the choice survives a restart',
  'S2.6 Reset to defaults restores Parent and Manual', 'S2.6 New section asks for a name and adds an empty section']
const S27 = ['S2.7 flat by last updated: newest first, every row at one indent', "S2.7 Parent grouping shows the tree from Vibe Tracks' file",
  'S2.7 State grouping puts each track under its state', 'S2.7 switching groupings keeps the selection']

const ENTRIES = ['Group by', 'Sort by', 'Show', 'New section', 'Reset to defaults', 'View all']
const STATE_RE = { working: /^(working|running|active|in progress)/i, blocked: /^blocked/i, idle: /^idle/i, done: /^done/i }

export default group('view', [...S26, ...S27], async (ctx, t) => {
  const { page, F } = ctx
  const titles = F.boxes.map((b) => b.title)
  const noMenu = "no view menu (looked for a control named filter/view/group/sort/display/options in the sidebar above the tracks)"
  let menu = await openViewMenu(page, titles)
  await closeMenus(page)
  const sub = async (name) => {
    const m = await openViewMenu(page, titles)
    const it = itemOf(m, new RegExp(`^${name}$`, 'i'))
    if (!it) { await closeMenus(page); return { item: null, sub: null } }
    const s = await submenu(page, it)
    await closeMenus(page)
    return { item: it, sub: s }
  }
  const current = async () => {
    const m = await openViewMenu(page, titles)
    await closeMenus(page)
    const g = itemOf(m, /^Group by$/i), s = itemOf(m, /^Sort by$/i)
    return { group: g ? g.value : null, sort: s ? s.value : null }
  }
  await t(S26[0], async () => {
    need(menu, noMenu)
    const got = labels(menu)
    need(got.join('|') === ENTRIES.join('|'), `entries: ${got.join(', ') || 'none'}; want ${ENTRIES.join(', ')}`)
  })
  await t(S26[1], async () => {
    need(menu, noMenu)
    const { item, sub: s } = await sub('Group by')
    need(item, 'no Group by entry')
    need(s, 'Group by opens no submenu')
    need(labels(s).join('|') === 'None|Parent|State', `Group by: ${labels(s).join(', ')}`)
  })
  await t(S26[2], async () => {
    need(menu, noMenu)
    const { item, sub: s } = await sub('Sort by')
    need(item, 'no Sort by entry')
    need(s, 'Sort by opens no submenu')
    need(labels(s).join('|') === 'Manual|Last updated|Created|Name', `Sort by: ${labels(s).join(', ')}`)
  })
  await t(S26[3], async () => {
    need(menu, noMenu)
    const { item, sub: s } = await sub('Show')
    need(item, 'no Show entry')
    need(s, 'Show opens no submenu')
    const l = labels(s)
    need(l.some((x) => /archived/i.test(x)) && l.some((x) => /done/i.test(x)), `Show: ${l.join(', ')}`)
  })
  await t(S26[4], async () => {
    need(menu, noMenu)
    const c = await current()
    need(c.group === 'Parent' && c.sort === 'Manual', `Group by shows "${c.group ?? ''}", Sort by shows "${c.sort ?? ''}"; the defaults are Parent and Manual`)
  })

  // S2.7 flat: Group by None, Sort by Last updated
  await t(S27[0], async () => {
    need(menu, noMenu)
    need(await pickView(page, titles, 'Group by', 'None'), 'could not pick Group by › None')
    need(await pickView(page, titles, 'Sort by', 'Last updated'), 'could not pick Sort by › Last updated')
    await sleep(400)
    const list = await order(page, titles)
    const open = F.boxes.filter((b) => b.state !== 'done').map((b) => b.title)
    const missing = open.filter((x) => !list.some((r) => r.title === x))
    need(!missing.length, `not listed: ${missing.join(', ')}`)
    const want = [...F.boxes].filter((b) => list.some((r) => r.title === b.title)).sort((x, y) => (x.activity < y.activity ? 1 : -1)).map((b) => b.title)
    need(list.map((r) => r.title).join('|') === want.join('|'), `order: ${list.map((r) => r.title).join(', ')}\nnewest first: ${want.join(', ')}`)
    const xs = list.map((r) => r.x)
    need(Math.max(...xs) - Math.min(...xs) <= 2, `indents differ: ${[...new Set(xs)].join(', ')} px`)
  })
  await t(S27[2], async () => {
    need(menu, noMenu)
    need(await pickView(page, titles, 'Group by', 'State'), 'could not pick Group by › State')
    await sleep(400)
    const heads = await page.evaluate(() => {
      const V = window.__vta, side = V.sidebar(), out = []
      for (const el of V.all()) {
        if (!V.vis(el)) continue
        const own = V.ownText(el)
        if (!own || own.length > 40) continue
        if (!/^(working|running|active|in progress|blocked|idle|done|waiting[a-z ]*|paused|stale)\b/i.test(own)) continue
        const r = V.rect(el)
        if (V.inside(r, side, 4)) out.push({ text: own, y: r.y })
      }
      return out
    })
    const list = await rows(page, titles)
    need(list.length, 'no track rows')
    const wrong = []
    for (const r of list) {
      const box = F.boxes.find((b) => b.title === r.title)
      const h = heads.filter((x) => x.y < r.row.y && !titles.includes(x.text)).sort((p, q) => q.y - p.y)[0]
      if (!h || !STATE_RE[box.state].test(h.text)) wrong.push(`${r.title} (${box.state}) under ${h ? `"${h.text}"` : 'no state header'}`)
    }
    need(!wrong.length, wrong.join('; '))
  })
  await t(S26[5], async () => {
    need(menu, noMenu)
    need(await pickView(page, titles, 'Group by', 'None'), 'could not pick Group by › None')
    need(await pickView(page, titles, 'Sort by', 'Name'), 'could not pick Sort by › Name')
    await ctx.restart()
    const c = await current()
    need(c.group === 'None' && c.sort === 'Name', `after a restart Group by shows "${c.group ?? ''}", Sort by "${c.sort ?? ''}"; picked None and Name`)
  })
  await t(S26[6], async () => {
    need(menu, noMenu)
    const m = await openViewMenu(page, titles)
    const it = itemOf(m, /^Reset to defaults$/i)
    need(it, 'no Reset to defaults entry')
    await clickItem(page, it)
    await sleep(500)
    await closeMenus(page)
    const c = await current()
    need(c.group === 'Parent' && c.sort === 'Manual', `after Reset Group by shows "${c.group ?? ''}", Sort by "${c.sort ?? ''}"`)
  })
  await t(S27[1], async () => {
    need(menu, noMenu)
    const c = await current()
    if (!(c.group === 'Parent' && c.sort === 'Manual')) {
      await pickView(page, titles, 'Group by', 'Parent')
      await pickView(page, titles, 'Sort by', 'Manual')
    }
    await settle(page)
    const list = await order(page, titles)
    const open = F.boxes.filter((b) => b.state !== 'done')
    const missing = open.filter((b) => !list.some((r) => r.title === b.title)).map((b) => b.title)
    need(!missing.length, `not shown: ${missing.join(', ')}`)
    const bad = []
    for (const b of F.boxes) {
      if (!list.some((r) => r.title === b.title)) continue
      const p = b.parent && F.boxes.find((x) => x.slug === b.parent)
      if (p && !under(list, b.title, p.title)) bad.push(`${b.title} not under ${p.title}`)
      if (!p && list.find((r) => r.title === b.title).x > Math.min(...list.map((r) => r.x)) + 2) bad.push(`${b.title} is indented but top-level`)
    }
    const shown = F.boxes.filter((b) => list.some((r) => r.title === b.title)).map((b) => b.title)
    if (list.map((r) => r.title).join('|') !== shown.join('|')) bad.push(`order ${list.map((r) => r.title).join(', ')}; the tree's ${shown.join(', ')}`)
    need(!bad.length, bad.join('; '))
  })
  await t(S27[3], async () => {
    need(menu, noMenu)
    const box = F.boxes.find((b) => b.roles.includes('top_leaf'))
    const other = F.boxes.find((b) => b.roles.includes('nosite'))
    need(await clickTitle(page, box.title), `no row for ${box.title}`)
    await page.mouse.move(1300, 880)
    await sleep(300)
    const fill = async (title) => { const r = await row(page, title); return r ? page.evaluate(([x, y]) => window.__vta.effBgAt(x, y), [r.row.x + 4, r.row.y + r.row.h / 2]) : null }
    const sel0 = await fill(box.title), plain = await fill(other.title)
    const u0 = page.url()
    need(sel0 && plain, 'rows not found')
    const diff = (p, q) => Math.max(Math.abs(p.r - q.r), Math.abs(p.g - q.g), Math.abs(p.b - q.b))
    need(diff(sel0, plain) > 3, `the selected row looks like any other (rgb ${sel0.r},${sel0.g},${sel0.b})`)
    const after = []
    for (const g of ['None', 'Parent']) {
      need(await pickView(page, titles, 'Group by', g), `could not pick Group by › ${g}`)
      await page.mouse.move(1300, 880)
      await sleep(300)
      const s = await fill(box.title)
      after.push([g, s, page.url()])
    }
    const lost = after.filter(([, s, u]) => !s || diff(s, sel0) > 3 || u !== u0)
    need(!lost.length, lost.map(([g, s, u]) => `${g}: ${s ? `rgb ${s.r},${s.g},${s.b}` : 'row gone'}, ${u}`).join('; '))
  })
  await t(S26[7], async () => {
    need(menu, noMenu)
    const m = await openViewMenu(page, titles)
    const it = itemOf(m, /^New section$/i)
    need(it, 'no New section entry')
    await clickItem(page, it)
    const asked = await waitFor(() => page.evaluate(() => {
      let a = document.activeElement
      while (a && a.shadowRoot && a.shadowRoot.activeElement) a = a.shadowRoot.activeElement
      return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable) ? true : null
    }), 2000)
    need(asked, 'New section asked for no name (no text field took focus)')
    await page.keyboard.type(F.section_name)
    await page.keyboard.press('Enter')
    const shown = await waitFor(() => sideText(page, F.section_name), 3000)
    need(shown, `no "${F.section_name}" section in the sidebar after naming it`)
  })
})
