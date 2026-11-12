// Optional package integration helper. Faucet-funded Testnet only, never environment wallets.
import assert from 'node:assert/strict'
import {mkdtempSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {Client} from 'xrpl'
import {commitment,encodeHeader,open} from './index.mjs'
export async function testnetPurchase(serve){
 assert.equal(process.env.XRPL_KEY_REVEAL_TESTNET,'1')
 const client=new Client('wss://s.altnet.rippletest.net:51233');let server
 try{
  await client.connect();assert.equal((await client.request({command:'server_info'})).result.info.network_id,1)
  const {wallet:buyer}=await client.fundWallet(),{wallet}=await client.fundWallet()
  server=await serve({client,wallet,dbPath:join(mkdtempSync(join(tmpdir(),'seller-integration-')),'journal.db'),resourceUrl:'http://localhost/article',content:()=> 'Synthetic integration article.'})
  const url=new URL(server.url);url.searchParams.set('buyer',buyer.classicAddress);url.searchParams.set('intent','one')
  const unpaid=await fetch(url);assert.equal(unpaid.status,402);const offer=await unpaid.json(),req=offer.accepts[0],e=req.extra
  const prepared=await client.autofill({TransactionType:'EscrowCreate',Account:buyer.classicAddress,Destination:req.payTo,Amount:req.amount,Condition:e.condition,CancelAfter:e.cancelAfter,Memos:[{Memo:{MemoData:commitment(offer)}}]})
  assert(BigInt(prepared.Fee)<=1000n)
  const signed=buyer.sign(prepared);console.log(`Testnet create ${signed.hash}`)
  const create=(await client.submitAndWait(signed.tx_blob)).result;assert.equal(create.meta.TransactionResult,'tesSUCCESS')
  const paid=await fetch(url,{headers:{'PAYMENT-SIGNATURE':encodeHeader({x402Version:2,accepted:req,payload:{signedTxBlob:signed.tx_blob}})}})
  assert.equal(paid.status,200);const result=await paid.json();console.log(`Testnet finish ${result.finishHash}`)
  const finish=(await client.request({command:'tx',transaction:result.finishHash})).result
  assert.equal(finish.validated,true);assert.equal(finish.meta.TransactionResult,'tesSUCCESS')
  assert.equal(open(offer.extensions.keyReveal,finish.tx_json??finish,e.condition).toString(),'Synthetic integration article.')
 }finally{await server?.close();await client.disconnect()}
}
