// Repo hygiene (#269): the front door stays intact. Run: node scripts/repo-hygiene.mjs
// Checks, all offline and read-only (reads tracked and new unignored files, so ignored files never count):
//   1. community and policy files exist;
//   2. relative Markdown links and #anchors in README.md and docs/ resolve;
//   3. README badges point at workflows that exist;
//   4. no tracked file over 5 MB outside design/;
//   5. no seed-shaped or API-key-shaped strings in tracked text files;
//   6. scripts load tsx through tsx/esm/api: tsx rejects module.register('tsx/esm') on every Node.
// Prints one line per problem and exits 1 if there is any.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, extname, join, normalize } from 'node:path'

const REQUIRED = [
  'README.md', 'LICENSE', 'CONTRIBUTING.md', 'SECURITY.md', 'CODE_OF_CONDUCT.md',
  '.github/CODEOWNERS', '.github/pull_request_template.md', '.github/ISSUE_TEMPLATE/config.yml',
  '.github/ISSUE_TEMPLATE/bug.yml', '.github/ISSUE_TEMPLATE/feature.yml',
  '.github/ISSUE_TEMPLATE/builder-feedback.yml', 'docs/SFF-PUSH.md', 'docs/contracts/SECURITY.md',
]
const MAX_BYTES = 5 * 1024 * 1024
// XRPL family seeds are base58 starting with "s"; OpenAI-style keys start with "sk-".
const SECRET_PATTERNS = [
  { name: 'XRPL seed', re: /(?<![A-Za-z0-9])s[1-9A-HJ-NP-Za-km-z]{28}(?![A-Za-z0-9])/ },
  { name: 'API key (sk-)', re: /(?<![A-Za-z0-9_-])sk-[A-Za-z0-9_-]{20,}/ },
]
const TEXT_EXT = new Set(['.md', '.mjs', '.js', '.ts', '.tsx', '.jsx', '.json', '.yml', '.yaml', '.html', '.css', '.txt', '.sh', '.toml', '.example'])
// Lockfiles hold integrity hashes; the corpus and eval fixtures are generated data.
const SECRET_SKIP = [/^package-lock\.json$/, /^data\/corpus\//, /^eval\/.*\.json$/, /^scripts\/repo-hygiene\.mjs$/]

const root = process.cwd()
const files = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root, maxBuffer: 1 << 26 }).toString().split('\0').filter(Boolean)
  .filter(f => existsSync(join(root, f)))
const problems = []
const bad = (msg) => problems.push(msg)

for (const f of REQUIRED) if (!files.includes(f)) bad(`missing required file: ${f}`)

for (const f of files) {
  if (f.startsWith('design/')) continue
  if (statSync(join(root, f)).size > MAX_BYTES) bad(`${f}: over 5 MB; move it under design/ or out of git`)
}

// GitHub's anchor slug: lowercase, drop punctuation except hyphens, spaces to hyphens.
const slug = (h) => h.trim().toLowerCase().replace(/[`*_]/g, '').replace(/[^\p{L}\p{N}\- ]/gu, '').replace(/ /g, '-')
const anchorCache = new Map()
function anchors(file) {
  if (!anchorCache.has(file)) {
    const set = new Set()
    const seen = new Map()
    let fence = false
    for (const line of readFileSync(join(root, file), 'utf8').split('\n')) {
      if (/^\s*(```|~~~)/.test(line)) { fence = !fence; continue }
      const m = !fence && line.match(/^#{1,6}\s+(.+?)\s*#*\s*$/)
      if (!m) continue
      const s = slug(m[1].replace(/\[([^\]]*)\]\([^)]*\)/g, '$1'))
      const n = seen.get(s) ?? 0
      seen.set(s, n + 1)
      set.add(n ? `${s}-${n}` : s)
    }
    for (const m of readFileSync(join(root, file), 'utf8').matchAll(/<a\s+(?:name|id)="([^"]+)"/g)) set.add(m[1])
    anchorCache.set(file, set)
  }
  return anchorCache.get(file)
}

const mdFiles = files.filter(f => f.endsWith('.md') && (f === 'README.md' || f.startsWith('docs/')))
for (const f of mdFiles) {
  let fence = false
  const lines = readFileSync(join(root, f), 'utf8').split('\n')
  lines.forEach((line, i) => {
    if (/^\s*(```|~~~)/.test(line)) { fence = !fence; return }
    if (fence) return
    const text = line.replace(/`[^`]*`/g, '')
    for (const m of text.matchAll(/!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
      const href = m[1].replace(/^<|>$/g, '')
      if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//')) continue
      const [path, frag] = href.split('#')
      const target = path ? normalize(join(dirname(f), decodeURIComponent(path))) : f
      const where = `${f}:${i + 1}`
      if (!existsSync(join(root, target))) { bad(`${where}: broken link ${href}`); continue }
      if (frag && target.endsWith('.md') && statSync(join(root, target)).isFile() && !anchors(target).has(frag.toLowerCase())) {
        bad(`${where}: no anchor #${frag} in ${target}`)
      }
    }
    for (const m of text.matchAll(/\]\(https:\/\/github\.com\/[^/\s)]+\/[^/\s)]+\/actions\/workflows\/([^/\s)]+)/g)) {
      if (!existsSync(join(root, '.github/workflows', m[1]))) bad(`${f}:${i + 1}: badge points at missing workflow ${m[1]}`)
    }
    for (const m of text.matchAll(/https:\/\/github\.com\/[^/\s)]+\/[^/\s)]+\/workflows\/([^/\s)]+)\/badge\.svg/g)) {
      if (!existsSync(join(root, '.github/workflows', m[1]))) bad(`${f}:${i + 1}: badge points at missing workflow ${m[1]}`)
    }
  })
  if (fence) bad(`${f}: unclosed code fence`)
}

for (const f of files) {
  if (!TEXT_EXT.has(extname(f)) && !['LICENSE', 'CODEOWNERS'].includes(f.split('/').pop())) continue
  if (SECRET_SKIP.some(re => re.test(f))) continue
  const text = readFileSync(join(root, f), 'utf8')
  for (const { name, re } of SECRET_PATTERNS) {
    const m = text.match(re)
    if (m) bad(`${f}: looks like a ${name} (${m[0].slice(0, 4)}…); never commit keys or seeds`)
  }
}

// tsx 4 throws "must be loaded with --import instead of --loader" for module.register('tsx/esm').
const TSX_REGISTER = /register\(\s*['"]tsx\/esm['"]/
for (const f of files) {
  if (!/\.(mjs|cjs|js|ts)$/.test(f) || f === 'scripts/repo-hygiene.mjs') continue
  if (TSX_REGISTER.test(readFileSync(join(root, f), 'utf8'))) bad(`${f}: module.register('tsx/esm') fails at startup; use import { register } from 'tsx/esm/api' and register()`)
}

if (problems.length) {
  console.error(`repo-hygiene: ${problems.length} problem${problems.length > 1 ? 's' : ''}`)
  for (const p of problems) console.error(`  ${p}`)
  process.exit(1)
}
console.log(`repo-hygiene: ok (${files.length} files, ${mdFiles.length} Markdown files)`)
