// UI evidence fixtures are committed recordings, never a claim of live model or Testnet execution.
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { readFileSync, writeFileSync } from 'node:fs'
import { evidencePath } from './evidence-path'
const recording = JSON.parse(readFileSync('demo/traces/UC3-key-reveal.json','utf8'))
const decline = JSON.parse(readFileSync('demo/traces/UC1.json','utf8'))
const status={state:'ready',csrfToken:'ui-test',queue:[],capabilities:{ask:true,scope:true,history:true,receipts:true,pdf:false,settings:false,faultControls:false},remaining:{questions:5,minor:1000},labels:{models:'fixture models',rail:'SIMULATED · no real value'},links:{repo:'https://github.com/Collaboration95/theFastandtheFungible',deck:'',video:'',progress:'',replay:''}}
for (const mode of ['local','hosted']) for (const width of [1440,390]) test(`${mode} money and accessible overlays at ${width}`, async({page})=>{
 test.setTimeout(120_000)
 await page.setViewportSize({width,height:900}); await page.emulateMedia({reducedMotion:'reduce'})
 const errors:string[]=[],expectedNetworkErrors:string[]=[];page.on('pageerror', e=>errors.push(e.message));page.on('console',message=>{if(message.type()!=='error')return;const url=message.location().url;if(/\/api\/(ledger|demo\/status)(?:[?/#]|$)/.test(url)&&/Failed to load resource/.test(message.text()))expectedNetworkErrors.push(message.text()+' '+url);else errors.push(message.text()+' '+url)})
 let current=recording
 await page.route('**/api/demo/status',r=>mode==='hosted'?r.fulfill({json:status}):r.fulfill({status:404,json:{}}))
 await page.route('**/api/health',r=>r.fulfill({json:recording.health}))
 await page.route('**/api/runs',r=>r.fulfill({json:[]}))
 await page.route('**/runs/*/receipts.json',r=>r.fulfill({json:JSON.parse(readFileSync('docs/evidence/replay-nov11/key-reveal/UC3.receipts.json','utf8'))}))
 await page.route('**/runs/*/events*',r=>r.fulfill({contentType:'text/event-stream',body:''}))
 await page.route('**/runs/*',r=>r.fulfill({json:current.run}))
 await page.route('**/api/ledger',r=>r.fulfill({status:503,json:{}}))
 await page.route('**/api/scope',r=>r.fulfill({json:{...recording.scope,questions:[]}}))
 const audit:unknown[]=[]
 const capture=async(state:string)=>{
  const result=await new AxeBuilder({page}).analyze();audit.push({state,violations:result.violations})
  await page.screenshot({path:evidencePath(`ui-nov11/after/${mode}/${state}-${width}.png`),fullPage:true})
  expect.soft(result.violations, state).toEqual([])
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),state).toBe(true)
 }
 await page.goto('/');await expect(page.locator('.ra-qbox')).toBeVisible();await capture('home')
 await page.locator('.ra-presets button').first().click();await page.getByRole('button',{name:/^Ask/}).click()
 await expect(page.getByRole('button',{name:'Start now'})).toBeVisible();await capture('plan')
 await expect(page.getByRole('timer')).toContainText('paused');await page.waitForTimeout(5200)
 await expect(page.getByRole('button',{name:'Start now'})).toBeVisible() // reduced motion never starts silently
 await page.getByRole('button',{name:'Cancel',exact:true}).click()
 await page.goto(`/?run=${recording.run.runId}`);await expect(page.locator('.ra-q')).toBeVisible();await capture('answer')
 if(width===390){await page.locator('.ra-mobile-spend > button').click();await capture('mobile-spend')}
 const spend=page.locator('.ra-spend:visible');await spend.locator('.ra-spending-proof > summary').click();await spend.locator('.ra-run-proof > summary').click();await expect(spend.getByRole('heading',{name:'Verify on XRPL in your browser'})).toBeVisible()
 await page.getByRole('button',{name:/Receipt/}).first().click();await capture('receipt');await page.keyboard.press('Escape')
 await page.locator('.ra-cite').first().click();await capture('citation');await expect.soft(page.locator('.ra-dr-b')).toHaveAttribute('tabindex','0');await page.keyboard.press('Escape')
 await page.keyboard.press('w');await page.getByRole('tab',{name:'Ledger',exact:true}).click();await expect(page.getByRole('button',{name:'Retry balances'})).toBeVisible();await capture('ledger');await page.keyboard.press('Escape')
 await page.getByRole('button',{name:'View all',exact:true}).click();await capture('sources');await page.keyboard.press('Escape')
 await page.keyboard.press('ControlOrMeta+k');await capture('palette');await page.keyboard.press('Escape')
 current=decline;await page.goto(`/?run=${decline.run.runId}`);await expect(page.locator('.ra-q')).toBeVisible();await capture('decline')
 const pending=structuredClone(recording);pending.run.phase='BUY';pending.run.stopped=false;pending.run.answers=[];pending.run.receipts=[];pending.run.spentMinor=0;pending.run.refundedMinor=0;pending.run.reservedMinor=30;pending.run.intents=[{...pending.run.intents[0],status:'SUBMITTING',refund:undefined,escrow:{...pending.run.intents[0].escrow,state:'LOCKED',finishHash:undefined,revealLedger:undefined,keyVerified:undefined,decryptVerified:undefined,cancelAfter:Math.floor(Date.now()/1000)-946684800+45}}];pending.run.events=[];pending.run.checkpoint={};current=pending;await page.goto(`/?run=${pending.run.runId}`);await expect(page.locator('.ra-q')).toBeVisible();if(width===390)await page.locator('.ra-mobile-spend > button').click();await capture('escrow-hold');if(width===390)await page.keyboard.press('Escape')
 await page.goto('/?settings=1');if(mode==='local')await expect(page.getByRole('navigation',{name:'Settings sections'})).toBeVisible();else await expect(page.locator('.ra-qbox')).toBeVisible()
 await capture(mode==='local'?'settings':'settings-hidden');expect(errors).toEqual([])
 writeFileSync(evidencePath(`ui-nov11/after/${mode}/audit-${width}.json`),JSON.stringify({mode,width,audit,errors,expectedNetworkErrors},null,2))
})

for (const width of [1440,390]) test(`desktop recovery uses the shared light system at ${width}`,async({page})=>{
 await page.setViewportSize({width,height:900});await page.emulateMedia({reducedMotion:'reduce'})
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
 const assets:Record<string,[string,string]>={'recovery.html':['desktop/recovery.html','text/html'],'preferences.css':['desktop/preferences.css','text/css'],'recovery.js':['desktop/recovery.js','text/javascript'],'tokens.css':['src/tokens.css','text/css'],'geist.woff2':['node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2','font/woff2']}
 await page.route('**/desktop/*',r=>{const asset=assets[new URL(r.request().url()).pathname.split('/').pop()!];return asset?r.fulfill({body:readFileSync(asset[0]),contentType:asset[1]}):r.abort()})
 await page.goto('/desktop/recovery.html');await expect(page.getByRole('heading',{level:1,name:'Your workspace is safe'})).toBeVisible();await page.evaluate(()=>document.fonts.ready)
 const audit=await new AxeBuilder({page}).analyze();expect(audit.violations).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([])
 await page.screenshot({path:evidencePath(`ui-nov11/after/desktop/recovery-${width}.png`),fullPage:true})
 writeFileSync(evidencePath(`ui-nov11/after/desktop/audit-${width}.json`),JSON.stringify({width,violations:audit.violations,errors,evidence:'Rendered packaged recovery assets with the same URL paths. No Electron IPC or installed DMG execution claimed.'},null,2))
})

// POLISH-1: synthetic writer identity metadata; no external ledger requests or visitor questions.
test('writer credential and domain have separate 44 px phone hit areas', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.route('**/api/demo/status', r => r.fulfill({ json: status }))
  await page.route('**/api/health', r => r.fulfill({ json: recording.health }))
  await page.route('**/api/runs', r => r.fulfill({ json: [] }))
  await page.route('**/api/reputation', r => r.fulfill({ json: { publishers: [] } }))
  const verification = { status: 'verified', issuerLabel: 'ResearchAgent operator', issuer: 'rnFqpNSS2rcDoFe72cwneSzwZAhoxqduqr', credentialType: 'AB', credentialId: 'A'.repeat(64), domainId: 'B'.repeat(64), ledgerIndex: 123, checkedAt: '2026-11-12T00:00:00Z' }
  await page.route('**/api/writers/earnings', r => r.fulfill({ json: { scope: 'Synthetic layout fixture.', writers: [{ slug: 'team-xrpl-explainers', publisherSlug: 'team-xrpl-explainers', name: 'XRPL explainers', authorship: 'Team-authored', verification, articles: [], articleCount: 1, priceRange: [40], sales: [], trust: [], demoSales: 4 }] } }))
  await page.goto('/')
  await expect(page.locator('.ra-qbox')).toBeVisible()
  await page.getByRole('button', { name: 'Open commands' }).click()
  await page.getByRole('option', { name: /Writers/ }).click()
  const links = page.locator('.ra-writer-verification > a')
  await expect(links).toHaveCount(2)
  const boxes = await links.evaluateAll(elements => elements.map(el => {
    const r = el.getBoundingClientRect()
    return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height }
  }))
  for (const box of boxes) { expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44) }
  expect(boxes[0].right <= boxes[1].x || boxes[1].right <= boxes[0].x || boxes[0].bottom <= boxes[1].y || boxes[1].bottom <= boxes[0].y).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: 'scratch/polish-1-writer-phone.png', fullPage: true })
})

