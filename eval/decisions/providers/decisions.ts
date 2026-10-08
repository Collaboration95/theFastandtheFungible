// Provider adapters for the harness (#212), ported from bench/decisions/providers/openai-decisions.ts on
// bench/decisions-vs-clef. Every call goes through ../transport.ts, so nothing leaves the process
// without the explicit live opt-in. `HarnessDecisionProvider` generalises the bench's Luna adapter to
// any arm (flash, clef, luna) so the offline eval can swap its fixture judge for a live one.
import { z } from 'zod'
import type { DecisionProvider } from '../../../server/agents/decision.js'
import { publicCandidate, publicSources } from '../../../server/agents/decision.js'
import { clefCandidate, clefQuestions } from '../../../server/agents/clef.js'
import { CandidateJudgmentSchema } from '../../../shared/contracts/index.js'
import { models, request, type Arm, type CallRecord } from '../transport.js'

export type Question = { type: string; instructions: string; criteria?: Record<string, string> | readonly string[] }
export type Questions = Record<string, Question>
export type Answer = { type?: string; noul?: number; choice?: string; score?: number; probabilities?: Record<string, number> }

/** Clef question format → the OpenAI Decisions format (predicate, choice, score). */
export function mapQuestions(questions: Questions) {
  return Object.entries(questions).map(([name, q]) => q.type === 'noul'
    ? { name, type: 'predicate', instructions: q.instructions }
    : q.type === 'choice'
      ? { name, type: 'choice', instructions: q.instructions, choices: Object.entries(q.criteria ?? {}).map(([value, description]) => ({ value, description })) }
      : { name, type: 'score', instructions: q.instructions, levels: (q.criteria as readonly string[]).map((description, i) => ({ label: String(i), description })) })
}
const LunaAnswerSchema = z.object({ name: z.string(), type: z.string(), probability: z.number().optional(), probabilities: z.array(z.object({ value: z.union([z.string(), z.number()]), probability: z.number() })).optional() }).passthrough()
/** A provider payload → Clef-shaped answers. A refusal or a malformed payload throws: never a confident zero. */
export function normalize(arm: Arm, payload: unknown): Record<string, Answer> {
  if (arm !== 'luna') {
    const parsed = z.object({ success: z.literal(true), result: z.object({ answers: z.record(z.string(), z.unknown()) }) }).safeParse(payload)
    if (!parsed.success) throw new Error('Invalid Clef response')
    return parsed.data.result.answers as Record<string, Answer>
  }
  const parsed = z.object({ answers: z.array(LunaAnswerSchema) }).safeParse(payload)
  if (!parsed.success) throw new Error('Invalid Decisions response')
  return Object.fromEntries(parsed.data.answers.map(a => {
    if (a.type === 'refusal') throw new Error('Decisions refusal')
    if (a.type === 'predicate') return [a.name, { type: 'noul', noul: a.probability }]
    const probabilities = Object.fromEntries((a.probabilities ?? []).map(p => [String(p.value), p.probability]))
    const choice = Object.entries(probabilities).sort((x, y) => y[1] - x[1])[0]?.[0]
    return [a.name, { ...a, probabilities, ...(choice === undefined ? {} : { choice }) } as Answer]
  }))
}
export function judgment(answers: Record<string, Answer>, prefix = '') {
  return CandidateJudgmentSchema.parse({ addressesGap: answers[prefix + 'addresses_gap']?.noul, originality: answers[prefix + 'originality']?.probabilities, credibility: answers[prefix + 'credibility']?.score })
}
export const prob = (a: Answer | undefined) => {
  const p = a?.noul
  if (typeof p !== 'number' || p < 0 || p > 1) throw new Error('Invalid predicate')
  return p
}
export async function call(arm: Arm, state: unknown, questions: Questions, meta: { phase: string; kind: string; repeat?: number; ordinal?: string }): Promise<{ record: CallRecord; answers: Record<string, Answer>; valid: boolean }> {
  const body = arm === 'luna' ? { model: models.luna, input: JSON.stringify(state, null, 2), questions: mapQuestions(questions) } : { model: arm === 'clef' ? 'clef' : 'clef-flash', state, questions }
  const record = await request(arm, body, meta)
  try { return { record, answers: normalize(arm, record.response), valid: !record.error } } catch { return { record, answers: {}, valid: false } }
}

/**
 * Research-only DecisionProvider over the harness transport. `name` stays 'cloudflare' because the
 * production interface has no other discriminator; every harness output records the arm instead.
 * Nothing here is displayed in the product or sent to payment.
 */
export class HarnessDecisionProvider implements DecisionProvider {
  readonly name = 'cloudflare' as const
  readonly model: string
  readonly records: CallRecord[] = []
  constructor(readonly arm: Arm, private readonly phase = 'adapter', private readonly repeat = 0, private readonly questions: { round: Questions; candidate: Questions; paid: Questions } = clefQuestions as never) { this.model = models[arm] }
  private async ask(state: unknown, questions: Questions, kind: string) {
    const r = await call(this.arm, state, questions, { phase: this.phase, kind, repeat: this.repeat })
    this.records.push(r.record)
    if (!r.valid || r.record.timeout3s) throw new Error('Decision unavailable')
    return r.answers
  }
  async judgeRound(input: Parameters<DecisionProvider['judgeRound']>[0]) {
    return { gapMaterial: prob((await this.ask(input, this.questions.round, 'round')).gap_material) }
  }
  async judgeCandidate(input: Parameters<DecisionProvider['judgeCandidate']>[0]) {
    const state = { question: input.question, gap: input.gap, readSources: publicSources(input.readSources), candidate: clefCandidate(publicCandidate(input.candidate)) }
    return judgment(await this.ask(state, this.questions.candidate, 'candidate'))
  }
  /** Called only after a (simulated) verified grant, as in production (gate 1). */
  async judgePaidRelevance(input: Parameters<NonNullable<DecisionProvider['judgePaidRelevance']>>[0]) {
    const state = { question: input.question, gap: input.gap, passages: input.content.spans.map(s => s.text) }
    return { observed: prob((await this.ask(state, this.questions.paid, 'paid')).addresses_gap) }
  }
}
