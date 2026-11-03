import { createHash } from 'node:crypto'
import type { Observation } from '../../tests/scenarios/harness.js'
/** Identical retry streams observe the same state. Keep every distinct state, audit duplicates once. */
export function snapshotCollector() {
  const seen = new Set<string>(), observations: Observation[] = []
  return { observations, add(observation: Observation) {
    const key = createHash('sha256').update(JSON.stringify([observation.kind,observation.runId,observation.raw,observation.grants])).digest('hex')
    if (!seen.has(key)) { seen.add(key); observations.push(observation) }
  } }
}
