import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { writeFileSync } from 'node:fs'
import { evidencePath } from './evidence-path'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdir, cp, readdir, stat } from 'node:fs/promises'
import recordingIndex from '../demo/recording-index.json' with { type: 'json' }
// Python chooses an ephemeral port. Serve the actual Pages subpath, without a backend.
test('static Pages UC3: draft, verified upgrade, refund, receipt, citation and Writers', async ({ page }, info) => {
  const assets = await readdir('site/demo/assets')
  let jsBytes = 0
  for (const file of assets.filter(f => f.endsWith('.js') || f.endsWith('.json'))) jsBytes += (await stat(`site/demo/assets/${file}`)).size
  expect(jsBytes).toBeLessThan(2_000_000)
  const root = info.outputPath('pages')
  await mkdir(`${root}/theFastandtheFungible`, { recursive: true })
  await cp('site', `${root}/theFastandtheFungible`, { recursive: true })
  const python = spawn('python3', ['-u', '-m', 'http.server', '0', '--bind', '127.0.0.1', '--directory', root], { stdio: ['ignore', 'pipe', 'ignore'] })
  try {
    const [chunk] = await once(python.stdout!, 'data')
    const port = String(chunk).match(/port (\d+)/)?.[1]
    expect(port).toBeTruthy()
    const errors: string[] = [], requests: string[] = [], sockets: string[] = []
    page.on('websocket', socket => { sockets.push(socket.url()); socket.on('framesent', frame => { const message = JSON.parse(String(frame.payload)); expect(message.command).toBe('tx') }) })
    page.on('pageerror', error => errors.push(error.message))
    page.on('request', request => requests.push(request.url()))
    await page.goto(`http://127.0.0.1:${port}/theFastandtheFungible/demo/`)
    await expect(page.locator('.demo-shell > summary').getByText(/^Replay · XRPL Testnet, recorded \d{1,2} [A-Z][a-z]{2} \d{4} · fictional writers · no real value$/)).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Recorded scenario' })).toHaveValue('')
    await expect(page.getByRole('button', { name: 'Pause', exact:true })).toBeVisible()
    await page.getByRole('button', { name:'Pause', exact:true }).click()
    await expect(page.getByRole('button', { name:'Resume', exact:true })).toBeVisible()
    await page.getByRole('button', { name:'Resume', exact:true }).click()
    await expect(page.getByText('Draft · free sources only', { exact: true })).toBeVisible()
    await expect(page).toHaveTitle(/Answer ready/, { timeout: 30000 })
    await expect(page.getByText('Updated with paid evidence', { exact: true })).not.toBeVisible()
    await page.locator('.ra-answer-work > summary').click()
    await expect(page.getByText('Updated with paid evidence', { exact: true })).toBeVisible()
    await expect(page.locator('.ra-vtext')).toContainText('26 weeks to 18 weeks')
  await expect(page.locator('.ra-vtext')).not.toContainText('Supports')
  await expect(page.locator('.ra-claim').filter({ hasText: '26 weeks to 18 weeks' })).toHaveCount(0)
    await expect(page.getByRole('region', { name: /Payment: AlphaLeak/ })).toContainText('Refunded S$0.30')
    await expect(page.getByRole('region', { name: 'Payment: The Fab Floor' })).toContainText('Paid by key reveal')
    await expect(page.getByRole('region', { name: 'Sources', exact: true })).toContainText('2 bought · 1 refunded')
    const spend = page.getByRole('region', { name: 'Spend', exact: true }).first()
    await expect(spend).toContainText('S$1.30 budget left · refunds don’t restore budget'.replace('’', "'"))
    // Successful proof lives in Spend; unresolved/refund proof remains open on its card.
    await spend.locator('.ra-spending-proof > summary').click()
    // Each key-reveal proof lists its own create and finish transactions; the refund links separately.
    await expect(page.getByRole('link', { name: 'tx', exact: true })).toHaveCount(4)
    await expect(page.getByRole('link', { name: /^Refund tx [A-F0-9]{8}…[A-F0-9]{8}$/ })).toHaveCount(1)
    await expect(page.locator('p:visible', { hasText: 'Refund signed by the writer. This demo writer agrees to refund; a real writer could refuse.' })).toHaveCount(1)
    await page.screenshot({ path: info.outputPath('uc3.png'), fullPage: true })
    await page.getByRole('button', { name: /Receipt/ }).first().click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await page.locator('.ra-cite').first().click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByRole('dialog').locator('mark')).toBeVisible()
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: /^Writers/ }).click()
    await expect(page.getByText(/quarantined/i).first()).toBeVisible()
    await page.getByRole('button', { name: 'AlphaLeak' }).click()
    await expect(page.getByText(/Honesty 0\.40/)).toBeVisible()
    await page.setViewportSize({ width: 390, height: 844 })
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.locator('.demo-shell > summary').click()
    await page.getByText('Run it yourself', { exact: true }).click()
    await expect(page.getByText(/claude mcp add researchagent/)).toBeVisible()
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.keyboard.press('Meta+k')
    await page.getByRole('option', { name: /What's the analyst outlook/ }).click()
    await page.getByRole('button', { name: /^Ask$/ }).click()
    await page.getByRole('button', { name: 'Start now' }).click()
    await expect(page).toHaveTitle(/Answer ready/, { timeout: 30000 })
    await expect(page.getByRole('region', { name: /Payment: NotFinancialTimes/ })).toContainText('Verified')
    await expect(page.locator('.demo-shell > summary').getByText(/^Replay · simulated payments, recorded .* · fictional writers · no real value$/)).toBeVisible()
    await expect(page.locator('.demo-transactions')).toHaveCount(0)
    await page.goto(`http://127.0.0.1:${port}/theFastandtheFungible/demo/?scenario=UC1`)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Bank of Japan')
    await page.keyboard.press('ControlOrMeta+n')
    await page.getByRole('button', { name: /^Bank of Japan decision/ }).click()
    await page.getByRole('button', { name: /^Ask$/ }).click()
    await page.getByRole('button', { name: 'Start now' }).click()
    await expect(page).toHaveTitle(/Answer ready/, { timeout: 30000 })
    await expect(page.locator('.demo-shell > summary').getByText(/^Replay · simulated payments, recorded .* · fictional writers · no real value$/)).toBeVisible()
    expect(sockets.length).toBeLessThanOrEqual(9)
    expect(sockets.every(url => ['wss://s.altnet.rippletest.net:51233/', 'wss://clio.altnet.rippletest.net:51233/', 'wss://testnet.xrpl-labs.com/'].includes(url))).toBe(true)
    expect(errors).toEqual([])
    expect(requests.every(url => url.startsWith(`http://127.0.0.1:${port}/theFastandtheFungible/`))).toBe(true)
  } finally { python.kill('SIGTERM'); await once(python, 'exit') }
})

