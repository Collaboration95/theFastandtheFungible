import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
// node evolution/check_sff.mjs <main checkout with npm ci installed>
if (!process.argv[2]) throw new Error('Pass the main checkout (Playwright and axe dependencies).')
const require=createRequire(resolve(process.argv[2], 'package.json'))
const {chromium}=require('playwright');const AxeBuilder=require('@axe-core/playwright').default
const root=resolve(dirname(fileURLToPath(import.meta.url)), '..')
const server=spawn('python3',['-u','-m','http.server','0','--bind','127.0.0.1','--directory',root],{stdio:['ignore','pipe','ignore']})
const port=await new Promise((resolve,reject)=>{server.stdout.on('data',b=>{const m=/port (\d+)/.exec(String(b));if(m)resolve(m[1])});server.on('error',reject);server.on('exit',code=>reject(new Error(`server exited ${code}`)))})
const browser=await chromium.launch()
try{
 const context=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'});const page=await context.newPage()
 const errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.goto(`http://127.0.0.1:${port}/evolution/`)
 const dataText=readFileSync(root+'/evolution/data.js','utf8')
 const data=JSON.parse(dataText.split('window.EVO = ')[1].trim().replace(/;$/,''))
 assert.equal(await page.locator('.sff-day').count(),data.sff.cards.length)
 if(!data.sff.scorecard.length)assert.match(await page.locator('#sff-score-note').textContent(),/Coming soon/)
 await page.locator('#sff').scrollIntoViewIfNeeded()
 const violations=(await new AxeBuilder({page}).include('#sff').analyze()).violations
 assert.deepEqual(violations,[])
 assert.equal(await page.locator('.sff-day').first().evaluate(e=>getComputedStyle(e).animationName),'none')
 // No screenshots are committed as test evidence; assertions inspect the rendered page.
 await page.setViewportSize({width:390,height:844})
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
 
 // Synthetic data is browser-intercepted only, never committed as scorecard evidence.
 data.sff.scorecard=[
  {mode:'fixture',timestamp:'2026-11-02',sha:'a'.repeat(40),metrics:{wastedSpendPct:39.5,selectionF1:null,costPerQuery:0}},
  {mode:'fixture',timestamp:'2026-11-03',sha:'b'.repeat(40),metrics:{wastedSpendPct:20,selectionF1:0.5,costPerQuery:0}},
  {mode:'LIVE',timestamp:'2026-11-03',sha:'c'.repeat(40),metrics:{wastedSpendPct:30,selectionF1:0.4,costPerQuery:0.01}},
 ]
 await page.route('**/data.js',route=>route.fulfill({contentType:'text/javascript',body:'window.EVO = '+JSON.stringify(data)+';'}))
 await page.reload()
 assert.equal(await page.locator('.sff-series').count(),6)
 const f1=page.locator('.sff-series').filter({has:page.getByRole('heading',{name:'fixture / selectionF1',exact:true})})
 assert.equal(await f1.locator('circle').count(),1)
 assert.match(await page.locator('#sff-score-note').textContent(),/Fixture and live runs are separate/)
 assert.deepEqual((await new AxeBuilder({page}).include('#sff').analyze()).violations,[])
 // v1 uses at/quality/timing/cost/audit and may come from a modified worktree.
 data.sff.scorecard=[{schema:'tftf.scorecard/v1',at:'2026-11-03T00:00:00Z',commit:'d'.repeat(40),mode:'fixture',inputHash:'1'.repeat(64),worktreeDirty:true,labels:{settlement:'SIMULATED test row'},quality:{wastedSpendPct:0,selectionF1Flow:.31},timing:{p95FirstAnswerMs:147,coldStartMs:730},cost:{latencyModelUsdPerQuery:null},audit:{total:0},external:{dmgColdStartMs:null}}]
 await page.reload()
 assert.equal(await page.locator('.sff-series').count(),5)
 assert.match(await page.locator('.sff-series').first().textContent(),/2026-11-03T00:00:00Z/)
 assert.match(await page.locator('.sff-series').first().textContent(),/working tree modified/)
 await page.getByText('Measurement conditions',{exact:true}).click()
 assert.equal(await page.getByText(/SIMULATED test row/).count(),1)
 assert.equal(await page.getByRole('heading',{name:/Hard-gate violations/}).count(),1)
 assert.deepEqual((await new AxeBuilder({page}).include('#sff').analyze()).violations,[])
 assert.deepEqual(errors,[])
 console.log(`PASS: ${data.sff.cards.length} day cards, missing-history fallback, six fixture/LIVE sparklines + v1 schema, null/dirty provenance preserved, axe clean, 390px reflow, reduced motion; python server used ephemeral port ${port}`)
}finally{await browser.close();server.kill('SIGTERM')}
