import { test, expect } from '@playwright/test'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdir, cp, readdir, stat } from 'node:fs/promises'
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
    await expect(page.getByText(/^Recorded on XRPL Testnet · no real value · key reveal .*the refund is writer-signed \(fixture writer cooperates\)$/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Pause', exact:true })).toBeVisible()
    await page.getByRole('button', { name:'Pause', exact:true }).click()
    await expect(page.getByRole('button', { name:'Resume', exact:true })).toBeVisible()
    await page.getByRole('button', { name:'Resume', exact:true }).click()
    await expect(page.getByText('Draft · free sources only', { exact: true })).toBeVisible()
    await expect(page).toHaveTitle(/Answer ready/, { timeout: 30000 })
    await expect(page.getByText('Updated with paid evidence', { exact: true })).toBeVisible()
    await expect(page.locator('.ra-vtext')).toContainText('26 weeks to 18 weeks')
  await expect(page.locator('.ra-vtext')).toContainText('Supports')
  await expect(page.locator('.ra-claim').filter({ hasText: '26 weeks to 18 weeks' })).toHaveCount(0)
    await expect(page.getByRole('region', { name: /Purchase: AlphaLeak/ })).toContainText('Refunded S$0.30')
    await expect(page.getByRole('region', { name: 'Purchase: The Fab Floor' })).toContainText('Paid by key reveal')
    await expect(page.getByRole('region', { name: 'Sources', exact: true })).toContainText('1 kept · 1 refunded')
    const spend = page.getByRole('region', { name: 'Spend', exact: true }).first()
    await expect(spend).toContainText('S$1.30 budget left · refunds don’t restore budget'.replace('’', "'"))
    // Each key-reveal card lists its own create and finish transactions; the refund links separately.
    await expect(page.getByRole('link', { name: 'tx ↗', exact: true })).toHaveCount(4)
    await expect(page.getByRole('link', { name: /^Refund tx [A-F0-9]{6}…[A-F0-9]{5} ↗$/ })).toHaveCount(1)
    await expect(page.locator('p:visible', { hasText: 'Refund · writer-signed · fixture writer cooperates (a real writer could refuse)' })).toHaveCount(1)
    await page.screenshot({ path: info.outputPath('uc3.png'), fullPage: true })
    await page.getByRole('button', { name: /Receipt/ }).first().click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await page.locator('.ra-cite').first().click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByRole('dialog').locator('mark')).toBeVisible()
    await page.keyboard.press('Escape')
    await page.getByRole('tab', { name: 'Writers' }).click()
    await expect(page.getByText(/quarantined/i).first()).toBeVisible()
    await page.getByRole('button', { name: 'AlphaLeak' }).click()
    await expect(page.getByText(/Honesty 0\.40/)).toBeVisible()
    await page.setViewportSize({ width: 390, height: 844 })
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.getByText('Run it yourself', { exact: true }).click()
    await expect(page.getByText(/claude mcp add researchagent/)).toBeVisible()
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.keyboard.press('Meta+k')
    await page.getByRole('button', { name: /What's the analyst outlook/ }).click()
    await page.getByRole('button', { name: /^Ask$/ }).click()
    await page.getByRole('button', { name: 'Start now' }).click()
    await expect(page).toHaveTitle(/Answer ready/, { timeout: 30000 })
    await expect(page.getByRole('region', { name: /Purchase: NotFinancialTimes/ })).toContainText('Verified')
    await expect(page.getByText('Replay of a recorded run · fictional writers · simulated payments')).toBeVisible()
    await page.goto(`http://127.0.0.1:${port}/theFastandtheFungible/demo/?scenario=UC1`)
    await page.getByRole('button', { name: /^Bank of Japan decision/ }).click()
    await page.getByRole('button', { name: /^Ask$/ }).click()
    await page.getByRole('button', { name: 'Start now' }).click()
    await expect(page).toHaveTitle(/Answer ready/, { timeout: 30000 })
    await expect(page.getByText('Replay of a recorded run · fictional writers · simulated payments')).toBeVisible()
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
  await expect(page.getByText(/ciphertext before grant stays quarantined/)).toBeVisible()
  for (const name of ['Testnet UC3 · key reveal', 'Testnet UC3 · payment', 'Testnet · writer no-show']) await expect(page.getByRole('link',{name,exact:true})).toBeVisible()
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
