import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { loadBank } from '../questions/bank.js'
import { loadWorld } from '../decisions/world.js'
import { buildSnapshots } from '../coverage/snapshots.js'

export const SAMPLE = ['Q01', 'Q09', 'Q18', 'Q19', 'Q23', 'Q27', 'Q31', 'Q35', 'Q42', 'Q44']
export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')
export async function frozenInputs() {
  const bank = loadBank(), world = await loadWorld()
  const snapshots = await buildSnapshots(world, bank)
  const prompts = ['server/agents/clef.ts', 'shared/fact-menu.ts', 'publisher/manifest.ts', 'shared/manifest.ts', 'eval/decisions/world.ts', 'server/agents/openai-decisions.ts', 'eval/decisions/providers/decisions.ts', 'eval/coverage/arms.ts', 'server/agents/research.ts', 'server/agents/scope.ts', 'server/agents/requirements.ts']
  return { version: 'sff-scorecard/v2-fact-menu', bank: sha256(JSON.stringify(bank)), corpus: sha256(JSON.stringify(world.corpus)), corpusContent: sha256(JSON.stringify({ ...world.corpus, articles: world.corpus.articles.map(({ factMenu: _menu, ...article }) => article) })), snapshots: sha256(JSON.stringify(snapshots)),
    promptSources: Object.fromEntries(prompts.map(p => [p, sha256(readFileSync(p, 'utf8'))])),
    split: 'all 48 bank questions; all 116 coverage snapshots; no training or threshold fitting', order: bank.questions.map(q => q.id), latencySample: SAMPLE,
    config: { flow: 'requested', sharedTrust: false, paidRelevance: false, provider: 'openai', model: 'gpt-6-luna', maxQuestions: 25, wording: 'evidence', gapWording: 'plain', calibration: 'off', search: 'keyword', research: 'extractive-fixture', rail: 'simulated', budgetMinor: 200, timing: 'fresh child process, warm queries, 10ms poll + SSE; no telemetry' } }
}
