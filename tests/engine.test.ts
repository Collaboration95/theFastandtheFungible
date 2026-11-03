import { expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { startEngine } from '../server/engine.js'

it('boots two isolated fixture engines on ephemeral ports and closes every listener', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ra-engines-'))
  const engines = await Promise.all(['a', 'b'].map(name => startEngine({ dataDir: join(dir, name) })))
  try {
    const urls = engines.flatMap(e => [e.apiUrl, e.publisherUrl])
    expect(new Set(urls).size).toBe(4)
    for (const url of urls) {
      expect([5100, 8788, 8790]).not.toContain(Number(new URL(url).port))
      expect((await fetch(`${url}/health`)).ok).toBe(true)
    }
    for (const engine of engines) {
      expect((await fetch(engine.apiUrl + '/api/metrics')).status).toBe(401)
      const metrics = await (await fetch(engine.apiUrl + '/api/metrics', { headers: { Authorization: `Bearer ${engine.apiToken}` } })).json()
      expect(metrics).toMatchObject({ schema: 'operations-v1', rail: 'simulated' })
    }
    const health = await (await fetch(`${engines[0].apiUrl}/health`)).json()
    expect(health.labels.research).toContain('fixture')
    expect(health.labels.settlement).toContain('SIMULATED')
    await Promise.all(engines.map(e => e.close()))
    for (const url of urls) await expect(fetch(`${url}/health`)).rejects.toThrow()
  } finally {
    await Promise.all(engines.map(e => e.close()))
    rmSync(dir, { recursive: true, force: true })
  }
}, 30_000)
