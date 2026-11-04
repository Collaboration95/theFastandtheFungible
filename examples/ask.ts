import { createClient } from '../sdk/index.js'
const client = createClient({ baseUrl: process.env.RA_URL ?? 'http://127.0.0.1:8788', token: process.env.RA_API_TOKEN })
const task = client.ask('What is the analyst outlook on the Kestrel Semiconductor deal with TSMC (pricing & margins)?', {
  budget: 2, idempotencyKey: 'example-ask-v1',
})
for await (const event of task.events) { void event }
const run = await task
if (process.argv.includes('--json')) console.log(JSON.stringify(run))
else {
  console.log('Answer:', JSON.stringify(run.answer))
  console.log('Citation:', JSON.stringify(run.citations[0] ?? 'none'))
  console.log('Tx hash:', run.receipts[0]?.xrpl?.txHash ?? 'none (simulated or free)')
  console.log(`Spend: S$${(run.spentMinor / 100).toFixed(2)} gross`)
  console.log('Mode:', run.labels.settlement)
  console.log('Verify: researchagent verify receipts.json --ledger (export receipts.json from the run)')
}
