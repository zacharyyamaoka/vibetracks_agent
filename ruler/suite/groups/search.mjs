// S2.11 Search (ruler v3, docs/peps/0003): a palette on Ctrl+K, Ctrl+O and Ctrl+P, a Search row with "Ctrl+K" in the
// sidebar's top rows, hits in the tracks' files naming track, file and line, the open track's first, Enter opening the
// page that shows the hit, Escape closing it. Real keys and pointer; read on screen (visible text, boxes, the focused
// element), never a class name or test id.
//
// The phrases: a box's own README marker line (unique to it), and Zach's own "ruler v1", which is on line 5 of every
// fixture box's README ("… acceptance run (ruler v1, seed N)."), so every box has a hit and the order can be read.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { group, need, sleep, waitFor, sideText, rows, url, urlNames, mainText } from '../lib.mjs'
import { byRole, one, clickTitle } from './common.mjs'

const S211 = [
  'S2.11 Ctrl+K opens the search palette with its input focused',
  'S2.11 Ctrl+O and Ctrl+P open the search palette too',
  'S2.11 Escape closes the search palette',
  'S2.11 the sidebar shows Search with Ctrl+K at its right end, below New track and above the tracks; a click opens the palette',
  "S2.11 a phrase from one box's files lists that hit with its track, file and line",
  "S2.11 with a track open, its hits come first",
  'S2.11 Enter on a hit opens its track on the page that shows it',
]

/** The focused text input (shadow roots and same-document only: focus inside a box's frame reads as none), remembered
 *  in the page as window.__vtaSearch; null when none is focused and visible. */
const focusedInput = (page) => page.evaluate(() => {
  let el = document.activeElement
  while (el && el.shadowRoot && el.shadowRoot.activeElement) el = el.shadowRoot.activeElement
  if (!el || el === document.body) return null
  const role = el.getAttribute && el.getAttribute('role')
  const texty = (el.tagName === 'INPUT' && !/^(checkbox|radio|button|submit|reset|range|color|file|hidden)$/i.test(el.type || ''))
    || el.tagName === 'TEXTAREA' || el.isContentEditable || /^(combobox|searchbox|textbox)$/.test(role || '')
  if (!texty || !window.__vta.vis(el)) return null
  window.__vtaSearch = el
  return { rect: window.__vta.rect(el), placeholder: el.getAttribute('placeholder') || '', label: el.getAttribute('aria-label') || '' }
})
const paletteShown = (page) => page.evaluate(() => !!window.__vtaSearch && window.__vta.vis(window.__vtaSearch))
/** Nothing focused: the state a person is in after clicking empty space. */
const neutral = async (page) => { await page.evaluate(() => { const a = document.activeElement; if (a && a.blur) a.blur() }); await sleep(150) }
async function closePalette(page) {
  for (let i = 0; i < 2 && (await paletteShown(page)); i++) { await page.keyboard.press('Escape'); await sleep(250) }
}
async function openWith(page, keys) {
  await closePalette(page)
  await neutral(page)
  await page.evaluate(() => { window.__vtaSearch = null })
  await page.keyboard.press(keys)
  return waitFor(() => focusedInput(page), 1500, 100)
}

/** The hit rows on screen naming `file`, top to bottom: each row is the tallest ancestor (≤ 72 px) of the smallest
 *  element holding the file name that holds it once; its track is a fixture title (or slug) in the row, else the
 *  nearest title above it within 240 px (a group heading). */
