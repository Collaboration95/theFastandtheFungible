// Offline, prospectively authored synthetic documents. No provider calls or run output input.
// Reuses the corpus assembler/menu and bank schema/needle validators, without changing v1/v2.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
// @ts-expect-error The existing corpus generator is JavaScript.
import { assemble } from './generate-corpus.mjs'
import { loadArticles, loadBank, verifyBank } from '../eval/questions/bank.js'
import { ArticleSchema, articleProblems } from '../shared/contracts/writers.js'
const specs = JSON.parse(readFileSync('eval/questions/fresh-specs.v1.json', 'utf8'))
const bible = JSON.parse(readFileSync('data/corpus/v2/story-bible.json', 'utf8'))
const original = loadBank('eval/questions/bank.v2.json')
const questions = []
let id = 201
for (const s of specs) {
  const roster = JSON.parse(readFileSync(`data/writers/${s.publisherSlug}.json`, 'utf8'))
  // Separate public-record and paid editorial text prevents template leakage across tiers.
  const filler = s.tier === 'PAID'
    ? `The inspection team treats the register as a measurement record rather than a forecast. Each observation carries a local definition so that adjacent measures remain distinct. Operators reconcile the underlying logs before they submit an account to the editor. Readers should distinguish completed activity from announced plans. A count can move because of maintenance, routing or reporting boundaries. This account describes the fictional operator alone and does not imply a change elsewhere. The supporting notes discuss how the staff collect observations and how the editor resolves inconsistent entries. The article makes no recommendation about investment or procurement. Independent validation would require access to the original instrument logs.`
    : `Public documentation describes an administrative series with a clearly stated reporting boundary. The agency publishes this material for reference without charging a reader. Its tables describe recorded activity and avoid projecting future outcomes. Revision notices belong beside the original entry so that later readers can understand what changed. Definitions travel with the series because similar labels can describe different processes. This fictional record has no evidentiary authority outside the demonstration. A reader may compare entries only after checking the covered operator and reporting interval. The desk provides an accessible summary, while separate technical documents describe collection procedures. No private commentary is reproduced in this notice.`
  const blocks = s.facts.map((f: { text: string }) => f.text)
  const body = blocks.join('\n\n') + '\n\n' + Array.from({ length: 6 }, (_, i) => `## ${s.entity} record context ${i + 1}\n\n${s.entity}: ${filler}`).join('\n\n')
  const article = ArticleSchema.parse(assemble({ ...s, writerSlug: roster.writers[0].slug, title: `${s.entity} ${s.domain} operations register`, publishedAt: `${s.year}-10-20`, tags: [s.entity, s.domain, ...s.facts.map((f: { measure: string }) => f.measure)], family: s.articleId }, { abstract: `A fictional ${s.domain} operator opens its reporting methods for inspection; the register distinguishes completed observations from planning commentary.`, body }, bible))
  // Explicit publisher promises derived only from each bound paragraph, no answer values.
  if (s.tier === 'PAID') article.factMenu = Object.fromEntries(s.facts.map((f: { entity: string; measure: string; year: number }, i: number) => [`p${i + 1}`, { entity: f.entity, measure: f.measure, period: f.year === 2026 ? 'twenty twenty six' : 'twenty twenty seven' }]))
  const problems = articleProblems(article, roster.publisher)
  if (problems.length) throw new Error(`${s.articleId}: ${problems.join('; ')}`)
  const dir = `eval/questions/corpus-fresh.v1/${s.publisherSlug}`
  mkdirSync(dir, { recursive: true }); writeFileSync(`${dir}/${s.articleId}.json`, JSON.stringify(article, null, 2) + '\n')
  for (const f of s.facts.slice(0, 2)) {
    const qid = `Q${id++}`
    questions.push({ id: qid, lane: `source:${s.articleId}`, kind: s.tier === 'FREE' ? 'free-sufficient' : 'paid-needed', question: f.need,
      requested: [{ id: `${qid}.fact`, need: f.need, text: f.text, needles: f.needles, sources: [s.articleId] }], expect: { buy: s.tier === 'FREE' ? null : s.articleId }, notes: `Fresh synthetic ${s.domain}; no observed-result input. Other operators/periods/metrics are distractors. Human review pending.` })
  }
}
const bank = { ...original, version: 3, label: 'Fresh-v1: 48 questions, 24 new documents, four new domains', generator: { author: 'OpenAI Codex prospective specifications; existing corpus assembler and bank validators', vendor: 'OpenAI', judgedModels: original.generator.judgedModels, vendorDiffersFromJudged: false, method: ['Offline deterministic authoring, new questions and new documents; same vendor as judge disclosed.', '24 sources, two questions each; 32 paid-needed and 16 free-sufficient; prices fixed before any run.', 'Policy and set frozen before one main-policy and one generalised-policy live run. No tuning on either result.'] }, corpusSensitivity: {}, questions }
const errors = verifyBank(bank, new Map([...loadArticles(), ...loadArticles('eval/questions/corpus-fresh.v1')])).filter(p => p.severity === 'error')
if (errors.length) throw new Error(JSON.stringify(errors))
writeFileSync('eval/questions/bank.fresh.v1.json', JSON.stringify(bank, null, 2) + '\n')
console.log('Fresh bank: 48 questions / 24 new source clusters / water utilities, maritime logistics, fibre networks, food cold chain. Zero model calls.')
