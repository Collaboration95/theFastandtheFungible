import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { RunSnapshotSchema } from '../shared/contracts/index.js'
import { replayLabel } from '../demo/replay-label.js'
import { ENV } from '../shared/presentation.js'
import { recordedRunLabel } from '../shared/recorded-run-label.js'
import { presentRun } from '../sdk/present.js'

it('retains live synthesis over real, public passage URLs with no purchases', () => {
  const recording = JSON.parse(readFileSync('demo/traces/UC-real-content.json', 'utf8'))
  const run = RunSnapshotSchema.parse(recording.run)
  expect(run.phase).toBe('DONE')
  expect(run.budgetMinor).toBe(0)
  expect(run.intents).toHaveLength(0)
  expect(run.receipts).toHaveLength(0)
  expect(recording.provenance.modelSpendUpperBoundUsd).toBeLessThan(1)
  expect(run.answers.at(-1)?.provider).toBe('deepseek')
  expect(run.answers.at(-1)?.claims.length).toBeGreaterThan(0)
  expect(run.candidates.every(c => c.license.kind === 'MIT')).toBe(true)
  expect(presentRun(run,'http://publisher.invalid').citations.every(c=>c.url.startsWith('https://xrpl.org/docs/'))).toBe(true)
  for (const claim of run.answers.at(-1)!.claims) {
    for (const citation of claim.citations) {
      const content = run.contents.find(c => c.resourceId === citation.resourceId && c.version === citation.version)
      const span = content?.spans.find(s => s.id === citation.spanId)
      expect(span?.url).toMatch(/^https:\/\/xrpl\.org\/docs\/[^ ]+#/)
    }
  }
  expect(replayLabel('UC-real-content', '12 Nov 2026', false)).toBe('Replay · simulated payments, recorded 12 Nov 2026 · live models')
  expect(replayLabel('UC3-key-reveal', '11 Nov 2026', true)).toBe(ENV.replay('11 Nov 2026', true))
  expect(recordedRunLabel(run)).toBe('Recorded run · live answers · simulated payments')
  expect(recordedRunLabel({...run,answers:[]})).toBe('Recorded run · answers pending · simulated payments')
  const original = JSON.parse(readFileSync('demo/traces/UC3-key-reveal.json', 'utf8'))
  expect(recordedRunLabel(original.run)).toBe('Recorded run · fixture answers · fictional writers and content · XRPL Testnet, no real value')
})