async function hitRows(page, file, titles, slugs) {
  return page.evaluate(([file, titles, slugs]) => {
    const V = window.__vta
    const count = (t) => t.split(file).length - 1
    const leaves = V.all().filter((el) => V.vis(el) && el !== window.__vtaSearch && V.fullText(el).includes(file)
      && ![...el.children].some((c) => V.fullText(c).includes(file)))
    const seen = new Set(), out = []
    for (const leaf of leaves) {
      let row = leaf
      for (let a = V.parentOf(leaf); a; a = V.parentOf(a)) {
        const r = a.getBoundingClientRect()
        if (r.height > 72 || count(V.fullText(a)) > 1) break
        row = a
      }
      if (seen.has(row)) continue
      seen.add(row)
      const r = V.rect(row), text = V.fullText(row)
      const named = (s) => titles.findIndex((t, i) => s.includes(t) || s.includes(slugs[i]))
      let track = named(text)
      if (track < 0) {
        let best = null
        for (const el of V.all()) {
          if (!V.vis(el)) continue
          const own = V.ownText(el)
          const k = titles.indexOf(own) >= 0 ? titles.indexOf(own) : slugs.indexOf(own)
          if (k < 0) continue
          const er = V.rect(el)
          if (er.y > r.y + 2 || er.y < r.y - 240 || er.r < r.x || er.x > r.r) continue
          if (!best || er.y > best.y) best = { y: er.y, k }
        }
        track = best ? best.k : -1
      }
      out.push({ y: r.y, x: r.x, text: text.slice(0, 300), track: track >= 0 ? titles[track] : null })
    }
    return out.sort((a, b) => a.y - b.y)
  }, [file, titles, slugs])
}
const lineIs = (text, file, n) => new RegExp(`${file.replace('.', '\\.')}\\s*(?:[:#(]|,?\\s*line\\s*|\\s+L)\\s*${n}\\b|\\bline\\s*${n}\\b`, 'i').test(text)
/** The 1-based line of the box's file that holds the phrase. */
function lineOf(stage, F, box, file, phrase) {
  const text = readFileSync(join(box.path.replace(F.home, stage.home), file), 'utf8')
  return text.split('\n').findIndex((l) => l.includes(phrase)) + 1
}

