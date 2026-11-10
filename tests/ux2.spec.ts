import { test, expect } from '@playwright/test'
import { DEMO_QUESTIONS } from '../shared/contracts/examples'
import AxeBuilder from '@axe-core/playwright'
import { evidencePath } from './evidence-path'
import { mkdir, writeFile } from 'node:fs/promises'
const dir = process.env.UX2_SCREENSHOTS ?? '.playwright/evidence/ux2'
test('UX-2: UC4, exact lead citation, export, supporting screens and mobile Spend', async ({ page }) => {
  await mkdir(dir, { recursive: true })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/?pace=real')
  await expect(page.getByRole('region', { name: "What’s real here" })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('textbox', { name: 'Your question' }).fill(DEMO_QUESTIONS.find(q => q.id === 'UC4')!.text)
  await page.getByRole('button', { name: /^Ask/ }).click()
  await page.getByRole('button', { name: 'Start now' }).click()
  await expect(page).toHaveTitle(/Answer ready/)
  await expect(page.locator('.ra-activity-details')).not.toHaveAttribute('open', '')
  await page.locator('.ra-activity-details > summary').click()
  await expect(page.locator('.ra-activity-details')).toHaveAttribute('open', '')
  await page.locator('.ra-activity-details > summary').click()
  await expect(page.locator('.ra-vtext')).toContainText('15 August 2026')
  await expect(page.getByRole('region', { name: 'Requested facts' })).toHaveCount(0) // native details, not a redundant landmark
  await expect(page.getByText('3 of 3 answered', { exact: false })).not.toBeVisible()
  await page.locator('.ra-answer-work > summary').click()
  await expect(page.getByText('3 of 3 answered', { exact: false })).toBeVisible()
  await page.screenshot({ path: `${dir}/uc4.jpg`, quality: 70 })
  await page.locator('.ra-vtext .ra-cite').first().click()
  await expect(page.getByRole('dialog')).toContainText('Passage')
  await expect(page.locator('.ra-passage mark')).toContainText('15 August 2026')
  await page.keyboard.press('Escape')
  await page.getByRole('region', { name: 'Sources', exact: true }).getByRole('button', { name: 'View all' }).click()
  await expect(page.getByRole('dialog', { name: 'All sources' })).toContainText('Writer / access')
  await page.keyboard.press('Escape')
  await page.locator('.ra-export > summary').click()
  // UC4 is fully covered by free evidence; no paid comparison should be offered.
  await expect(page.getByRole('button', { name: 'See what changed after the purchase' })).toHaveCount(0)
  await page.locator('.ra-export > summary').click()
  await page.getByRole('button', { name: /Writers/ }).click()
  await expect(page.getByRole('columnheader', { name: 'Promise checks passed / failed' })).toBeVisible()
  await page.screenshot({ path: `${dir}/writers.jpg`, quality: 70 })
  await page.keyboard.press('Control+1')
  await page.keyboard.press('w')
  await expect(page.getByText('What the agent did, in order.')).toBeVisible()
  await page.screenshot({ path: `${dir}/show-work.jpg`, quality: 70 })
  await page.keyboard.press('Escape')
  await page.keyboard.press('Control+k')
  await expect(page.getByRole('combobox')).toHaveAttribute('placeholder','Search actions, runs and examples')
  await expect(page.getByRole('dialog')).not.toContainText('UC2')
  await page.screenshot({ path: `${dir}/palette.jpg`, quality: 70 })
  await page.keyboard.press('Escape')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.locator('.ra-mobile-spend > button').click()
  const sheet = page.getByRole('dialog', { name: 'Spend and payments' })
  await expect(sheet).toBeVisible()
  await expect(sheet).toContainText('S$0.00')
  expect((await new AxeBuilder({ page }).analyze()).violations.filter(v => ['serious','critical'].includes(v.impact ?? ''))).toEqual([])
  await page.screenshot({ path: `${dir}/mobile-spend.jpg`, quality: 70 })
  await page.keyboard.press('Escape')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Show sidebar' }).click()
  await page.getByRole('button', { name: 'Writers', exact: true }).click()
  await expect(page.getByText('Each writer carries an authorship label. Sales and trust below come from your history.')).toBeVisible()
  await writeFile(`${dir}/environment.txt`, 'Local Chromium; offline demo; simulated payments; no live providers or Testnet.\n')
})

test('paid UC2 export opens the before/after comparison and returns to the answer', async ({ page }) => {
  await page.goto('/?pace=real')
  await page.getByRole('button', { name: /^Kestrel–TSMC outlook/ }).click()
  await page.getByRole('button', { name: /^Ask/ }).click()
  await page.getByRole('button', { name: 'pricing & margins' }).click()
  await page.getByRole('button', { name: 'Start now' }).click()
  await expect(page).toHaveTitle(/Answer ready/)
  await expect(page.getByRole('region', { name: 'Sources', exact: true })).toContainText('1 bought · 0 refunded')
  await page.locator('.ra-export > summary').click()
  await page.getByRole('button', { name: 'See what changed after the purchase' }).click()
  await expect(page.getByRole('region', { name: 'What changed after the purchase' })).toBeVisible()
  await page.getByRole('button', { name: 'Back to answer' }).click()
  await expect(page.locator('.ra-vtext')).toContainText('55.2%')
})

test('completed Testnet answer gets its anchor without a reload and polling stops', async ({ page }) => {
  const { readFile } = await import('node:fs/promises')
  const run = JSON.parse(await readFile('src/fixtures/uc/uc2.json', 'utf8'))
  // Use the contract's exact settlement label, with fixture content and stubbed ledger evidence.
  const { XRPL_LABEL } = await import('../shared/contracts/publisher')
  run.labels.settlement = XRPL_LABEL
  run.events.at(-1).at = new Date().toISOString()
  let reads = 0
  let ready = false
  await page.route(`**/runs/${run.runId}/events`, route => route.fulfill({ contentType: 'text/event-stream', body: ': heartbeat\n\n' }))
  await page.route(`**/runs/${run.runId}`, route => {
    reads++
    return route.fulfill({ json: { ...run, ...(ready ? { ledgerAnchor: { version: 'anchor-v1', network: 'xrpl:1', txHash: 'A'.repeat(64), account: 'rNtb7gEMUHyPUR6B39HQLkEhUtrYtY7NNf', head: 'b'.repeat(64), runIdHash: 'c'.repeat(64), ledgerIndex: 123, feeDrops: '12' } } : {}) } })
  })
  await page.goto(`/?run=${run.runId}&pace=real`)
  await expect(page.getByText('Anchoring…', { exact: true }).first()).toBeVisible()
  ready = true
  const anchor = page.getByRole('link', { name: 'Anchored on XRPL · anchor fee 12 drops (Testnet) · ledger 123' }).first()
  await expect(anchor).toHaveAttribute('href', `https://testnet.xrpl.org/transactions/${'A'.repeat(64)}`)
  const stoppedAt = reads
  await page.waitForTimeout(4500)
  expect(reads).toBe(stoppedAt)
})

test('"Anchoring… awaiting validation" keeps polling and resolves to the anchor without a reload', async ({ page }) => {
  const { readFile } = await import('node:fs/promises')
  const run = JSON.parse(await readFile('src/fixtures/uc/uc2.json', 'utf8'))
  const { XRPL_LABEL } = await import('../shared/contracts/publisher')
  run.labels.settlement = XRPL_LABEL
  run.events.push({ id: 9999, runId: run.runId, type: 'SNAPSHOT', label: 'Anchoring… awaiting validation', at: new Date().toISOString() })
  let reads = 0
  await page.route(`**/runs/${run.runId}/events`, route => route.fulfill({ contentType: 'text/event-stream', body: ': heartbeat\n\n' }))
  await page.route(`**/runs/${run.runId}`, route => {
    reads++
    return route.fulfill({ json: { ...run, ...(reads > 3 ? { ledgerAnchor: { version: 'anchor-v1', network: 'xrpl:1', txHash: 'A'.repeat(64), account: 'rNtb7gEMUHyPUR6B39HQLkEhUtrYtY7NNf', head: 'b'.repeat(64), runIdHash: 'c'.repeat(64), ledgerIndex: 456, feeDrops: '12' } } : {}) } })
  })
  await page.goto(`/?run=${run.runId}&pace=real`)
  await expect(page.getByText('Anchoring… awaiting validation', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Anchor unavailable', { exact: false })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Anchored on XRPL · anchor fee 12 drops (Testnet) · ledger 456' }).first()).toBeVisible({ timeout: 15_000 })
})

