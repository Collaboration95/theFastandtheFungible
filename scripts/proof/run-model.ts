import { mkdirSync, writeFileSync } from 'node:fs'
import { checkModel, mutations } from './model.js'
const summary = { label: 'BOUNDED MODEL; abstract ledger, not Testnet', models: [checkModel(), checkModel({ mode: 'conditional' }), checkModel({ budget: 2 }), checkModel({ mode: 'conditional', budget: 2 })], mutations: mutations.map(m => checkModel({ intents: 3, crashes: 1, retries: 1 }, m)) }
mkdirSync('docs/evidence/proof', { recursive: true })
writeFileSync('docs/evidence/proof/model-summary.json', JSON.stringify(summary, null, 2)+'\n')
console.log(JSON.stringify(summary, null, 2))
if (summary.models.some(m => m.violations.length) || summary.mutations.some(m => !m.violations.length)) process.exitCode = 1
