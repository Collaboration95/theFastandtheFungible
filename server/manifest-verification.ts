import { canonicalJson, verifyManifestSignature } from '../shared/manifest.js'
import type { Manifest } from '../shared/contracts/manifest.js'
import { ExactCache } from './exact-cache.js'
export function cachedManifestVerifier(verify = verifyManifestSignature, capacity = 512) {
  const cache = new ExactCache<boolean>(capacity)
  return (manifest: Manifest): boolean => {
    const key = canonicalJson(manifest)
    const cached = cache.get(key)
    if (cached !== undefined) return cached
    const result = verify(manifest)
    cache.set(key, result)
    return result
  }
}
export const verifyCachedManifest = cachedManifestVerifier()
