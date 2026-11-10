// Builds the facts behind /progress/ ("Since SingHacks"):
//   npm run site:progress            → site/progress/data.json, images, then the static page
//   node scripts/build-progress-data.mjs --no-render   (data only)
// Reads git, gh (merged PRs, releases), CHANGELOG.md, docs/SFF-PUSH.md, eval and
// docs/evidence JSON, and site/ledger/transactions.json. Needs network for gh.
// Every count is query-defined and dated: PRs and releases are filtered to commits
// reachable from the counted SHA. Any missing number stops the build (exit 1).
// The authored words live in scripts/progress-story.mjs. Never opens the blind v5 banks.
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join, extname, basename } from 'node:path'
import { pathToFileURL } from 'node:url'
import * as story from './progress-story.mjs'
import { operationLabel } from '../site/ledger/ledger.js'

const root = join(import.meta.dirname, '..')
const out = join(root, 'site/progress')
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 29, stdio: [opts.input ? 'pipe' : 'ignore', 'pipe', 'pipe'], ...opts })
const git = (...args) => run('git', args).trimEnd()
const gh = (...args) => JSON.parse(run('gh', args))
const read = path => readFileSync(join(root, path), 'utf8')
const json = path => JSON.parse(read(path))

export class MissingFact extends Error {}
let releaseDates = {}
/** Stop the build when a number or source is absent. */
export function need(value, label) {
  if (value === undefined || value === null || (typeof value === 'number' && !Number.isFinite(value)) || value === '') throw new MissingFact(`progress: missing ${label}`)
  return value
}
const needFile = path => { if (!existsSync(join(root, path))) throw new MissingFact(`progress: missing source file ${path}`); return path }

const semver = (a, b) => { const p = t => { const [, x, y, z, rc] = t.match(/^v(\d+)\.(\d+)\.(\d+)(?:-rc\.(\d+))?$/); return [+x, +y, +z, rc === undefined ? Infinity : +rc] }; const [A, B] = [p(a), p(b)]; for (let i = 0; i < 4; i++) if (A[i] !== B[i]) return A[i] < B[i] ? -1 : 1; return 0 }
// Singapore-time day for an ISO timestamp.
export const sgtDay = iso => new Date(Date.parse(iso) + story.TZ_OFFSET_HOURS * 3600e3).toISOString().slice(0, 10)
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const dayLabel = day => `${Number(day.slice(8, 10))} ${MONTHS[Number(day.slice(5, 7)) - 1]}`
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5)

