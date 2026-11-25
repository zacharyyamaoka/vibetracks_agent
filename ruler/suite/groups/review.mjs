// S3.2 Review is a box's own review page over every track's waits; S3.3 Feedback is a box's own feedback page over
// every track's feedback notes.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { group, need, sleep, waitFor, mainText, url, urlNames, hashTree, changedFiles, dialogs, settle } from '../lib.mjs'
import { clickSide } from './common.mjs'

const COMP = JSON.parse(readFileSync(fileURLToPath(new URL('../../reference/box-components.json', import.meta.url)), 'utf8'))
const S32 = ['S3.2 both waits are on Review, each labelled with its track', "S3.2 the waits sit in the element a box's own site uses",
  "S3.2 clicking a wait opens its box's page"]
const S33 = ['S3.3 every feedback note is listed with its track', 'S3.3 the side panel opens the note',
  "S3.3 adding feedback writes one new file in the chosen box's feedback/ and nothing else"]

/** In whichever frame holds `text`: does an ancestor (within 4 levels, ≤ 160 px tall) also read `label`, and is it
 *  inside a <tag>? */
async function context(page, text, label, tag) {
  for (const frame of page.frames()) {
    let r = null
    try {
      r = await frame.evaluate(([text, label, tag]) => {
        if (!window.__vta) return null
        const V = window.__vta
        const el = V.findText(text, false)[0]
        if (!el) return null
        let labelled = false, inside = false
        let a = el
        for (let i = 0; a && i < 6; i++, a = V.parentOf(a)) {
          if (V.rect(a).h > 160) break
          if (V.fullText(a).includes(label)) { labelled = true; break }
        }
        for (let b = el; b; b = V.parentOf(b)) if (tag && b.tagName && b.tagName.toLowerCase() === tag) { inside = true; break }
        return { labelled, inside }
      }, [text, label, tag])
    } catch (e) { r = null }
    if (r) return r
  }
  return null
}

