import { afterEach, afterAll, vi } from 'vitest'
import { ResourceScope } from '../../shared/resource-scope.js'
const legacy = new ResourceScope()
let scope: ResourceScope | undefined
/** Lazy per-test owner; concurrent tests must pass an explicit scope instead. */
export function resources() { return scope ??= new ResourceScope() }
afterEach(async () => { const current = scope; scope = undefined; await current?.close() })

// Compatibility ownership for unmigrated synchronous test factories (including
// Lane D's history fixture). Preserve exact caller paths; production fs is unchanged.
// New factories should call resources().tempDir() directly.
vi.mock('node:fs', async importOriginal => {
  const fs = await importOriginal<typeof import('node:fs')>()
  return { ...fs, mkdtempSync: (...args: Parameters<typeof fs.mkdtempSync>) => {
    const path = fs.mkdtempSync(...args)
    legacy.defer(() => fs.promises.rm(path, { recursive: true, force: true }))
    return path
  } }
})

afterAll(() => legacy.close())