export default group('search', S211, async (ctx, t) => {
  const { page, F, stage } = ctx
  const boxes = F.boxes
  const titles = boxes.map((b) => b.title), slugs = boxes.map((b) => b.slug)

  await t(S211[0], async () => {
    const box = await openWith(page, 'Control+k')
    need(box, 'Ctrl+K: no text input appears focused (in the page, outside any box frame) within 1.5 s')
    return `${box.placeholder || box.label || 'an input'} at ${Math.round(box.rect.x)},${Math.round(box.rect.y)}`
  })
  await t(S211[1], async () => {
    const missing = []
    for (const keys of ['Control+o', 'Control+p']) if (!(await openWith(page, keys))) missing.push(keys.replace('Control+', 'Ctrl+').toUpperCase().replace('CTRL', 'Ctrl'))
    await closePalette(page)
    need(!missing.length, `${missing.join(' and ')}: no focused search input appears within 1.5 s`)
  })
  await t(S211[2], async () => {
    need(await openWith(page, 'Control+k'), 'Ctrl+K opens no palette to close (the first S2.11 check)')
    await page.keyboard.press('Escape')
    const gone = await waitFor(async () => !(await paletteShown(page)), 1500, 100)
    need(gone, 'the search input is still on screen 1.5 s after Escape')
  })
  await t(S211[3], async () => {
    await closePalette(page)
    const search = await sideText(page, 'Search')
    need(search, 'no sidebar row reads "Search"')
    need(/ctrl\s*\+?\s*k/i.test(search.rowText), `the Search row reads "${search.rowText}", with no "Ctrl+K"`)
    const kbd = await page.evaluate((row) => {
      const V = window.__vta
      const box = { l: row.x, r: row.x + row.w, t: row.y, b: row.y + row.h }
      const els = V.all().filter((el) => V.vis(el) && V.inside(V.rect(el), box, 2) && /ctrl\s*\+?\s*k/i.test(V.fullText(el)))
      els.sort((a, b) => V.rect(a).w - V.rect(b).w)
      return els[0] ? V.rect(els[0]) : null
    }, search.row)
    need(kbd && search.row.x + search.row.w - (kbd.x + kbd.w) <= 32, `"Ctrl+K" ends ${kbd ? Math.round(search.row.x + search.row.w - kbd.x - kbd.w) : '?'} px from the Search row's right end (want ≤ 32)`)
    const nt = await sideText(page, 'New track')
    const list = await rows(page, titles)
    need(nt && search.row.y > nt.row.y, `Search (y ${Math.round(search.row.y)}) is not below New track (y ${nt ? Math.round(nt.row.y) : 'none'})`)
    need(list.length && search.row.y < list[0].row.y, `Search is not above the first track row ${list[0] ? list[0].title : '(none)'}`)
    await neutral(page)
    await page.evaluate(() => { window.__vtaSearch = null })
    await page.mouse.click(search.text.x + Math.min(10, search.text.w / 2), search.text.y + search.text.h / 2)
    const opened = await waitFor(() => focusedInput(page), 1500, 100)
    await closePalette(page)
    need(opened, 'a click on Search opens no focused search input')
  })

  const unique = byRole(F, 'top_leaf')[0]
  await t(S211[4], async () => {
    const phrase = unique.readme_marker
    const line = lineOf(stage, F, unique, 'README.md', phrase)
    need(await openWith(page, 'Control+k'), 'Ctrl+K opens no palette')
    await page.keyboard.type(phrase)
    const hit = await waitFor(async () => (await hitRows(page, 'README.md', titles, slugs)).find((h) => h.track === unique.title), 5000, 200)
    const all = await hitRows(page, 'README.md', titles, slugs)
    await closePalette(page)
    need(hit, `typing "${phrase}" lists no hit naming ${unique.title} and README.md within 5 s (hits naming README.md: ${all.map((h) => `${h.track || '?'}: ${h.text.slice(0, 80)}`).join(' | ') || 'none'})`)
    need(lineIs(hit.text, 'README.md', line), `the hit "${hit.text.slice(0, 160)}" does not give its line, ${line}`)
    return hit.text.slice(0, 160)
  })
  await t(S211[5], async () => {
    const open = byRole(F, 'top_leaf')[1] || byRole(F, 'top_leaf')[0]
    need(await clickTitle(page, open.title), `no row for ${open.title}`)
    need(await waitFor(async () => urlNames(url(page), open), 3000), `${open.title} did not open`)
    need(await openWith(page, 'Control+k'), 'Ctrl+K opens no palette')
    await page.keyboard.type('ruler v1')
    const list = await waitFor(async () => { const h = await hitRows(page, 'README.md', titles, slugs); return new Set(h.map((x) => x.track).filter(Boolean)).size >= 2 ? h : null }, 6000, 250)
    const seen = list || await hitRows(page, 'README.md', titles, slugs)
    await closePalette(page)
    need(list, `typing "ruler v1" (line 5 of every box's README) lists hits from ${new Set(seen.map((x) => x.track).filter(Boolean)).size} track(s) within 6 s, not 2 or more`)
    const first = list.find((h) => h.track)
    need(first.track === open.title, `with ${open.title} open, the first hit is ${first.track}'s ("${first.text.slice(0, 100)}")`)
    return `${list.length} hits; first ${first.track}`
  })
  await t(S211[6], async () => {
    const box = one(F, 'nosite')
    const phrase = box.readme_marker
    need(await openWith(page, 'Control+k'), 'Ctrl+K opens no palette')
    await page.keyboard.type(phrase)
    const hit = await waitFor(async () => (await hitRows(page, 'README.md', titles, slugs)).find((h) => h.track === box.title), 5000, 200)
    need(hit, `typing "${phrase}" lists no hit for ${box.title}`)
    const before = url(page)
    await page.keyboard.press('Enter')
    let moved = await waitFor(async () => urlNames(url(page), box) && url(page) !== before, 2000)
    if (!moved) { await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); moved = await waitFor(async () => urlNames(url(page), box), 2000) }
    need(moved, `Enter on the hit did not open ${box.title} (address ${url(page)})`)
    const shown = await waitFor(() => mainText(page, phrase), 5000, 200)
    need(shown, `${box.title} opened, but its README line "${phrase}" is not on screen in the main pane`)
  })
  await closePalette(page)
})
