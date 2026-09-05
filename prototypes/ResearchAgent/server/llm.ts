import { z } from 'zod'
import type { Source } from '../src/domain.js'

const PlanSchema = z.object({
  sourceId: z.string(),
  reason: z.string().min(1),
  gap: z.string().min(1),
})

const DossierSchema = z.object({
  title: z.string().min(1),
  conclusion: z.string().min(1),
  changedAfterPaidResearch: z.object({
    before: z.string().min(1),
    afterNorthstar: z.string().optional(),
    after: z.string().min(1),
  }),
  claims: z.array(z.object({
    id: z.string().min(1),
    text: z.string().min(1),
    stance: z.enum(['SUPPORTS', 'CHALLENGES', 'UNCERTAIN']),
    materiality: z.enum(['MATERIAL', 'CONTEXT']),
    sourceIds: z.array(z.string()).min(1),
    spanIds: z.array(z.string()).min(1),
  })).min(1),
  uncertainty: z.string().min(1),
  method: z.string().min(1),
})

export type PurchasePlan = z.infer<typeof PlanSchema> & {
  provider: 'groq' | 'fixture'
  model: string
  status: 'LIVE' | 'FALLBACK'
}

export type DossierSynthesis = z.infer<typeof DossierSchema>
export type DossierEvidencePacket = {
  question: string; decision: string; horizon: string; budgetCents: number; spentCents: number; remainingCents: number;
  activeGap: string; thesis: { open: string; afterNorthstar?: string; afterMeridian?: string; current: string };
  purchasePlan?: PurchasePlan;
  sources: Array<{
    id: string; publisher: string; title: string; accessTier: Source['accessTier']; priceCents: number;
    preview: string; family: string; authority: Source['authority']; originality: Source['originality'];
    decision?: Source['decision']; reason?: string; evidenceSpans?: Source['evidenceSpans'];
  }>;
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

function parseJsonObject(text: string) {
  const normalized = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '')
  return JSON.parse(normalized)
}

async function readGroqStream(response: Response, onDelta: (delta: string) => void) {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Groq did not return a response stream')
  const decoder = new TextDecoder()
  let pending = ''
  let fullText = ''
  let finished = false

  while (!finished) {
    const { done, value } = await reader.read()
    pending += decoder.decode(value ?? new Uint8Array(), { stream: !done })
    const lines = pending.split(/\r?\n/)
    pending = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data:')) continue
      const data = line.slice(5).trim()
      if (data === '[DONE]') { finished = true; break }
      try {
        const payload = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> }
        const delta = payload.choices?.[0]?.delta?.content
        if (typeof delta === 'string' && delta) { fullText += delta; onDelta(delta) }
      } catch {
        // Ignore keep-alives and incomplete provider frames; the next frame completes them.
      }
    }
    if (done) break
  }
  return fullText
}

export async function synthesizeDossier(packet: DossierEvidencePacket, onDelta: (delta: string) => void): Promise<DossierSynthesis> {
  if (!isLive()) throw new Error('Groq synthesis is not configured')
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), Number(process.env.LLM_SYNTHESIS_TIMEOUT_MS ?? process.env.LLM_TIMEOUT_MS ?? 45000))
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
        max_tokens: 2400,
        stream: true,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `You are the cited dossier synthesizer for an evidence research agent. Return JSON only, matching this exact shape: {"title":"string","conclusion":"string","changedAfterPaidResearch":{"before":"string","afterNorthstar":"string?","after":"string"},"claims":[{"id":"claim-1","text":"string","stance":"SUPPORTS|CHALLENGES|UNCERTAIN","materiality":"MATERIAL|CONTEXT","sourceIds":["exact source id"],"spanIds":["exact evidence span id"]}],"uncertainty":"string","method":"string"}. Use only the supplied evidence packet. Do not invent sources, quotes, prices, facts, or span IDs. Every claim must cite one or more exact sourceIds and spanIds from the packet; never cite a source without an available evidence span. Explain uncertainty instead of filling gaps. Do not reveal chain-of-thought. The output is a concise investment-research dossier, not investment advice.`,
          },
          { role: 'user', content: JSON.stringify(packet) },
        ],
      }),
    })
    if (!response.ok) throw new Error(`Groq synthesis returned ${response.status}`)
    const text = await readGroqStream(response, onDelta)
    return DossierSchema.parse(parseJsonObject(text))
  } finally {
    clearTimeout(timeout)
  }
}
