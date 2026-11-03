import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { cachedManifestVerifier } from '../server/manifest-verification.js'
import { verifyManifestSignature } from '../shared/manifest.js'
import { RunValidator } from '../server/run-validation.js'
import { Store } from '../server/store.js'
import { RunSnapshotSchema } from '../shared/contracts/index.js'
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
  it('preserves schema output, rejects changed invalid fields and isolates mutations', () => {
    const store = new Store(':memory:')
    try {
      const run = store.createRun('fixture', 100), validator = new RunValidator()
      expect(validator.parse(run)).toEqual(RunSnapshotSchema.parse(run))
      expect(validator.parse({ ...run, error: undefined })).toEqual(RunSnapshotSchema.parse({ ...run, error: undefined }))
      const withSpecial = { ...run, checkpoint: { extra: Number.NaN } }
      expect(validator.parse(withSpecial)).toEqual(RunSnapshotSchema.parse(withSpecial))
      const first = validator.parse(run); first.checkpoint.extra = 'caller mutation'
      expect(validator.parse(run)).toEqual(RunSnapshotSchema.parse(run))
      for (const patch of [{ budgetMinor: -1 }, { stopped: 'no' }, { candidates: [{ bad: true }] }]) {
        const altered = { ...run, ...patch } as typeof run
        expect(() => validator.parse(altered)).toThrow()
        expect(() => RunSnapshotSchema.parse(altered)).toThrow()
      }
    } finally { store.close() }
  })
})
