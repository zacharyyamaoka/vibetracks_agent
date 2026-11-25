// S4.1 `vt new` duplicates the black-box template; S4.3 local-first, publishing needs `gh` signed in (a fake gh that
// records its arguments); S1.5 add a box that already exists.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { group, need, sleep, waitFor, order, under, hashTree, changedFiles, listFiles, readmeHeading, settle, load } from '../lib.mjs'
import { one, byRole } from './common.mjs'

const S41 = ['S4.1 vt new exits 0 offline and makes a new box folder', 'S4.1 the folder is a git repo with one commit',
  "S4.1 its README's first heading is the title", "S4.1 its files include the starter box's",
  'S4.1 the track is in the tree under the parent', "S4.1 --from copies the source box's files without its history"]
const S43 = ['S4.3 without --publish gh is never called', 'S4.3 signed out, --publish stops, names gh auth login and makes nothing',
  'S4.3 signed in, --publish creates a private repo from the folder and pushes once']
const S15 = ['S1.5 adding a plain folder exits non-zero, names what is missing and leaves the tree unchanged',
  'S1.5 vt add lists an existing box under its parent in the sidebar']

/** Git repos under HOME (two levels deep). */
function repos(home) {
  const out = new Set()
  const look = (d, depth) => {
    let es = []
    try { es = readdirSync(d, { withFileTypes: true }) } catch (e) { return }
    for (const e of es) {
      if (!e.isDirectory() || e.name === '.git' || e.name === 'node_modules') continue
      const p = join(d, e.name)
      if (existsSync(join(p, '.git'))) out.add(p)
      else if (depth < 2) look(p, depth + 1)
    }
  }
  look(home, 0)
  return out
}
const newRepos = (before, home) => [...repos(home)].filter((p) => !before.has(p))
const ghCalls = (F) => readFileSync(F.gh.log, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))

