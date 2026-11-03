import { createClient } from '../sdk/index.js'
const client = createClient({ baseUrl: process.env.RA_URL ?? 'http://127.0.0.1:6100' })
const result = await client.verify(process.argv[2] ?? 'receipts.json')
console.log(JSON.stringify(result))
process.exitCode = result.ok ? 0 : 1
