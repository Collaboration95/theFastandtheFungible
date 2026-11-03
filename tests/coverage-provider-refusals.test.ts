import { afterEach, expect, it, vi } from 'vitest'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { compatibleJson, compatibleProfile } from '../server/agents/compatible.js'
import { JsonDecisionProvider } from '../server/agents/json-decision.js'
import { ClefDecisionProvider } from '../server/agents/clef.js'
import { exampleCandidate, exampleContent } from '../shared/contracts/examples.js'

afterEach(() => vi.unstubAllEnvs())
async function endpoint(status: number, body: string, inspect?: (body: string) => void) {
  let calls = 0
  const server = createServer(async (req, res) => {
    let input = ''; for await (const chunk of req) input += chunk
    calls++; inspect?.(input); res.writeHead(status); res.end(body)
  })
  server.listen(0, '127.0.0.1'); await once(server, 'listening')
  return {
    profile: { baseUrl: `http://127.0.0.1:${(server.address() as { port: number }).port}`, model: 'synthetic', apiKey: 'synthetic-unused' },
    calls: () => calls,
    close: async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())) },
  }
}

it.each([
  [503, 'PRIVATE_PROVIDER_BODY', 'Provider request failed'],
  [200, 'not JSON', 'JSON'],
  [200, 'x'.repeat(262145), 'Provider response too large'],
])('refuses unusable compatible responses (%s) without reflecting their body', async (status, body, message) => {
  const local = await endpoint(status, body)
  try {
    const error = await compatibleJson(local.profile, {}).catch(error => error as Error)
    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toContain(message)
    expect((error as Error).message).not.toContain('PRIVATE_PROVIDER_BODY')
    expect(local.calls()).toBe(1)
  } finally { await local.close() }
})

it('incomplete or already-aborted profiles never send a request', async () => {
  const local = await endpoint(200, '{}')
  try {
    for (const profile of [{ ...local.profile, apiKey: '' }, { ...local.profile, model: '' }]) {
      await expect(compatibleJson(profile, {})).rejects.toThrow('incomplete')
    }
    await expect(compatibleJson(local.profile, {}, AbortSignal.abort())).rejects.toThrow()
    expect(local.calls()).toBe(0)
  } finally { await local.close() }
})

it('compatible candidate judgment receives public metadata and rejects missing JSON content', async () => {
  const inputs: string[] = []
  const judgment = { addressesGap: 1, originality: { original: 1, rewrite: 0, overlap: 0 }, credibility: 2 }
  const local = await endpoint(200, JSON.stringify({ choices: [{ message: { content: JSON.stringify(judgment) } }] }), body => inputs.push(body))
  try {
    for (const [key, value] of Object.entries({ DECISION_BASE_URL: local.profile.baseUrl, DECISION_MODEL: 'synthetic', DECISION_API_KEY: local.profile.apiKey })) vi.stubEnv(key, value)
    const provider = new JsonDecisionProvider()
    const candidate = { ...exampleCandidate, body: 'PREMIUM_CANARY', spans: [{ text: 'PREMIUM_CANARY' }] }
    expect(await provider.judgeCandidate({ question: 'Question?', gap: 'Missing fact', candidate, readSources: [] })).toEqual(judgment)
    const state = JSON.parse(JSON.parse(inputs[0]).messages[1].content)
    for (const field of ['wallet', 'manifest', 'url', 'body', 'spans']) expect(state.candidate).not.toHaveProperty(field)
    expect(inputs[0]).not.toContain('PREMIUM_CANARY')
    expect(provider.name).toBe('compatible')
    expect(provider.promptVersion).toContain('UNCALIBRATED')
    // An empty provider result is not interpreted as a decision or authority.
    const empty = await endpoint(200, '{}')
    try {
      vi.stubEnv('DECISION_BASE_URL', empty.profile.baseUrl)
      await expect(provider.judgeRound({ question: 'Question?', conclusion: '', gap: 'Missing fact' })).rejects.toThrow()
    } finally { await empty.close() }
  } finally { await local.close() }
})

it('separate compatible decision credentials do not silently use the research identity', () => {
  for (const [key, value] of Object.entries({ LLM_BASE_URL: 'http://127.0.0.1:1', LLM_MODEL: 'research', LLM_API_KEY: 'synthetic-research', DECISION_BASE_URL: 'http://127.0.0.1:2', DECISION_MODEL: 'decision', DECISION_API_KEY: 'synthetic-decision' })) vi.stubEnv(key, value)
  expect(compatibleProfile()).toEqual({ baseUrl: 'http://127.0.0.1:1', model: 'research', apiKey: 'synthetic-research' })
  expect(compatibleProfile(true)).toEqual({ baseUrl: 'http://127.0.0.1:2', model: 'decision', apiKey: 'synthetic-decision' })
})

it('paid-relevance transport quotes only supplied granted spans and refuses invalid probability', async () => {
  let noul = .6
  const transport = vi.fn<typeof fetch>(async () => Response.json({ success: true, result: { answers: { addresses_gap: { type: 'noul', noul } } } }))
  const provider = new ClefDecisionProvider({ token: 'synthetic-unused', accountId: 'synthetic', fetch: transport })
  const content = { ...exampleContent, body: 'UNNEEDED_BODY_CANARY', spans: [{ id: 'granted', text: 'A verified granted passage.' }] }
  expect(await provider.judgePaidRelevance({ question: 'Question?', gap: 'Missing fact', content })).toEqual({ observed: .6 })
  expect(String(transport.mock.calls[0][1]?.body)).toContain('A verified granted passage.')
  expect(String(transport.mock.calls[0][1]?.body)).not.toContain('UNNEEDED_BODY_CANARY')
  noul = 2
  await expect(provider.judgePaidRelevance({ question: 'Question?', gap: 'Missing fact', content })).rejects.toThrow()
})
