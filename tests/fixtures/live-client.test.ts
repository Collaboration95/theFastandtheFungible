import { afterEach, describe, expect, it, vi } from 'vitest'
import { ClefDecisionProvider, clefQuestions } from '../../server/agents/clef.js'
import { streamJson } from '../../server/agents/llm.js'

afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.restoreAllMocks() })
const round = { success: true, result: { answers: { gap_material: { type: 'noul', noul: 0.8 } } } }
const sse = () => new Response(`data: ${JSON.stringify({ choices: [{ delta: { content: '{"findings":[]}' } }] })}\n\ndata: [DONE]\n\n`)

describe('bounded live client recovery', () => {
  it('uses the official required model selector and criteria input fields', async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(round)))
    const provider = new ClefDecisionProvider({ token: 'mock', accountId: 'mock', model: '@cf/cloudflare/clef', fetch: transport })
    await provider.judgeRound({ question: 'q', conclusion: 'c', gap: 'g' })
    expect(JSON.parse(String(transport.mock.calls[0][1]?.body))).toMatchObject({ model: 'clef', questions: clefQuestions.round })
    expect(clefQuestions.candidate.originality.criteria).toHaveProperty('original')
    expect(clefQuestions.candidate.credibility.criteria).toEqual(['Opinion or marketing', 'Secondary reporting', 'Named primary sources or data'])
    expect(clefQuestions.candidate.originality).not.toHaveProperty('choices')
    expect(clefQuestions.candidate.credibility).not.toHaveProperty('legend')
  })
  it('honours Clef Retry-After outside the per-attempt timeout, capped at 2 s (#195)', async () => {
    vi.useFakeTimers()
    const transport = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response('', { status: 429, headers: { 'Retry-After': '5' } })).mockResolvedValueOnce(new Response(JSON.stringify(round)))
    const provider = new ClefDecisionProvider({ token: 'mock', accountId: 'mock', fetch: transport })
    const result = provider.judgeRound({ question: 'q', conclusion: 'c', gap: 'g' })
    await vi.advanceTimersByTimeAsync(1999)
    expect(transport).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(await result).toEqual({ gapMaterial: 0.8 })
    expect(transport).toHaveBeenCalledTimes(2)
  })
  it('retains the exact Clef HTTP status without exposing its response body', async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(new Response('PRIVATE_ERROR_TEXT', { status: 422 }))
    const provider = new ClefDecisionProvider({ token: 'mock', accountId: 'mock', fetch: transport })
    await expect(provider.judgeRound({ question: 'q', conclusion: 'c', gap: 'g' })).rejects.toMatchObject({ status: 'HTTP 422', message: 'Clef unavailable (HTTP 422)' })
    expect(transport).toHaveBeenCalledTimes(1)
  })
  it.each([2, 120])('backs off Groq 429 with Retry-After %s and preserves exact spans', async retrySeconds => {
    vi.useFakeTimers()
    vi.stubEnv('LLM_PROVIDER', 'groq'); vi.stubEnv('GROQ_API_KEY', 'mock'); vi.stubEnv('LLM_BASE_URL', '')
    const transport = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('', { status: 429, headers: { 'Retry-After': String(retrySeconds) } })).mockResolvedValueOnce(sse())
    const result = streamJson('JSON report', { sources: [{ resourceId: 'accessible', version: 'v1', body: 'LONG_BODY_DUPLICATE', spans: [{ id: 'fact', text: 'Exact accessible evidence.' }] }] })
    if (retrySeconds > 60) {
      await expect(result).rejects.toThrow('LLM returned 429')
      expect(transport).toHaveBeenCalledTimes(1)
    } else {
      await vi.advanceTimersByTimeAsync(59999)
      expect(transport).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(1)
      expect(await result).toEqual({ findings: [] })
      expect(transport).toHaveBeenCalledTimes(2)
    }
    const request = String(transport.mock.calls[retrySeconds > 60 ? 0 : 1][1]?.body)
    expect(request).toContain('Exact accessible evidence.')
    expect(request).toContain('accessible')
    expect(request).not.toContain('LONG_BODY_DUPLICATE')
  })
})
