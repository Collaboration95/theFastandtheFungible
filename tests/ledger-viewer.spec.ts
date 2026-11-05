import { test, expect } from '@playwright/test'
import { createServer, type Server } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import AxeBuilder from '@axe-core/playwright'
let server:Server, url:string
test.beforeEach(async({page})=>{ await page.routeWebSocket(/wss:\/\/.*/,ws=>ws.close()) })
test.beforeAll(async()=>{server=createServer(async(req,res)=>{try{const name=(req.url??'/').split('?')[0];if(!['/','/index.html','/ledger.js','/style.css','/transactions.json'].includes(name)){res.writeHead(404).end();return}res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.json')?'application/json':name.endsWith('.css')?'text/css':'text/html');res.end(await readFile(resolve('site/ledger',name==='/'?'index.html':name.slice(1))))}catch{res.writeHead(404).end()}});await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));url=`http://127.0.0.1:${(server.address() as {port:number}).port}`})
test.afterAll(async()=>{await new Promise<void>(r=>server.close(()=>r()))})
test('offline evidence, keyboard and accessibility',async({page})=>{await page.goto(url);await expect(page.locator('tbody tr')).toHaveCount(45);await expect(page.getByRole('link',{name:'Download public evidence JSON'})).toHaveAttribute('download','');await expect(page.getByRole('button')).toBeEnabled();await page.getByRole('button').focus();await expect(page.getByRole('button')).toBeFocused();const a=await new AxeBuilder({page}).analyze();expect(a.violations.filter(v=>['serious','critical'].includes(v.impact??''))).toEqual([])})
test('CORS and unavailable history retain snapshot',async({page})=>{await page.goto(url);await expect(page.locator('tbody tr')).toHaveCount(45);await expect(page.getByRole('status')).toContainText('finished');await expect(page.locator('.state').first()).toContainText('Historical')})
test('stubbed v2 response states are conservative',async({page})=>{
 await page.goto(url)
 const statuses=await page.evaluate(async()=>{
  // @ts-expect-error Browser imports the standalone module from the ephemeral test server.
  const {classify}=await import('/ledger.js')
  const data=await(await fetch('/transactions.json')).json();const r=data.rows[0]
  const valid={result:{hash:r.hash,ledger_index:r.ledgerIndex,validated:true,tx_json:{TransactionType:'Payment',Account:r.from,Destination:r.to,InvoiceID:r.invoiceId,Fee:r.feeDrops,Amount:r.deliveredAmount},meta:{TransactionResult:'tesSUCCESS',delivered_amount:r.deliveredAmount}}}
  const values=[valid,{}, {result:{error:'txnNotFound'}}]
  for(const change of ['pending','unvalidated','amount','issuer','network','failure','malformed']){
   const b=structuredClone(valid)
   if(change==='pending'||change==='unvalidated')b.result.validated=false
   if(change==='amount')b.result.meta.delivered_amount.value='7'
   if(change==='issuer')b.result.meta.delivered_amount.issuer='wrong'
   if(change==='network')Object.assign(b.result.tx_json,{NetworkID:0})
   if(change==='failure')b.result.meta.TransactionResult='tecFAILED'
   if(change==='malformed')Object.assign(b.result,{meta:null})
   values.push(b)
  }
  return values.map(v=>classify(r,v))
 })
 expect(statuses[0]).toContain('validated · tesSUCCESS');expect(statuses.slice(1).every((s:string)=>s.startsWith('Historical'))).toBe(true)
})

test('auto-checks all rows and styles only matching validated successes',async({page})=>{
 const data=JSON.parse(await readFile('site/ledger/transactions.json','utf8'))
 await page.routeWebSocket(/wss:\/\/.*/,ws=>ws.onMessage(async raw=>{
  const request=JSON.parse(String(raw)), r=data.rows.find((r:{hash:string})=>r.hash===request.transaction)
  expect(request.command).toBe('tx')
  if (r.source.includes('round3-r2')) {
   const retained=JSON.parse(await readFile('docs/evidence/round3-r2/ledger-responses.json','utf8'))
   ws.send(JSON.stringify({id:request.id,result:retained.find((x:{hash:string})=>x.hash===r.hash).response})); return
  }
  const t:Record<string,unknown>={TransactionType:r.operation ?? 'Payment',Fee:r.feeDrops,Account:r.from,Destination:r.to,InvoiceID:r.invoiceId,Amount:r.deliveredAmount??r.amountDrops}
  if(r.group==='escrow')Object.assign(t,{TransactionType:({create:'EscrowCreate',finish:'EscrowFinish',cancel:'EscrowCancel'} as Record<string,string>)[r.operation],Account:r.owner,Owner:r.owner,Sequence:r.createSequence,OfferSequence:r.createSequence,Destination:r.destination})
  if(r.condition)t.Condition=r.condition
  if(r.operation==='create' && r.label) { const p=JSON.parse(await readFile(r.source.includes('round2-v1')?'docs/evidence/round2-v1/proof.json':'docs/evidence/round2-r/happy-receipt.json','utf8'));const terms=p.quote?.terms ?? p.proofs[0].keyReveal.quote.terms; if(r.hash===(p.createHash ?? p.proofs?.[0].keyReveal.createHash))t.Memos=[{Memo:{MemoType:Buffer.from('researchagent/escrow-v1').toString('hex').toUpperCase(),MemoData:Buffer.from(JSON.stringify(terms)).toString('hex').toUpperCase()}}] }
  if(r.keyReveal) { t.Condition=r.keyReveal.condition; const p=JSON.parse(await readFile(r.source.includes('round2-v1')?'docs/evidence/round2-v1/proof.json':'docs/evidence/round2-r/happy-receipt.json','utf8')); t.Fulfillment='A0228020'+(p.key ?? p.proofs[0].keyReveal.key) }
  if(r.group==='anchor')Object.assign(t,{TransactionType:'AccountSet',Account:r.account,Memos:[{Memo:{MemoType:Buffer.from('researchagent/anchor-v1').toString('hex').toUpperCase(),MemoData:Buffer.from(r.head+':').toString('hex').toUpperCase()+'A'.repeat(128)}}]})
  if(r.credentialTypeText)Object.assign(t,{Account:r.operation==='CredentialCreate'?r.issuer:r.subject,Subject:r.subject,Issuer:r.issuer,CredentialType:Buffer.from(r.credentialTypeText).toString('hex').toUpperCase()})
  ws.send(JSON.stringify({id:request.id,result:{hash:r.hash,validated:true,ledger_index:r.ledgerIndex,tx_json:t,meta:{TransactionResult:'tesSUCCESS',delivered_amount:r.deliveredAmount}}}))
 }))
 await page.goto(url)
 await expect(page.getByRole('status')).toContainText('45/45 validated')
 await expect(page.locator('.state.verified')).toHaveCount(45)
 await expect(page.locator('caption')).toContainText('45 curated')
 await expect(page.locator('a[href*="blob/main"]')).toHaveCount(0)
})

test('fair exchange checks ledger key, ciphertext and authenticated decryption', async ({page}) => {
 await page.goto(url)
 const results = await page.evaluate(async () => {
  const data = await (await fetch('/transactions.json')).json()
  const row = data.rows.find((r:{keyReveal?:unknown}) => r.keyReveal)
  const create = row.keyReveal.create
  const body = (r:typeof row, tx:Record<string,unknown>) => ({result:{hash:r.hash,validated:true,ledger_index:r.ledgerIndex,meta:{TransactionResult:'tesSUCCESS'},tx_json:{Fee:r.feeDrops,Owner:r.owner,OfferSequence:r.createSequence,...tx}}})
  const c = body(create,{TransactionType:'EscrowCreate',Account:create.owner,Destination:create.destination,Sequence:create.createSequence,Amount:create.amountDrops,Condition:row.keyReveal.condition,Memos:[{Memo:{MemoType:'72657365617263686167656E742F657363726F772D7631'.toUpperCase(),MemoData:Array.from(new TextEncoder().encode(JSON.stringify(row.keyReveal.terms)), b=>b.toString(16).padStart(2,'0')).join('').toUpperCase()}}]})
  return {row,c}
 })
 const receipt = JSON.parse(await readFile('docs/evidence/round2-r/happy-receipt.json','utf8'))
 const statuses = await page.evaluate(async ({row,c,key}) => {
  // @ts-expect-error standalone browser module
  const {fairExchange} = await import('/ledger.js')
  const f={result:{hash:row.hash,validated:true,ledger_index:row.ledgerIndex,meta:{TransactionResult:'tesSUCCESS'},tx_json:{TransactionType:'EscrowFinish',Fee:row.feeDrops,Owner:row.owner,OfferSequence:row.createSequence,Condition:row.keyReveal.condition,Fulfillment:'A0228020'+key}}}
  const bad = structuredClone(f); bad.result.tx_json.Fulfillment='A0228020'+'00'.repeat(32)
  const changed=structuredClone(row); changed.keyReveal.ciphertext='00'+changed.keyReveal.ciphertext.slice(2)
  return [await fairExchange(row,f,c),await fairExchange(row,bad,c),await fairExchange(changed,f,c),await fairExchange(row,{},c)]
 }, {...results,key:receipt.proofs[0].keyReveal.key})
 expect(statuses[0]).toContain('sha256(K) = Condition ✓')
 expect(statuses[0]).toContain('AES-GCM decrypt ✓')
 expect(statuses.slice(1).every(s=>s.startsWith('Fair-exchange proof failed'))).toBe(true)
})
