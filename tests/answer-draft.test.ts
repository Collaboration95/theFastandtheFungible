import { afterEach, describe, expect, it, vi } from 'vitest'
import { exampleCandidate, exampleContent } from '../shared/contracts/examples.js'
import { AnswerDraftSchema, type ContentEnvelope, type PublicCandidate } from '../shared/contracts/index.js'
import { parsePartialJson } from '../server/agents/partial-json.js'
import { draftClaims, writeAnswer, type WriteAnswerDraft } from '../server/agents/research.js'

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('parsePartialJson (streamed answer drafts)', () => {
  const full = { conclusion: 'Lead "times" fell\nto 14 weeks', claims: [{ id: 'c1', text: 'Café lines: 55.2%', stance: 'SUPPORTS', n: -1.5e3, ok: true, none: null }], openGaps: [] }
  const text = JSON.stringify(full, null, 1)
  it('never throws on any prefix, and the full text parses exactly', () => {
    for (let i = 0; i <= text.length; i++) expect(() => parsePartialJson(text.slice(0, i))).not.toThrow()
    expect(parsePartialJson(text)).toEqual(full)
  })
  it('closes an open string and keeps what has arrived', () => {
    expect(parsePartialJson('')).toBeUndefined()
    expect(parsePartialJson('{')).toEqual({})
    expect(parsePartialJson('{"conc')).toEqual({})
    expect(parsePartialJson('{"conclusion"')).toEqual({})
    expect(parsePartialJson('{"conclusion":')).toEqual({})
    expect(parsePartialJson('{"conclusion":"Lead ti')).toEqual({ conclusion: 'Lead ti' })
    expect(parsePartialJson('{"claims":[{"id":"c1","text":"Kestrel cut')).toEqual({ claims: [{ id: 'c1', text: 'Kestrel cut' }] })
  })
  it('drops a cut escape or literal rather than guessing it', () => {
    expect(parsePartialJson('{"t":"a\\')).toEqual({ t: 'a' })
    expect(parsePartialJson('{"t":"a\\u00')).toEqual({ t: 'a' })
    expect(parsePartialJson('{"t":"a\\"b')).toEqual({ t: 'a"b' })
    expect(parsePartialJson('{"n":12')).toEqual({})
    expect(parsePartialJson('{"n":12,')).toEqual({ n: 12 })
    expect(parsePartialJson('{"ok":tr')).toEqual({})
  })
})

describe('draftClaims', () => {
  it('keeps only claim text and a complete stance: no citations, ids or conclusion', () => {
    const claims = draftClaims({ conclusion: 'UNBOUND SUMMARY', claims: [{ id: 'x', text: 'A', stance: 'SUPP', citations: [{ resourceId: 'r' }] }, { text: '' }, { text: 'B', stance: 'CHALLENGES' }, 'junk', null] })
    expect(claims).toEqual([{ text: 'A' }, { text: 'B', stance: 'CHALLENGES' }])
    expect(draftClaims({ claims: Array.from({ length: 20 }, () => ({ text: 'x'.repeat(900) })) })).toHaveLength(12)
    expect(draftClaims({ claims: [{ text: 'x'.repeat(900) }] })[0].text).toHaveLength(600)
    expect(draftClaims(undefined)).toEqual([])
  })
})

describe('writeAnswer streams a labelled draft, then names what the citation check removed', () => {
  const candidate = (id: string): PublicCandidate => ({ ...exampleCandidate, resourceId: id, facets: ['demand'], tier: 'FREE' })
  const content = (id: string, text: string): ContentEnvelope => ({ ...exampleContent, resourceId: id, body: text, spans: [{ id: 'generic-span', text }] })
  const bodies = [content('random-A', 'Demand contracts support a 600 MW expansion.')]
  const model = { conclusion: 'UNBOUND SUMMARY', claims: [
    { id: 'valid', text: bodies[0].body, stance: 'SUPPORTS', citations: [{ resourceId: 'random-A', version: 'v1', spanId: 'generic-span' }] },
    { id: 'invalid', text: 'INVENTED CLAIM', stance: 'SUPPORTS', citations: [{ resourceId: 'premium-unread', version: 'v1', spanId: 'generic-span' }] },
  ], openGaps: [] }
  const stream = (value: unknown, size = 9) => {
    const text = JSON.stringify(value)
    const deltas = Array.from({ length: Math.ceil(text.length / size) }, (_, i) => text.slice(i * size, (i + 1) * size))
    const frames = deltas.map(delta => `data: ${JSON.stringify({ choices: [{ delta: { content: delta } }] })}\n\n`).join('') + 'data: [DONE]\n\n'
    return new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(frames)); controller.close() } }))
  }
  it('drafts grow claim by claim; the last draft lists the rejected claim; the stored answer keeps only the valid one', async () => {
    vi.stubEnv('LLM_PROVIDER', 'groq'); vi.stubEnv('GROQ_API_KEY', 'test-only'); vi.stubEnv('LLM_MODEL', '')
    vi.stubGlobal('fetch', vi.fn(async () => stream(model)))
    let now = 0
    vi.spyOn(Date, 'now').mockImplementation(() => (now += 100))
    const drafts: WriteAnswerDraft[] = []
    const { answer } = await writeAnswer({ question: 'q', candidates: [candidate('random-A')], contents: bodies, version: 1, onDraft: draft => drafts.push(structuredClone(draft)) })
    expect(answer.claims.map(claim => claim.id)).toEqual(['valid'])
    expect(drafts.length).toBeGreaterThan(5)
    // Text arrives progressively: some draft holds a strict prefix of the first claim.
    expect(drafts.some(draft => draft.claims[0] && draft.claims[0].text.length < bodies[0].body.length)).toBe(true)
    const last = drafts.at(-1)!
    expect(last.claims.map(claim => claim.text)).toEqual([bodies[0].body, 'INVENTED CLAIM'])
    expect(last.removed).toEqual(['INVENTED CLAIM'])
    expect(drafts.slice(0, -1).every(draft => draft.removed === undefined)).toBe(true)
    // Drafts carry claim text only: never the model's unbound summary or its citation bindings.
    expect(JSON.stringify(drafts)).not.toMatch(/UNBOUND SUMMARY|premium-unread|resourceId/)
  })
  it('the fixture (no LLM) streams no draft', async () => {
    vi.stubEnv('LLM_PROVIDER', 'fixture')
    const onDraft = vi.fn()
    await writeAnswer({ question: 'q', candidates: [candidate('random-A')], contents: bodies, version: 1, onDraft })
    expect(onDraft).not.toHaveBeenCalled()
  })
  it('the draft contract bounds what can be sent', () => {
    expect(AnswerDraftSchema.safeParse({ runId: 'r', version: 1, conditional: false, status: 'WRITING', claims: Array.from({ length: 13 }, () => ({ text: 'x' })) }).success).toBe(false)
    expect(AnswerDraftSchema.safeParse({ runId: 'r', version: 0, conditional: false, status: 'WRITING', claims: [] }).success).toBe(false)
  })
})
