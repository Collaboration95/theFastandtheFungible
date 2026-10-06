// Hand-written mini corpus (#112): 3 publishers, 8 short articles (one PAID, one rewrite).
// Other streams' unit tests use it until the generated corpus lands. Word limits are relaxed.
import { validateWriterCorpus } from '../../../shared/contracts/writers.js'
import raw from './corpus.json'
import alphaLeak from './alphaleak.json'

export const miniCorpus = validateWriterCorpus(raw, { relaxWordLimits: true })
/** The mini corpus plus an AlphaLeak-style publisher carrying the story bible's planted article (#126). */
export const alphaLeakCorpus = validateWriterCorpus({
  publishers: [...raw.publishers, ...alphaLeak.publishers], writers: [...raw.writers, ...alphaLeak.writers], articles: [...raw.articles, ...alphaLeak.articles],
}, { relaxWordLimits: true })
