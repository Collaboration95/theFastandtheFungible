import { Store } from '../../server/store.ts'
const [path, principal, lane] = process.argv.slice(2)
const store = new Store(path)
let total = 0
try {
  for (let i = 0; i < 12; i++) total += store.admit({ surface: 'agent', principal, question: `parallel ${lane}-${i}`,
    requestedMinor: 50, idempotencyKey: `${lane}-${i}`, maxMinor: 500 }).run.budgetMinor
  console.log(total)
} finally { store.close() }