test('key reveal tab autoplays and preserves quarantine disclosure', async ({ page }, info) => {
 const root=info.outputPath('pages')
 await mkdir(`${root}/theFastandtheFungible`,{recursive:true})
 await cp('site',`${root}/theFastandtheFungible`,{recursive:true})
 const python = spawn('python3', ['-u','-m','http.server','0','--bind','127.0.0.1','--directory',root], {stdio:['ignore','pipe','ignore']})
 try {
  const [chunk] = await once(python.stdout!, 'data')
  const port = String(chunk).match(/port (\d+)/)?.[1]
  await page.routeWebSocket(/wss:\/\/.*/, ws => ws.close())
  await page.goto(`http://127.0.0.1:${port}/theFastandtheFungible/demo/?scenario=UC-key-reveal`)
  await expect(page.locator('.demo-shell > summary').getByText(/^Replay · XRPL Testnet, recorded/)).toBeVisible()
  await expect(page.getByRole('combobox',{name:'Recorded scenario'})).toHaveValue('UC-key-reveal')
  for (const name of ['Key reveal + refund (start here)', 'Plain payment', 'Writer never reveals: money back', 'Simulated: decline', 'Simulated: buy', 'Simulated: refund']) await expect(page.getByRole('option',{name,exact:true})).toHaveCount(1)
  await expect(page.locator('.demo-transactions p')).toHaveCount(5)
  await expect(page.locator('.demo-transactions')).toContainText('EscrowFinish (key published)')
  await expect(page.locator('.demo-transactions')).toContainText('EscrowCancel (writer no-show)')
  await expect(page.locator('.demo-transactions')).toContainText('Historical')
  await expect(page).toHaveTitle(/Answer ready/, {timeout:45000})
 } finally {python.kill('SIGTERM');await once(python,'exit')}
})

