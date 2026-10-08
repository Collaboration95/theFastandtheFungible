// Regenerates src/fixtures/uc/*.json from the #157 scenario harness (fixture providers, SIMULATED rail,
// v2 corpus, ephemeral ports): `node --import tsx src/fixtures/generate-uc.ts`. Run IDs and times are
// normalised so the files are stable. Each snapshot holds only what the API already sends the browser.
import { writeFileSync } from 'node:fs'
import { startScenario } from '../../tests/scenarios/harness.js'
import type { UseCaseId } from '../../tests/scenarios/use-cases.js'

const h = await startScenario({ plain: true })
try {
  for (const id of ['UC1', 'UC2', 'UC3', 'UC4'] as UseCaseId[]) {
    const run = await h.until(await h.ask(id))
    const t0 = Date.parse(run.events[0]?.at ?? new Date().toISOString())
    const json = JSON.stringify(run)
      .replaceAll(run.runId, `fixture-${id.toLowerCase()}`)
      .replace(/"(\d{4}-\d\d-\d\dT[\d:.]+Z)"/g, (_, at: string) => JSON.stringify(new Date(Date.parse('2026-10-10T09:00:00.000Z') + Date.parse(at) - t0).toISOString()))
    writeFileSync(new URL(`./uc/${id.toLowerCase()}.json`, import.meta.url), `${json}\n`)
  }
  // After UC1–UC4: the Writers tab's records, and the UC2 clarify scope.
  const reputation = await (await fetch(`${h.base}/api/reputation`)).json() as { publishers: { updatedAt: string }[] }
  for (const record of reputation.publishers) record.updatedAt = '2026-10-10T09:00:00.000Z'
  writeFileSync(new URL('./uc/reputation.json', import.meta.url), `${JSON.stringify(reputation.publishers, null, 1)}\n`)
  writeFileSync(new URL('./uc/scope-uc2.json', import.meta.url), `${JSON.stringify(await h.scope('UC2'), null, 1)}\n`)
} finally { await h.stop() }
