import { it, expect } from 'vitest'
import { Wallet } from 'xrpl'
import { fixtureLedger } from '../scripts/chaos/ledger.js'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

it('fixture ledger retains confirmed hashes across crashes and rejects a competing blob at the same sequence', async () => {
  const dir = mkdtempSync(join(tmpdir(),'chaos-ledger-')), payer = Wallet.generate(), target = Wallet.generate()
  const tx = { TransactionType: 'Payment' as const, Account: payer.classicAddress, Destination: target.classicAddress, Amount: '1000', Fee: '12', Sequence: 1, LastLedgerSequence: 120 }
  const first = payer.sign(tx), second = payer.sign({...tx,Amount:'2000'})
  let chain = fixtureLedger(join(dir,'ledger.db'))
  try {
    await chain.ledger.request({command:'submit',tx_blob:first.tx_blob})
    chain.close(); chain = fixtureLedger(join(dir,'ledger.db'))
    expect((await chain.ledger.request({command:'submit',tx_blob:first.tx_blob})).result.engine_result).toBe('tefALREADY')
    expect((await chain.ledger.request({command:'submit',tx_blob:second.tx_blob})).result.engine_result).toBe('tefPAST_SEQ')
    expect(chain.transactions()).toHaveLength(1)
    expect((await chain.ledger.request({command:'tx',transaction:first.hash})).result.validated).toBe(true)
    await expect(chain.ledger.request({command:'tx',transaction:second.hash})).rejects.toThrow('txnNotFound')
  } finally { chain.close(); rmSync(dir,{recursive:true,force:true}) }
})

import { reliabilityMetrics } from '../eval/scorecard/chaos.js'
it('reports historical chaos separately from quality and refuses malformed evidence', () => {
  const evidence = {schema:'chaos-v1',label:'SYNTHETIC fixture',iterations:500,invariantViolations:0,doubleCharges:0,durationMs:1800000,latencyMs:{p95DriftMs:12},testedCommit:'fixture-commit'}
  expect(reliabilityMetrics(evidence,evidence)).toMatchObject({chaosPassRatePct:100,doubleCharges:0,soakP95DriftMs:12,soakCommit:'fixture-commit'})
  expect(reliabilityMetrics({...evidence,invariantViolations:1}).chaosPassRatePct).toBeLessThan(100)
  expect(reliabilityMetrics(evidence).soakP95DriftMs).toBeNull()
  for (const bad of [{iterations:0},{doubleCharges:-1},{schema:'other'},{durationMs:0},{label:'live'}]) expect(() => reliabilityMetrics({...evidence,...bad})).toThrow('Invalid fixture chaos evidence')
})
