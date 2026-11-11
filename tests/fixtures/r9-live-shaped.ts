// R9-A: replays the live DeepSeek plans the round-9 judges recorded on the hosted demo (r9-live-plans.json) through
// the real engine with fixture decisions, SIMULATED payments and keyword search. The hosted demo plans live and
// decides with the fixture model, so this is its decision path with the planner's own wording, offline and
// deterministic. Development and regression data only, never a held-out result.
//   npx tsx tests/fixtures/r9-live-shaped.ts <out.json> [modal|run]
import { once } from 'node:events'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createPublisherApp } from '../../publisher/routes.js'
import { PublisherClient } from '../../server/publisher-client.js'
import { PurchaseManager } from '../../server/purchases.js'
import { Store } from '../../server/store.js'
import { RunLoop } from '../../server/agents/loop.js'
import { fixtureRequirements, withIds } from '../../server/agents/requirements.js'
import { FixtureDecisionProvider } from '../../server/agents/decision.js'
import { Reputation } from '../../server/reputation.js'
import type { RunSnapshot } from '../../shared/contracts/index.js'

export type LivePlan = { restatement: string; subqueries: string[]; requirements: string[] }
export type LiveQuestion = { id: string; question: string; budgetMinor: number; modal: LivePlan; run: LivePlan; observed: { bought: string[]; spentMinor: number; lead: string[] } }
export const LIVE_PLANS: LiveQuestion[] = JSON.parse(readFileSync(new URL('./r9-live-plans.json', import.meta.url), 'utf8')).questions
export const liveQuestion = (id: string) => {
  const found = LIVE_PLANS.find(q => q.id === id)
  if (!found) throw new Error(`no recorded plan for ${id}`)
  return found
}
export type LiveShapedResult = { id: string; wording: 'modal' | 'run'; question: string; bought: string[]; spentMinor: number; lead: string[]; openGaps: string[]; stopReason?: unknown; phase: RunSnapshot['phase']; decisions: { round: number; gap: string; selected?: string; rows: { id: string; verdict: string; value: number; reason: string }[] }[] }

/** One publisher and engine for a batch of questions; each question is its own run with its own frozen plan. */
export async function runLiveShaped(questions: LiveQuestion[], wording: 'modal' | 'run' = 'modal'): Promise<LiveShapedResult[]> {
  const app = createPublisherApp({ journal: ':memory:', rail: 'simulated', env: {} }); await app.locals.ready; await app.locals.writersReady
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening')
  const store = new Store(':memory:')
  try {
    const client = new PublisherClient({ baseUrl: `http://127.0.0.1:${(server.address() as { port: number }).port}` })
    const loop = new RunLoop(store, client, new PurchaseManager(store, client), undefined, { provider: new FixtureDecisionProvider(), reputation: new Reputation(store) })
    const results: LiveShapedResult[] = []
    for (const q of questions) {
      const { requirements, ...plan } = q[wording]
      const run = store.createRun(q.question, q.budgetMinor)
      // A plan without requested facts (the scope's labelled fixture fallback) freezes the fixture extraction, as freezeRequirements does.
      const frozen = requirements.length ? withIds(requirements.map(text => ({ text }))) : withIds(fixtureRequirements(q.question))
      store.updateRun(run.runId, { checkpoint: { plan, requirements: frozen, requirementsBy: requirements.length ? 'DeepSeek · deepseek-flash (recorded)' : 'fixture · scope-fixture' } })
      await loop.start(run.runId)
      const final = store.getRun(run.runId)
      results.push({ id: q.id, wording, question: q.question, bought: final.intents.filter(i => i.status === 'VERIFIED' || i.status === 'REFUNDED').map(i => i.resourceId), spentMinor: final.spentMinor, lead: (final.answers.at(-1)?.lead ?? []).map(l => l.text), openGaps: (final.answers.at(-1)?.openGaps ?? []).map(g => g.text), stopReason: final.checkpoint.stopReason, phase: final.phase, decisions: final.decisions.map(d => ({ round: d.round, gap: d.gap, selected: d.selectedResourceId, rows: d.rows.map(r => ({ id: r.candidate.resourceId, verdict: r.verdict, value: Number(r.value.toFixed(3)), reason: r.reason })) })) })
    }
    return results
  } finally { store.close(); server.closeAllConnections(); await new Promise<void>(done => server.close(() => done())); app.locals.journal.close() }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = process.argv[2], wording = (process.argv[3] ?? 'modal') as 'modal' | 'run'
  const results = await runLiveShaped(LIVE_PLANS, wording)
  for (const r of results) console.log(r.id, wording, `S$${(r.spentMinor / 100).toFixed(2)}`, JSON.stringify(r.bought), JSON.stringify(r.lead[0] ?? ''))
  if (out) writeFileSync(out, JSON.stringify(results, null, 2))
}
