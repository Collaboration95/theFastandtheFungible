import { ledgerCorpus } from './writers/ledger-analytics/catalogue.js'
import { loadPublicDocs } from './writers/public-docs.js'
import { localWriterRegistrations } from '../server/local-writer-discovery.js'
import { loadLocalWriters } from './local-writers.js'
import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { validateWriterCorpus, type WriterCorpus } from '../shared/contracts/writers.js'

const dataDirectory = new URL('../data/', import.meta.url)
const miniCorpusFile = new URL('../tests/fixtures/corpus-mini/corpus.json', import.meta.url)

async function jsonFiles(dir: URL): Promise<unknown[]> {
  if (!existsSync(dir)) return []
  const entries = await readdir(dir, { withFileTypes: true, recursive: true })
  const files = entries.filter(e => e.isFile() && e.name.endsWith('.json') && e.name !== 'embeddings.json')
    .map(e => `${e.parentPath}/${e.name}`).sort()
  return Promise.all(files.map(async file => JSON.parse(await readFile(file, 'utf8')) as unknown))
}
const asList = (value: unknown, key: string): unknown[] => Array.isArray(value) ? value
  : value && typeof value === 'object' && Array.isArray((value as Record<string, unknown>)[key]) ? (value as Record<string, unknown[]>)[key]
  : value === undefined ? [] : [value]

/**
 * The v2 writer corpus (#122): one roster file per publisher in data/writers/
 * ({ publisher, writers } or a publisher object with a `writers` array) and the
 * articles anywhere under data/corpus/v2/ (one article, an array, or { articles }).
 * Without articles it serves the roster alone; without a roster, the mini corpus.
 */
export async function loadWriterCorpus(root = dataDirectory, options: { allowMini?: boolean; profile?: 'default' | 'real' } = {}): Promise<WriterCorpus> {
  const profile = options.profile ?? (process.env.CORPUS_PROFILE?.trim().toLowerCase() || 'default')
  if (!['default','real'].includes(profile)) throw Error('Invalid CORPUS_PROFILE')
  const roster = await jsonFiles(new URL('writers/', root))
  let articles = (await jsonFiles(new URL('corpus/v2/', root))).flatMap(file => asList(file, 'articles'))
    .filter(item => item && typeof item === 'object' && 'articleId' in item)
  const docs = root === dataDirectory && (process.env.FREE_TIER?.trim().toLowerCase() === 'public-docs' || profile === 'real') ? await loadPublicDocs(new URL('corpus/public-docs/', root)) : undefined
  if (docs) articles = articles.filter(a => (a as {tier:string}).tier !== 'FREE')
  if (roster.length) {
    const publishers = roster.map(file => {
      const { writers: _w, topics: _t, publisher, ...rest } = file as Record<string, unknown>
      return publisher ?? rest
    })
    const writers = roster.flatMap(file => asList((file as Record<string, unknown>).writers, 'writers'))
    // Until #120 commits the articles, the full roster is served with no articles.
    if (!articles.length && options.allowMini === false) throw new Error('No v2 articles under data/corpus/v2/')
    if (!articles.length) console.warn('Writer articles not generated yet (#120); serving the roster with no articles')
    const active = new Set(localWriterRegistrations().map(w => w.slug))
    const local = root === dataDirectory ? (await loadLocalWriters()).filter(c => !active.has(c.publishers[0].slug)) : []
    const ledger = root === dataDirectory && (process.env.LEDGER_ANALYTICS === '1' || profile === 'real') ? ledgerCorpus() : undefined
    return selectCorpusProfile(validateWriterCorpus({ publishers: [...publishers, ...(docs?.publishers ?? []), ...(ledger?.publishers ?? []), ...local.flatMap(c => c.publishers)],
      writers: [...writers, ...(docs?.writers ?? []), ...(ledger?.writers ?? []), ...local.flatMap(c => c.writers)], articles: [...articles, ...(docs?.articles ?? []), ...(ledger?.articles ?? []), ...local.flatMap(c => c.articles)] }), profile)
  }
  if (profile === 'real' || options.allowMini === false || !existsSync(miniCorpusFile)) throw new Error('No writer roster in data/writers/')
  console.warn('Writer corpus not generated yet; serving the mini corpus (SYNTHETIC test fixture)')
  return validateWriterCorpus(JSON.parse(await readFile(miniCorpusFile, 'utf8')), { relaxWordLimits: true })
}

/** Corpus provenance is an admission boundary, independent of ranking and fixtures. */
export function selectCorpusProfile(corpus: WriterCorpus, profile: string): WriterCorpus {
  if (profile !== 'real') return corpus
  const allowed = new Set(corpus.publishers.filter(p => p.synthetic === false).map(p=>p.slug))
  return validateWriterCorpus({publishers:corpus.publishers.filter(p=>allowed.has(p.slug)),writers:corpus.writers.filter(w=>allowed.has(w.publisherSlug)),articles:corpus.articles.filter(a=>allowed.has(a.publisherSlug))})
}
