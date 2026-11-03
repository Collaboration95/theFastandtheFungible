// Offline authoring from reviewed planted-fact specifications; never calls a model.
import { readFileSync, writeFileSync } from 'node:fs'
import { loadArticles, loadBank, verifyBank, normalize } from '../eval/questions/bank.js'
const original = loadBank('eval/questions/bank.v1.json')
const articles = loadArticles()
const specs: { articleId: string; passageId: string; need: string; needles: string[] }[] = JSON.parse(readFileSync('eval/questions/additions.v2.json', 'utf8'))
const additions = specs.map((s, i) => {
  const article = articles.get(s.articleId)!
  const passage = article.passages.find(p => p.id === s.passageId)!
  if (!s.needles.every(n => normalize(passage.text).includes(normalize(n)))) throw new Error(`Invalid planted fact ${s.articleId}/${s.passageId}`)
  const id = `Q${i + 49}`
  return { id, lane: `source:${article.articleId}`, kind: article.tier === 'FREE' ? 'free-sufficient' as const : 'paid-needed' as const,
    question: s.need, requested: [{ id: `${id}.fact`, need: s.need, text: passage.text, needles: s.needles, sources: [s.articleId] }],
    expect: { buy: article.tier === 'PAID' ? s.articleId : null }, notes: `Synthetic-corpus fact; curated specification ${s.articleId}/${s.passageId}. Human review pending; not a claim about the real world.` }
})
const bank = { ...original, version: 2, builtAt: '2026-11-03', label: 'Synthetic corpus, 48 historical dev questions plus 92 new source-grouped prospective holdout facts',
  generator: { ...original.generator, author: 'Historical Claude bank plus Codex curated planted-fact specifications and deterministic generator', vendor: 'Anthropic + OpenAI', vendorDiffersFromJudged: false,
    method: [...original.generator.method, 'v2 additions authored by OpenAI Codex; same vendor as Luna, disclosed. Numeric labels verified against exact planted passages. No paraphrase padding.'] },
  questions: [...original.questions, ...additions] }
const errors = verifyBank(bank).filter(p => p.severity === 'error')
if (errors.length) throw new Error(JSON.stringify(errors))
writeFileSync('eval/questions/bank.v2.json', JSON.stringify(bank, null, 2) + '\n')
writeFileSync('eval/scorecard/receipt-split.json', JSON.stringify({ version: 'numbers/v2', frozenAt: '2026-11-03',
  devIds: original.questions.map(q => q.id), heldoutIds: additions.map(q => q.id),
  devFamilies: [...new Set(original.questions.map(q => q.lane))], heldoutFamilies: [...new Set(additions.map(q => q.lane))],
  protocol: 'All 48 historical questions are dev: earlier PRs saw the old full bank. All 92 new facts are prospective heldout, grouped by source article (20 source families). Existing corpus was visible previously; these are new questions, not unseen documents. Labels and candidate frozen before baseline/after. No tuning on heldout. No cross-vendor authoring claim for v2. CIs cluster entire source families, not paraphrases; small corpus limits precision.', payments: 'SIMULATED', maxTaskModelUsd: 5 }, null, 2) + '\n')
console.log(`Generated ${bank.questions.length} questions; dev ${original.questions.length}, heldout ${additions.length}, heldout source groups ${new Set(additions.map(q => q.lane)).size}.`)
