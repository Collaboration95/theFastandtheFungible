import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

// Specs refresh tracked screenshots under docs/evidence only on request (UPDATE_EVIDENCE=1).
// Otherwise they write to the ignored test-results/ tree, so test runs, the local gate and
// final acceptance never dirty the source tree they are certifying.
export function evidencePath(rel: string): string {
  const path = join(process.env.UPDATE_EVIDENCE === '1' ? 'docs/evidence' : 'test-results/evidence', rel)
  mkdirSync(dirname(path), { recursive: true })
  return path
}