// The first minute of every Testnet replay: no failure frame, ever, and every recorded hash live-green quickly.
for (const [name, query, rows] of [['default key-reveal UC3', '', 6], ['writer no-show', '?scenario=UC-key-reveal', 5]] as const) test(`${name} replay never shows a failure and its hashes go live-green`, async ({ page }, info) => {
  test.setTimeout(150_000)
  const root = info.outputPath('pages')
  await mkdir(`${root}/theFastandtheFungible`, { recursive: true })
  await cp('site', `${root}/theFastandtheFungible`, { recursive: true })
  const python = spawn('python3', ['-u', '-m', 'http.server', '0', '--bind', '127.0.0.1', '--directory', root], { stdio: ['ignore', 'pipe', 'ignore'] })
  try {
    const [chunk] = await once(python.stdout!, 'data')
    const port = String(chunk).match(/port (\d+)/)?.[1]
    await page.goto(`http://127.0.0.1:${port}/theFastandtheFungible/demo/${query}`)
    let greenAt: number | undefined
    for (let second = 0; second < 60; second++) {
      const text = await page.locator('body').innerText()
      expect(text, `at ${second} s`).not.toMatch(/Failed|could not finish|Start a new question|Resume the answer/i)
      const states = await page.locator('.demo-transactions p span').allTextContents()
      if (greenAt === undefined && states.length === rows && states.every(t => /validated/.test(t))) greenAt = second
      await page.waitForTimeout(1000)
    }
    expect(greenAt, 'every recorded hash is validated live').toBeDefined()
    expect(greenAt!, 'within 10 s').toBeLessThanOrEqual(10)
    await expect(page).toHaveTitle(/Answer ready/)
  } finally { python.kill('SIGTERM'); await once(python, 'exit') }
})

// Recorded fixtures and closed ledger sockets isolate UI evidence from live validation.
for (const width of [1440, 390]) test(`replay UI accessibility at ${width}`, async ({page}, info) => {
 test.setTimeout(120_000)
 const root=info.outputPath('pages'); await mkdir(`${root}/theFastandtheFungible`,{recursive:true}); await cp('site',`${root}/theFastandtheFungible`,{recursive:true})
 const server=spawn('python3',['-u','-m','http.server','0','--bind','127.0.0.1','--directory',root],{stdio:['ignore','pipe','ignore']})
 try {
  const [chunk]=await once(server.stdout!,'data'),port=String(chunk).match(/port (\d+)/)?.[1]
  await page.setViewportSize({width,height:900});await page.emulateMedia({reducedMotion:'reduce'});await page.routeWebSocket(/wss:\/\/.*/,ws=>ws.close())
  const errors:string[]=[],audit:unknown[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text())})
  const capture=async(state:string)=>{const result=await new AxeBuilder({page}).analyze();audit.push({state,violations:result.violations});await page.screenshot({path:evidencePath(`ui-nov11/after/replay/${state}-${width}.png`),fullPage:true});expect.soft(result.violations,state).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),state).toBe(true)}
  const base=`http://127.0.0.1:${port}/theFastandtheFungible/demo/`
  await page.goto(base);await expect(page).toHaveTitle(/Answer ready/,{timeout:45_000});await capture('answer')
  if(width===390)await page.locator('.demo-shell > summary').click()
  await expect(page.getByRole('link',{name:'Ask your own question'})).toBeVisible()
  await expect(page.getByRole('link',{name:'Ask your own question'})).toHaveAttribute('href','https://ra-front-651013803640.asia-southeast1.run.app')
  if(width===390)await page.locator('.demo-shell > summary').click()
  if(width===390){await page.locator('.ra-mobile-spend > button').click();await capture('mobile-spend')}
  await page.getByRole('button',{name:/Receipt/}).first().click();await capture('receipt');await page.keyboard.press('Escape')
  await page.locator('.ra-cite').first().click();await capture('citation');await page.keyboard.press('Escape')
  await page.keyboard.press('w');await page.getByRole('tab',{name:'Ledger',exact:true}).click();await capture('ledger');await page.keyboard.press('Escape')
  await page.keyboard.press('ControlOrMeta+,');await expect(page.getByRole('heading',{name:'About this replay'})).toBeVisible();await capture('settings')
  await page.goto(base+'?scenario=UC1');await expect(page.getByRole('heading',{level:1})).toContainText('Bank of Japan');await page.keyboard.press('ControlOrMeta+n');await capture('home')
  await page.locator('.ra-presets button').first().click();await page.getByRole('button',{name:/^Ask/}).click();await page.getByRole('button',{name:'Start now'}).waitFor();await capture('plan')
  await page.getByRole('button',{name:'Start now'}).click();await expect(page).toHaveTitle(/Answer ready/,{timeout:45_000});await capture('decline')
  expect(errors).toEqual([]);writeFileSync(evidencePath(`ui-nov11/after/replay/audit-${width}.json`),JSON.stringify({mode:'replay',width,audit,errors},null,2))
 }finally{server.kill('SIGTERM');await once(server,'exit')}
})

