import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import type { WriterCorpus } from '../../shared/contracts/writers.js'
import { validateWriterCorpus } from '../../shared/contracts/writers.js'

export const PUBLIC_DOCS_PUBLISHERS = new Set(['xrpl-docs', 'x402-docs'])
/** Missing build output is a startup error; never silently substitute fictional sources. */
export async function loadPublicDocs(root = new URL('../../data/corpus/public-docs/', import.meta.url)): Promise<WriterCorpus> {
  const bytes = await readFile(new URL('index.json', root), 'utf8')
  const manifest = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8')) as {indexSha256:string}
  if (createHash('sha256').update(bytes).digest('hex') !== manifest.indexSha256) throw new Error('Public docs index differs from pinned manifest; rebuild it')
  const index = JSON.parse(bytes) as Pick<WriterCorpus, 'articles'>
  return validateWriterCorpus({ articles: index.articles, publishers: [
    { slug: 'xrpl-docs', name: 'XRPL documentation (XRPL Foundation and contributors)', licence: 'MIT', domain: 'xrpl.org' },
    { slug: 'x402-docs', name: 'x402 documentation (Coinbase and contributors)', licence: 'Apache-2.0', domain: 'github.com/coinbase/x402' },
  ].map(p => ({ ...p, kind: 'records', prices: {}, accent: '#5c5c66', heroQuote: 'Public documentation · upstream authors credited', bio: 'Public documentation, imported at a pinned commit. Not an independent writer.', synthetic: false, verification: { status: 'unverified' } })),
  writers: [...PUBLIC_DOCS_PUBLISHERS].map(slug => ({slug, publisherSlug:slug, name: slug === 'xrpl-docs' ? 'XRPL Foundation and contributors' : 'Coinbase and contributors', bio:'Upstream public documentation authors', voice:'Technical reference'})) })
}