test('an anchored no-purchase decline shows its ledger proof and the Export menu', async ({ page }) => {
  const { readFile } = await import('node:fs/promises')
  const run = JSON.parse(await readFile('src/fixtures/uc/uc2.json', 'utf8'))
  const { XRPL_LABEL } = await import('../shared/contracts/publisher')
  Object.assign(run, { labels: { ...run.labels, settlement: XRPL_LABEL }, answers: [], receipts: [], intents: [], contents: [], phase: 'DONE', stopped: false, spentMinor: 0, reservedMinor: 0,
    events: run.events.filter((e: { type: string }) => e.type !== 'FREE_DRAFT'), ledgerAnchor: { version: 'anchor-v1', network: 'xrpl:1', txHash: 'B'.repeat(64), account: 'rNtb7gEMUHyPUR6B39HQLkEhUtrYtY7NNf', head: 'b'.repeat(64), runIdHash: 'c'.repeat(64), ledgerIndex: 22152330, feeDrops: '12' } })
  await page.route(`**/runs/${run.runId}/events`, route => route.fulfill({ contentType: 'text/event-stream', body: ': heartbeat\n\n' }))
  await page.route(`**/runs/${run.runId}`, route => route.fulfill({ json: run }))
  await page.goto(`/?run=${run.runId}&pace=real`)
  const proof = page.getByRole('link', { name: 'Anchored on XRPL · no purchase · anchor fee 12 drops (Testnet) · ledger 22152330' })
  await expect(proof).toBeVisible()
  await expect(proof).toHaveAttribute('href', `https://testnet.xrpl.org/transactions/${'B'.repeat(64)}`)
  await expect(page.locator('.ra-export > summary')).toBeVisible()
})

