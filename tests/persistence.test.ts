import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn, type ChildProcess } from 'node:child_process'
import { createServer } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import { loadRunStore, persistRunStore } from '../server/persistence'

const temporaryDirectories: string[] = []

async function freePort(): Promise<number> {
  const probe = createServer()
  await new Promise<void>((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', () => resolve()) })
  const address = probe.address()
  const port = typeof address === 'object' && address ? address.port : 0
  await new Promise<void>((resolve, reject) => { probe.close((error) => error ? reject(error) : resolve()) })
  return port
}

async function startServer(file: string, port: number): Promise<ChildProcess> {
  const cli = join(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs')
  const child = spawn(process.execPath, [cli, 'server/index.ts'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port), RESEARCH_RUNS_FILE: file, XRPL_MODE: 'fixture' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let stderr = ''
  child.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString() })
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`ResearchAgent server exited during startup: ${stderr}`)
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`)
      if (response.ok) return child
    } catch {
      // The listener may need another polling interval while the fixture loads.
    }
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  child.kill()
  throw new Error(`ResearchAgent server did not become healthy: ${stderr}`)
}

async function stopServer(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) return
  child.kill()
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, 1000)
    child.once('exit', () => { clearTimeout(timer); resolve() })
  })
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('local run persistence', () => {
  it('treats an absent store as fresh and a saved fixture run as seeded after restart', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'research-agent-persistence-'))
    temporaryDirectories.push(directory)
    const file = join(directory, 'runs.json')

    const fresh = await loadRunStore<{ runId: string; spentCents: number }>(file)
    expect(fresh.mode).toBe('fresh')
    expect(fresh.runs.size).toBe(0)

    await persistRunStore(file, [{ runId: 'run_saved_fixture', spentCents: 20 }])
    const restarted = await loadRunStore<{ runId: string; spentCents: number }>(file)
    expect(restarted.mode).toBe('seeded')
    expect(restarted.runs.get('run_saved_fixture')).toEqual({ runId: 'run_saved_fixture', spentCents: 20 })
  })

  it('keeps saved fixture history while isolating a new run after restart', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'research-agent-persistence-'))
    temporaryDirectories.push(directory)
    const file = join(directory, 'runs.json')

    await persistRunStore(file, [{ runId: 'run_old', spentCents: 80, unlockedArticle: 'northstar-wire' }])
    const existing = await loadRunStore<{ runId: string; spentCents: number; unlockedArticle: string | null }>(file)
    existing.runs.set('run_new', { runId: 'run_new', spentCents: 0, unlockedArticle: null })
    await persistRunStore(file, existing.runs.values())

    const restarted = await loadRunStore<{ runId: string; spentCents: number; unlockedArticle: string | null }>(file)
    expect([...restarted.runs.keys()]).toEqual(['run_old', 'run_new'])
    expect(restarted.runs.get('run_new')).toEqual({ runId: 'run_new', spentCents: 0, unlockedArticle: null })
    expect(restarted.runs.get('run_old')).toEqual({ runId: 'run_old', spentCents: 80, unlockedArticle: 'northstar-wire' })
  })

  it('round-trips receipt-critical purchase records without dropping nested evidence or settlement metadata', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'research-agent-receipt-'))
    temporaryDirectories.push(directory)
    const file = join(directory, 'runs.json')
    const purchasedAt = '2026-09-19T05:27:53.220Z'
    const purchasedRun = {
      runId: 'run_receipt_fixture',
      spentCents: 80,
      budgetCents: 200,
      sources: [{
        id: 'meridian-ledger',
        publisher: 'Grid Operators Report',
        decision: 'BUY',
        purchasedAt,
        evidenceSpans: [{ id: 'meridian-s1', label: 'Grid bottleneck', text: 'A signed connection agreement is not the same as energisation.' }],
        payment: {
          mode: 'fixture',
          network: 'fixture',
          amountDrops: 80000,
          settlement: 'SIMULATION_NOT_SETTLED',
          transactionHash: undefined,
          ledgerIndex: undefined,
          explorerUrl: undefined,
        },
      }],
      events: [{ id: '7', type: 'PREMIUM_PURCHASE_SETTLED', label: 'Grid Operators Report unlocked', at: purchasedAt }],
    }

    await persistRunStore(file, [purchasedRun])
    const restarted = await loadRunStore<typeof purchasedRun>(file)

    expect(restarted.runs.get(purchasedRun.runId)).toEqual(purchasedRun)
    expect(restarted.runs.get(purchasedRun.runId)?.sources[0]).toMatchObject({
      id: 'meridian-ledger',
      decision: 'BUY',
      purchasedAt,
      evidenceSpans: [{ id: 'meridian-s1' }],
      payment: { mode: 'fixture', amountDrops: 80000, settlement: 'SIMULATION_NOT_SETTLED' },
    })
  })

  it('fails closed for malformed state instead of silently starting over', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'research-agent-persistence-'))
    temporaryDirectories.push(directory)
    const file = join(directory, 'runs.json')
    await writeFile(file, '{not-json')

    await expect(loadRunStore(file)).rejects.toThrow(/Unable to parse persisted research runs/)
    expect(await readFile(file, 'utf8')).toBe('{not-json')
  })

  it('keeps a new API run clean across a server restart', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'research-agent-api-'))
    temporaryDirectories.push(directory)
    const file = join(directory, 'runs.json')
    await persistRunStore(file, [{ runId: 'run_saved_fixture', spentCents: 80, sources: [], payment: { mode: 'fixture' } }])
    const port = await freePort()
    let child = await startServer(file, port)
    const baseUrl = `http://127.0.0.1:${port}`
    try {
      const health = await fetch(`${baseUrl}/api/health`).then((response) => response.json()) as { persistenceMode: string; persistedRunCount: number; stateMode: string }
      expect(health).toMatchObject({ persistenceMode: 'seeded', persistedRunCount: 1, stateMode: 'seeded' })

      const createdResponse = await fetch(`${baseUrl}/api/v1/research-runs`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question: 'A clean fixture run', sourceAllowlist: ['company-filings'] }) })
      expect(createdResponse.status).toBe(201)
      const created = await createdResponse.json() as { runId: string; stateMode: string; spentCents: number; rawSourceCount: number; sources: unknown[]; persistence: { mode: string; persistedRunCount: number } }
      expect(created.stateMode).toBe('fresh')
      expect(created.spentCents).toBe(0)
      expect(created.rawSourceCount).toBe(0)
      expect(created.sources).toEqual([])
      expect(created.persistence).toEqual({ mode: 'seeded', persistedRunCount: 2 })

      await stopServer(child)
      child = await startServer(file, port)
      const restarted = await fetch(`${baseUrl}/api/v1/research-runs/${created.runId}`).then((response) => response.json()) as { stateMode: string; spentCents: number; rawSourceCount: number; events: { type: string }[]; sources: unknown[] }
      expect(restarted.stateMode).toBe('prior')
      expect(restarted.spentCents).toBe(0)
      expect(restarted.rawSourceCount).toBe(0)
      expect(restarted.sources).toEqual([])
      expect(restarted.events.map((event) => event.type)).toEqual(['BRIEF_READY'])
    } finally {
      await stopServer(child)
    }
  })

  it('keeps a purchased receipt addressable after reset while starting a clean replacement run', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'research-agent-reset-'))
    temporaryDirectories.push(directory)
    const port = await freePort()
    const child = await startServer(join(directory, 'runs.json'), port)
    const baseUrl = `http://127.0.0.1:${port}`
    const request = (path: string, body?: unknown) => fetch(`${baseUrl}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })

    try {
      const created = await (await request('/api/v1/research-runs', {})).json() as { runId: string }
      expect((await request(`/api/v1/research-runs/${created.runId}/plan`, {})).status).toBe(200)
      for (let step = 0; step < 2; step += 1) await request(`/api/v1/research-runs/${created.runId}/step`, { action: 'next' })
      const sourcePath = `/api/v1/research-runs/${created.runId}/sources/meridian-ledger`
      const quoted = await (await request(sourcePath)).json() as { premium: { quoteHash: string } }
      const purchased = await request(`/api/v1/research-runs/${created.runId}/purchases`, {
        sourceId: 'meridian-ledger',
        action: 'BUY',
        approval: 'APPROVED',
        quoteHash: quoted.premium.quoteHash,
        idempotencyKey: 'reset-receipt-purchase',
      })
      expect(purchased.status).toBe(200)

      const beforeReset = await (await request(`/api/v1/research-runs/${created.runId}/receipt`)).json() as {
        runId: string
        purchases: { sourceId: string; decision: string; amountCents: number; settlement: string }[]
      }
      expect(beforeReset).toMatchObject({
        runId: created.runId,
        purchases: [{ sourceId: 'meridian-ledger', decision: 'BUY', amountCents: 80, settlement: 'SIMULATION_NOT_SETTLED' }],
      })

      const resetResponse = await request(`/api/v1/research-runs/${created.runId}/reset`, {})
      expect(resetResponse.status).toBe(200)
      const reset = await resetResponse.json() as {
        runId: string
        spentCents: number
        sources: unknown[]
        persistence: { persistedRunCount: number }
      }
      expect(reset.runId).not.toBe(created.runId)
      expect(reset.spentCents).toBe(0)
      expect(reset.sources).toEqual([])
      expect(reset.persistence.persistedRunCount).toBe(2)

      const prior = await (await request(`/api/v1/research-runs/${created.runId}`)).json() as {
        spentCents: number
        sources: { id: string; decision?: string }[]
      }
      expect(prior.spentCents).toBe(80)
      expect(prior.sources.find((source) => source.id === 'meridian-ledger')?.decision).toBe('BUY')

      const priorSnapshot = await (await request(`/api/v1/research-runs/${created.runId}`)).json()
      const staleStep = await request(`/api/v1/research-runs/${created.runId}/step`, { action: 'next' })
      expect(staleStep.status).toBe(409)
      expect(await staleStep.json()).toMatchObject({ error: 'This run is read-only after reset or cancellation' })
      const stalePlan = await request(`/api/v1/research-runs/${created.runId}/plan`, {})
      expect(stalePlan.status).toBe(409)
      const stalePurchasePlan = await request(`/api/v1/research-runs/${created.runId}/purchase-decisions`, {})
      expect(stalePurchasePlan.status).toBe(409)
      const repeatedReset = await request(`/api/v1/research-runs/${created.runId}/reset`, {})
      expect(repeatedReset.status).toBe(409)
      expect(await (await request(`/api/v1/research-runs/${created.runId}`)).json()).toEqual(priorSnapshot)
      await expect(request(`/api/v1/research-runs/${created.runId}/receipt`).then((response) => response.json())).resolves.toMatchObject({
        runId: created.runId,
        purchases: [{ sourceId: 'meridian-ledger', decision: 'BUY', amountCents: 80 }],
      })
    } finally {
      await stopServer(child)
    }
  })

  it('rejects missing or stale quote approval without spending or unlocking premium evidence', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'research-agent-quote-'))
    temporaryDirectories.push(directory)
    const port = await freePort()
    const child = await startServer(join(directory, 'runs.json'), port)
    const baseUrl = `http://127.0.0.1:${port}`
    const request = (path: string, body?: unknown) => fetch(`${baseUrl}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })

    try {
      const created = await (await request('/api/v1/research-runs', {})).json() as { runId: string }
      expect((await request(`/api/v1/research-runs/${created.runId}/plan`, {})).status).toBe(200)
      await request(`/api/v1/research-runs/${created.runId}/step`, { action: 'next' })
      await request(`/api/v1/research-runs/${created.runId}/step`, { action: 'next' })
      const sourcePath = `/api/v1/research-runs/${created.runId}/sources/northstar-wire`
      const quoted = await (await request(sourcePath)).json() as { premium: { status: string; quoteHash: string } }
      expect(quoted.premium).toMatchObject({ status: 'PAYMENT_REQUIRED' })

      const missingQuote = await request(`/api/v1/research-runs/${created.runId}/purchases`, { sourceId: 'northstar-wire', action: 'BUY', approval: 'APPROVED', idempotencyKey: 'missing-quote' })
      expect(missingQuote.status).toBe(409)
      const wrongQuote = await request(`/api/v1/research-runs/${created.runId}/purchases`, { sourceId: 'northstar-wire', action: 'BUY', approval: 'APPROVED', quoteHash: `${quoted.premium.quoteHash}-stale`, idempotencyKey: 'wrong-quote' })
      expect(wrongQuote.status).toBe(409)

      const run = await (await request(`/api/v1/research-runs/${created.runId}`)).json() as { spentCents: number; sources: { id: string; decision?: string }[] }
      expect(run.spentCents).toBe(0)
      expect(run.sources.find((source) => source.id === 'northstar-wire')?.decision).toBeUndefined()
      expect(await (await request(sourcePath)).json()).toMatchObject({ premium: { status: 'PAYMENT_REQUIRED' } })
    } finally {
      await stopServer(child)
    }
  })

  it('rejects missing or mismatched quote approval without spending or unlocking', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'research-agent-quote-'))
    temporaryDirectories.push(directory)
    const port = await freePort()
    const child = await startServer(join(directory, 'runs.json'), port)
    const baseUrl = `http://127.0.0.1:${port}`
    try {
      const created = await fetch(`${baseUrl}/api/v1/research-runs`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sourceAllowlist: ['wire-services'] }) }).then((response) => response.json()) as { runId: string }
      expect((await fetch(`${baseUrl}/api/v1/research-runs/${created.runId}/plan`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status).toBe(200)
      for (let step = 0; step < 2; step += 1) await fetch(`${baseUrl}/api/v1/research-runs/${created.runId}/step`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'next' }) })
      const purchase = (quoteHash?: string) => fetch(`${baseUrl}/api/v1/research-runs/${created.runId}/purchases`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sourceId: 'northstar-wire', action: 'BUY', approval: 'APPROVED', quoteHash }) })
      expect((await purchase()).status).toBe(409)
      expect((await purchase('stale-quote')).status).toBe(409)
      const state = await fetch(`${baseUrl}/api/v1/research-runs/${created.runId}`).then((response) => response.json()) as { spentCents: number; sources: { id: string; decision?: string }[] }
      expect(state.spentCents).toBe(0)
      expect(state.sources.find((source) => source.id === 'northstar-wire')?.decision).toBeUndefined()
    } finally { await stopServer(child) }
  })

  it('requires explicit plan approval before direct step discovery', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'research-agent-plan-approval-'))
    temporaryDirectories.push(directory)
    const port = await freePort()
    const child = await startServer(join(directory, 'runs.json'), port)
    const baseUrl = `http://127.0.0.1:${port}`
    const request = (path: string, body?: unknown) => fetch(`${baseUrl}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })

    try {
      const createdResponse = await request('/api/v1/research-runs', {})
      expect(createdResponse.status).toBe(201)
      const created = await createdResponse.json() as { runId: string; phase: string; rawSourceCount: number }
      expect(created).toMatchObject({ phase: 'DRAFT', rawSourceCount: 0 })

      const blocked = await request(`/api/v1/research-runs/${created.runId}/step`, { action: 'next' })
      expect(blocked.status).toBe(409)
      expect(await blocked.json()).toMatchObject({ error: 'Approve the research plan before execution begins' })
      for (const endpoint of ['discover', 'rank', 'gaps', 'synthesize', 'purchase-decisions']) {
        const direct = await request(`/api/v1/research-runs/${created.runId}/${endpoint}`, {})
        expect(direct.status).toBe(409)
      }
      expect(await (await request(`/api/v1/research-runs/${created.runId}`)).json()).toMatchObject({ phase: 'DRAFT', rawSourceCount: 0 })

      const approved = await request(`/api/v1/research-runs/${created.runId}/plan`, {})
      expect(approved.status).toBe(200)
      expect(await approved.json()).toMatchObject({ phase: 'PLANNING', plan: { artifact: 'RESEARCH_PLAN' } })

      const planned = await request(`/api/v1/research-runs/${created.runId}/step`, { action: 'next' })
      expect(planned.status).toBe(200)
      expect(await planned.json()).toMatchObject({ phase: 'DISCOVERING', rawSourceCount: expect.any(Number) })
    } finally {
      await stopServer(child)
    }
  })

  it('rejects direct synthesis when a restricted approved run has no accessible evidence', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'research-agent-empty-dossier-'))
    temporaryDirectories.push(directory)
    const port = await freePort()
    const child = await startServer(join(directory, 'runs.json'), port)
    const baseUrl = `http://127.0.0.1:${port}`
    const request = (path: string, body?: unknown) => fetch(`${baseUrl}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })

    try {
      const created = await (await request('/api/v1/research-runs', { sourceAllowlist: ['wire-services'] })).json() as { runId: string }
      const approved = await request(`/api/v1/research-runs/${created.runId}/plan`, {})
      expect(approved.status).toBe(200)
      expect(await approved.json()).toMatchObject({ phase: 'PLANNING', planApproved: true, sources: [] })

      const rejected = await request(`/api/v1/research-runs/${created.runId}/synthesize`, {})
      expect(rejected.status).toBe(409)
      const rejectedBody = await rejected.json() as { error: string; state: { phase: string; dossierReady: boolean; claims: unknown[]; events: { type: string }[] } }
      expect(rejectedBody).toMatchObject({
        error: 'Cannot synthesize a dossier without accessible evidence spans',
        state: { phase: 'PLANNING', dossierReady: false, claims: [] },
      })
      expect(rejectedBody.state.events.some((event) => event.type === 'DOSSIER_READY')).toBe(false)

      const advanced = await request(`/api/v1/research-runs/${created.runId}/step`, { action: 'next' })
      expect(advanced.status).toBe(200)
      const advancedBody = await advanced.json() as { phase: string; dossierReady: boolean; claims: unknown[]; events: { type: string }[] }
      expect(advancedBody).toMatchObject({ phase: 'DISCOVERING', dossierReady: false, claims: [] })
      expect(advancedBody.events.some((event) => event.type === 'DOSSIER_READY')).toBe(false)

      const dossier = await request(`/api/v1/research-runs/${created.runId}/dossier`)
      expect(dossier.status).toBe(409)
      expect(await dossier.json()).toMatchObject({ error: 'Dossier is not ready' })
    } finally {
      await stopServer(child)
    }
  })
})
