// Server only. Model acquisition is a separate build step; inference never downloads.
import { resolve } from 'node:path'
export const LOCAL_MODELS = {
  'Xenova/bge-small-en-v1.5': 'ea104dacec62c0de699686887e3f920caeb4f3e3',
  'Xenova/all-MiniLM-L6-v2': '751bff37182d3f1213fa05d7196b954e230abad9',
} as const
export const LOCAL_MODEL = 'Xenova/bge-small-en-v1.5'
export const LOCAL_DIMS = 384
export const modelRoot = () => resolve(process.env.EMBEDDING_MODEL_DIR || 'data/models')
export const localCacheFile = () => resolve(modelRoot(), 'corpus-vectors.json')
export function createLocalEmbedder(model: keyof typeof LOCAL_MODELS = LOCAL_MODEL) {
  const load = async () => {
    const packageName = '@huggingface/transformers'
    const { env, pipeline } = await import(packageName) as typeof import('@huggingface/transformers')
    env.localModelPath = `${modelRoot()}/`
    env.allowRemoteModels = false
    env.useBrowserCache = false
    return pipeline('feature-extraction', model, { device: 'cpu', dtype: 'q8', local_files_only: true,
      session_options: { intraOpNumThreads: 1, interOpNumThreads: 1 } })
  }
  let loaded: ReturnType<typeof load> | undefined
  // Serialize inference to bound CPU and memory on publisher fan-out.
  let tail: Promise<unknown> = Promise.resolve()
  return (texts: string[], signal?: AbortSignal): Promise<number[][]> => {
    const task = tail.then(async () => {
      signal?.throwIfAborted()
      const extractor = await (loaded ??= load())
      signal?.throwIfAborted()
      const out = (await extractor(texts, { pooling: 'mean', normalize: true })).tolist() as number[][]
      signal?.throwIfAborted()
      if (out.length !== texts.length || out.some(v => v.length !== LOCAL_DIMS || v.some(n => !Number.isFinite(n)))) throw new Error('Invalid local embedding shape')
      return out
    })
    tail = task.catch(() => {})
    return task
  }
}
export const embedLocal = createLocalEmbedder()
