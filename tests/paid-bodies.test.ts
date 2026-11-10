import { expect, it } from 'vitest'
// @ts-expect-error plain .mjs script, checked through runtime mutations
import { paidBodyFindings, readPaidArticles } from '../scripts/check-paid-bodies.mjs'

it('rejects paths, source filenames and engineering storage details in paid bodies or passages', () => {
 for (const text of ['Code: publisher/routes.ts', 'src/ is unchanged', 'outside-name.tsx', 'run-check.mjs', 'SQLite stores an outbox', 'Seeds stay in 0600 storage', 'reservedMinor', 'signed transaction blob']) {
  expect(paidBodyFindings([{ articleId: 'mutation', tier: 'PAID', body: text }]).length, text).toBeGreaterThan(0)
  expect(paidBodyFindings([{ articleId: 'mutation', tier: 'PAID', body: '', passages: [{ text }] }]).length, text).toBeGreaterThan(0)
 }
})

it('permits reader-facing ledger terminology and checks the shipped paid corpus', () => {
 expect(paidBodyFindings([{ articleId: 'reader', tier: 'PAID', body: 'EscrowCreate locks XRP. Check delivered_amount and LastLedgerSequence; Testnet funds have no real value.' }])).toEqual([])
 expect(paidBodyFindings(readPaidArticles('data/corpus/v2/articles'))).toEqual([])
})
