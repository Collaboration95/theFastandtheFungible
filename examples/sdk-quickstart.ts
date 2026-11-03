import { createClient } from '../sdk/index.js'

const client = createClient({ baseUrl: process.env.RA_URL ?? 'http://127.0.0.1:8788', token: process.env.RA_API_TOKEN })
const run = await client.ask('What is the analyst outlook on the Kestrel Semiconductor deal with TSMC (pricing & margins)?', {
  budget: 1,
  idempotencyKey: 'quickstart-1',
})
console.log(run.answer)
console.log(run.purchases.map(p => p.txHash).filter(Boolean))
console.log(run.labels, run.corpusLabel)
