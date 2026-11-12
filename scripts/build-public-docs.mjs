// Read-only, pinned GitHub acquisition. Archives and extraction stay outside the checkout.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, readdirSync, mkdirSync, openSync, closeSync, chmodSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
export const sources = [
  { slug: 'xrpl-docs', repo: 'XRPLF/xrpl-dev-portal', sha: '182f8d20b157aa791433ff399a0f30dbed74a5eb', licence: 'MIT', roots: ['docs/'] },
  { slug: 'x402-docs', repo: 'coinbase/x402', sha: '0e6e8c55d86b4f14234fb6e49a4052074fb93e57', licence: 'Apache-2.0', roots: ['docs/', 'specs/'] },
]
const hash = s => createHash('sha256').update(s).digest('hex')
export const anchor = s => s.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').toLowerCase().replace(/<[^>]*>/g, '').replace(/[^\p{L}\p{N}_\-\s]/gu, '').trim().replace(/\s/g, '-')
export const publicPage = (source, path) => source.slug !== 'xrpl-docs' || !path.split('/').some(part => part.startsWith('_'))
const walk = dir => readdirSync(dir, { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name, 'en')).flatMap(e => e.isDirectory() ? walk(join(dir,e.name)) : [join(dir,e.name)])
export function passagesFrom(markdown, url) {
  const headings = [], counts = new Map(), passages = []
  const pageTitle = /^#\s+(.+)$/m.exec(markdown)?.[1] ?? ''
  let section = '', sectionAnchor = '', code = false, text = ''
  const flush = () => {
    for (const paragraph of text.trim().split(/\n\s*\n/)) {
      let rest = paragraph.trim()
      while (rest) {
        let end = Math.min(rest.length, 1200)
        if (end < rest.length) { const space = rest.lastIndexOf(' ', end); if (space > 600) end = space }
        const chunk = rest.slice(0, end).trim(); rest = rest.slice(end).trim()
        if (chunk) passages.push({ id: `p${passages.length + 1}`, heading: section, headingPath: headings.filter(Boolean), anchor: sectionAnchor, url: url + (sectionAnchor ? '#' + sectionAnchor : ''), text: chunk })
      }
    }
    text = ''
  }
  for (const line of markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) { code = !code; continue }
    if (code) continue
    const rendered = line.replace(/\{%\s*\$frontmatter\.seo\.title\s*%\}/g, pageTitle)
    const h = /^(#{1,6})\s+(.+?)\s*#*$/.exec(rendered)
    if (h) {
      flush(); headings.length = h[1].length - 1; headings[headings.length] = h[2]; section = headings.filter(Boolean).join(' / ')
      const base = anchor(h[2]), n = counts.get(base) || 0; counts.set(base, n + 1); sectionAnchor = /\{%/.test(h[2]) ? '' : base + (n ? '-' + n : '')
    } else if (!/\{%|%\}|^import |^export |^\s*</.test(line)) text += line + '\n'
  }
  flush(); return passages
}
export function build(root, out) {
  const manifest = { schemaVersion: 1, maxPassageChars: 1200, sources: [] }, articles = []
  for (const source of sources) {
    const dir = join(root, readdirSync(root).find(n => n.startsWith(source.repo.split('/')[0] + '-') && n.includes(source.sha.slice(0,7))) || source.slug)
    const licenceFile = readdirSync(dir).find(n => /^LICENSE(?:\.|$)/i.test(n))
    const licenceText = readFileSync(join(dir, licenceFile), 'utf8')
    const docs = walk(dir).filter(f => source.roots.some(r => relative(dir,f).startsWith(r)) && publicPage(source,relative(dir,f)) && /\.(md|mdx)$/.test(f) && !/\/(?:AGENTS|CONTRIBUTING)\.md$/.test(f))
    let passageCount = 0
    for (const file of docs) {
      const path = relative(dir, file), markdown = readFileSync(file,'utf8')
      const url = source.slug === 'xrpl-docs' ? `https://xrpl.org/${path.replace(/\.(md|mdx)$/, '').replace(/\/index$/, '')}` : `https://github.com/${source.repo}/blob/${source.sha}/${path}`
      const title = /^#\s+(.+)$/m.exec(markdown)?.[1] || path.split('/').pop().replace(/\.(md|mdx)$/,'')
      const passages = passagesFrom(markdown, url)
      // The normal article contract requires 4 passages and 150 words. Skip tiny stubs; never waive it.
      for (let i = 0; i < passages.length; i += 12) {
        const group = passages.slice(i, i + 12)
        const body = group.map(p => p.text).join('\n\n')
        if (group.length < 4 || (body.match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)?/gu) ?? []).length < 150 || (body.match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)?/gu) ?? []).length > 3000) continue
        passageCount += group.length
        articles.push({ articleId: `${source.slug}-${hash(path).slice(0,12)}-${i}`, version: source.sha, publisherSlug: source.slug, writerSlug: source.slug,
          title, publishedAt: '2026-11-12', tier: 'FREE', priceMinor: 0, abstract: `Public documentation reference: ${title}`.slice(0,220), tags: [source.slug, ...path.replace(/\.(md|mdx)$/,'').split(/[/_-]/)].filter(Boolean),
          family: `${source.slug}-${hash(path).slice(0,12)}`, sources: [{url, accessedAt:'2026-11-12'}], body, passages: group })
      }
    }
    manifest.sources.push({ ...source, licenceFile, licenceText, passageCount, articleCount: articles.filter(a=>a.publisherSlug===source.slug).length })
  }
  const bytes = JSON.stringify({ articles }, null, 2) + '\n'
  mkdirSync(out, {recursive:true}); writeFileSync(join(out,'index.json'), bytes); writeFileSync(join(out,'manifest.json'), JSON.stringify({...manifest, indexSha256:hash(bytes), bytes:Buffer.byteLength(bytes)},null,2)+'\n')
  // These public Docker inputs must remain readable by the non-root runtime,
  // including when the private operator wrapper uses umask 077.
  chmodSync(out, 0o755)
  for (const name of ['index.json', 'manifest.json']) chmodSync(join(out, name), 0o644)
  return manifest
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { ResourceScope } = await import('../shared/resource-scope.ts')
  const scope = new ResourceScope(), temp = scope.tempDir('researchagent-docs-')
  try {
    const root = process.env.PUBLIC_DOCS_ARCHIVES_DIR || temp
    if (!process.env.PUBLIC_DOCS_ARCHIVES_DIR) for (const s of sources) {
      const archive = join(temp, s.slug + '.tgz')
      const fd = openSync(archive, 'w', 0o600)
      try { execFileSync('gh', ['api', `repos/${s.repo}/tarball/${s.sha}`], {stdio:['ignore',fd,'pipe']}) }
      finally { closeSync(fd) }
      execFileSync('tar',['-xzf',archive,'-C',temp])
    }
    console.log(JSON.stringify(build(root, 'data/corpus/public-docs').sources.map(({slug,sha,licence,passageCount,articleCount}) => ({slug,sha,licence,passageCount,articleCount}))))
  } finally { await scope.close() }
}
