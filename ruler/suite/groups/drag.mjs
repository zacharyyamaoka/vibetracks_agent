// S2.8 drag to reorder and to move under another track, on a stock tree; S1.3 Vibe Tracks owns the tree (its file
// is outside every box, survives a restart, and a hand edit of it shows in the sidebar).
import { readFileSync, writeFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { group, need, sleep, waitFor, row, order, under, sidebar, hashTree, changedFiles, settle } from '../lib.mjs'
import { one, byRole, drag, thinBars, shape, clickTitle } from './common.mjs'

const STOCK = JSON.parse(readFileSync(fileURLToPath(new URL('../../reference/stock-trees.json', import.meta.url)), 'utf8'))
const S28 = ['S2.8 dragging a row between two rows reorders it', 'S2.8 a drop indicator shows mid-drag',
  "S2.8 dropping onto a row makes it that row's child", 'S2.8 dragging out to the left makes it top-level',
  'S2.8 a drop into its own child is refused', 'S2.8 the moves survive a vt serve restart',
  'S2.8 the keyboard path does one reorder', 'S2.8 the page loads a stock tree package']
const S13 = ['S1.3 the tree set by a drag survives a restart', 'S1.3 the file that changed lives outside every box',
  'S1.3 a hand edit of that file moves the row within 5 s, with no reload']

/** Bytes of every file under HOME outside the boxes, for putting a tree file back by hand. */
function snapshotBytes(home, boxDirs) {
  const out = {}
  for (const rel of Object.keys(hashTree(home, [...boxDirs, '.cache']))) {
    const p = join(home, rel)
    try { if (statSync(p).size <= 4e6) out[rel] = readFileSync(p) } catch (e) { /* vanished */ }
  }
  return out
}

export default group('drag', [...S28, ...S13], async (ctx, t) => {
  const { page, F, stage } = ctx
  const titles = F.boxes.map((b) => b.title)
  const home = stage.home
  const boxDirs = [...F.boxes, F.extra].map((b) => relative(F.home, b.path))
  const tops = F.boxes.filter((b) => !b.parent && (b.roles.includes('nosite') || b.roles.includes('top_leaf')))
  const at = async (title) => { const r = await row(page, title); return r ? { x: r.text.x + 6, y: r.row.y + r.row.h / 2, r } : null }

  // 1. reorder: of the top-level leaves as shown now, the last one dropped between the first two
  let reordered = false, indicator = null
  let nosite = tops[0], leaf0 = tops[1]
  await t(S28[0], async () => {
    const leafTop = F.boxes.filter((b) => !b.parent && !F.boxes.some((k) => k.parent === b.slug)).map((b) => b.title)
    const shown = (await order(page, titles)).filter((r) => leafTop.includes(r.title))
    need(shown.length >= 3, `fewer than three top-level leaf rows shown: ${shape(shown)}`)
    const [first, second, last] = [shown[0], shown[1], shown[shown.length - 1]]
    const a = await row(page, first.title), b = await row(page, second.title), m = await at(last.title)
    need(a && b && m, 'rows not found')
    const y = (a.row.y + a.row.h + b.row.y) / 2
    const before = await thinBars(page)
    indicator = await drag(page, m, { x: a.text.x + 10, y }, async () => {
      const now = await thinBars(page)
      const fresh = now.filter((r) => !before.some((o) => o.x === r.x && o.y === r.y && o.w === r.w) && Math.abs(r.y + r.h / 2 - y) <= 12)
      return fresh[0] || null
    })
    const list = await order(page, titles)
    const i = (x) => list.findIndex((r) => r.title === x)
    need(i(first.title) >= 0 && i(first.title) < i(last.title) && i(last.title) < i(second.title), `${last.title} was dropped between ${first.title} and ${second.title}; after the drag: ${shape(list)}`)
    need(list[i(last.title)].x === list[i(first.title)].x, `${last.title} changed depth (${list[i(last.title)].x} vs ${list[i(first.title)].x})`)
    reordered = true
    nosite = F.boxes.find((b) => b.title === first.title)
    leaf0 = F.boxes.find((b) => b.title === second.title)
  })
  await t(S28[1], async () => {
    need(indicator, 'no drop line (a bar ≤ 4 px tall, ≥ 40 px wide) near the drop point while dragging')
    return `bar ${indicator.w}×${indicator.h} at y ${indicator.y}`
  })

  // 2. onto a row: the first top-level leaf onto the no-site box; the files around it watched (S1.3)
  const quiet0 = hashTree(home, ['.cache'])
  await sleep(2500)
  const quiet1 = hashTree(home, ['.cache'])
  const volatile = new Set(changedFiles(quiet0, quiet1))
  const bytesBefore = snapshotBytes(home, boxDirs)
  let onto = false, treeFiles = []
  await t(S28[2], async () => {
    const target = await row(page, nosite.title), m = await at(leaf0.title)
    need(target && m, 'rows not found')
    await drag(page, m, { x: target.text.x + 30, y: target.row.y + target.row.h / 2 })
    const ok = await waitFor(async () => under(await order(page, titles), leaf0.title, nosite.title), 2000)
    need(ok, `${leaf0.title} is not under ${nosite.title}: ${shape(await order(page, titles))}`)
    onto = true
  })
  await sleep(1500)
  await t(S13[1], async () => {
    need(onto, 'the drag onto a row did not move it (S2.8), so nothing was set')
    const after = hashTree(home, ['.cache'])
    const changed = changedFiles(quiet1, after).filter((p) => !volatile.has(p))
    need(changed.length, 'the drag changed no file under HOME')
    const inBox = changed.filter((p) => boxDirs.some((d) => p === d || p.startsWith(d + '/')))
    treeFiles = changed.filter((p) => !inBox.includes(p) && bytesBefore[p])
    need(!inBox.length, `files inside a box changed: ${inBox.join(', ')}`)
    return changed.join(', ')
  })

  // 3. out to the left: a child dropped below its parent's block at the top-level indent
  const kid = one(F, 'rollup_working'), rollup = one(F, 'rollup_parent'), chainTop = one(F, 'chain_top')
  await t(S28[3], async () => {
    const list = await order(page, titles)
    const p = list.findIndex((r) => r.title === rollup.title)
    need(p >= 0, `no row for ${rollup.title}: ${shape(list)}`)
    need(under(list, kid.title, rollup.title), `${kid.title} is not under ${rollup.title} to begin with: ${shape(list)}`)
    let end = p
    while (end + 1 < list.length && list[end + 1].x > list[p].x + 1) end++
    const lastRow = await row(page, list[end].title), m = await at(kid.title)
    const nextRow = end + 1 < list.length ? await row(page, list[end + 1].title) : null
    need(lastRow && m, 'rows not found')
    const side = await sidebar(page)
    const x = Math.max(side.l + 4, list[p].x - 24)
    const y = nextRow ? (lastRow.row.y + lastRow.row.h + nextRow.row.y) / 2 : lastRow.row.y + lastRow.row.h + 3
    await drag(page, m, { x, y })
    const after = await order(page, titles)
    const k = after.find((r) => r.title === kid.title)
    need(k, `${kid.title} disappeared`)
    need(Math.abs(k.x - after.find((r) => r.title === rollup.title).x) <= 2 && !under(after, kid.title, rollup.title), `${kid.title} is not top-level: ${shape(after)}`)
  })

  // 4. into its own child: refused
  await t(S28[4], async () => {
    need(onto, 'precondition: a drop onto a row works (S2.8), else a refusal cannot be told from no drag at all')
    const child = F.boxes.find((b) => b.parent === chainTop.slug)
    const before = shape(await order(page, titles))
    const target = await row(page, child.title), m = await at(chainTop.title)
    need(target && m, 'rows not found')
    await drag(page, m, { x: target.text.x + 30, y: target.row.y + target.row.h / 2 })
    const after = shape(await order(page, titles))
    need(after === before, `the tree changed:\nbefore ${before}\nafter  ${after}`)
  })

  // 5. a restart
  const beforeRestart = shape(await order(page, titles))
  await ctx.restart()
  await settle(page)
  const afterRestart = await order(page, titles)
  await t(S28[5], async () => {
    need(reordered && onto, `precondition: the reorder and the drop onto a row both moved a row (reorder ${reordered}, onto ${onto})`)
    need(shape(afterRestart) === beforeRestart, `before the restart ${beforeRestart}\nafter  ${shape(afterRestart)}`)
  })
  await t(S13[0], async () => {
    need(onto, 'the drag onto a row did not move it')
    need(under(afterRestart, leaf0.title, nosite.title), `after the restart ${leaf0.title} is not under ${nosite.title}: ${shape(afterRestart)}`)
  })

  // 6. a hand edit: the tree file(s) put back as they were before the drag onto a row
  await t(S13[2], async () => {
    need(onto && treeFiles.length, 'no tree file was found (the check before)')
    await page.evaluate(() => { window.__vtaMark = 'vta-' + Math.random() })
    const mark = await page.evaluate(() => window.__vtaMark)
    for (const rel of treeFiles) writeFileSync(join(home, rel), bytesBefore[rel])
    const moved = await waitFor(async () => (!under(await order(page, titles), leaf0.title, nosite.title) && (await row(page, leaf0.title)) ? true : null), 5000, 200)
    const still = await page.evaluate(() => window.__vtaMark)
    need(moved, `${leaf0.title} is still under ${nosite.title} 5 s after ${treeFiles.join(', ')} was edited back`)
    need(still === mark, 'the page reloaded')
  })

  // 7. the keyboard: one reorder among siblings, by the first idiom that works
  await t(S28[6], async () => {
    const kids = F.boxes.filter((b) => b.parent === chainTop.slug).map((b) => b.title)
    const shownKids = (await order(page, titles)).filter((r) => kids.includes(r.title))
    need(shownKids.length >= 2, `${chainTop.title} shows fewer than two children: ${shape(shownKids)}`)
    const firstKid = { title: shownKids[0].title }, sib = { title: shownKids[1].title }
    const idx = (list, x) => list.findIndex((r) => r.title === x)
    const tried = []
    const idioms = [['Alt+ArrowUp'], ['Control+Shift+ArrowUp'], ['Meta+ArrowUp'], ['Control+Shift+KeyD', 'ArrowUp', 'ArrowUp', 'Enter'], ['menu']]
    for (const keys of idioms) {
      const before = await order(page, titles)
      if (!(idx(before, sib.title) > idx(before, firstKid.title))) break
      await clickTitle(page, sib.title)
      const r = await row(page, sib.title)
      if (!r) break
      await page.evaluate((y) => { const V = window.__vta; const els = V.all().filter((e) => V.vis(e) && e.tabIndex >= 0 && Math.abs(V.rect(e).y + V.rect(e).h / 2 - y) < 12 && V.rect(e).x < V.sidebar().r); if (els[0] && document.activeElement !== els[0] && !els[0].contains(document.activeElement)) els[0].focus() }, r.row.y + r.row.h / 2)
      if (keys[0] === 'menu') {
        await page.keyboard.press('Shift+F10')
        await sleep(400)
        for (let i = 0; i < 14; i++) {
          const focused = await page.evaluate(() => { let a = document.activeElement; while (a && a.shadowRoot && a.shadowRoot.activeElement) a = a.shadowRoot.activeElement; return a ? window.__vta.fullText(a) : '' })
          if (/^move up\b/i.test(focused)) { await page.keyboard.press('Enter'); break }
          await page.keyboard.press('ArrowDown')
          await sleep(80)
        }
      } else {
        for (const k of keys) { await page.keyboard.press(k); await sleep(120) }
      }
      await sleep(600)
      await page.keyboard.press('Escape')
      const after = await order(page, titles)
      tried.push(keys.join(' '))
      if (idx(after, sib.title) >= 0 && idx(after, sib.title) < idx(after, firstKid.title) && under(after, sib.title, chainTop.title)) return `by ${keys.join(' ')}`
    }
    need(false, `no keyboard path moved ${sib.title} above ${firstKid.title} (tried: ${tried.join('; ') || 'nothing'})`)
  })

  // 8. which tree: a stock package among the scripts the page loaded
  await t(S28[7], async () => {
    const found = []
    for (const pkg of STOCK.packages) {
      for (const s of ctx.scripts) {
        const byUrl = pkg.url_patterns.some((p) => s.url.toLowerCase().includes(p.toLowerCase()))
        const marks = pkg.markers.filter((m) => s.body.includes(`"${m}"`) || s.body.includes(`'${m}'`) || s.body.includes('`' + m + '`'))
        if (byUrl || (pkg.min_markers > 0 && marks.length >= pkg.min_markers)) { found.push(`${pkg.npm} (${byUrl ? 'url ' + s.url : 'markers ' + marks.join(', ')})`); break }
      }
    }
    ctx.diag.stock_tree = found
    need(found.length, `none of ${STOCK.packages.map((p) => p.npm).join(', ')} among the ${ctx.scripts.length} scripts the page loaded`)
    return found.join('; ')
  })
})
