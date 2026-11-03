import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { cachedManifestVerifier } from '../server/manifest-verification.js'
import { verifyManifestSignature } from '../shared/manifest.js'
import { Store } from '../server/store.js'
import { ExactCache } from '../server/exact-cache.js'

const fixture = JSON.parse(readFileSync('tests/fixtures/receipt-conformance/secp256k1.json', 'utf8')).proofs[0].manifest

describe('exact verification reuse', () => {
  it('never accepts altered signed bytes, signatures, wallet or key', () => {
    const verify = vi.fn(verifyManifestSignature), cached = cachedManifestVerifier(verify)
    expect(cached(fixture)).toBe(true)
    expect(cached(structuredClone(fixture))).toBe(true)
    expect(verify).toHaveBeenCalledTimes(1)
    for (const patch of [{ root: 'f'.repeat(64) }, { sig: '00'.repeat(64) }, { wallet: 'invalid' }, { pubKey: '02' + '00'.repeat(32) }]) expect(cached({ ...fixture, ...patch })).toBe(false)
    expect(verify).toHaveBeenCalledTimes(5)
    expect(cached(fixture)).toBe(true)
  })
  it('eviction forces the original verifier to execute again', () => {
    const verify = vi.fn(verifyManifestSignature), cached = cachedManifestVerifier(verify, 1)
    expect(cached(fixture)).toBe(true)
    expect(cached({ ...fixture, root: 'f'.repeat(64) })).toBe(false)
    expect(cached(fixture)).toBe(true)
    expect(verify).toHaveBeenCalledTimes(3)
  })
  it('enforces both the byte bound and LRU capacity', () => {
    const c = new ExactCache<string>(2, 20)
    c.set('a', '1'); c.set('b', '2'); c.get('a'); c.set('c', '3')
    expect(c.get('b')).toBeUndefined()
    c.set('oversized', 'xxxxxxxxxxxxxxxx')
    expect(c.get('oversized')).toBeUndefined()
  })
  it('returns isolated snapshots and observes external altered bytes after cache hits', () => {
    const store = new Store(':memory:')
    try {
      const run = store.createRun('fixture', 100)
      const first = store.getRun(run.runId); first.checkpoint.extra = 'caller mutation'
      expect(store.getRun(run.runId).checkpoint.extra).toBeUndefined()
      const db = (store as unknown as { db: { prepare: (sql: string) => { run: (...args: string[]) => void } } }).db
      db.prepare('UPDATE runs SET json=? WHERE id=?').run(JSON.stringify({ ...run, budgetMinor: -1 }), run.runId)
      expect(() => store.getRun(run.runId)).toThrow()
    } finally { store.close() }
  })
})
