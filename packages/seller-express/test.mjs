import assert from 'node:assert/strict'
import {test} from 'node:test'
import {once} from 'node:events'
import express from 'express'
import {Wallet} from 'xrpl'
import {keyReveal} from './index.mjs'
import {testnetPurchase} from '@researchagent/seller-core/testnet'
async function serve(options){
 const seller=keyReveal(options),app=express();app.get('/article',seller.middleware)
 const server=app.listen(0,'127.0.0.1');await once(server,'listening')
 return{url:`http://127.0.0.1:${server.address().port}/article`,close:async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));seller.close()}}
}
test('Express returns a header/body challenge, never paid content',async()=>{
 const buyer=Wallet.generate(),server=await serve({client:{request:async r=>({result:r.command==='server_info'?{info:{network_id:1}}:{ledger:{close_time:100}}})},wallet:Wallet.generate(),dbPath:':memory:',resourceUrl:'http://localhost/article',content:()=> 'premium secret'})
 try{
  const response=await fetch(`${server.url}?buyer=${buyer.classicAddress}&intent=one`)
  assert.equal(response.status,402);const body=await response.text();assert(!body.includes('premium secret'));assert.deepEqual(JSON.parse(Buffer.from(response.headers.get('PAYMENT-REQUIRED'),'base64')),JSON.parse(body))
 }finally{await server.close()}
})
test('Testnet Express escrow purchase',{skip:process.env.XRPL_KEY_REVEAL_TESTNET!=='1',timeout:180000},()=>testnetPurchase(serve))
