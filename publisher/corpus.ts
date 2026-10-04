import type { CorpusResource } from '../shared/contracts/corpus.js'
export async function loadCorpus(_variant = process.env.CORPUS_VARIANT): Promise<CorpusResource[]> { throw new Error('TODO(W1-CORPUS): load and validate v2 corpus') }