test('anchor waiting ends after its bounded deadline', async ({ page }) => {
  const { readFile } = await import('node:fs/promises')
  const { XRPL_LABEL } = await import('../shared/contracts/publisher')
  const run = JSON.parse(await readFile('src/fixtures/uc/uc2.json', 'utf8'))
  run.labels.settlement = XRPL_LABEL
  run.events.at(-1).at = new Date().toISOString()
  await page.route(`**/runs/${run.runId}/events`, route => route.fulfill({ contentType: 'text/event-stream', body: ': heartbeat\n\n' }))
  await page.route(`**/runs/${run.runId}`, route => route.fulfill({ json: run }))
  await page.clock.install()
  await page.goto(`/?run=${run.runId}&pace=real`)
  await expect(page.getByText('Anchoring…', { exact: true }).first()).toBeVisible()
  await page.clock.fastForward(91_000)
  await expect(page.getByText('Anchor unavailable (no validated anchor recorded)', { exact: true }).first()).toBeVisible()
})

for (const viewport of [{width:1440,height:900},{width:1280,height:800}]) {
 test(`Lane K popover clears Ask at ${viewport.width}`, async ({page}) => {
  await page.setViewportSize(viewport)
  await page.goto('/')
  const pop=page.locator('#environment-details')
  await expect(pop).toBeVisible()
  // Measure both boxes in one evaluation so no layout shift can land between the two reads, then again once fonts settle.
  const overlap = () => page.evaluate(() => { const a = document.querySelector('button.ra-ask')!.getBoundingClientRect(), b = document.querySelector('#environment-details')!.getBoundingClientRect(); return a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y })
  expect(await overlap()).toBe(false) // first paint
  await page.evaluate(() => document.fonts.ready)
  for (let i = 0; i < 8; i++) { expect(await overlap()).toBe(false); await page.waitForTimeout(60) } // settled, and while the layout keeps moving
  const h=await page.locator('h1').first().boundingBox()
  expect(h!.y).toBeGreaterThanOrEqual(0)
  expect(h!.y+h!.height).toBeLessThan(viewport.height)
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([])
  await page.screenshot({path:evidencePath(`r5-k/popover-${viewport.width}.png`)})
 })
}
test('the first-visit environment note never opens over a deep-linked result', async ({ page }) => {
 const { readFile } = await import('node:fs/promises')
 const run = JSON.parse(await readFile('src/fixtures/uc/uc2.json', 'utf8'))
 await page.route(`**/runs/${run.runId}/events`, route => route.fulfill({ contentType: 'text/event-stream', body: ': heartbeat\n\n' }))
 await page.route(`**/runs/${run.runId}`, route => route.fulfill({ json: run }))
 await page.goto(`/?run=${run.runId}&pace=real`)
 await expect(page.getByRole('region', { name: 'Research answer' })).toBeVisible()
 await page.waitForTimeout(500)
 await expect(page.locator('#environment-details')).toHaveCount(0)
 await expect(page.getByRole('button', { name: /Demo · simulated payments/ })).toBeVisible() // the indicator itself stays
})

