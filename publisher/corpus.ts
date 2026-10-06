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
export async function loadWriterCorpus(root = dataDirectory, options: { allowMini?: boolean } = {}): Promise<WriterCorpus> {
  const roster = await jsonFiles(new URL('writers/', root))
  const articles = (await jsonFiles(new URL('corpus/v2/', root))).flatMap(file => asList(file, 'articles'))
    .filter(item => item && typeof item === 'object' && 'articleId' in item)
  if (roster.length) {
    const publishers = roster.map(file => {
      const { writers: _w, topics: _t, publisher, ...rest } = file as Record<string, unknown>
      return publisher ?? rest
    })
    const writers = roster.flatMap(file => asList((file as Record<string, unknown>).writers, 'writers'))
    // Until #120 commits the articles, the full roster is served with no articles.
    if (!articles.length && options.allowMini === false) throw new Error('No v2 articles under data/corpus/v2/')
    if (!articles.length) console.warn('Writer articles not generated yet (#120); serving the roster with no articles')
    return validateWriterCorpus({ publishers, writers, articles })
  }
  if (options.allowMini === false || !existsSync(miniCorpusFile)) throw new Error('No writer roster in data/writers/')
  console.warn('Writer corpus not generated yet; serving the mini corpus (SYNTHETIC test fixture)')
  return validateWriterCorpus(JSON.parse(await readFile(miniCorpusFile, 'utf8')), { relaxWordLimits: true })
}
