import { createClient } from '../sdk/index.js'

const client = createClient({ baseUrl: process.env.RA_BACKEND_URL ?? 'http://127.0.0.1:9388', token: process.env.RA_API_TOKEN })
const run = await client.ask('How does Kestrel benefit from the TSMC deal (pricing & margins)?', {
  budgetSgd: 1,
  idempotencyKey: 'quickstart-1',
})
console.log(run.answer)
console.log(run.purchases.map(p => p.txHash).filter(Boolean))
console.log(run.labels, run.corpusLabel)
