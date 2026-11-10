import { expect, it } from 'vitest'
import { join } from 'node:path'
import { PublisherJournal } from '../publisher/journal.js'
import { resources } from './helpers/resource-scope.js'

it('retiring an exact failed finish preserves its key and history across a journal restart', () => {
  const path = join(resources().tempDir('release-finish-recovery-'), 'publisher.db')
  const first = { txHash: 'A'.repeat(64), txBlob: 'fixture-first-blob', lastLedgerSequence: 20 }
  const second = { txHash: 'B'.repeat(64), txBlob: 'fixture-retry-blob', lastLedgerSequence: 40 }
  const journal = new PublisherJournal(path)
  try {
    journal.saveKeyReveal('invoice', { secret: 'fixture-secret', finish: first })
    expect(() => journal.retireFinish('invoice', second.txHash)).toThrow('Finish attempt changed')
    expect(journal.keyReveal('invoice')?.finish).toEqual(first)
    journal.retireFinish('invoice', first.txHash)
    expect(journal.keyReveal('invoice')).toEqual({ secret: 'fixture-secret' })
    expect(() => journal.saveKeyReveal('invoice', { secret: 'different-key' })).toThrow('Key reveal already bound')
    journal.saveKeyReveal('invoice', { secret: 'fixture-secret', finish: second })
    expect(() => journal.retireFinish('invoice', first.txHash)).toThrow('Finish attempt changed')
    expect(journal.keyReveal('invoice')?.finish).toEqual(second)
  } finally { journal.close() }
  const reopened = resources().own(new PublisherJournal(path))
  expect(reopened.keyReveal('invoice')).toEqual({ secret: 'fixture-secret', finish: second })
  reopened.retireFinish('invoice', second.txHash)
  expect(reopened.keyReveal('invoice')).toEqual({ secret: 'fixture-secret' })
  expect(reopened.terminalAttempts('invoice')).toEqual([first, second])
})
