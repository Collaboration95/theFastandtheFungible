import { describe, expect, it } from 'vitest'
// @ts-expect-error deterministic builder has no declaration file
import { passagesFrom, anchor, publicPage, sources } from '../scripts/build-public-docs.mjs'
import { loadWriterCorpus } from '../publisher/corpus.js'
import { chmodSync, mkdirSync, writeFileSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { ResourceScope } from '../shared/resource-scope.js'

describe('public documentation passage builder', () => {
  it('makes public container inputs readable under the private operator umask', async () => {
    const scope = new ResourceScope(), root = scope.tempDir('public-docs-mode-'), out = join(root, 'output')
    try {
      for (const source of sources) {
        const dir = join(root, source.slug)
        mkdirSync(dir)
        writeFileSync(join(dir, 'LICENSE'), 'Test fixture licence')
      }
      mkdirSync(out, { mode: 0o700 })
      for (const name of ['index.json', 'manifest.json']) {
        writeFileSync(join(out, name), '{}')
        chmodSync(join(out, name), 0o600)
      }
      execFileSync(process.execPath, ['--input-type=module', '-e', `import { build } from ${JSON.stringify(new URL('../scripts/build-public-docs.mjs', import.meta.url).href)}; process.umask(0o077); build(${JSON.stringify(root)}, ${JSON.stringify(out)});`])
      expect(statSync(out).mode & 0o555).toBe(0o555)
      for (const name of ['index.json', 'manifest.json']) expect(statSync(join(out, name)).mode & 0o444).toBe(0o444)
    } finally { await scope.close() }
  })
  it('refuses executable and non-web canonical passage URLs', async () => {
    const { SpanSchema } = await import('../shared/contracts/corpus.js')
    expect(SpanSchema.safeParse({id:'p1',text:'Public text',url:'javascript:alert(1)'}).success).toBe(false)
    expect(SpanSchema.safeParse({id:'p1',text:'Public text',url:'https://xrpl.org/docs/reference#format'}).success).toBe(true)
  })
  it('bounds exact source extracts and preserves heading paths and duplicate anchors', () => {
    const text = 'A documented fact. '.repeat(150)
    const passages = passagesFrom(`---\ntitle: metadata\n---\n# Reference\n## Format\n${text}\n## Format\nAnother fact.`, 'https://xrpl.org/docs/reference') as {text:string;url:string;headingPath:string[]}[]
    expect(passages.every(p=>p.text.length <= 1200)).toBe(true)
    expect(passages[0].headingPath).toEqual(['Reference','Format'])
    expect(passages.at(-1)?.url).toBe('https://xrpl.org/docs/reference#format-1')
    expect(anchor('Request Format')).toBe('request-format')
    expect(anchor('Option B: [ERC20](../../extension.md)')).toBe('option-b-erc20')
    expect(publicPage({slug:'xrpl-docs'},'docs/_snippets/common-links.md')).toBe(false)
    expect(publicPage({slug:'xrpl-docs'},'docs/img/_sources/README.md')).toBe(false)
    expect(publicPage({slug:'xrpl-docs'},'docs/account_info.md')).toBe(true)
    expect(passagesFrom('# PermissionedDomain\n## {% $frontmatter.seo.title %} Fields\nFields description.', 'https://xrpl.org/docs/permissioneddomain')[0].url).toBe('https://xrpl.org/docs/permissioneddomain#permissioneddomain-fields')
  })
  it('keeps the existing default corpus', async () => {
    const corpus = await loadWriterCorpus()
    expect(corpus.publishers.some(p=>p.slug==='alphaleak')).toBe(true)
    expect(corpus.publishers.some(p=>p.slug==='xrpl-docs')).toBe(false)
  })
})

it('loads pinned docs, signs free deliveries without a funded wallet, and rejects changed bytes', async () => {
  const { ResourceScope } = await import('../shared/resource-scope.js')
  const { writeFileSync, readFileSync } = await import('node:fs')
  const { join } = await import('node:path')
  const { pathToFileURL } = await import('node:url')
  const { createHash } = await import('node:crypto')
  const { loadPublicDocs } = await import('../publisher/writers/public-docs.js')
  const { buildRegistry } = await import('../publisher/registry.js')
  const { PublisherJournal } = await import('../publisher/journal.js')
  const { createManifests } = await import('../publisher/manifest.js')
  const { verifyDelivery, verifyManifestSignature } = await import('../shared/manifest.js')
  const scope = new ResourceScope(), dir = scope.tempDir('public-docs-test-')
  const journal = new PublisherJournal(':memory:')
  try {
    const corpus = await loadWriterCorpus()
    const article = structuredClone(corpus.articles.find(a=>a.publisherSlug==='team-builder-notes')!)
    article.publisherSlug = article.writerSlug = 'xrpl-docs'; article.tier = 'FREE'; article.priceMinor = 0
    article.passages = article.passages.map(p=>({...p,url:'https://xrpl.org/docs/test#reference'}))
    const bytes = JSON.stringify({articles:[article]})
    writeFileSync(join(dir,'index.json'),bytes)
    writeFileSync(join(dir,'manifest.json'),JSON.stringify({indexSha256:createHash('sha256').update(bytes).digest('hex')}))
    const docs = await loadPublicDocs(pathToFileURL(dir + '/'))
    const entries = await buildRegistry(docs,{rail:'xrpl-testnet',env:{}})
    const entry = entries.get('xrpl-docs')!, proofs = createManifests(journal), manifest = proofs.manifestFor(entry,docs.articles[0],1,true)!
    expect(manifest.priceMinor).toBe(0)
    expect(verifyManifestSignature(manifest)).toBe(true)
    expect(verifyDelivery(article.body,article.passages,proofs.saltsFor(article),manifest).ok).toBe(true)
    expect(docs.articles[0].passages[0].url).toBe('https://xrpl.org/docs/test#reference')
    writeFileSync(join(dir,'index.json'),readFileSync(join(dir,'index.json'),'utf8')+' ')
    await expect(loadPublicDocs(pathToFileURL(dir + '/'))).rejects.toThrow('differs from pinned manifest')
  } finally { journal.close(); await scope.close() }
})
