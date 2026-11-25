// S1.2 a box holds nothing for Vibe Tracks, and tree changes never write a box.
import { writeFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { group, need, sleep, waitFor, row, order, under, sideText, openRowMenu, closeMenus, itemOf, submenu, clickItem, dialogs, rowMenuAction } from '../lib.mjs'
import { one, byRole, drag, shape, walkNames, openViewMenu } from './common.mjs'

const S12 = ['S1.2 every sidebar verb ran: drag, pin, rename, archive, move to section, delete',
  "S1.2 after them each box's git status is clean and its HEAD unchanged",
  'S1.2 no file under any box is named like vibetracks or vibe-tracks',
  'S1.2 a vibetracks.toml dropped into a box changes nothing on the page']

export default group('verbs', S12, async (ctx, t) => {
  const { page, F, stage, titles } = ctx
  const all = [...F.boxes, F.extra]
  const tops = F.boxes.filter((b) => !b.parent && (b.roles.includes('nosite') || b.roles.includes('top_leaf')))
  const ran = {}
  const renamed = `Renamed ${F.boxes[0].title.split(' ')[0]} ${F.seed}`
  // drag: a top-level leaf onto another
  {
    const a = await row(page, tops[1].title), b = await row(page, tops[0].title)
    if (a && b) {
      await drag(page, { x: a.text.x + 6, y: a.row.y + a.row.h / 2 }, { x: b.text.x + 30, y: b.row.y + b.row.h / 2 })
      ran.drag = under(await order(page, titles), tops[1].title, tops[0].title)
    } else ran.drag = false
  }
  // pin
  {
    const box = one(F, 'rollup_blocked')
    ran.pin = (await rowMenuAction(page, box.title, /^pin$/i)) && !!(await waitFor(() => sideText(page, 'Pinned'), 2000))
    await closeMenus(page)
  }
  // rename (Vibe Tracks' label only)
  {
    const box = one(F, 'rollup_working')
    const ok = await rowMenuAction(page, box.title, /^rename$/i)
    if (ok) {
      await sleep(300)
      await page.keyboard.press('Control+A')
      await page.keyboard.type(renamed)
      await page.keyboard.press('Enter')
    }
    ran.rename = ok && !!(await waitFor(() => sideText(page, renamed), 3000))
    await closeMenus(page)
  }
  // archive
  {
    const box = byRole(F, 'chain_sibling')[0]
    ran.archive = (await rowMenuAction(page, box.title, /^archive$/i)) && !!(await waitFor(async () => !(await row(page, box.title)), 3000))
    await closeMenus(page)
  }
  // move to section: a section first (the view menu's New section), then the row's Move to section ›
  {
    const box = tops[tops.length - 1]
    const vm = await openViewMenu(page, titles)
    const ns = itemOf(vm, /^New section$/i)
    if (ns) {
      await clickItem(page, ns)
      await sleep(400)
      await page.keyboard.type(F.section_name)
      await page.keyboard.press('Enter')
      await sleep(600)
    }
    await closeMenus(page)
    const m = await openRowMenu(page, box.title)
    const it = itemOf(m, /^Move to section$/i)
    let ok = false
    if (it) {
      const sub = await submenu(page, it)
      const target = itemOf(sub, new RegExp(`^${F.section_name}$`))
      if (target) {
        await clickItem(page, target)
        ok = !!(await waitFor(async () => {
          const h = await sideText(page, F.section_name), r = await row(page, box.title)
          return h && r && r.row.y > h.text.y ? true : null
        }, 3000))
      }
    }
    await closeMenus(page)
    ran.section = ok
  }
  // delete (from Vibe Tracks only)
  {
    const box = byRole(F, 'done_box').find((b) => !b.parent) || byRole(F, 'done_box')[0]
    const ok = await rowMenuAction(page, box.title, /^delete$/i)
    if (ok && (await waitFor(async () => (await dialogs(page)).length ? true : null, 1500))) {
      const b = await page.evaluate(() => {
        const V = window.__vta
        const el = V.all().find((e) => (e.tagName === 'BUTTON' || e.getAttribute('role') === 'button') && V.vis(e) && /^delete/i.test(V.fullText(e)) && e.closest && e.closest('[role="dialog"],[role="alertdialog"],dialog,[aria-modal="true"]'))
        return el ? V.rect(el) : null
      })
      if (b) await page.mouse.click(b.x + b.w / 2, b.y + b.h / 2)
    }
    ran.delete = ok && !!(await waitFor(async () => !(await row(page, box.title)), 3000))
    await closeMenus(page)
  }
  ctx.diag.groups.verbs_ran = ran
  const allRan = Object.values(ran).every(Boolean)
  const missing = Object.entries(ran).filter(([, v]) => !v).map(([k]) => k)
  await t(S12[0], async () => { need(allRan, `these verbs found no control or had no effect in the sidebar: ${missing.join(', ')}`) })
  await sleep(1500)
  await t(S12[1], async () => {
    need(allRan, `precondition: every verb runs first (${missing.join(', ')} did not)`)
    const bad = []
    for (const b of all) {
      const st = stage.git(b.path, ['status', '--porcelain']), head = stage.git(b.path, ['rev-parse', 'HEAD'])
      if (st.code !== 0 || st.out) bad.push(`${b.slug}: ${st.out || st.err}`)
      if (head.out !== b.head) bad.push(`${b.slug}: HEAD ${b.head.slice(0, 7)} → ${head.out.slice(0, 7)}`)
    }
    need(!bad.length, bad.join('; '))
  })
  await t(S12[2], async () => {
    need(allRan, `precondition: every verb runs first (${missing.join(', ')} did not)`)
    const hits = all.flatMap((b) => walkNames(b.path)).filter((p) => /vibe-?tracks?|vibetrack/i.test(p.split('/').pop()))
    need(!hits.length, hits.join(', '))
  })
  await t(S12[3], async () => {
    const box = one(F, 'chain_top')
    need(await row(page, box.title), `no row for ${box.title} to compare`)
    const before = shape(await order(page, [...titles, renamed]))
    const text0 = await page.evaluate(() => { const V = window.__vta, s = V.sidebar(); return V.all().filter((e) => V.vis(e) && V.inside(V.rect(e), s, 2) && V.ownText(e)).map((e) => V.ownText(e)).join('|') })
    const file = join(box.path, 'vibetracks.toml')
    const other = one(F, 'rollup_parent')
    writeFileSync(file, `title = "Toml Says Rename"\nparent = "${other.slug}"\npinned = true\narchived = true\n`)
    try {
      await sleep(6000)
      const after = shape(await order(page, [...titles, renamed]))
      const text1 = await page.evaluate(() => { const V = window.__vta, s = V.sidebar(); return V.all().filter((e) => V.vis(e) && V.inside(V.rect(e), s, 2) && V.ownText(e)).map((e) => V.ownText(e)).join('|') })
      need(after === before, `the tree changed:\nbefore ${before}\nafter  ${after}`)
      need(!/Toml Says Rename/.test(text1), "the toml's title shows in the sidebar")
      need(text1 === text0, 'the sidebar text changed')
    } finally { try { unlinkSync(file) } catch (e) { /* gone */ } }
  })
})
