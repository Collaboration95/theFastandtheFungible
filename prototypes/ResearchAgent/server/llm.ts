import { z } from 'zod'
import type { Source } from '../src/domain.js'

const PlanSchema = z.object({
  sourceId: z.string(),
  reason: z.string().min(1),
  gap: z.string().min(1),
})

export type PurchasePlan = z.infer<typeof PlanSchema> & {
  provider: 'groq' | 'fixture'
  model: string
  status: 'LIVE' | 'FALLBACK'
}

const model = () => process.env.LLM_MODEL || 'llama-3.3-70b-versatile'
const isLive = () => process.env.LLM_PROVIDER === 'groq' && Boolean(process.env.GROQ_API_KEY)

function fallback(question: string, candidates: Source[]): PurchasePlan {
  const selected = [...candidates].sort((a, b) => b.relevance - a.relevance)[0]
  return {
    sourceId: selected?.id ?? '',
    reason: selected ? `Selected ${selected.publisher} as the strongest affordable premium result in the retrieved evidence set.` : 'No affordable premium source was found.',
    gap: `What evidence would most change the answer to: ${question}`,
    provider: 'fixture',
    model: 'fixture-research-v1',
    status: 'FALLBACK',
  }
}

export async function planPurchase(question: string, sources: Source[], budgetCents: number): Promise<PurchasePlan> {
  const candidates = sources.filter((source) => source.accessTier === 'PREMIUM' && source.id !== 'circuit-note' && source.priceCents <= budgetCents && source.priceCents <= 100)
  const safeFallback = fallback(question, candidates)
  if (!isLive() || candidates.length === 0) return safeFallback

  const evidence = candidates.map((source) => ({
    id: source.id,
    publisher: source.publisher,
    title: source.title,
    preview: source.preview,
    priceCents: source.priceCents,
    relevance: source.relevance,
    gapMatch: source.gapMatch,
    novelty: source.novelty,
    authority: source.authority,
    originality: source.originality,
    family: source.familyLabel,
  }))
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), Number(process.env.LLM_TIMEOUT_MS ?? 30000))
  try {
    const configuredBase = process.env.LLM_BASE_URL || 'https://api.groq.com/openai/v1/chat/completions'
    const endpoint = configuredBase.endsWith('/chat/completions') ? configuredBase : `${configuredBase.replace(/\/$/, '')}/chat/completions`
    const response = await fetch(endpoint, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      body: JSON.stringify({
        model: model(),
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'You are the purchase-planning component of an evidence research agent. You receive only question text and metadata/previews from a deterministic semantic retrieval layer. Do not claim to have searched the web. Do not invent facts, prices, sources, or quotes. Select exactly one affordable premium source ID that would add the most useful evidence. Return JSON only with sourceId, reason, and gap.' },
          { role: 'user', content: JSON.stringify({ question, budgetCents, candidates: evidence }) },
        ],
      }),
    })
    if (!response.ok) throw new Error(`Groq returned ${response.status}`)
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
    const parsed = PlanSchema.parse(JSON.parse(payload.choices?.[0]?.message?.content ?? '{}'))
    if (!candidates.some((source) => source.id === parsed.sourceId)) throw new Error('Groq selected an ineligible source')
    return { ...parsed, provider: 'groq', model: model(), status: 'LIVE' }
  } catch (error) {
    console.error(`Groq purchase planning fallback: ${(error as Error).message}`)
    return safeFallback
  } finally {
    clearTimeout(timeout)
  }
}
