// Offline self-check of the committed v2 corpus (#120). Run: node --import tsx scripts/check-corpus.mjs
// Fast: reads JSON only. Also imported by tests/corpus-v2.test.ts.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { sharesRun, validateWriterCorpus } from '../shared/contracts/writers.ts'
import { CLAIM_KINDS } from '../shared/manifest.ts'

const readJson = path => JSON.parse(readFileSync(path, 'utf8'))

export function loadCorpus(root) {
  const roster = readdirSync(join(root, 'data/writers')).filter(f => f.endsWith('.json')).map(f => readJson(join(root, 'data/writers', f)))
  const dir = join(root, 'data/corpus/v2/articles')
  const articles = readdirSync(dir).flatMap(p => readdirSync(join(dir, p)).filter(f => f.endsWith('.json')).map(f => readJson(join(dir, p, f))))
  return { publishers: roster.map(f => f.publisher), writers: roster.flatMap(f => f.writers), articles }
}

/** Returns a list of problems; empty means the corpus is good. */
export function checkCorpus(root) {
  const bible = readJson(join(root, 'data/corpus/v2/story-bible.json'))
  const input = loadCorpus(root)
  const problems = []
  let corpus
  try { corpus = validateWriterCorpus(input) } catch (error) { return [String(error.message)] }
  const byId = new Map(corpus.articles.map(a => [a.articleId, a]))
  const records = new Set(corpus.publishers.filter(p => p.kind === 'records').map(p => p.slug))
  const writerArticles = corpus.articles.filter(a => !records.has(a.publisherSlug))
  if (writerArticles.length < 70) problems.push(`only ${writerArticles.length} writer articles (need 70+)`)
  if (corpus.articles.length - writerArticles.length < 8) problems.push('fewer than 8 open-records docs')

  const plant = bible.alphaLeakPlant
  const needles = []
  for (const article of bible.useCases.flatMap(u => u.articles)) {
    const a = byId.get(article.articleId)
    if (!a) { problems.push(`golden ${article.articleId} is missing`); continue }
    for (const key of ['tier', 'priceMinor', 'publisherSlug', 'writerSlug', 'family']) if (a[key] !== article[key]) problems.push(`${a.articleId}: ${key} is ${a[key]}, bible says ${article[key]}`)
    if (a.derivedFrom !== article.derivedFrom) problems.push(`${a.articleId}: derivedFrom ${a.derivedFrom} differs from bible`)
    for (const f of article.facts) for (const n of f.needles) { needles.push(n); if (!a.body.includes(n)) problems.push(`${a.articleId}: missing golden text "${n}"`) }
    for (const c of article.manifestClaims ?? []) {
      const p = a.passages.find(x => x.id === c.passageId)
      if (!p) { problems.push(`${a.articleId}: no passage ${c.passageId}`); continue }
      const holds = CLAIM_KINDS[c.kind](p.text)
      if (article.articleId === plant.articleId) { if (holds) problems.push(`${a.articleId}: planted ${c.kind} claim is true, it must be false`) } else if (!holds) problems.push(`${a.articleId}: claim ${c.id} (${c.kind}) is false`)
    }
  }
  const planted = byId.get(plant.articleId)
  if (planted && planted.passages.find(p => p.id === plant.manifestClaim.passageId)?.text !== plant.passageText) problems.push('AlphaLeak planted passage text differs from the bible')
  if (planted && !(planted.priceMinor === plant.priceMinor)) problems.push('AlphaLeak planted price differs from the bible')

  // Claims the publisher lists for other PAID articles are derived from CLAIM_KINDS itself (publisher/manifest.ts), so they hold by construction.

  // Gate 1: a PAID abstract states no dated figure, no numeric series and no golden fact.
  for (const a of corpus.articles.filter(x => x.tier === 'PAID')) {
    if (sharesRun(a.title, a.body)) problems.push(`${a.articleId}: title shares 8+ consecutive words with the body`)
    if (CLAIM_KINDS['dated-figure'](a.abstract) || CLAIM_KINDS['numeric-series'](a.abstract)) problems.push(`${a.articleId}: abstract states figures`)
    for (const n of needles) if (/\d/.test(n) && a.abstract.includes(n)) problems.push(`${a.articleId}: abstract leaks "${n}"`)
  }
  return problems
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const problems = checkCorpus(new URL('..', import.meta.url).pathname)
  if (problems.length) { console.error(problems.join('\n')); process.exit(1) }
  console.log('corpus ok')
}