// Every published replay link opens a question, with a compact shell on both widths.
test('scenario links open their run within ten seconds and keep compact, honest chrome', async ({ page }, info) => {
  test.setTimeout(90_000)
  const root = info.outputPath('pages')
  await mkdir(`${root}/theFastandtheFungible`, { recursive: true })
  await cp('site', `${root}/theFastandtheFungible`, { recursive: true })
  const server = spawn('python3', ['-u', '-m', 'http.server', '0', '--bind', '127.0.0.1', '--directory', root], { stdio: ['ignore', 'pipe', 'ignore'] })
  try {
    const [chunk] = await once(server.stdout!, 'data'), port = String(chunk).match(/port (\d+)/)?.[1]
    await page.routeWebSocket(/wss:\/\/.*/, ws => ws.close())
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 })
      for (const scenario of ['', 'UC3-key-reveal', 'UC-key-reveal', 'UC3-testnet', 'UC1', 'UC2', 'UC3']) {
        await page.goto(`http://127.0.0.1:${port}/theFastandtheFungible/demo/${scenario ? `?scenario=${scenario}` : ''}`)
        const recording = JSON.parse(await (await import('node:fs/promises')).readFile(`demo/traces/${scenario || 'UC3-key-reveal'}.json`, 'utf8'))
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(recording.run.question, { timeout: 10_000 })
        expect(new URL(page.url()).searchParams.get('run')).toBe(recording.run.runId)
        expect(await page.evaluate(() => Math.max(...['.ra-hdr', '.demo-banner', '.ra-top'].map(selector => document.querySelector(selector)!.getBoundingClientRect().bottom)))).toBeLessThanOrEqual(width === 390 ? 120 : 100)
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
        if (scenario) {
          await page.goto(`http://127.0.0.1:${port}/theFastandtheFungible/demo/?run=${recording.run.runId}`)
          await expect(page.getByRole('heading', { level: 1 })).toHaveText(recording.run.question, { timeout: 10_000 })
          await expect(page.getByRole('combobox', { name: 'Recorded scenario', includeHidden: true })).toHaveValue(scenario === 'UC3-key-reveal' ? '' : scenario)
        }
        if (!scenario) {
          const skip = page.getByRole('link', { name: 'Skip to recorded run' })
          // The integrated app focuses the run heading on navigation. Check that,
          // then start a fresh document traversal to exercise the first skip link.
          await expect(page.getByRole('heading', { level: 1 })).toBeFocused()
          await page.locator('body').evaluate(body => { body.tabIndex = -1; body.focus() })
          await page.keyboard.press('Tab')
          await expect(skip).toBeFocused()
          await page.locator('body').evaluate(body => body.removeAttribute('tabindex'))
          await page.keyboard.press('Enter')
          await expect(page.locator('#main')).toBeFocused()
          await expect(page.locator('.demo-shell > summary .demo-label')).toHaveText('Replay · XRPL Testnet, recorded 11 Nov 2026 · fictional writers · no real value')
          if (width === 390) await page.locator('.demo-shell > summary').click()
          await expect(page.getByRole('combobox', { name: 'Recorded scenario' })).toBeVisible()
          await page.getByRole('button', { name: 'Pause', exact: true }).click()
          await expect(page.getByRole('button', { name: 'Resume', exact: true })).toBeVisible()
          expect((await new AxeBuilder({ page }).analyze()).violations.filter(v => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual([])
        }
      }
    }
  } finally { server.kill('SIGTERM'); await once(server, 'exit') }
})