test('Lane K decline explains three policy decisions', async ({page}) => {
 const {readFile}=await import('node:fs/promises')
 const base=JSON.parse(await readFile('src/fixtures/uc/uc2.json','utf8'))
 const row=base.decisions[0].rows.find((r: {candidate:{tier:string}})=>r.candidate.tier==='PAID')
 const rows=[1,2,3].map(n=>({...row,candidate:{...row.candidate,resourceId:`tickets-${n}`,title:`Synthetic Tickets note ${n}`},value:0.159,verdict:'SKIP_LOW_VALUE',reason:`Synthetic fixture: insufficient incremental value ${n}`}))
 const run={...base,contents:[],grants:[],checkpoint:{},spentMinor:0,reservedMinor:0,runId:'tickets-decline',question:'Synthetic Tickets question',phase:'DONE',answers:[],intents:[],receipts:[],candidates:rows.map(r=>r.candidate),decisions:[{...base.decisions[0],threshold:0.2,rows}],events:[{id:1,runId:'tickets-decline',type:'FREE_DRAFT',label:'Synthetic fixture',at:'2026-11-07T00:00:03Z',data:{elapsedMs:3000}},{id:2,runId:'tickets-decline',type:'DONE',label:'Synthetic fixture',at:'2026-11-07T00:00:05Z'}]}
 await page.addInitScript(()=>localStorage.setItem('researchagent.environment-seen','1'))
 await page.route('**/runs/tickets-decline/events',route=>route.fulfill({contentType:'text/event-stream',body:': heartbeat\n\n'}))
 await page.route('**/runs/tickets-decline',route=>route.fulfill({json:run}))
 await page.goto('/?run=tickets-decline&pace=real')
 const answer=page.getByRole('region',{name:'Research answer'})
 await expect(answer).toContainText('Nothing was bought: the available articles do not add enough relevant evidence.')
 await expect(answer.locator('.ra-why-value').first()).not.toBeVisible()
 await answer.getByText('Why nothing was bought').click()
 await expect(answer).toContainText('value 0.16 vs 0.20')
 await expect(answer.locator('li')).toHaveCount(3)
 await expect(page.getByRole('region',{name:'Run activity'})).toContainText('5.0 s')
 await page.screenshot({path:evidencePath('r5-k/decline-state.png'),fullPage:true})
})