export default group('review', [...S32, ...S33], async (ctx, t) => {
  const { page, F, stage } = ctx
  const waits = F.boxes.flatMap((b) => b.waits.map((w) => ({ box: b, text: w })))
  const notes = F.boxes.flatMap((b) => b.feedback.map((n) => ({ box: b, ...n })))
  const allBoxes = [...F.boxes, F.extra]

  await t(S32[0], async () => {
    need(await clickSide(page, 'Review'), 'no Review row')
    const bad = []
    for (const w of waits) {
      const at = await waitFor(() => mainText(page, w.text), 5000, 200)
      if (!at) { bad.push(`"${w.text}" not on Review`); continue }
      const c = await context(page, w.text, w.box.title, null)
      if (!c || !c.labelled) bad.push(`"${w.text}" not labelled ${w.box.title}`)
    }
    need(!bad.length, bad.join('; '))
  })
  await t(S32[1], async () => {
    const bad = []
    for (const w of waits) {
      const c = await context(page, w.text, w.box.title, COMP.needs_you.tag)
      if (!c || !c.inside) bad.push(`"${w.text}" is not inside <${COMP.needs_you.tag}>`)
    }
    need(!bad.length, bad.join('; '))
  })
  await t(S32[2], async () => {
    const w = waits[0]
    const at = await mainText(page, w.text)
    need(at, `"${w.text}" not on Review`)
    await page.mouse.click(at.x + Math.min(20, at.w / 2), at.y + at.h / 2)
    const ok = await waitFor(async () => urlNames(url(page), w.box) || (w.box.site ? await mainText(page, w.box.marker) : await mainText(page, w.box.readme_marker)), 8000, 200)
    need(ok, `clicking the wait did not open ${w.box.title}'s page (address ${url(page)})`)
  })

  await t(S33[0], async () => {
    need(await clickSide(page, 'Feedback'), 'no Feedback row')
    const bad = []
    for (const n of notes) {
      const at = await waitFor(() => mainText(page, n.title), 5000, 200)
      if (!at) { bad.push(`"${n.title}" not listed`); continue }
      const c = await context(page, n.title, n.box.title, null)
      if (!c || !c.labelled) bad.push(`"${n.title}" not labelled ${n.box.title}`)
    }
    need(!bad.length, bad.join('; '))
  })
  await t(S33[1], async () => {
    const n = notes[0]
    const at = await mainText(page, n.title)
    need(at, `"${n.title}" not listed`)
    await page.mouse.click(at.x + Math.min(20, at.w / 2), at.y + at.h / 2)
    const shown = await waitFor(() => mainText(page, `(note ${n.token})`), 5000, 200)
    need(shown, `clicking "${n.title}" did not show its note's text "${n.body}"`)
    await page.keyboard.press('Escape')
    await sleep(300)
  })
  await t(S33[2], async () => {
    if (!/feedback/i.test(url(page))) await clickSide(page, 'Feedback')
    const target = F.boxes.find((b) => b.roles.includes('top_leaf') && !b.feedback.length) || F.boxes[0]
    const before = Object.fromEntries(allBoxes.map((b) => [b.slug, hashTree(b.path, ['.git'])]))
    const d0 = (await dialogs(page)).length
    const add = await page.evaluate(() => {
      const V = window.__vta, side = V.sidebar()
      const el = V.all().find((e) => V.vis(e) && (e.tagName === 'BUTTON' || e.getAttribute('role') === 'button') && V.rect(e).x >= side.r &&
        /^(\+\s*)?(new|add)( feedback| note)?$|^\+$/i.test(V.fullText(e) || e.getAttribute('aria-label') || ''))
      return el ? V.rect(el) : null
    })
    need(add, 'no New / Add feedback button on the Feedback page')
    await page.mouse.click(add.x + add.w / 2, add.y + add.h / 2)
    await sleep(600)
    // the track to file it under: a <select> or a combobox that offers the boxes
    const choose = page.locator('select:visible')
    let picked = false
    for (let i = 0; i < await choose.count(); i++) {
      const opts = await choose.nth(i).locator('option').allTextContents()
      const hit = opts.find((o) => o.trim() === target.title || o.trim() === target.slug)
      if (hit) { await choose.nth(i).selectOption({ label: hit }); picked = true; break }
    }
    if (!picked) {
      const combo = page.locator('[role="combobox"]:visible, input[list]:visible')
      if (await combo.count()) { await combo.first().click(); await page.keyboard.type(target.title); await sleep(300); await page.keyboard.press('Enter'); picked = true }
    }
    need(picked, `nothing on the form asks which track (no select or combobox offering ${target.title})`)
    const words = `VTA feedback for ${target.title} (seed ${F.seed})`
    const field = page.locator('textarea:visible, input[type="text"]:visible:not([role="combobox"]):not([list]), [contenteditable="true"]:visible')
    need(await field.count(), 'no text field for the feedback')
    await field.first().click()
    await page.keyboard.type(words)
    const submit = await page.evaluate(() => {
      const V = window.__vta, side = V.sidebar()
      const el = V.all().find((e) => V.vis(e) && (e.tagName === 'BUTTON' || e.getAttribute('role') === 'button') && V.rect(e).x >= side.r && /^(add|save|create|submit|file( it)?|send)\b/i.test(V.fullText(e)))
      return el ? V.rect(el) : null
    })
    if (submit) await page.mouse.click(submit.x + submit.w / 2, submit.y + submit.h / 2)
    else await page.keyboard.press('Control+Enter')
    await sleep(2500)
    const changes = []
    for (const b of allBoxes) for (const f of changedFiles(before[b.slug], hashTree(b.path, ['.git']))) changes.push([b.slug, f, before[b.slug][f] ? 'changed' : 'new'])
    const mine = changes.filter(([s, f, k]) => s === target.slug && f.startsWith('feedback/') && k === 'new')
    need(mine.length === 1 && changes.length === 1, `writes: ${changes.map(([s, f, k]) => `${s}/${f} (${k})`).join(', ') || 'none'}; want exactly one new file in ${target.slug}/feedback/`)
  })
})
