/** Run in main and Lane N, compare JSON; --observed-fixture injects synthetic identity only. */
import { startScenario } from '../tests/scenarios/harness.js'
import { resolve } from 'node:path'
if (process.argv.includes('--observed-fixture')) process.env.SCENARIO_API_ROUTES = resolve('scripts/fixtures/credentials-api.ts')
const harness = await startScenario({ plain: true })
try {
  const run = await harness.until(await harness.ask('UC2'))
  console.log(JSON.stringify({ budgetMinor: run.budgetMinor, spentMinor: run.spentMinor, reservedMinor: run.reservedMinor,
    intents: run.intents.map(i => ({ resourceId: i.resourceId, status: i.status, amountMinor: i.amountMinor })),
    decisions: run.decisions.map(d => ({ round: d.round, rows: d.rows.map(r => ({ resourceId: r.candidate.resourceId, verdict: r.verdict })) })),
  }))
} finally { await harness.stop() }
