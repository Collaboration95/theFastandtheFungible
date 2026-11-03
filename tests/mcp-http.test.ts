import { request } from 'node:http'
import { it, expect } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { startEngine } from '../server/engine.js'
import { Store } from '../server/store.js'
import { startMcpHttp } from '../mcp/http.js'
import { USE_CASES } from './scenarios/use-cases.js'

it('SDK HTTP ask, principal caps, strict policy boundary, verification, isolation and immediate revocation', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mcp-http-'))
  const engine = await startEngine({ dataDir: dir })
  const store = new Store(join(dir, 'app.db'))
  const agent = store.addAgent({ name: 'SDK', maxMinor: 100, dailyMinor: 200 })
  const other = store.addAgent({ name: 'Other', maxMinor: 100, dailyMinor: 200 })
  const http = await startMcpHttp({ apiUrl: engine.apiUrl, store })
  const client = new Client({ name: 'http-test', version: '1' })
  const headers = { Authorization: `Bearer ${agent.token}` }
  try {
    for (const h of [{}, { Authorization: 'Bearer wrong' }] as Record<string, string>[]) expect((await fetch(http.url, { method: 'POST', headers: h })).status).toBe(401)
    expect((await fetch(http.url, { method: 'POST', headers: { ...headers, Origin: 'https://evil.example' } })).status).toBe(403)
    expect(await new Promise<number | undefined>((done, fail) => { const r = request(http.url, { method: 'POST', headers: { ...headers, Host: 'evil.example' } }, res => { res.resume(); done(res.statusCode) }); r.on('error', fail); r.end() })).toBe(403)
    await client.connect(new StreamableHTTPClientTransport(new URL(http.url), { requestInit: { headers } }))
    const call = async (name: string, args: Record<string, unknown>) => {
      const result = await client.callTool({ name, arguments: args })
      expect(result.isError).not.toBe(true)
      return JSON.parse((result.content as { text: string }[])[0].text)
    }
    const question = USE_CASES.UC2.question.replace(/\?$/, ' (pricing & margins)?')
    const args = { question, budget_sgd: 999, idempotency_key: 'http-proof' }
    const before = store.listRuns().length
    expect((await client.callTool({ name: 'ask_expert', arguments: { ...args, purchase: true, resource_id: 'llm-selected' } })).isError).toBe(true)
    expect(store.listRuns()).toHaveLength(before)
    const run = await call('ask_expert', args)
    expect(run).toMatchObject({ phase: 'DONE', budgetMinor: 100, clamped: true })
    expect(run.spentMinor).toBeLessThanOrEqual(100)
    expect(run.purchases.filter((p: { verified: boolean }) => p.verified)).toHaveLength(1)
    expect((await call('ask_expert', args)).run_id).toBe(run.run_id)
    expect((await call('verify_answer', { run_id: run.run_id })).ok).toBe(true)
    expect(store.runPrincipal(run.run_id)?.principal).toBe(agent.id)
    expect(store.lastMcpCall(agent.id)).toBeTruthy()
    const unauthorized = await fetch(`${engine.apiUrl}/api/mcp/runs/${run.run_id}`, { headers: { Authorization: `Bearer ${other.token}` } })
    expect(unauthorized.status).toBe(404)
    expect(await call('pause_spending', { reason: 'MCP kill switch' })).toMatchObject({ paused: true, scope: 'agent', agentId: agent.id })
    expect((await client.callTool({ name: 'ask_expert', arguments: { ...args, idempotency_key: 'after-pause' } })).isError).toBe(true)
    expect(await call('pause_spending', {})).toMatchObject({ paused: true })
    store.setAgentPaused(agent.id, false)
    store.setAgentPaused(agent.id, true, true)
    expect((await fetch(http.url, { method: 'POST', headers })).status).toBe(401)
    await expect(client.callTool({ name: 'wallet_status', arguments: {} })).rejects.toThrow()
  } finally { await client.close(); await http.close(); store.close(); await engine.close(); rmSync(dir, { recursive: true, force: true }) }
}, 60_000)
