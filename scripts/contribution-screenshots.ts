/** Local UI proof, fixture wrapper only, ephemeral Vite listener. */
import { mkdir, writeFile } from 'node:fs/promises'
import { createServer } from 'vite'
import { chromium } from 'playwright'
import AxeBuilder from '@axe-core/playwright'
await mkdir('scratch', {recursive:true})
await writeFile('scratch/lane-g-proof.tsx', `import React from 'react'; import {createRoot} from 'react-dom/client'; import ReceiptSheet from '../src/components/ReceiptSheet'; import {exampleRun} from '../shared/contracts/examples'; import useful from '../docs/evidence/round2-g/useful.receipts.json'; import redundant from '../docs/evidence/round2-g/redundant.receipts.json'; import refunded from '../docs/evidence/round2-g/refunded.receipts.json'; import '../src/styles.css'; const name=location.hash.slice(1);const b=({useful,redundant,refunded})[name]??useful;const run={...exampleRun,runId:b.runId,labels:{...exampleRun.labels,settlement:b.receipts[0]?.label??exampleRun.labels.settlement},contents:b.sources,candidates:b.candidates,answers:b.answers,intents:b.intents,grants:b.grants,receipts:b.receipts}; const receipt=name==='refunded'?b.receipts.find(r=>b.intents.some(i=>i.intentId===r.intentId&&i.refund)):b.receipts[0];createRoot(document.getElementById('root')!).render(<main><h1>Fixture receipt inspection</h1><p>Synthetic content · offline proof · historical refunds retain original rail labels</p><ReceiptSheet run={run} receipt={receipt} onClose={()=>document.querySelector('dialog').close()}/></main>);`)
await writeFile('scratch/lane-g-proof.html','<!doctype html><html lang="en"><meta charset="utf-8"><title>Receipt fixture</title><div id="root"></div><script type="module" src="/scratch/lane-g-proof.tsx"></script></html>')
const vite=await createServer({server:{host:'127.0.0.1',port:0},logLevel:'error'});await vite.listen()
const browser=await chromium.launch();const context=await browser.newContext({viewport:{width:1100,height:1400}});const page=await context.newPage()
const results=[]
await page.route('**/runs/**/receipts.json', route => route.fulfill({json:{payments:[]}}))
try {
 for(const name of ['useful','redundant','refunded']) {
  await page.goto(`http://127.0.0.1:${(vite.httpServer!.address() as {port:number}).port}/scratch/lane-g-proof.html#${name}`)
  await page.reload();await page.getByRole('dialog',{name:'Receipt',exact:true}).waitFor()
  const detail=page.locator('section[aria-label="What your money bought"] details').first()
  if(await detail.count()) { await detail.locator(':scope > summary').focus(); await page.keyboard.press('Enter'); if(!await detail.getAttribute('open').then(v => v !== null)) throw new Error('Keyboard disclosure failed') }
  const violations=(await new AxeBuilder({page}).analyze()).violations.filter(v=>['serious','critical'].includes(v.impact??''))
  if(violations.length) throw new Error(JSON.stringify(violations))
  await page.screenshot({path:`docs/evidence/round2-g/${name}.png`,fullPage:true})
  await page.keyboard.press('Escape');if(await page.getByRole('dialog').isVisible())throw new Error('Escape did not close receipt')
  results.push({name,serious:0,critical:0,keyboardEscape:true})
 }
 await writeFile('docs/evidence/round2-g/accessibility.json',JSON.stringify(results,null,2)+'\n')
}finally{await browser.close();await vite.close()}
