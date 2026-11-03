// Optional, explicitly historical fixture-chaos observations; never quality gates or live ledger proof.
import { readFileSync } from 'node:fs'
export type ChaosEvidence = { schema: string; label: string; iterations: number; invariantViolations: number; doubleCharges: number;
  durationMs: number; latencyMs: { p95DriftMs: number | null }; testedCommit?: string }
export function reliabilityMetrics(chaos: ChaosEvidence, soak?: ChaosEvidence) {
  for (const evidence of [chaos, soak].filter(Boolean) as ChaosEvidence[]) {
    if (evidence.schema !== 'chaos-v1' || !evidence.label.includes('SYNTHETIC') || !Number.isSafeInteger(evidence.iterations) || evidence.iterations < 1
      || !Number.isSafeInteger(evidence.invariantViolations) || evidence.invariantViolations < 0 || !Number.isSafeInteger(evidence.doubleCharges) || evidence.doubleCharges < 0
      || !Number.isFinite(evidence.durationMs) || evidence.durationMs <= 0) throw new Error('Invalid fixture chaos evidence')
  }
  return { label: 'Historical SYNTHETIC fault experiments; not Testnet or production reliability',
    iterations: chaos.iterations, chaosPassRatePct: 100 * chaos.iterations / (chaos.iterations + chaos.invariantViolations),
    doubleCharges: chaos.doubleCharges, invariantViolations: chaos.invariantViolations,
    soakDurationMs: soak?.durationMs ?? null, soakP95DriftMs: soak?.latencyMs.p95DriftMs ?? null,
    chaosCommit: chaos.testedCommit ?? null, soakCommit: soak?.testedCommit ?? null }
}
export function readReliability(chaosFile: string, soakFile?: string) {
  return { ...reliabilityMetrics(JSON.parse(readFileSync(chaosFile,'utf8')), soakFile ? JSON.parse(readFileSync(soakFile,'utf8')) : undefined), evidence: { chaos: chaosFile, soak: soakFile ?? null } }
}
