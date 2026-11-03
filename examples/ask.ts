import { createClient } from '../sdk/index.js'
const client = createClient({ baseUrl: process.env.RA_URL ?? 'http://127.0.0.1:6100' })
const task = client.ask('How did the Kestrel–TSMC deal change pricing and margins?', {
  budget: 2, idempotencyKey: 'example-ask-v1',
})
for await (const event of task.events) console.log(event.type, event.label)
const run = await task
console.log(JSON.stringify(run)) // includes clamped budget, citations, receipts and labels
