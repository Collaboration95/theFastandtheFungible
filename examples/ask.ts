import { createClient } from '../sdk/index.js'
const client = createClient({ baseUrl: process.env.RA_URL ?? 'http://127.0.0.1:8788' })
const task = client.ask('What is the analyst outlook on the Kestrel Semiconductor deal with TSMC (pricing & margins)?', {
  budget: 2, idempotencyKey: 'example-ask-v1',
})
for await (const event of task.events) console.log(event.type, event.label)
const run = await task
console.log(JSON.stringify(run)) // includes clamped budget, citations, receipts and labels

console.log('Receipt:', JSON.stringify(run.receipts))
console.log('What your money bought (structural use; semantics not assessed):', JSON.stringify(run.contributions))
