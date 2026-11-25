// S4.2 the New track dialog writes the command to copy, and can run it; S4.4 a new box shows under its parent at once.
import { group, need, sleep, waitFor, order, under, dialogs, boxesTitled, settle } from '../lib.mjs'
import { one, byRole, clickSide } from './common.mjs'

const S42 = ['S4.2 the command follows the name, the parent and Publish', 'S4.2 Copy puts the command on the clipboard',
  'S4.2 Create makes the box and shows it under its parent within 5 s']
const S44 = ['S4.4 vt new from a shell shows the row under its parent within 5 s']

const norm = (s) => (s || '').replace(/\s+/g, ' ').trim()
async function commandText(page) {
  return page.evaluate(() => {
    const V = window.__vta
    const els = V.all().filter((e) => V.vis(e) && /^\$?\s*vt new\b/.test(V.fullText(e)))
    els.sort((a, b) => V.fullText(a).length - V.fullText(b).length)
    return els.length ? V.fullText(els[0]).replace(/^\$\s*/, '') : null
  })
}

export default group('newtrack', [...S42, ...S44], async (ctx, t) => {
  const { page, F, stage, titles } = ctx
  const name = F.new_titles.s42
  const parent = one(F, 'chain_top')
  const want = [`vt new "${name}"`, `vt new "${name}" --parent ${parent.slug}`, `vt new "${name}" --parent ${parent.slug} --publish`]
  let opened = false, flow = []
  await t(S42[0], async () => {
    need(await clickSide(page, 'New track'), 'no New track row')
    opened = !!(await waitFor(async () => (await dialogs(page)).length ? true : null, 3000))
    need(opened, 'New track opened no dialog')
    const nameField = page.locator('[role="dialog"] input:visible, dialog input:visible, [aria-modal="true"] input:visible').filter({ hasNot: page.locator('[type="checkbox"]') })
    const fields = await nameField.count()
    need(fields, 'the dialog has no text field for the name')
    let target = null, firstText = null
    for (let i = 0; i < fields; i++) {
      const f = nameField.nth(i)
      const type = ((await f.getAttribute('type')) || 'text').toLowerCase()
      if (!['text', 'search'].includes(type)) continue
      if (!firstText) firstText = f
      const hint = `${await f.getAttribute('placeholder') || ''} ${await f.getAttribute('aria-label') || ''} ${await f.getAttribute('name') || ''}`
      if (/name|title|called/i.test(hint)) { target = f; break }
    }
    target = target || firstText
    need(target, 'the dialog has no text field for the name')
    await target.click()
    await target.fill('')
    await page.keyboard.type(name)
    await sleep(300)
    flow.push(['name', norm(await commandText(page))])
    const selects = page.locator('[role="dialog"] select:visible, dialog select:visible, [aria-modal="true"] select:visible')
    let chose = false
    for (let i = 0; i < await selects.count(); i++) {
      const opts = await selects.nth(i).locator('option').allTextContents()
      const hit = opts.find((o) => o.trim() === parent.title || o.trim() === parent.slug)
      if (hit) { await selects.nth(i).selectOption({ label: hit }); chose = true; break }
    }
    await sleep(300)
    flow.push(['parent', norm(await commandText(page))])
    const pub = page.locator('[role="dialog"] label:has-text("Publish"), dialog label:has-text("Publish"), [aria-modal="true"] label:has-text("Publish"), [role="switch"]:visible')
    const flipped = (await pub.count()) > 0
    if (flipped) await pub.first().click()
    await sleep(300)
    flow.push(['publish', norm(await commandText(page))])
    const bad = flow.map(([step, got], i) => (got === want[i] ? null : `after ${step}: "${got ?? 'no command shown'}", want "${want[i]}"`)).filter(Boolean)
    need(chose, `no Under choice offering ${parent.title}`)
    need(flipped, 'no Publish to GitHub switch')
    need(!bad.length, bad.join('; '))
  })
  await t(S42[1], async () => {
    need(opened, 'no New track dialog')
    const shown = norm(await commandText(page))
    const copy = await page.evaluate(() => {
      const V = window.__vta
      const el = V.all().find((e) => V.vis(e) && (e.tagName === 'BUTTON' || e.getAttribute('role') === 'button') && /copy/i.test(V.fullText(e) + ' ' + (e.getAttribute('aria-label') || '')))
      return el ? V.rect(el) : null
    })
    need(copy, 'no Copy command button')
    await page.mouse.click(copy.x + copy.w / 2, copy.y + copy.h / 2)
    await sleep(400)
    const clip = await page.evaluate(() => navigator.clipboard.readText().catch((e) => 'unreadable: ' + e.message))
    need(norm(clip) === shown && shown, `clipboard "${clip}", command "${shown}"`)
  })
  await t(S42[2], async () => {
    need(opened, 'no New track dialog')
    const pub = page.locator('[role="dialog"] label:has-text("Publish"), dialog label:has-text("Publish"), [aria-modal="true"] label:has-text("Publish"), [role="switch"]:visible')
    if ((norm(await commandText(page)) || '').includes('--publish') && await pub.count()) { await pub.first().click(); await sleep(300) }
    const create = await page.evaluate(() => {
      const V = window.__vta
      const el = V.all().find((e) => V.vis(e) && (e.tagName === 'BUTTON' || e.getAttribute('role') === 'button') && /^create\b/i.test(V.fullText(e)))
      return el ? V.rect(el) : null
    })
    need(create, 'no Create button in the dialog')
    await page.mouse.click(create.x + create.w / 2, create.y + create.h / 2)
    const t0 = Date.now()
    const shown = await waitFor(async () => under(await order(page, [...titles, name]), name, parent.title), 5000, 200)
    const made = boxesTitled(stage.home, name)
    need(shown, `"${name}" is not under ${parent.title} in the sidebar within 5 s of Create`)
    need(made.length === 1, `boxes titled "${name}" under HOME: ${made.length}`)
    const commits = stage.git(made[0], ['rev-list', '--count', 'HEAD'])
    need(commits.out === '1', `${made[0]} has ${commits.out || 'no'} commits, want 1`)
    return `${Date.now() - t0} ms`
  })
  await page.keyboard.press('Escape')
  await clickSide(page, 'Home')
  await t(S44[0], async () => {
    const title = F.new_titles.s44
    const p = one(F, 'rollup_parent')
    const r = stage.vtRun(['new', title, '--parent', p.slug])
    need(r.code === 0, `vt new exited ${r.code}: ${r.out.slice(-400)}`)
    const t0 = Date.now()
    const ok = await waitFor(async () => under(await order(page, [...titles, title]), title, p.title), 5000, 200)
    need(ok, `"${title}" is not under ${p.title} in the sidebar within 5 s of vt new exiting`)
    return `${Date.now() - t0} ms`
  })
})