// Synthetic paid-answer fixture: opt-in rating UI; no providers or ledger calls.
for (const enabled of [false,true]) test(`answer value rating capability ${enabled?'enabled':'disabled'}`,async({page})=>{
 let voted:boolean|null=null,reads=0,writes=0
 await page.route('**/api/demo/status',r=>r.fulfill({json:{hosted:false}}))
 await page.route('**/api/health',r=>r.fulfill({json:{...recording.health,answerRatings:enabled}}))
 await page.route('**/api/runs',r=>r.fulfill({json:[]}))
 await page.route('**/runs/*/events*',r=>r.fulfill({contentType:'text/event-stream',body:''}))
 await page.route('**/runs/*',r=>r.fulfill({json:recording.run}))
 await page.route('**/runs/*/rating',async r=>{
  expect(enabled).toBe(true)
  if(r.request().method()==='POST'){writes++;voted=r.request().postDataJSON().yes}else reads++
  await r.fulfill({json:{yes:voted}})
 })
 const loaded=page.waitForResponse('**/api/health')
 await page.goto(`/?run=${recording.run.runId}`);await loaded
 await expect(page.locator('.ra-q')).toBeVisible()
 if(enabled){
  await expect(page.getByText(/^Worth S\$/)).toBeVisible()
  await page.getByRole('button',{name:'Yes',exact:true}).click()
  await expect(page.getByText('Thanks for your feedback.')).toBeVisible()
  await page.reload();await expect(page.getByText('Thanks for your feedback.')).toBeVisible()
  expect(reads).toBe(2);expect(writes).toBe(1)
 }else{
  await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))))
  await expect(page.getByText(/^Worth S\$/)).toHaveCount(0);expect(reads).toBe(0);expect(writes).toBe(0)
 }
})
