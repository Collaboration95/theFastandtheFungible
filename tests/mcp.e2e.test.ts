import { expect, it } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { mkdtempSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { USE_CASES } from './scenarios/use-cases.js'
import { assertNoLeaks } from './scenarios/harness.js'
import { loadWriterCorpus } from '../publisher/corpus.js'
import { Store } from '../server/store.js'
import { startEngine } from '../server/engine.js'

async function connect(env: Record<string, string>) {
  const transport = new StdioClientTransport({ command: process.execPath, args: ['--import', 'tsx', resolve('mcp/server.ts')], env: { PATH: process.env.PATH!, ...env }, stderr: 'pipe' })
  transport.stderr?.on('data', () => {})
  const client = new Client({ name: 'fixture-e2e', version: '1' })
  await client.connect(transport)
  return client
}
// Tool outputs are a wire contract; JSON parsing here deliberately observes the actual stdio text.
async function call(client: Client, name: string, args: Record<string, unknown> = {}) {
  const result = await client.callTool({ name, arguments: args })
  expect(result.isError).not.toBe(true)
  return JSON.parse((result.content as { text: string }[])[0].text)
}

it('stdio search → policy buy → cited answer; cap, daily cap, retry and restart hold', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mcp-e2e-'))
  const env = { RA_DATA_DIR: dir, MCP_MAX_BUDGET_MINOR: '200', MCP_DAILY_CAP_MINOR: '200' }
  let client = await connect(env)
  try {
    expect((await client.listTools()).tools.map(t => t.name).sort()).toEqual(['ask_expert', 'get_run', 'search_expertise', 'wallet_status'])
    const search = await call(client, 'search_expertise', { query: USE_CASES.UC2.question })
    const corpus = await loadWriterCorpus()
    assertNoLeaks([{ kind: 'MCP stdio search', raw: JSON.stringify(search), grants: [] }], corpus)
    expect(search.hits.length).toBeGreaterThan(0)
    expect(search.labels.settlement).toContain('SIMULATED')
    for (const hit of search.hits) {
      expect(Object.keys(hit).sort()).toEqual(['abstract', 'priceMinor', 'relevance', 'tier', 'title', 'url', 'writer'])
      expect(hit).not.toHaveProperty('body'); expect(hit).not.toHaveProperty('passages')
    }
    const args = { question: USE_CASES.UC2.question.replace(/\?$/, ' (pricing & margins)?'), budget_sgd: 999, idempotency_key: 'uc2-intent' }
    const run = await call(client, 'ask_expert', args)
    expect(run).toMatchObject({ phase: 'DONE', budgetMinor: 200, clamped: true })
    expect(run.labels.research).toContain('fixture')
    expect(run.labels.settlement).toContain('SIMULATED')
    expect(run.purchases.some((p: { verified: boolean }) => p.verified)).toBe(true)
    expect(run.citations.length).toBeGreaterThan(0)
    const store = new Store(join(dir, 'app.db'))
    const snapshot = store.getRun(run.run_id)
    for (const citation of run.citations) {
      const delivered = snapshot.contents.find(c => c.resourceId === citation.resourceId && c.version === citation.version)
      expect(delivered?.spans.find(p => p.id === citation.spanId)?.text).toBe(citation.passage)
    }
    assertNoLeaks([{ kind: 'MCP stdio answer', raw: JSON.stringify(run), grants: snapshot.grants, runId: run.run_id }], corpus)
    store.close()
    const paid = run.citations.filter((c: { grantIntentId: string | null }) => c.grantIntentId)
    expect(paid.length).toBeGreaterThan(0)
    for (const citation of paid) {
      expect(citation.passage.length).toBeGreaterThan(0)
      expect(run.purchases.some((p: { intentId: string; verified: boolean }) => p.intentId === citation.grantIntentId && p.verified)).toBe(true)
    }
    expect((await call(client, 'get_run', { run_id: run.run_id })).citations).toEqual(run.citations)
    const [repeat, parallelRetry] = await Promise.all([call(client, 'ask_expert', args), call(client, 'ask_expert', args)])
    expect(parallelRetry.run_id).toBe(run.run_id)
    expect(repeat.run_id).toBe(run.run_id)
    expect(repeat.purchases).toEqual(run.purchases)
    await client.close()
    client = await connect(env)
    const restarted = await call(client, 'ask_expert', args)
    expect(restarted.run_id).toBe(run.run_id)
    expect(restarted.spentMinor).toBe(run.spentMinor)
    const wallet = await call(client, 'wallet_status')
    expect(wallet.spentMinor).toBe(run.spentMinor)
    expect(JSON.stringify(wallet)).not.toMatch(/seed|secret|token/i)
    const next = await call(client, 'ask_expert', { ...args, idempotency_key: 'another-intent' })
    expect(next.budgetMinor).toBeLessThanOrEqual(200 - run.spentMinor)
    expect(next.spentMinor + run.spentMinor).toBeLessThanOrEqual(200)
  } finally { await client.close(); rmSync(dir, { recursive: true, force: true }) }
}, 60_000)

it('remote backend enforces its own human caps, independent of the caller environment', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mcp-remote-'))
  const engine = await startEngine({ dataDir: dir }) // unset caps default to zero
  const client = await connect({ RA_BACKEND_URL: engine.apiUrl, MCP_MAX_BUDGET_MINOR: '500', MCP_DAILY_CAP_MINOR: '50000' })
  try {
    const run = await call(client, 'ask_expert', { question: USE_CASES.UC2.question, budget_sgd: 5 })
    expect(run).toMatchObject({ budgetMinor: 0, spentMinor: 0, clamped: true })
    expect(run.purchases.every((p: { priceMinor: number; status: string }) => p.priceMinor === 0 || p.status === 'SKIPPED')).toBe(true)
    expect(run.labels.settlement).toContain('SIMULATED')
  } finally { await client.close(); await engine.close(); rmSync(dir, { recursive: true, force: true }) }
}, 30_000)
