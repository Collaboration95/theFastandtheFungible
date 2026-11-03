import { afterEach, expect, it, vi } from 'vitest'
import { writeFileSync } from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createServer } from 'node:http'
import { createClient } from '../sdk/index.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createMcpServer } from '../mcp/tools.js'
import { fixture, listen, close } from './byok-fixture.js'
import { compatibleFetch, validateProviderUrl } from '../server/agents/compatible.js'
import { DEMO_QUESTIONS } from '../shared/contracts/examples.js'
afterEach(() => vi.unstubAllEnvs())
it('one synthetic key produces cited compatible answers through HTTP, TS, Python and MCP', async () => {
  const f = await fixture()
  const question = DEMO_QUESTIONS[0].text
  const matrix: Record<string, unknown> = { evidence: 'local synthetic protocol; no live provider or ledger', rates: 'synthetic USD/M input=2 output=4' }
  try {
    const run = await (await f.post('/runs', { question, budgetMinor: 0 })).json()
    while (f.api.work.active) await new Promise(resolve => setTimeout(resolve, 10))
    const http = f.api.store.getRun(run.runId)
    expect(http.answers.at(-1)?.provider).toBe('openai-compatible'); expect(http.answers.at(-1)?.claims.length).toBeGreaterThan(0); expect(http.intents).toHaveLength(0)
    matrix.http = { provider: http.answers.at(-1)?.provider, claims: http.answers.at(-1)?.claims.length, buys: http.intents.length }
    const ts = await createClient({ baseUrl: f.url, token: 'synthetic-operator' }).ask(question, { budgetSgd: 2 })
    expect(ts.citations.length).toBeGreaterThan(0); expect(ts.labels.research).toContain('OpenAI-compatible'); expect(ts.spentMinor).toBe(0)
    matrix.ts = { citations: ts.citations.length, labels: ts.labels, spentMinor: ts.spentMinor }
    const py = await promisify(execFile)('python3', ['-c', 'import json,sys; from researchagent import Client; print(json.dumps(Client(sys.argv[1], "synthetic-operator").ask(sys.argv[2],budget=0,idempotency_key="c1-python").result()))', f.url, question], { env: { ...process.env, PYTHONPATH: 'packages/sdk-python/src' } })
    const python = JSON.parse(py.stdout); expect(python.citations.length).toBeGreaterThan(0); expect(python.labels.research).toContain('OpenAI-compatible'); matrix.python = { citations: python.citations.length, labels: python.labels }
    const mcp = createMcpServer(f.url, 'synthetic-operator'); const client = new Client({ name: 'c1-test', version: '1' }); const [a,b] = InMemoryTransport.createLinkedPair(); await mcp.connect(a); await client.connect(b)
    try { const result = await client.callTool({ name: 'ask_expert', arguments: { question, budget_sgd: 0 } }); expect(result.isError).not.toBe(true); const data = JSON.parse((result.content as { text: string }[])[0].text); expect(data.citations.length).toBeGreaterThan(0); expect(data.labels.research).toContain('OpenAI-compatible'); matrix.mcp = { citations: data.citations.length, labels: data.labels } } finally { await client.close(); await mcp.close() }
    const test = await (await f.post('/api/providers/test', {})).json(); expect(test).toMatchObject({ ok: true, inputTokens: 1000, outputTokens: 500, costUsd: .004 }); expect(JSON.stringify(test)).not.toContain('synthetic-c1-secret'); matrix.connection = test
    vi.stubEnv('MODEL_INPUT_USD_PER_MILLION', ''); expect((await (await f.post('/api/providers/test', {})).json()).costUsd).toBeNull()
    expect((await (await f.post('/api/providers/test', { apiKey: 'body-key' })).json()).ok).toBe(false)
    if (process.env.C1_EVIDENCE === '1') writeFileSync('docs/evidence/round2-c1/byok-matrix.json', JSON.stringify(matrix, null, 2)+'\n')
  } finally { await f.close() }
}, 20000)
it('rejects unsafe origins and redirects before forwarding credentials', async () => {
  for (const url of ['http://169.254.169.254', 'https://10.0.0.1', 'https://example.com', 'http://localhost:1234', 'https://api.openai.com@127.0.0.1', 'https://api.openai.com/?x=1', 'https://api.openai.com/#x']) expect(() => validateProviderUrl(url)).toThrow()
  let unauthorized = 0
  const target = createServer((_req,res) => { unauthorized++; res.end('{}') }); const dest = await listen(target)
  const redirect = createServer((_req,res) => { res.writeHead(302, { Location: dest }); res.end() }); const base = await listen(redirect)
  try { await expect(compatibleFetch(base, { headers: { Authorization: 'Bearer synthetic' } })).rejects.toThrow('redirect'); expect(unauthorized).toBe(0) } finally { await close(target); await close(redirect) }
})
