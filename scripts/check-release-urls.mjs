// Every release link the public pack pins must resolve before the site is published.
//   node scripts/check-release-urls.mjs          HEADs each pinned release URL; exit 1 if any is missing
//   node scripts/check-release-urls.mjs --list   prints the URLs and the files that cite them (no network)
// A pinned install, verify or download line that returns 404 breaks the judge's first command, so
// `scripts/site-publish.py` runs this first. It reads the README, docs/*.md, docs/submission, the site,
// server.json and the in-app links; it never opens docs/evidence or the CHANGELOG (history may name tags).
// Covered forms: releases/download/<tag>/<asset>, releases/download/<tag> (as the tag's release),
// releases/tag/<tag>, raw.githubusercontent.com/<repo>/<tag>/<path>, and $REL/<asset> after `REL=<base>`.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const REPO = 'Collaboration95/theFastandtheFungible'
const root = join(import.meta.dirname, '..')

/** Text files whose release links a judge can click or paste. */
export function publicFiles(base = root) {
  const out = []
  const walk = (dir, match, deep = true) => {
    if (!existsSync(join(base, dir))) return
    for (const name of readdirSync(join(base, dir)).sort()) {
      const path = `${dir}/${name}`
      if (statSync(join(base, path)).isDirectory()) { if (deep) walk(path, match) } else if (match.test(name) && !/\.test\./.test(name)) out.push(path)
    }
  }
  for (const file of ['README.md', 'server.json', 'packages/sdk-python/README.md', 'demo/index.html']) if (existsSync(join(base, file))) out.push(file)
  walk('docs', /\.md$/, false) // the guides, not docs/evidence
  walk('docs/submission', /\.(md|html|json|txt)$/)
  walk('site', /\.(html|json)$/)
  walk('src/components', /\.tsx$/)
  return out
}

const URL_PATTERNS = [
  new RegExp(`https://github\\.com/${REPO}/releases/download/[^\\s"'<>)\\]\`\\\\]+`, 'g'),
  new RegExp(`https://github\\.com/${REPO}/releases/tag/[^\\s"'<>)\\]\`\\\\]+`, 'g'),
  new RegExp(`https://raw\\.githubusercontent\\.com/${REPO}/v\\d[^\\s"'<>)\\]\`\\\\]+`, 'g'),
]
// Template or elided links ("…/releases/download/v1.1.1/…", "${tag}") are not real URLs.
const isTemplate = url => /[${}<>…*]|\.\.\./.test(url)
const isRelease = url => /\/releases\/download\/[^/]+$/.test(url) // base only: check the release page instead
const asReleasePage = url => url.replace('/releases/download/', '/releases/tag/')

/** URL → files that cite it, over the given text files. */
export function collect(base = root, files = publicFiles(base)) {
  const cited = new Map()
  const note = (raw, file) => {
    const url = raw.replace(/[.,;:]+$/, '')
    if (isTemplate(url)) return
    const key = isRelease(url) ? asReleasePage(url) : url
    cited.set(key, [...new Set([...(cited.get(key) ?? []), file])])
  }
  for (const file of files) {
    const text = readFileSync(join(base, file), 'utf8')
    for (const re of URL_PATTERNS) for (const m of text.matchAll(re)) note(m[0], file)
    // `REL=https://…/releases/download/vX` then `$REL/asset` or `${REL}/asset`.
    const rel = text.match(new RegExp(`\\bREL=(https://github\\.com/${REPO}/releases/download/v[\\w.-]+)`))?.[1]
    if (rel) for (const m of text.matchAll(/\$\{?REL\}?\/([A-Za-z0-9._-]+)/g)) note(`${rel}/${m[1]}`, file)
  }
  return cited
}

/** HEAD each URL (following redirects). A server that refuses HEAD gets a one-byte GET. Returns the failures. */
export async function check(urls, { fetchImpl = fetch, timeoutMs = 20_000, concurrency = 6 } = {}) {
  const failures = []
  const probe = async url => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        let res = await fetchImpl(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(timeoutMs) })
        if (res.status === 403 || res.status === 405) res = await fetchImpl(url, { method: 'GET', headers: { range: 'bytes=0-0' }, redirect: 'follow', signal: AbortSignal.timeout(timeoutMs) })
        if (res.status < 400) return null
        if (res.status === 404) return `404 not found`
        if (attempt) return `HTTP ${res.status}`
      } catch (error) {
        if (attempt) return `no answer (${error.name === 'TimeoutError' ? 'timed out' : error.message})`
      }
    }
    return null
  }
  const queue = [...urls]
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    for (let url = queue.shift(); url; url = queue.shift()) { const why = await probe(url); if (why) failures.push({ url, why }) }
  }))
  return failures.sort((a, b) => a.url.localeCompare(b.url))
}

async function main() {
  const cited = collect()
  if (process.argv.includes('--list')) { for (const [url, files] of [...cited].sort()) console.log(`${url}\n    ${files.join(', ')}`); return }
  const failures = await check([...cited.keys()])
  if (failures.length) {
    console.error(`release links: ${failures.length} of ${cited.size} pinned URLs do not resolve`)
    for (const { url, why } of failures) console.error(`  ${why}  ${url}\n      cited by ${cited.get(url).join(', ')}`)
    console.error('Publish the release (or re-pin the links) before publishing the site.')
    process.exit(1)
  }
  console.log(`release links: ok (${cited.size} pinned URLs resolve)`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main()
