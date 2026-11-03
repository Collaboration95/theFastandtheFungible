/** Screenshots of existing publisher/source/answer/receipt UI with offline fixture data. */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createServer } from 'vite'
import { chromium } from 'playwright'
import { publishSite } from '../publisher/publishing/publish.js'
process.env.LLM_PROVIDER = 'fixture'; process.env.SEARCH_EMBEDDINGS = 'off'
const result = JSON.parse(await readFile('scratch/multi-origin.json','utf8'))
const out = 'docs/evidence/round2-f'; await mkdir(out,{recursive:true})
const publisher = await publishSite({ folder: `${result.root}/markdown`, root: `${result.root}/proof`, slug: 'collision', rail: 'simulated', port: 0, env: {}, log: () => {} })
await writeFile('scratch/lane-f-proof.tsx', `/* eslint-disable @typescript-eslint/no-explicit-any -- temporary fixture wrapper */\nimport React from 'react'; import {createRoot} from 'react-dom/client'; import Sources from '../src/components/Sources'; import Answer from '../src/components/Answer'; import ReceiptSheet from '../src/components/ReceiptSheet'; import {exampleRun} from '../shared/contracts/examples'; import b from '../docs/evidence/round2-f/receipt-v2.json'; import '../src/styles.css'; const run={...exampleRun,runId:b.runId,phase:'DONE',candidates:b.candidates,contents:b.sources,answers:b.answers,intents:b.intents,grants:b.grants,receipts:b.receipts}; createRoot(document.getElementById('root')!).render(<main style={{padding:32,maxWidth:1100,margin:'auto'}}><p>SYNTHETIC · SIMULATED · pinned local origins · explicit fixture rubric</p><h1>Independent writers in one search</h1><Sources run={run as any}/><Answer run={run as any} view="latest" onView={()=>{}} compare={false} onCompare={()=>{}}/><button onClick={()=>{location.hash='receipt';location.reload()}}>Open receipt</button>{location.hash && <ReceiptSheet run={run as any} receipt={run.receipts[1] as any} onClose={()=>{}}/>}</main>);`)
await writeFile('scratch/lane-f-proof.html','<!doctype html><html><div id="root"></div><script type="module" src="/scratch/lane-f-proof.tsx"></script></html>')
const vite = await createServer({ server:{host:'127.0.0.1',port:0,strictPort:false}, logLevel:'error' }); await vite.listen()
const base = `http://127.0.0.1:${(vite.httpServer!.address() as {port:number}).port}`
const browser=await chromium.launch({headless:true}); const page=await browser.newPage({viewport:{width:1280,height:900}})
try {
  await page.goto(`${publisher.baseUrl}/w/collision/`); await page.evaluate(() => document.getAnimations().forEach(a => a.finish())); await page.screenshot({path:`${out}/01-published.png`,fullPage:true})
  await page.goto(`${base}/scratch/lane-f-proof.html`); await page.getByRole('button',{name:'View all'}).click(); await page.evaluate(() => document.getAnimations().forEach(a => a.finish())); await page.screenshot({path:`${out}/02-found.png`,fullPage:true})
  await page.getByRole('button',{name:'Close sources'}).click(); await page.evaluate(() => document.getAnimations().forEach(a => a.finish())); await page.screenshot({path:`${out}/03-cited.png`,fullPage:true})
  await page.getByRole('button',{name:'Open receipt'}).click(); await page.getByRole('dialog',{name:'Receipt',exact:true}).waitFor(); await page.evaluate(() => document.getAnimations().forEach(a => a.finish())); await page.screenshot({path:`${out}/04-paid.png`,fullPage:true})
} finally {await browser.close(); await vite.close(); publisher.server.closeAllConnections(); await new Promise<void>(r=>publisher.server.close(()=>r()))}
