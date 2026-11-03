import { isDeepStrictEqual } from 'node:util'
import { RunSnapshotSchema, type RunSnapshot } from '../shared/contracts/index.js'
import { ExactCache } from './exact-cache.js'

/** RunSnapshot has no cross-field refinements. Each field still uses its original schema.
 * Cache only JSON round-trippable fields; return fresh parsed values on every hit.
 * The authoritative SQLite bytes are always read, including after rollback/external writes.
 */
export class RunValidator {
  private readonly cache = new ExactCache<string>()
  parse(run: RunSnapshot): RunSnapshot {
    const result: Record<string, unknown> = {}
    for (const [key, schema] of Object.entries(RunSnapshotSchema.shape)) {
      const value = run[key as keyof RunSnapshot]
      const json = JSON.stringify(value)
      // Optional undefined must go through Zod too, without conflating it with null.
      if (json === undefined) { const parsed = schema.parse(value); if (parsed !== undefined) result[key] = parsed; continue }
      if (!isDeepStrictEqual(value, JSON.parse(json))) { result[key] = schema.parse(value); continue }
      const cacheKey = JSON.stringify([key, json])
      const cached = this.cache.get(cacheKey)
      if (cached !== undefined) result[key] = JSON.parse(cached)
      else {
        const parsed = schema.parse(value)
        result[key] = parsed
        const output = JSON.stringify(parsed)
        if (output !== undefined && isDeepStrictEqual(parsed, JSON.parse(output))) this.cache.set(cacheKey, output)
      }
    }
    return result as RunSnapshot
  }
}