export default group('cli', [...S41, ...S43, ...S15], async (ctx, t) => {
  const { page, F, stage, titles } = ctx
  const home = stage.home
  const parent = one(F, 'rollup_parent')

  // ── S4.1 ──
  const title = F.new_titles.s41
  let made = null
  await t(S41[0], async () => {
    const before = repos(home)
    const r = stage.vtRun(['new', title, '--parent', parent.slug])
    need(r.code === 0, `vt new "${title}" --parent ${parent.slug} exited ${r.code}: ${r.out.slice(-500)}`)
    const fresh = newRepos(before, home)
    need(fresh.length === 1, `new git repos under HOME: ${fresh.length} (${fresh.join(', ')})`)
    made = fresh[0]
    return made
  })
  await t(S41[1], async () => {
    need(made, 'no box was made (the first S4.1 check)')
    const n = stage.git(made, ['rev-list', '--count', 'HEAD'])
    need(n.code === 0 && n.out === '1', `commits: ${n.out || n.err}`)
  })
  await t(S41[2], async () => {
    need(made, 'no box was made')
    need(readmeHeading(made) === title, `README.md's first heading is "${readmeHeading(made)}"`)
  })
  await t(S41[3], async () => {
    need(made, 'no box was made')
    const have = new Set(listFiles(made))
    const missing = F.starter_files.filter((f) => !have.has(f))
    need(!missing.length, `missing: ${missing.join(', ')}`)
  })
  await t(S41[4], async () => {
    need(made, 'no box was made')
    await load(page, stage, titles)
    const ok = await waitFor(async () => under(await order(page, [...titles, title]), title, parent.title), 5000, 250)
    need(ok, `"${title}" is not under ${parent.title} in the sidebar`)
  })
  await t(S41[5], async () => {
    const src = one(F, 'rollup_working')
    const t2 = F.new_titles.s41_from
    const before = repos(home)
    const r = stage.vtRun(['new', t2, '--from', src.slug])
    need(r.code === 0, `vt new "${t2}" --from ${src.slug} exited ${r.code}: ${r.out.slice(-400)}`)
    const fresh = newRepos(before, home)
    need(fresh.length === 1, `new git repos under HOME: ${fresh.length}`)
    const tracked = stage.git(src.path, ['ls-files']).out.split('\n').filter(Boolean)
    const have = new Set(listFiles(fresh[0]))
    const missing = tracked.filter((f) => !have.has(f))
    need(!missing.length, `not copied: ${missing.join(', ')}`)
    const n = stage.git(fresh[0], ['rev-list', '--count', 'HEAD'])
    need(n.out === '1', `${n.out || 'no'} commits, want 1 (no history)`)
    const old = stage.git(fresh[0], ['cat-file', '-e', `${src.head}^{commit}`])
    need(old.code !== 0, `the source's commit ${src.head.slice(0, 7)} is in the copy's history`)
  })

  // ── S4.3 ──
  await t(S43[0], async () => {
    const before = repos(home), n0 = ghCalls(F).length
    const r = stage.vtRun(['new', F.new_titles.s43_local])
    need(r.code === 0 && newRepos(before, home).length === 1, `vt new without --publish did not make a box (exit ${r.code}): ${r.out.slice(-300)}`)
    const calls = ghCalls(F).slice(n0)
    need(!calls.length, `gh was called: ${calls.map((c) => c.args.join(' ')).join('; ')}`)
  })
  await t(S43[1], async () => {
    writeFileSync(F.gh.state, 'out\n')
    const before = repos(home)
    const top0 = new Set(readdirSync(home))
    const r = stage.vtRun(['new', F.new_titles.s43_out, '--publish'])
    need(r.code !== 0 && r.code != null, `exit ${r.code} while gh is signed out`)
    need(/gh auth login/.test(r.out), `the message does not name gh auth login: ${r.out.slice(-300)}`)
    const slug = F.new_titles.s43_out.toLowerCase().replace(/[^a-z0-9]+/g, '')
    const made = [...newRepos(before, home), ...readdirSync(home).filter((n) => !top0.has(n) && n.toLowerCase().replace(/[^a-z0-9]+/g, '').includes(slug))]
    need(!made.length, `made anyway: ${made.join(', ')}`)
  })
  await t(S43[2], async () => {
    writeFileSync(F.gh.state, 'in\n')
    const before = repos(home), n0 = ghCalls(F).length
    const r = stage.vtRun(['new', F.new_titles.s43_in, '--publish'])
    writeFileSync(F.gh.state, 'out\n')
    need(r.code === 0, `exit ${r.code} while gh is signed in: ${r.out.slice(-300)}`)
    const fresh = newRepos(before, home)
    need(fresh.length === 1, `new git repos under HOME: ${fresh.length}`)
    const creates = ghCalls(F).slice(n0).filter((c) => c.args[0] === 'repo' && c.args[1] === 'create')
    need(creates.length === 1, `gh repo create called ${creates.length} times`)
    const a = creates[0].args
    const srcIdx = a.findIndex((x) => x === '--source' || x.startsWith('--source='))
    const src = srcIdx < 0 ? null : a[srcIdx].includes('=') ? a[srcIdx].split('=')[1] : a[srcIdx + 1]
    need(a.includes('--private') && !a.includes('--public'), `not private: gh ${a.join(' ')}`)
    need(src && resolve(creates[0].cwd, src) === resolve(fresh[0]), `--source is ${src}, the box is ${fresh[0]}`)
    need(a.includes('--push'), `no --push: gh ${a.join(' ')}`)
  })

  // ── S1.5 ──
  await t(S15[0], async () => {
    const skip = ['.cache', ...[...F.boxes, F.extra].map((b) => b.path.slice(F.home.length + 1))]
    const h0 = hashTree(home, skip)
    await sleep(2500)
    const h1 = hashTree(home, skip)
    const volatile = new Set(changedFiles(h0, h1))
    const r = stage.vtRun(['add', F.plain_folder])
    await sleep(1200)
    const changed = changedFiles(h1, hashTree(home, skip)).filter((p) => !volatile.has(p) && !/(\.log$|(^|\/)logs?\/)/.test(p))
    need(r.code !== 0 && r.code != null, `vt add <plain folder> exited ${r.code}`)
    need(/README\.md|OBJECTIVES\.md|AGENTS\.md|ledger\.jsonl|status\.json|specs\/|feedback\//.test(r.out), `the message names nothing missing: ${r.out.slice(-300)}`)
    need(!changed.length, `files changed: ${changed.join(', ')}`)
  })
  await t(S15[1], async () => {
    const p = F.boxes.find((b) => b.slug === F.s15_parent)
    const r = stage.vtRun(['add', F.extra.path, '--parent', p.slug])
    need(r.code === 0, `vt add ${F.extra.path} --parent ${p.slug} exited ${r.code}: ${r.out.slice(-300)}`)
    let ok = await waitFor(async () => under(await order(page, [...titles, F.extra.title]), F.extra.title, p.title), 5000, 250)
    if (!ok) { await load(page, stage, titles); ok = await waitFor(async () => under(await order(page, [...titles, F.extra.title]), F.extra.title, p.title), 3000, 250) }
    need(ok, `"${F.extra.title}" is not under ${p.title} in the sidebar`)
  })
})
