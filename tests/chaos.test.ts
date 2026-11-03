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
