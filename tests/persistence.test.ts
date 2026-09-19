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
})
