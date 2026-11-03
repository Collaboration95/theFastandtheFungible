import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { verifyAnswer } from '../sdk/verify.js'
import manifest from './fixtures/receipt-conformance/manifest.json'
for (const c of manifest.cases) it(c.name, async () => {
  const b = JSON.parse(readFileSync(c.fixture,'utf8'))
  for (const m of c.mutations) {
    let target=b
    for (const p of m.path.slice(0,-1)) target=target[p]
    target[m.path.at(-1)!]=m.value
  }
  expect((await verifyAnswer(b)).ok).toBe(c.expected)
})

it('keeps the packaged schema snapshot aligned with the wire contract', async () => {
  const { z } = await import('zod')
  const { ReceiptBundleSchema } = await import('../shared/contracts/receipts.js')
  const { ReportSchema } = await import('../shared/contracts/report.js')
  for (const [name,schema] of Object.entries({bundle:ReceiptBundleSchema,report:ReportSchema})) {
    expect(JSON.parse(readFileSync(`packages/sdk-python/src/researchagent/${name}-schema.json`,'utf8'))).toEqual(z.toJSONSchema(schema,{io:'input'}))
  }
})
