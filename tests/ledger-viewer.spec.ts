import { test, expect } from '@playwright/test'
import { createServer, type Server } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import AxeBuilder from '@axe-core/playwright'
let server:Server, url:string
test.beforeAll(async()=>{server=createServer(async(req,res)=>{try{const name=(req.url??'/').split('?')[0];if(!['/','/index.html','/ledger.js','/style.css','/transactions.json'].includes(name)){res.writeHead(404).end();return}res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.json')?'application/json':name.endsWith('.css')?'text/css':'text/html');res.end(await readFile(resolve('site/ledger',name==='/'?'index.html':name.slice(1))))}catch{res.writeHead(404).end()}});await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));url=`http://127.0.0.1:${(server.address() as {port:number}).port}`})
test.afterAll(async()=>{await new Promise<void>(r=>server.close(()=>r()))})
test('offline evidence, keyboard and accessibility',async({page})=>{await page.goto(url);await expect(page.locator('tbody tr')).toHaveCount(9);await expect(page.getByRole('link',{name:'Download public evidence JSON'})).toHaveAttribute('download','');await page.getByRole('button').focus();await expect(page.getByRole('button')).toBeFocused();const a=await new AxeBuilder({page}).analyze();expect(a.violations.filter(v=>['serious','critical'].includes(v.impact??''))).toEqual([])})
test('CORS and unavailable history retain snapshot',async({page})=>{await page.route('https://testnet.xrpl-labs.com/',r=>r.abort());await page.goto(url);await expect(page.locator('tbody tr')).toHaveCount(9);await page.getByRole('button').click();await expect(page.getByRole('status')).toContainText('finished');await expect(page.locator('.state').first()).toContainText('Historical')})
test('stubbed v2 response states are conservative',async({page})=>{
 await page.goto(url)
 const statuses=await page.evaluate(async()=>{
  // @ts-expect-error Browser imports the standalone module from the ephemeral test server.
  const {classify}=await import('/ledger.js')
  const data=await(await fetch('/transactions.json')).json();const r=data.rows[0]
  const valid={result:{hash:r.hash,ledger_index:r.ledgerIndex,validated:true,tx_json:{TransactionType:'Payment',Account:r.from,Destination:r.to,InvoiceID:r.invoiceId,Fee:r.feeDrops},meta:{TransactionResult:'tesSUCCESS',delivered_amount:r.deliveredAmount}}}
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
 expect(statuses[0]).toContain('Freshly verified');expect(statuses.slice(1).every((s:string)=>s.startsWith('Historical'))).toBe(true)
})
