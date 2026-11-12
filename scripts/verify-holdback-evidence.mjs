// Read-only verification of every saved purchase and terminal after the evidence run.
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { Client } from 'xrpl'
import { verifyAnswer } from '../sdk/verify.ts'
const path='docs/evidence/money', raw=JSON.parse(readFileSync(`${path}/holdback-transactions.json`,'utf8')), c=new Client('wss://s.altnet.rippletest.net:51233',{timeout:20000}),results=[]
try {
  await c.connect()
  for(let i=0;i<raw.rows.length;i++) {
    const row=raw.rows[i],bundle=JSON.parse(readFileSync(`${path}/holdback-${String(i+1).padStart(2,'0')}.receipt.json`,'utf8'))
    const offline=await verifyAnswer(bundle)
    const online=await verifyAnswer(bundle,{testnet:true,ledger:{request:r=>c.request(r)}})
    const terminal=(await c.request({command:'tx',transaction:row.holdbackTerminal,api_version:2})).result
    assert.equal(terminal.validated,true); assert.equal(terminal.meta.TransactionResult,'tesSUCCESS')
    if(row.forcedPromiseFailure) { assert.equal(terminal.tx_json.TransactionType,'EscrowCancel'); assert.ok(terminal.tx_json.date>row.holdback.cancelAfter) }
    row.terminalLedger=terminal.ledger_index; row.terminalCloseTime=terminal.tx_json.date
    results.push({intentId:row.intentId,offline,online,terminalLedger:terminal.ledger_index,terminalCloseTime:terminal.tx_json.date})
    console.log(JSON.stringify({intentId:row.intentId,offline:offline.ok,online:online.ok,failures:online.checks.filter(c=>c.status==='FAIL')}))
  }
  writeFileSync(`${path}/holdback-verification.json`,JSON.stringify(results,null,2)+'\n')
  writeFileSync(`${path}/holdback-transactions.json`,JSON.stringify(raw,null,2)+'\n')
  assert.equal(results.length,15); assert.ok(results.every(r=>r.offline.ok&&r.online.ok))
} finally { await c.disconnect() }
