// `--decision production` (#207 data, #212): the decision provider the demo runs, built as server/routes.ts builds it
// from DECISION_PROVIDER (openai → OpenAIDecisionsProvider, cloudflare → ClefDecisionProvider) and the same env
// (DECISION_MODEL, DECISIONS_GAP_WORDING, DECISIONS_WORDING, DECISIONS_MAX_QUESTIONS). Only three things differ:
// - transport: every request goes through ../transport.ts (double live opt-in, EVAL_SPEND_CAP_USD, response cache,
//   cost meter), never the provider's own `fetch`;
// - credentials: the transport adds the EVAL_* key; the provider only ever holds a placeholder, never a real key;
// - the per-attempt timeout: EVAL_DECISION_TIMEOUT_MS (default 20 s), because the dataset wants scores, not latency.
//   Set it to 5000 to reproduce the demo's timeouts.
import { ClefDecisionProvider } from '../../../server/agents/clef.js'
import { OpenAIDecisionsProvider } from '../../../server/agents/openai-decisions.js'
import type { DecisionProvider } from '../../../server/agents/decision.js'
import { models, request, type Arm } from '../transport.js'

export type ProductionKind = 'openai' | 'cloudflare'
export function productionKind(configured: unknown = process.env.DECISION_PROVIDER): ProductionKind {
  if (configured === 'openai' || configured === 'cloudflare') return configured
  throw new Error('--decision production needs DECISION_PROVIDER=openai or DECISION_PROVIDER=cloudflare, as the demo sets it.')
}
/** The harness arm (rates, cache namespace, EVAL_* credential) for a production model. */
export const armFor = (kind: ProductionKind, model: string): Arm => kind === 'openai' ? 'luna' : model === models.clef ? 'clef' : 'flash'
const PLACEHOLDER = 'eval-transport-adds-the-EVAL-credential'

/** A fetch that hands the provider's exact request body to the harness transport and replays its stored response. */
export function harnessFetch(arm: Arm, phase: string): typeof fetch {
  return (async (_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as { questions?: unknown }
    const record = await request(arm, body, { phase, kind: 'production' })
    // A transport failure (status 0) looks like a 503 to the provider, which retries once and then fails the round (#197).
    return new Response(JSON.stringify(record.response ?? {}), { status: record.status || 503, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch
}

export type ProductionOptions = { fetch?: typeof fetch; phase?: string; env?: NodeJS.ProcessEnv }
/** The production provider. `fetch` replaces the harness transport (tests, and `--plan`'s counting stub). */
export function productionProvider(options: ProductionOptions = {}): DecisionProvider & { arm: Arm } {
  const env = options.env ?? process.env
  const kind = productionKind(env.DECISION_PROVIDER)
  const timeoutMs = Number(env.EVAL_DECISION_TIMEOUT_MS) > 0 ? Number(env.EVAL_DECISION_TIMEOUT_MS) : 20_000
  if (kind === 'openai') {
    const probe = new OpenAIDecisionsProvider()
    const arm = armFor(kind, probe.model)
    return Object.assign(new OpenAIDecisionsProvider({ apiKey: PLACEHOLDER, fetch: options.fetch ?? harnessFetch(arm, options.phase ?? 'production'), timeoutMs }), { arm })
  }
  const probe = new ClefDecisionProvider()
  const arm = armFor(kind, probe.model)
  return Object.assign(new ClefDecisionProvider({ token: PLACEHOLDER, accountId: 'eval-account', fetch: options.fetch ?? harnessFetch(arm, options.phase ?? 'production'), timeoutMs }), { arm })
}

/**
 * `--plan`: answers every request with a well-formed neutral reply and counts it, so the harness runs end to end
 * with no network and no cache writes. Counts are exact for the sweep; for the flow they follow this stub's
 * decisions, so the plan also prints per-question bounds.
 */
export function countingFetch(): { fetch: typeof fetch; calls: { questions: number; bytes: number }[] } {
  const calls: { questions: number; bytes: number }[] = []
  const fetchImpl = (async (_url: string | URL | Request, init?: RequestInit) => {
    const text = String(init?.body ?? '{}')
    const body = JSON.parse(text) as { questions?: unknown }
    if (Array.isArray(body.questions)) {
      // OpenAI Decisions: an answer per question, by name.
      const questions = body.questions as { name: string; type: string; choices?: { value: string }[]; levels?: unknown[] }[]
      calls.push({ questions: questions.length, bytes: text.length })
      const answers = questions.map(q => q.type === 'predicate' ? { type: 'predicate', name: q.name, probability: 0.5 } : q.type === 'choice' ? { type: 'choice', name: q.name, probabilities: (q.choices ?? []).map((c, i) => ({ value: c.value, probability: i === 0 ? 0.6 : 0.4 / Math.max(1, (q.choices ?? []).length - 1) })) } : { type: 'score', name: q.name, score: 1 })
      return new Response(JSON.stringify({ answers }), { status: 200 })
    }
    // Clef: answers keyed by question name.
    const questions = (body.questions ?? {}) as Record<string, { type: string; criteria?: Record<string, string> | string[] }>
    calls.push({ questions: Object.keys(questions).length, bytes: text.length })
    const answers = Object.fromEntries(Object.entries(questions).map(([name, q]) => {
      if (q.type === 'noul') return [name, { type: 'noul', noul: 0.5 }]
      if (q.type === 'score') return [name, { type: 'score', score: 1 }]
      const values = Object.keys(q.criteria ?? {})
      return [name, { type: 'choice', choice: values[0], probabilities: Object.fromEntries(values.map((v, i) => [v, i === 0 ? 0.6 : 0.4 / Math.max(1, values.length - 1)])) }]
    }))
    return new Response(JSON.stringify({ success: true, result: { answers } }), { status: 200 })
  }) as typeof fetch
  return { fetch: fetchImpl, calls }
}