test('replay downloads only the requested recording, then loads another scenario on demand', async ({page, browser}, info) => {
 const root=info.outputPath('pages'); await mkdir(`${root}/theFastandtheFungible`,{recursive:true}); await cp('site',`${root}/theFastandtheFungible`,{recursive:true})
 const server=spawn('python3',['-u','-m','http.server','0','--bind','127.0.0.1','--directory',root],{stdio:['ignore','pipe','ignore']})
 try {
  const [chunk]=await once(server.stdout!,'data'),port=String(chunk).match(/port (\d+)/)?.[1]
  await page.routeWebSocket(/wss:\/\/.*/,ws=>ws.close())
  const requests:string[]=[];page.on('request',r=>requests.push(new URL(r.url()).pathname))
  const base=`http://127.0.0.1:${port}/theFastandtheFungible/demo/`
  await page.goto(base);await expect(page.getByRole('heading',{level:1})).toContainText('Kestrel',{timeout:10_000})
  await expect(page.locator('link[rel="modulepreload"][href*="/assets/main-"]')).toHaveCount(1)
  await expect(page.locator('link[rel="stylesheet"][href*="/assets/main-"]')).toHaveCount(1)
  expect(requests.filter(p=>/\/(?:UC1|UC2|UC3|UC3-testnet|UC-key-reveal)-[A-Za-z0-9_-]{8}\.js$/.test(p))).toEqual([])
  expect(requests.filter(p=>/\/UC3-key-reveal-[\w-]+\.js$/.test(p))).toHaveLength(1)
  await expect(page.locator('.demo-transactions p')).toHaveCount(6)
  await page.getByRole('combobox',{name:'Recorded scenario'}).selectOption('UC2')
  await expect(page.getByRole('heading',{level:1})).toContainText("What's the analyst outlook",{timeout:10_000})
  expect(requests.filter(p=>/\/UC2-[\w-]+\.js$/.test(p))).toHaveLength(1)
  // A cold direct link must preload its own trace, including run-ID links.
  for (const entry of recordingIndex) for (const query of [`scenario=${entry.scenario}`, `run=${entry.runId}`, `scenario=${entry.scenario}&run=${recordingIndex.find(other => other.runId !== entry.runId)!.runId}`]) {
    const context = await browser.newContext(), direct = await context.newPage(), traces: string[] = []
    try {
      await direct.routeWebSocket(/wss:\/\/.*/, ws => ws.close())
      direct.on('request', request => { const file = new URL(request.url()).pathname.split('/').pop()!; if (/^UC.*\.js$/.test(file)) traces.push(file) })
      await direct.goto(`${base}?${query}`)
      await expect(direct.getByRole('heading', { level: 1 })).toHaveText(entry.question)
      expect(traces).toHaveLength(1)
      expect(traces[0]).toMatch(new RegExp(`^${entry.scenario}-[\\w-]+\\.js$`))
    } finally { await context.close() }
  }
 }finally{server.kill('SIGTERM');await once(server,'exit')}
})
