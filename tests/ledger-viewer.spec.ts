import { test, expect } from '@playwright/test'
import { createServer, type Server } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import AxeBuilder from '@axe-core/playwright'
let server:Server, url:string
test.beforeEach(async({page})=>{ await page.routeWebSocket(/wss:\/\/.*/,ws=>ws.close()) })
test.beforeAll(async()=>{server=createServer(async(req,res)=>{try{const name=(req.url??'/').split('?')[0];if(!['/','/index.html','/ledger.js','/style.css','/transactions.json'].includes(name)){res.writeHead(404).end();return}res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.json')?'application/json':name.endsWith('.css')?'text/css':'text/html');res.end(await readFile(resolve('site/ledger',name==='/'?'index.html':name.slice(1))))}catch{res.writeHead(404).end()}});await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));url=`http://127.0.0.1:${(server.address() as {port:number}).port}`})
test.afterAll(async()=>{await new Promise<void>(r=>server.close(()=>r()))})
test('offline evidence, keyboard and accessibility',async({page})=>{await page.goto(url);await expect(page.locator('tbody tr')).toHaveCount(16);await expect(page.getByRole('link',{name:'Download public evidence JSON'})).toHaveAttribute('download','');await expect(page.getByRole('button')).toBeEnabled();await page.getByRole('button').focus();await expect(page.getByRole('button')).toBeFocused();const a=await new AxeBuilder({page}).analyze();expect(a.violations.filter(v=>['serious','critical'].includes(v.impact??''))).toEqual([])})
test('CORS and unavailable history retain snapshot',async({page})=>{await page.goto(url);await expect(page.locator('tbody tr')).toHaveCount(16);await expect(page.getByRole('status')).toContainText('finished');await expect(page.locator('.state').first()).toContainText('Historical')})
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
 await page.routeWebSocket(/wss:\/\/.*/,ws=>ws.onMessage(raw=>{
  const request=JSON.parse(String(raw)), r=data.rows.find((r:{hash:string})=>r.hash===request.transaction)
  expect(request.command).toBe('tx')
  const t={TransactionType:r.operation ?? 'Payment',Fee:r.feeDrops,Account:r.from,Destination:r.to,InvoiceID:r.invoiceId,Amount:r.deliveredAmount??r.amountDrops}
  if(r.group==='escrow')Object.assign(t,{TransactionType:({create:'EscrowCreate',finish:'EscrowFinish',cancel:'EscrowCancel'} as Record<string,string>)[r.operation],Account:r.owner,Owner:r.owner,Sequence:r.createSequence,OfferSequence:r.createSequence})
  if(r.credentialTypeText)Object.assign(t,{Account:r.operation==='CredentialCreate'?r.issuer:r.subject,Subject:r.subject,Issuer:r.issuer,CredentialType:Buffer.from(r.credentialTypeText).toString('hex').toUpperCase()})
  ws.send(JSON.stringify({id:request.id,result:{hash:r.hash,validated:true,ledger_index:r.ledgerIndex,tx_json:t,meta:{TransactionResult:'tesSUCCESS',delivered_amount:r.deliveredAmount}}}))
 }))
 await page.goto(url)
 await expect(page.getByRole('status')).toContainText('16/16 validated')
 await expect(page.locator('.state.verified')).toHaveCount(16)
 await expect(page.locator('caption')).toContainText('16 curated')
 await expect(page.locator('a[href*="blob/main"]')).toHaveCount(0)
})
