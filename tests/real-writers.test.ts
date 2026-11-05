import { expect, it } from 'vitest'
import Ajv2020 from 'ajv/dist/2020.js'
import { readFileSync } from 'node:fs'
const read = (path: string) => readFileSync(path, 'utf8')
it('keeps the real-writers list schema-valid, empty until consent, and identical on the site', () => {
  const list = JSON.parse(read('docs/evidence/real-writers.json'))
  const validate = new Ajv2020({ strict: false }).compile(JSON.parse(read('docs/evidence/real-writers.schema.json')))
  expect(validate(list), JSON.stringify(validate.errors)).toBe(true)
  expect(read('site/evidence/real-writers.json')).toBe(read('docs/evidence/real-writers.json'))
  expect(validate({ writers: [{ name: 'X', address: 'not-an-address', consentEvidence: 'y' }] })).toBe(false)
})
it('labels the section the same way in the README and on the ledger', () => {
  for (const file of ['README.md', 'site/ledger/index.html']) expect(read(file)).toContain('real person · Testnet · no real value')
  expect(read('site/ledger/ledger.js')).toContain('../evidence/real-writers.json')
})