/** CHANGELOG.md → { 'v1.0.2': { heading, bullets: [{ text, prs }] } } */
export function parseChangelog(text) {
  const sections = {}
  let current = null, bullet = null
  for (const line of text.split('\n')) {
    const h = line.match(/^## (?:\[(\d+\.\d+\.\d+)\]|v(\d+\.\d+\.\d+(?:-rc\.\d+)?))(?=\s|$)(.*)$/)
    if (h) { current = sections[`v${h[1] ?? h[2]}`] = { heading: line.slice(3), bullets: [] }; bullet = null; continue }
    if (/^## /.test(line)) { current = null; continue }
    if (!current) continue
    if (/^- /.test(line)) { bullet = { raw: line.slice(2) }; current.bullets.push(bullet); continue }
    if (bullet && /^ {2}\S/.test(line)) { bullet.raw += ' ' + line.trim(); continue }
    if (!line.trim() || /^#/.test(line)) bullet = null
  }
  for (const section of Object.values(sections)) section.bullets = section.bullets.map(b => cleanBullet(b.raw)).filter(b => b.text)
  return sections
}
/** One plain sentence per bullet; PR numbers move to proof links. */
export function cleanBullet(raw) {
  const prs = [...new Set([...raw.matchAll(/#(\d{2,4})\b/g)].map(m => Number(m[1])))]
  let text = raw
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links → text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\s*\((?:(?:Refs |see )?#\d+(?:,\s*)?)+\)/g, '') // (#384) / (#401, #406)
    .replace(/(?<!\b(?:is|in|see|by|via|from|and|as))\s+#\d+(?=[\s.,;:)]|$)/g, '') // trailing clause refs; keep "the follow-up is #276"
    .replace(/([.!?])(?:[\s,;]*)$/, '$1')
    .replace(/\s+([.,;:])/g, '$1')
    .replace(/\s+/g, ' ').trim()
  const sentence = text.match(/^(.{40,}?[.!?])(?:\s|$)/)
  text = sentence ? sentence[1] : text
  if (text.length > 170) {
    // Cut at the first clause boundary that still reads as a sentence.
    const cut = [/: /g, /; /g, / — /g, /, (?:and |plus )?/g].map(re => [...text.matchAll(re)].map(m => m.index).find(i => i >= 30 && i <= 165)).find(i => i !== undefined)
    text = cut !== undefined ? text.slice(0, cut).replace(/[\s,;:]+$/, '') + '.' : text.slice(0, text.lastIndexOf(' ', 160)) + '…'
  }
  text = text.replace(/[:;,]$/, '.').replace(/\.\.$/, '.')
  if (!/[.!?…]$/.test(text)) text += '.'
  return { text, prs }
}

/** "feat(ui): add the thing (Refs #271)" → "Add the thing." */
export function prTitle(title) {
  const t = title.replace(/^[a-z]+(\([^)]*\))?!?:\s*/i, '').replace(/\s*\((?:Refs|Closes|Fixes)?\s*#\d+[^)]*\)/gi, '').replace(/\s*\[[^\]]+\]\s*$/, '').trim()
  return t.charAt(0).toUpperCase() + t.slice(1).replace(/\.?$/, '.')
}

/** Physical nonblank lines of code (TS/JS/Python/Shell) and file count at a ref. */
export function codeStats(ref) {
  const entries = git('ls-tree', '-r', ref).split('\n').filter(Boolean).map(line => { const [meta, path] = line.split('\t'); return { type: meta.split(' ')[1], id: meta.split(' ')[2], path } }).filter(e => e.type === 'blob')
  const code = entries.filter(e => /\.(?:[cm]?[jt]sx?|py|sh)$/.test(e.path) && !/(^|\/)package-lock\.json$/.test(e.path))
  const blobs = run('git', ['cat-file', '--batch'], { input: Buffer.from(code.map(e => e.id).join('\n') + '\n'), encoding: null })
  let lines = 0, offset = 0
  for (let i = 0; i < code.length; i++) {
    const end = blobs.indexOf(10, offset)
    const size = Number(blobs.subarray(offset, end).toString().split(' ')[2])
    const body = blobs.subarray(end + 1, end + 1 + size)
    offset = end + 1 + size + 1
    if (body.includes(0)) continue
    for (const l of body.toString('utf8').split('\n')) if (l.trim()) lines++
  }
  return { files: entries.length, codeFiles: code.length, codeLines: lines }
}

/** Test declarations written in the repo at a ref (static count, not executions). */
export function testDeclarations(ref) {
  const count = (pattern, specs) => { try { return run('git', ['grep', '-ohE', pattern, ref, '--', ...specs]).split('\n').filter(Boolean).length } catch (e) { if (e.status === 1) return 0; throw e } }
  const ts = count("(^|[^.A-Za-z0-9_])(it|test)(\\.(each|only|skip|concurrent|fails)[^(]{0,80})?\\((['\"`]|[A-Za-z_]+[,)])", ['*.test.ts', '*.test.tsx', '*.test.mts', '*.test.mjs', '*.test.js', '*.spec.ts', '*.spec.mjs'])
  const py = count('def test_', ['*.py'])
  return { typescript: ts, python: py, total: ts + py }
}

function findValue(obj, key) {
  if (obj && typeof obj === 'object') {
    if (key in obj) return obj[key]
    for (const v of Object.values(obj)) { const found = findValue(v, key); if (found !== undefined) return found }
  }
}

function copyImage(spec, slug, sourceSha) {
  mkdirSync(join(out, 'img'), { recursive: true })
  let bytes, from, captured
  if (spec.tag) {
    bytes = run('git', ['show', `${spec.tag}:${spec.path}`], { encoding: null })
    from = `${spec.tag}:${spec.path}`
    captured = git('log', '-1', '--format=%aI', spec.tag, '--', spec.path)
  } else if (spec.release) {
    const dir = join(out, '.tmp-release'); rmSync(dir, { recursive: true, force: true }); mkdirSync(dir)
    run('gh', ['release', 'download', spec.release, '--pattern', spec.asset, '--dir', dir])
    bytes = readFileSync(join(dir, spec.asset)); rmSync(dir, { recursive: true, force: true })
    from = `release ${spec.release} asset ${spec.asset}`
    captured = need(releaseDates?.[spec.release], `release date ${spec.release}`)
  } else {
    needFile(spec.path)
    bytes = readFileSync(join(root, spec.path))
    from = spec.path
    captured = git('log', '-1', '--format=%aI', sourceSha, '--', spec.path)
  }
  need(bytes?.length, `image bytes for ${slug}`)
  const ext = extname(spec.path ?? spec.asset).toLowerCase()
  const file = `img/${slug}${ext}`
  writeFileSync(join(out, file), bytes)
  const dims = imageSize(bytes, ext)
  return { src: file, alt: need(spec.alt, `alt text for ${slug}`), caption: spec.caption, from, captured: need(captured, `capture date for ${from}`).slice(0, 10), sha256: createHash('sha256').update(bytes).digest('hex'), ...dims }
}
function imageSize(b, ext) {
  if (ext === '.png') return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) }
  for (let i = 2; i < b.length;) { // JPEG SOF marker
    if (b[i] !== 0xFF) { i++; continue }
    const marker = b[i + 1], len = b.readUInt16BE(i + 2)
    if (marker >= 0xC0 && marker <= 0xCF && ![0xC4, 0xC8, 0xCC].includes(marker)) return { width: b.readUInt16BE(i + 7), height: b.readUInt16BE(i + 5) }
    i += 2 + len
  }
  throw new MissingFact('progress: unreadable image size')
}
function snippet(spec) {
  const text = read(needFile(spec.path))
  let lines
  if (spec.fence !== undefined) lines = [...text.matchAll(/```[a-z]*\n([\s\S]*?)```/g)][spec.fence]?.[1].trimEnd().split('\n')
  else {
    const all = text.trimEnd().split('\n')
    lines = spec.lines ? [...all.slice(spec.lines[0] - 1, spec.lines[1]), ...(spec.tail ? ['…', ...all.slice(-spec.tail)] : [])] : all
  }
  need(lines?.length, `snippet ${spec.path}`)
  // Long URLs and hashes are shortened for display; the full file is linked.
  return { lines: lines.map(l => l.replace(/https:\/\/testnet\.xrpl\.org\/transactions\/([A-F0-9]{8})[A-F0-9]{56}/g, 'testnet.xrpl.org/…/$1…').replace(/https:\/\/github\.com\/Collaboration95\/theFastandtheFungible\/releases\/download\//g, '…/releases/download/')), caption: spec.caption, from: spec.path }
}

export function build() {
  const sha = git('rev-parse', 'HEAD')
  const sourceDate = git('show', '-s', '--format=%cI', sha)
  const reachable = new Set(git('rev-list', sha).split('\n'))
  const generatedAt = new Date().toISOString()
  const asOf = sgtDay(sourceDate)

  // ---- Checkpoints
  const baselineSha = git('rev-parse', `${story.EVENT.ref}^{commit}`)
  const snapshotSha = git('rev-list', '-1', `--before=${story.SINCE.date}T00:00:00+08:00`, sha)
  const baseline = { ref: story.EVENT.ref, sha: baselineSha, date: git('show', '-s', '--format=%aI', baselineSha), tagDate: git('for-each-ref', '--format=%(creatordate:iso-strict)', `refs/tags/${story.EVENT.ref}`), ...codeStats(baselineSha), tests: testDeclarations(baselineSha) }
  const snapshot = { sha: snapshotSha, date: git('show', '-s', '--format=%cI', snapshotSha), ...codeStats(snapshotSha), tests: testDeclarations(snapshotSha) }
  const today = { sha, date: sourceDate, ...codeStats(sha), tests: testDeclarations(sha) }

  // ---- Merged PRs and releases, filtered to the counted history
  const prsAll = gh('pr', 'list', '--repo', 'Collaboration95/theFastandtheFungible', '--state', 'merged', '--base', 'main', '--limit', '2000', '--json', 'number,title,mergedAt,mergeCommit')
  const prs = prsAll.filter(p => p.mergeCommit && reachable.has(p.mergeCommit.oid))
  const prsSince = prs.filter(p => sgtDay(p.mergedAt) >= story.SINCE.date)
  const prByNumber = new Map(prs.map(p => [p.number, p]))
  const releasesAll = gh('release', 'list', '--repo', 'Collaboration95/theFastandtheFungible', '--limit', '100', '--json', 'tagName,name,publishedAt,isPrerelease,isLatest,isDraft')
  // Version order: v0.3.0 was backfilled after v0.4.0 was published.
  const releases = releasesAll.filter(r => !r.isDraft && reachable.has(git('rev-parse', `${r.tagName}^{commit}`))).sort((a, b) => semver(a.tagName, b.tagName))
  releaseDates = Object.fromEntries(releases.map(r => [r.tagName, r.publishedAt]))
  const commitsSince = Number(git('rev-list', '--count', `${snapshotSha}..${sha}`))

  // ---- Activity strip: PRs and commits per Singapore day
  const start = '2026-09-19'
  const commitDays = git('log', '--format=%cI', `--since=${start}T00:00:00+08:00`, sha).split('\n').filter(Boolean).map(sgtDay)
  const activity = []
  for (let d = start; d <= asOf; d = new Date(Date.parse(`${d}T00:00:00Z`) + 864e5).toISOString().slice(0, 10)) activity.push({ day: d, prs: prs.filter(p => sgtDay(p.mergedAt) === d).length, commits: commitDays.filter(c => c === d).length })

  // ---- Rail: early milestones, then every release
  const changelog = parseChangelog(read('CHANGELOG.md'))
  const firstTagContaining = commit => git('tag', '--contains', commit, '--sort=creatordate').split('\n').filter(t => /^v\d/.test(t) && releaseDates[t])[0] ?? null
  const proofUrl = p => p.pr ? `${story.REPO}/pull/${need(prByNumber.get(p.pr), `PR #${p.pr}`).number}` : p.ref ? `${story.REPO}/${p.ref}` : p.site ? `${story.SITE}${p.site}` : `${story.REPO}/blob/${sha}/${needFile(p.path)}`
  const ledger = json('site/ledger/transactions.json')
  const rail = []
  for (const m of story.milestones) {
    let date
    if (m.date.pr) date = sgtDay(need(prByNumber.get(m.date.pr), `PR #${m.date.pr}`).mergedAt)
    else if (m.date.tag) date = sgtDay(git('show', '-s', '--format=%cI', `${m.date.tag}^{commit}`))
    else { if (!read(needFile(m.date.source)).includes(m.date.mustInclude)) need(null, `date evidence for ${m.id}`); date = m.date.fixed }
    const bullets = m.bullets.map(b => typeof b === 'string' ? b : b.template.replace(/\{baseline\.(\w+)\}/g, (_, k) => need(baseline[k], `baseline.${k}`).toLocaleString('en-US')))
    rail.push({ id: m.id, kind: 'milestone', day: date, label: m.label ?? dayLabel(date), title: m.title, summary: m.summary, bullets, image: copyImage(m.image, m.id, sha), proofs: m.proofs.map(p => ({ label: p.pr ? `${p.label} #${p.pr}` : p.label, url: proofUrl(p) })) })
  }
  for (const r of releases) {
    const copy = need(story.releases[r.tagName], `release copy for ${r.tagName}`)
    const section = need(changelog[r.tagName], `CHANGELOG section for ${r.tagName}`)
    // CHANGELOG bullets first; thin early entries are topped up with the PRs merged in the tag's range.
    const prev = releases[releases.indexOf(r) - 1]?.tagName
    const range = new Set(git('rev-list', r.tagName, ...(prev ? [`^${prev}`] : [])).split('\n'))
    const rangePrs = prs.filter(p => range.has(p.mergeCommit.oid)).sort((a, b) => a.number - b.number)
    const cited = new Set(section.bullets.flatMap(b => b.prs))
    const bullets = [...section.bullets, ...rangePrs.filter(p => !cited.has(p.number) && !/^(fix|chore|test|docs|ci|build)(\(|:)|release|bump|\btests?\b/i.test(p.title)).map(p => ({ text: prTitle(p.title), prs: [p.number] }))].slice(0, 3)
    need(bullets.length || null, `shipped items for ${r.tagName}`)
    const prsIn = [...new Set(bullets.flatMap(b => b.prs))].filter(n => prByNumber.has(n)).slice(0, 3)
    const named = r.name.split(' · ').slice(1).filter(x => !/^ResearchAgent \d|^Day \d+$/.test(x))[0]
    const proofs = [{ label: 'Release notes', url: `${story.REPO}/releases/tag/${r.tagName}` }, ...prsIn.map(n => ({ label: `PR #${n}`, url: `${story.REPO}/pull/${n}` }))]
    if (copy.tx) {
      const hash = copy.tx.ledger ? ledger.rows.find(row => row[copy.tx.ledger])?.hash : read(needFile(copy.tx.path)).match(/\b[A-F0-9]{64}\b/)?.[0]
      proofs.push({ label: 'Testnet transaction', url: `https://testnet.xrpl.org/transactions/${need(hash, `transaction for ${r.tagName}`)}` })
    }
    rail.push({
      id: r.tagName, kind: 'release', tag: r.tagName, prerelease: r.isPrerelease, day: sgtDay(r.publishedAt), label: dayLabel(sgtDay(r.publishedAt)),
      title: copy.title ?? need(named, `release title for ${r.tagName}`), summary: null,
      bullets: bullets.map(b => b.text), image: copy.image ? copyImage(copy.image, r.tagName.replaceAll('.', '-'), sha) : null, snippet: copy.snippet ? snippet(copy.snippet) : null, proofs,
    })
  }
  const order = new Map(rail.map((r, i) => [r, i]))
  rail.sort((a, b) => a.day.localeCompare(b.day) || order.get(a) - order.get(b))

  // ---- Capability ladder
  const capabilities = story.capabilities.map(c => {
    const merged = c.prs.map(n => need(prByNumber.get(n), `PR #${n}`))
    const first = merged.sort((a, b) => a.mergedAt.localeCompare(b.mergedAt))[0]
    const day = first ? sgtDay(first.mergedAt) : sgtDay(git('show', '-s', '--format=%cI', `${c.tag}^{commit}`))
    const tag = first ? firstTagContaining(first.mergeCommit.oid) : c.tag
    return { name: c.name, then: c.then, now: c.now, day, label: dayLabel(day), tag, proofs: c.prs.length ? c.prs.map(n => ({ label: `#${n}`, url: `${story.REPO}/pull/${n}` })) : [{ label: 'Checkpoint tag', url: `${story.REPO}/tree/${c.tag}` }] }
  }).sort((a, b) => a.day.localeCompare(b.day))

  // ---- Metrics
  const j2 = 'docs/evidence/round4-j2'
  const j2Readme = read(`${j2}/README.md`)
  const before = label => Number(need(j2Readme.match(new RegExp(`\\| ${label} \\| ([\\d.]+) s \\|`))?.[1], `before value "${label}"`))
  const cold = json(`${j2}/cold-timings.json`)
  const firstRun = [
    { label: 'MCP server starts', unit: 's', before: before('stdio initialize'), after: need(cold.initialize, 'initialize') },
    { label: 'Testnet app ready', unit: 's', before: before('app --testnet ready'), after: need(cold.appReady, 'appReady') },
    { label: 'Download size', unit: 'MB', before: need(cold.bytesBefore, 'bytesBefore') / 1e6, after: need(cold.bytesAfter, 'bytesAfter') / 1e6 },
  ]
  const tryRuns = [
    { file: 'try-initial-timing.json', d: json(`${j2}/try-initial-timing.json`) },
    { file: 'try-timeout.json', d: json(`${j2}/try-timeout.json`) },
    { file: 'try-exact-timeout.json', d: json(`${j2}/try-exact-timeout.json`) },
    { file: 'try-timing.json', d: json(`${j2}/try-timing.json`) },
  ].map(({ file, d }) => d.status === 'deadline_exceeded'
    ? { file, seconds: need(d.limitSeconds, 'limit'), printed: d.runtimePrintedSeconds, pass: false, note: 'deadline exceeded' }
    : { file, seconds: need(d.seconds, `${file} seconds`), pass: d.exitCode === 0, note: d.exitCode === 0 ? 'passed' : 'timed out' })
  const tryLimit = need(json(`${j2}/try-exact-timeout.json`).limitSeconds, 'try limit')
  const tryFinal = tryRuns.at(-1)

  const ledgerHistory = []
  for (const line of git('log', '--reverse', '--format=%H %cI', sha, '--', 'site/ledger/transactions.json').split('\n').filter(Boolean)) {
    const [commit, at] = line.split(' ')
    const rows = JSON.parse(git('show', `${commit}:site/ledger/transactions.json`)).rows.length
    if (ledgerHistory.at(-1)?.rows === rows) continue
    const point = { day: sgtDay(at), label: dayLabel(sgtDay(at)), rows, commit: commit.slice(0, 8) }
    // The first snapshot, then the last count of each later day.
    if (ledgerHistory.length > 1 && ledgerHistory.at(-1).day === point.day) ledgerHistory[ledgerHistory.length - 1] = point
    else ledgerHistory.push(point)
  }
  if (ledgerHistory.length > 1 && ledgerHistory[0].day === ledgerHistory[1].day) ledgerHistory[0].label += ' · first'
  need(ledgerHistory.length, 'ledger history')
  if (ledgerHistory.at(-1).rows !== ledger.rows.length) need(null, 'ledger history matching the current file')

  const v4 = json('docs/evidence/v4-heldout/v4/results.json').summary
  const v4n = json('docs/evidence/v4-heldout/v4-negatives/results.json').summary
  const p0 = json('docs/evidence/r5-p0/summary.json').banks.v1.buyAndCite
  const sweep = json('docs/evidence/p1-threshold/sweep-summary.json')
  const v3 = need(sweep.find(r => r.threshold === 0.2 && r.bank === 'v3'), 'v3 at 0.20').buyAndCite
  const v2 = json('docs/evidence/j5-coverage/summary.json').heldout
  const v5Results = 'docs/evidence/v5-heldout/v5/results.json'
  const v5Frozen = existsSync(join(root, 'eval/questions/judge-xrpl.v5.json')) // existence only; never opened
  const v5 = existsSync(join(root, v5Results)) ? { status: 'measured', ...json(v5Results).summary.buyAndCite, source: v5Results } : { status: v5Frozen ? 'pending' : 'absent', frozen: v5Frozen ? sgtDay(git('log', '--diff-filter=A', '-1', '--format=%cI', sha, '--', 'eval/questions/judge-xrpl.v5.json')) : null }
  const banks = [
    { id: 'v1', label: 'v1 · development', n: need(p0.n, 'v1 n'), N: need(p0.N, 'v1 N'), heldout: false, source: 'docs/evidence/r5-p0/summary.json' },
    { id: 'v3', label: 'v3 · development', n: need(v3.n, 'v3 n'), N: need(v3.N, 'v3 N'), heldout: false, source: 'docs/evidence/p1-threshold/sweep-summary.json' },
    { id: 'v4', label: 'v4 · blind held-out', n: need(v4.buyAndCite.n, 'v4 n'), N: need(v4.buyAndCite.N, 'v4 N'), heldout: true, answersIt: v4.answersIt, source: 'docs/evidence/v4-heldout/README.md' },
    { id: 'v5', label: 'v5 · blind held-out', ...v5, heldout: true, source: 'docs/eval-judge-banks.md' },
  ]
  const offTopic = { n: need(v4n.negativeBuys.n, 'negatives n'), N: need(v4n.negativeBuys.N, 'negatives N'), source: 'docs/evidence/v4-heldout/README.md' }

  const testSeries = [
    { label: '7 Sep · prototype', day: sgtDay(baseline.date), ...baseline.tests },
    { label: '20 Sep · SingHacks', day: sgtDay(snapshot.date), ...snapshot.tests },
    ...['known-good-2026-10-08', 'v0.1.0', 'v1.0.0', 'v1.0.2'].map(t => { const c = git('rev-parse', `${t}^{commit}`); const day = sgtDay(git('show', '-s', '--format=%cI', c)); return { label: `${dayLabel(day)} · ${t.startsWith('known') ? 'October' : t}`, day, ...testDeclarations(c) } }),
  ]
  if (testSeries.at(-1).day !== asOf) testSeries.push({ label: `${dayLabel(asOf)} · today`, day: asOf, ...today.tests })
  const codeSeries = testSeries.map(t => ({ label: t.label, day: t.day, lines: t.day === asOf ? today.codeLines : null }))
  const checkpointRefs = [baselineSha, snapshotSha, ...['known-good-2026-10-08', 'v0.1.0', 'v1.0.0', 'v1.0.2'].map(t => git('rev-parse', `${t}^{commit}`)), sha]
  codeSeries.forEach((c, i) => { c.lines ??= codeStats(checkpointRefs[i]).codeLines; need(c.lines, `code lines at ${c.label}`) })
  const executed = read('docs/evidence/refactor-b/README.md').match(/check:fast passed: (\d+) files, ([\d,]+) tests/)
  need(executed, 'executed test count in docs/evidence/refactor-b/README.md')

  const transactions = ledger.rows.map(r => ({ day: need(r.date, 'tx date'), kind: operationLabel(r), hash: need(r.hash, 'tx hash'), label: r.label ?? `${r.group}: ${r.operation ?? r.kind}` }))
  if (transactions.some(t => t.kind === 'Other')) need(null, 'a kind for every ledger row')

  // ---- Misses we kept
  const soakLoaded = findValue(json('docs/evidence/round2-h2/acceptance.json'), 'loopP99')
  const soakQuiet = findValue(json('docs/evidence/soak-nov4-ab/Cfull.json'), 'loopP99')
  const iou = json('docs/evidence/r5-a/timings.json')
  const iouTarget = Number(need(read('CHANGELOG.md').match(/cold ([\d.]+) s, which missed the (\d+) s target/)?.[2], 'IOU target'))
  const sweepDev = json('docs/evidence/p1-threshold/fixture-scorecard-dev.json')
  const ceiling = need(json('docs/evidence/p1-threshold/selection.json').constraints.maxFixtureDevWastedGrossPct, 'waste ceiling')
  const factMenu = need(changelog['v0.3.0'].bullets.map(b => b.text).join(' ').match(/wasted spend regressed ([\d.]+)% → ([\d.]+)%/), 'fact-menu regression')
  const over = tryRuns.filter(r => !r.pass)
  const measures = {
    'try-cold': `${over.length} of ${tryRuns.length} cold runs over ${tryLimit} s: ${tryRuns.map(r => r.note === 'deadline exceeded' ? `stopped at the ${tryLimit} s deadline` : `${r.seconds.toFixed(1)} s ${r.pass ? 'pass' : r.note}`).join(' · ')}`,
    heldout: `${v4.buyAndCite.N - v4.buyAndCite.n} of ${v4.buyAndCite.N} held-out questions ended without a cited purchase; the key fact led the answer in ${v4.answersIt.n} of ${v4.answersIt.N}`,
    'v2-superseded': `v2 held-out ${need(v2.buyAndCite, 'v2')}/${need(v2.questions, 'v2 N')} → blind v4 ${v4.buyAndCite.n}/${v4.buyAndCite.N}`,
    soak: `Loop delay p99 ${need(soakLoaded?.value, 'loaded p99').toFixed(1)} ms against a ${soakLoaded.limit} ms limit on a busy host; ${need(soakQuiet?.value, 'quiet p99').toFixed(1)} ms when quiet`,
    'iou-cold': `${need(iou['iou-cold'], 'iou cold').toFixed(1)} s cold against a ${iouTarget} s target; ${need(iou['iou-warm'], 'iou warm').toFixed(1)} s warm`,
    threshold: `${sweepDev.filter(r => r.wastedGrossPct <= ceiling).length} of ${need(sweepDev.length, 'sweep size')} thresholds met the ${ceiling}% waste ceiling`,
    'fact-menu': `Wasted spend ${factMenu[1]}% → ${factMenu[2]}% (v0.3.0)`,
  }
  const misses = story.misses.map(m => ({ ...m, measure: need(measures[m.id], `measure ${m.id}`), source: `${story.REPO}/blob/${sha}/${needFile(m.source)}` }))

  // ---- Builder feedback
  const feedback = read('docs/BUILDER-FEEDBACK.md')
  const inventory = feedback.slice(feedback.indexOf('### Submission inventory'))
  const submissions = [...inventory.slice(0, inventory.indexOf('\n## ')).matchAll(/^\| (\d+) \|/gm)].length
  const findings = new Set([...feedback.matchAll(/^\| (B\d+)\s*·/gm)].map(m => m[1])).size
  const ranked = [...feedback.slice(0, feedback.indexOf('## Appendix')).matchAll(/^## \d+\. /gm)].length
  const drafts = readdirSync(join(root, 'docs/feedback/upstream')).filter(f => f.endsWith('.md') && !/FILING-KIT/.test(f)).length
  const filed = [...feedback.matchAll(/^- Filed: (.*)$/gm)].filter(m => !/not filed/i.test(m[1]) && /https:\/\/github\.com\/[^\s)]+\/issues\/\d+/.test(m[1])).length
  const feedbackCounts = { submissions: need(submissions || null, 'submissions'), submittedOn: '4–5 Sep', findings: need(findings || null, 'findings'), ranked: need(ranked || null, 'ranked'), drafts: need(drafts || null, 'drafts'), filed }
  if (!/submitted on 4–5 September 2026/.test(feedback)) need(null, 'submission dates')

  const realWriters = json('site/evidence/real-writers.json').writers.length
  const next = story.next.map(n => ({ ...n, body: n.id === 'v5' ? (v5.status === 'measured' ? `Measured: ${v5.n}/${v5.N} bought and cited.` : `Frozen ${dayLabel(need(v5.frozen, 'v5 frozen date'))} and written blind; it has not been run yet.`) : n.id === 'writers' ? (realWriters ? `${realWriters} consenting writer${realWriters === 1 ? '' : 's'} listed on the ledger page; the rest are fictional or team-authored.` : 'No consenting outside writer is listed yet; writers are fictional or team-authored and labelled.') : n.body }))

  // ---- Latest SFF-PUSH entry (tracker freshness)
  const push = read('docs/SFF-PUSH.md').match(/^- (\d{1,2} Nov): /m)
  need(push, 'latest SFF-PUSH entry')

  const data = {
    schema: 1,
    generated_at: generatedAt,
    source_sha: sha,
    source_date: sourceDate,
    as_of: asOf,
    since: story.SINCE,
    event: { label: story.EVENT.label, baseline: { ...baseline, tests: baseline.tests.total }, snapshot: { ...snapshot, tests: snapshot.tests.total } },
    today: { ...today, tests: today.tests.total, release: need(releases.at(-1), 'latest release').tagName, releaseDay: sgtDay(releases.at(-1).publishedAt) },
    headline: {
      days: daysBetween(story.SINCE.date, asOf) + 1,
      prs: prsSince.length,
      releases: releases.length,
      transactions: ledger.rows.length,
      heldout: { n: v4.buyAndCite.n, N: v4.buyAndCite.N, offTopic },
      try: { seconds: tryFinal.seconds, limit: tryLimit },
      tests: today.tests.total,
      commits: commitsSince,
    },
    activity,
    rail,
    capabilities,
    metrics: { firstRun, tryRuns, tryLimit, ledgerHistory, banks, offTopic, tests: testSeries, code: codeSeries, executedTests: { files: Number(executed[1]), tests: Number(executed[2].replace(/,/g, '')), source: 'docs/evidence/refactor-b/README.md' }, transactions },
    misses,
    feedback: feedbackCounts,
    next,
    tracker: { latest: push[1] },
    queries: [
      { metric: 'PRs merged', value: prsSince.length, definition: `gh pr list --state merged --base main, merged on or after ${story.SINCE.label} (SGT), merge commit reachable from ${sha.slice(0, 8)}` },
      { metric: 'Commits', value: commitsSince, definition: `git rev-list --count ${snapshotSha.slice(0, 8)}..${sha.slice(0, 8)} (after the last commit before ${story.SINCE.label})` },
      { metric: 'Releases', value: releases.length, definition: 'gh release list, published, tag reachable from the counted commit (prereleases included)' },
      { metric: 'Testnet transactions', value: ledger.rows.length, definition: 'rows in site/ledger/transactions.json; the ledger page re-checks each one live' },
      { metric: 'Held-out', value: `${v4.buyAndCite.n}/${v4.buyAndCite.N}`, definition: 'v4 blind bank, bought and cited, run once on 7 Nov (docs/evidence/v4-heldout)' },
      { metric: 'Tests in the repo', value: today.tests.total, definition: 'static count of it()/test() declarations in *.test.* / *.spec.* files plus Python def test_ (not executions)' },
      { metric: 'Lines of code', value: today.codeLines, definition: 'physical nonblank lines in tracked TS/JS/Python/Shell files, tests and tooling included' },
    ],
  }
  mkdirSync(out, { recursive: true })
  writeFileSync(join(out, 'data.json'), JSON.stringify(data, null, 2) + '\n')
  // Drop images no longer referenced.
  const used = new Set(rail.map(r => r.image?.src).filter(Boolean).map(s => basename(s)))
  for (const f of readdirSync(join(out, 'img'))) if (!used.has(f)) rmSync(join(out, 'img', f))
  console.log(`progress: data.json at ${sha.slice(0, 8)} · ${prsSince.length} PRs · ${releases.length} releases · ${rail.length} rail nodes`)
  return data
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    build()
    if (!process.argv.includes('--no-render')) await import('./render-progress.mjs').then(m => m.main())
  } catch (error) {
    console.error(error instanceof MissingFact ? error.message : error)
    process.exit(1)
  }
}
