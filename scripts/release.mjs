// Owner-only tagging helper. Version changes must already be merged through PR gates.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

const argv = process.argv.slice(2)
const flag = (name) => { const i = argv.indexOf(name); if (i < 0) return null; const [, v] = argv.splice(i, 2); return v }
const has = (name) => { const i = argv.indexOf(name); if (i < 0) return false; argv.splice(i, 1); return true }
const dryRun = has('--dry-run'), push = has('--push')
const dateArg = flag('--date')
const at = flag('--at'), notesFile = flag('--notes-file')
const [dayArg, title] = argv
const explicitVersion = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/.test(dayArg ?? '') ? dayArg.replace(/^v/, '') : null
const day = explicitVersion ? null : Number(dayArg)
if ((!explicitVersion && (!Number.isInteger(day) || day < 0)) || !title) {
  console.error('usage: node scripts/release.mjs <day|version> "<title>" [--date YYYY-MM-DD] [--at <sha> --notes-file <path>] [--dry-run] [--push]')
  process.exit(2)
}
const version = explicitVersion ?? `0.${day + 1}.0`
const tag = `v${version}`
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim()

// The push began on 2 Nov 2026; used when there is no earlier v* tag.
const FIRST_RELEASE_SINCE = '2026-11-02'
const SECTION_DATE = dateArg ? new Date(`${dateArg}T12:00:00Z`) : new Date()
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const heading = `### ${WEEKDAYS[SECTION_DATE.getDay()]} ${SECTION_DATE.getDate()} ${MONTHS[SECTION_DATE.getMonth()]}`

if (git('tag', '-l', tag)) { console.error(`${tag} already exists`); process.exit(1) }
if (at && !notesFile) throw new Error('Historical releases require explicit --notes-file (never today\'s changelog)')
const target = at ? git('rev-parse', '--verify', `${at}^{commit}`) : 'HEAD'
if (!dryRun) {
  if (git('status', '--porcelain')) { console.error('working tree is not clean'); process.exit(1) }
  git('fetch', '-q', 'origin', 'main')
  if (at) git('merge-base', '--is-ancestor', target, 'origin/main')
  else if (git('rev-parse', 'HEAD') !== git('rev-parse', 'origin/main')) { console.error('HEAD is not at origin/main; rebase or pull first'); process.exit(1) }
}

const changelog = readFileSync('docs/SFF-PUSH.md', 'utf8').split('\n')
const start = changelog.findIndex((l) => l.trim() === heading)
let section = ''
if (start >= 0) {
  const end = changelog.findIndex((l, i) => i > start && /^#{1,3} /.test(l))
  section = changelog.slice(start + 1, end < 0 ? undefined : end).join('\n').trim()
}

const previous = git('tag', '--merged', target, '-l', 'v*', '--sort=-v:refname').split('\n').filter(Boolean)[0]
const range = previous ? [`${previous}..${target}`] : [`--since=${FIRST_RELEASE_SINCE}`, target]
const prs = git('log', '--first-parent', '--format=- %s', ...range).split('\n').filter((l) => /\(#\d+\)$/.test(l))

const visual = ['png', 'jpg', 'gif'].map((e) => `docs/releases/day-${day}.${e}`).find(existsSync)
const releaseLabel = explicitVersion ? title : `Day ${day} · ${title}`
const notes = notesFile ? `${releaseLabel}\n\n${readFileSync(notesFile, 'utf8').trim()}` : [
  releaseLabel,
  visual && `![Day ${day}](https://raw.githubusercontent.com/Collaboration95/theFastandtheFungible/${tag}/${visual})`,
  section && `## What shipped\n\n${section}`,
  prs.length && `## Merged since ${previous ?? 'the start of the push'}\n\n${prs.join('\n')}`,
].filter(Boolean).join('\n\n')

if (dryRun) { console.log(`${tag}\n\n${notes}`); process.exit(0) }

const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
if (!at && pkg.version !== version) throw new Error('Version must already be merged through a PR; release never bumps or pushes main')
if (!at) {
  const sha = git('rev-parse', target)
  const statuses = JSON.parse(execFileSync('gh', ['api', `repos/{owner}/{repo}/commits/${sha}/status`], {encoding:'utf8'})).statuses
  if (statuses.find(status => status.context === 'local-gate')?.state !== 'success') throw new Error('Merged SHA needs a successful local-gate status before tagging; run npm run gate -- --publish on that clean commit')
}
// verbatim: the default cleanup would strip every line that starts with "#" (the notes' headings).
// Historical tag dates follow the feature commit so chronological tag views retain Day order.
if (at) process.env.GIT_COMMITTER_DATE = git('show', '-s', '--format=%cI', target)
git('tag', '-a', '--cleanup=verbatim', tag, target, '-m', notes)
console.log(`Created ${tag} at ${git('rev-parse', '--short', target)}.`)
if (push) {
  git('push', 'origin', tag)
  console.log(`Pushed ${tag}; the release workflow publishes it.`)
} else {
  console.log(`Publish with: git push origin ${tag}`)
}
