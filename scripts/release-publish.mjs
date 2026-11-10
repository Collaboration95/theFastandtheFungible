/** Local release publisher. Dry-run performs the same builds/admission without remote writes. */
import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, readdirSync, statSync } from 'node:fs'
import { resolve, basename, join } from 'node:path'
import { admitLocalRelease, sha256 } from './release-contract.mjs'
import { sourceIdentity } from './ship-check.mjs'

const argv = process.argv.slice(3)
let tag, dryRun = false
while (argv.length) {
  const flag = argv.shift()
  if (flag === '--dry-run') dryRun = true
  else if (flag === '--tag' && argv[0] && !argv[0].startsWith('-')) tag = argv.shift()
  else throw Error('usage: node scripts/release.mjs publish --tag vX.Y.Z [--dry-run]')
}
if (!/^v\d+\.\d+\.\d+(?:-rc\.[1-9]\d*)?$/.test(tag ?? '')) throw Error('TAG must be vX.Y.Z or vX.Y.Z-rc.N')
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim()
const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8' }).trim()
const initial = sourceIdentity(), tagObject = git('rev-parse', '--verify', `refs/tags/${tag}`)
const assertSource = () => {
  if (JSON.stringify(sourceIdentity()) !== JSON.stringify(initial) || git('rev-parse', `refs/tags/${tag}`) !== tagObject || git('rev-parse', `${tag}^{commit}`) !== initial.sha) throw Error('Tag/source changed or does not match HEAD')
  if (JSON.parse(readFileSync('package.json')).version !== tag.slice(1)) throw Error('Tag/package version mismatch')
}
assertSource()
if (git('cat-file', '-t', tagObject) !== 'tag') throw Error('An annotated release tag is required')
const annotation = git('for-each-ref', `refs/tags/${tag}`, '--format=%(contents)')
if (!annotation) throw Error('Release annotation notes required')
git('fetch', '-q', 'origin', 'main', '--tags')
const mainAncestor = spawnSync('git', ['merge-base', '--is-ancestor', initial.sha, 'origin/main']).status === 0
if (!dryRun && !mainAncestor) throw Error('Release commit must be an ancestor of origin/main')
const latestGate = () => JSON.parse(gh('api', `repos/{owner}/{repo}/commits/${initial.sha}/status`)).statuses.find(s => s.context === 'local-gate')?.state
if (!dryRun && latestGate() !== 'success') throw Error('Merged SHA requires successful local-gate before release')
const out = resolve('dist/local-release'), timings = [], started = Date.now()
// Remove stale artifacts so the acceptance report can only contain this release.
for (const path of ['dist/release', 'dist/final', 'desktop/out']) rmSync(path, { recursive: true, force: true })
const run = (name, cmd, args, capture = false) => {
  assertSource()
  const start = Date.now()
  const output = execFileSync(cmd, args, { stdio: capture ? 'pipe' : 'inherit', encoding: 'utf8', maxBuffer: 32 * 1024 ** 2 })
  if (capture) process.stdout.write(output)
  timings.push({ name, durationMs: Date.now() - start })
  assertSource()
  return output
}
const gateOutput = run('gate --full', 'npm', ['run', 'gate', '--', '--full'], true)
const gateFile = gateOutput.match(/local-gate: success; receipt (.+)/)?.[1]?.trim()
if (!gateFile) throw Error('Full gate did not return a successful receipt')
run('final acceptance --all-arch', process.execPath, ['scripts/final-acceptance.mjs', '--all-arch'])
const load = p => JSON.parse(readFileSync(p))
const manifestFile = resolve('dist/release/manifest.json')
const admit = () => admitLocalRelease({ manifest: load(manifestFile), receipt: { ...load('dist/release/consumer-results.json'), manifestFile }, gate: load(gateFile), acceptance: load('dist/final/acceptance.json'), ...initial, version: tag.slice(1), root: resolve('dist/release'), dmgRoot: resolve('desktop/out') })
admit()
rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true })
const assets = join(out, 'assets'); mkdirSync(assets)
for (const name of readdirSync('dist/release')) if (statSync(join('dist/release', name)).isFile()) cpSync(join('dist/release', name), join(assets, name))
const acceptance = load('dist/final/acceptance.json')
for (const row of acceptance.dmgs) cpSync(row.file, join(assets, basename(row.file)))
run('desktop hashes and unsigned aliases', process.execPath, ['scripts/desktop-release-assets.mjs', assets, initial.sha])
for (const [from, to] of [[gateFile, 'local-gate.json'], ['dist/final/acceptance.json', 'acceptance.json']]) cpSync(from, join(assets, to))
const stableTags = git('tag', '-l', 'v*', '--sort=-v:refname').split('\n').filter(t => !t.includes('-'))
const prerelease = tag.includes('-'), latest = !prerelease && stableTags[0] === tag
const notesFile = join(out, 'notes.md')
writeFileSync(notesFile, annotation + '\n\nApple Silicon and Intel Mac apps attached. Unsigned: move to Applications, then right-click → Open (Privacy & Security → Open Anyway if blocked). See desktop/SIGNING.md.\n\nVerified locally with fixture providers and simulated settlement; native arm64 recovery passed. Intel DMG built; native Intel acceptance pending. Local acceptance and gate receipts attached.\n')
const report = { schema: 1, tag, ...initial, dryRun, mainAncestor, prerelease, latest, timings, durationMs: Date.now() - started, assets: readdirSync(assets).sort().map(file => ({ file, bytes: statSync(join(assets, file)).size, sha256: sha256(join(assets, file)) })) }
writeFileSync(join(assets, 'release-publication.json'), JSON.stringify(report, null, 2) + '\n')
const reportHash = sha256(join(assets, 'release-publication.json')), notesHash = sha256(notesFile)
const finalCheck = () => {
  assertSource(); admit()
  if (sha256(join(assets, 'release-publication.json')) !== reportHash || sha256(notesFile) !== notesHash) throw Error('Publication metadata changed')
  const expected = [...load(manifestFile).artifacts, ...acceptance.dmgs]
  for (const row of expected) if (sha256(join(assets, basename(row.file))) !== row.sha256) throw Error('Staged accepted bytes changed: ' + row.file)
  for (const arch of ['arm64','x64']) if (sha256(join(assets, `ResearchAgent-unsigned-${arch}.dmg`)) !== sha256(join(assets, `ResearchAgent-${tag.slice(1)}-${arch}.dmg`))) throw Error('Unsigned alias changed')
  for (const row of report.assets) if (statSync(join(assets, row.file)).size !== row.bytes || sha256(join(assets, row.file)) !== row.sha256) throw Error('Upload bytes changed: ' + row.file)
}
finalCheck()
const releaseArgs = ['release', 'create', tag, '--verify-tag', `--latest=${latest}`, ...(prerelease ? ['--prerelease'] : []), '--title', `${tag} · ${annotation.split('\n')[0]}`, '--notes-file', notesFile, ...readdirSync(assets).sort().map(f => join(assets, f))]
if (dryRun) console.log('DRY RUN: no tag push or release creation. ' + (mainAncestor ? 'Main ancestry verified.' : 'Branch rehearsal; publication requires merging and re-running on main.'))
else {
  git('fetch', '-q', 'origin', 'main'); git('merge-base', '--is-ancestor', initial.sha, 'origin/main')
  if (latestGate() !== 'success') throw Error('Merged local-gate is no longer green')
  finalCheck(); git('push', 'origin', `refs/tags/${tag}`)
  finalCheck(); console.log(gh(...releaseArgs))
}
console.log(JSON.stringify({ ...report, assets: report.assets.map(a => a.file), output: out }, null, 2))
