// Hand-written mini corpus (#112): 3 publishers, 8 short articles (one PAID, one rewrite).
// Other streams' unit tests use it until the generated corpus lands. Word limits are relaxed.
import { validateWriterCorpus } from '../../../shared/contracts/writers.js'
import raw from './corpus.json'

export const miniCorpus = validateWriterCorpus(raw, { relaxWordLimits: true })
