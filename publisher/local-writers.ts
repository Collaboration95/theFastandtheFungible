import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { parse } from 'dotenv'
import type { EmbeddingCache } from './search.js'
import { validateWriterCorpus, type WriterCorpus } from '../shared/contracts/writers.js'

export const localWriterRoot = () => resolve(process.env.LOCAL_WRITERS_DIR || 'data/local-writers')
export const localWriterEnv = (slug: string, root = localWriterRoot()): NodeJS.ProcessEnv => {
  const file = join(root, slug, '.env.writer')
  return existsSync(file) ? parse(readFileSync(file)) : {}
}

/** Local content stays ignored, and is picked up on the next publisher/engine start. */
export async function loadLocalWriters(root = localWriterRoot()): Promise<WriterCorpus[]> {
  if (!existsSync(root)) return []
  const entries = await readdir(root, { withFileTypes: true })
  return Promise.all(entries.filter(e => e.isDirectory() && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(e.name))
    .filter(e => existsSync(join(root, e.name, 'corpus.json'))).map(async e => {
      const corpus = validateWriterCorpus(JSON.parse(readFileSync(join(root, e.name, 'corpus.json'), 'utf8')))
      if (corpus.publishers.length !== 1 || corpus.publishers[0].slug !== e.name) throw new Error('Invalid local writer identity')
      return corpus
    }))
}

/** Merge private local vectors with the built-in cache, without sending article bytes anywhere. */
export function localEmbeddingCache(base?: EmbeddingCache, root = localWriterRoot()): EmbeddingCache | undefined {
  if (!existsSync(root)) return base
  const files = readdirSync(root, { withFileTypes: true }).filter(e => e.isDirectory() && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(e.name))
    .map(e => join(root, e.name, 'embeddings.json')).filter(existsSync)
  if (!files.length) return base
  const caches = files.map(f => JSON.parse(readFileSync(f, 'utf8')) as EmbeddingCache)
  return { ...caches[0], vectors: Object.assign({}, base?.vectors, ...caches.map(c => c.vectors)) }
}
