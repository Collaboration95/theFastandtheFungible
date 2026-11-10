// Targeted SITE regression and evidence capture. OFFSET=2300 -> HTTP port 7400.
import { chromium } from 'playwright'
import AxeBuilder from '@axe-core/playwright'
import { once } from 'node:events'
import { mkdirSync, symlinkSync, writeFileSync } from 'node:fs'
import { newScope } from './local-gate.mjs'
import { join } from 'node:path'
import assert from 'node:assert/strict'
import { ISSUERS, parseAccountRoot, readIssuer } from '../site/builder-feedback/issuer-check.mjs'
const output = process.env.SITE_ONE ? '/tmp/site-one' : 'docs/evidence/site-nov11'
mkdirSync(output, { recursive: true })
const scope = await newScope(), temp = scope.tempDir('site-verify-')
symlinkSync(join(process.cwd(), 'site'), join(temp, 'theFastandtheFungible'))
const server = scope.spawn('python3', ['-u', '-m', 'http.server', '7400', '--bind', '127.0.0.1', '--directory', temp], {})
const base = 'http://127.0.0.1:7400/theFastandtheFungible/'
const browser = await chromium.launch(), report = [], failures = []
try {
  await once(server.stdout, 'data')
  assert.equal(parseAccountRoot({ validated: true, account_data: { Account: ISSUERS[0].account, Flags: 0x80000000 }, ledger_index: 1 }, ISSUERS[0].account).enabled, false, 'Clawback is not Locking')
  assert.equal(parseAccountRoot({ validated: true, account_data: { Account: ISSUERS[0].account, Flags: 0xc0000000 }, ledger_index: 1 }, ISSUERS[0].account).enabled, true)
  assert.throws(() => parseAccountRoot({ validated: false, account_data: { Flags: 0 }, ledger_index: 1 }, ISSUERS[0].account))
  class DeadSocket { close() {} }
  await assert.rejects(readIssuer(ISSUERS[0], DeadSocket, 5), /timed out/)
  for (const motion of (process.env.SITE_ONE ? ['reduce'] : ['reduce', 'no-preference'])) for (const width of (process.env.SITE_ONE ? [Number(process.env.SITE_WIDTH || 390)] : [390, 1440])) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: motion }), page = await context.newPage(), errors = []
    page.on('pageerror', e => errors.push(e.message))
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
    // Deterministic outage; live read results are captured separately.
    await page.routeWebSocket(/wss:\/\/.*/, socket => socket.close())
    for (const route of (process.env.SITE_ONE ? [process.env.SITE_ONE] : ['', 'talk/', 'evolution/', 'ledger/', 'progress/', 'developers/', 'proof/', 'builder-feedback/', 'demo/'])) {
      errors.length = 0
      await page.goto(base + route); await page.evaluate(() => document.fonts.ready)
      if (route === 'demo/') await page.waitForTimeout(500)
      const axe = await new AxeBuilder({ page }).analyze()
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
      const violations = axe.violations.map(v => ({ id: v.id, impact: v.impact, targets: v.nodes.map(n => n.target) }))
      const record = { route: route || '/', width, motion, violations, overflow, errors: [...errors] }
      report.push(record)
      if (violations.length || overflow || errors.length) failures.push(record)
      if (route === 'talk/' && motion === 'reduce') {
        assert.equal(await page.locator('[data-left]').textContent(), 'S$1.30')
        assert.equal(await page.locator('[data-net]').textContent(), 'S$0.40')
        assert.equal(await page.locator('[data-mleft]').textContent(), 'S$1.30')
        for (const metric of await page.locator('.run-top .num').all()) assert.equal(await metric.evaluate(el => el.getBoundingClientRect().right <= el.closest('.panel').getBoundingClientRect().right), true, 'Money figure must fit')
      }
      if (route === 'builder-feedback/') {
        await page.getByRole('button', { name: 'Check public ledgers' }).click()
        await page.getByText('AllowTrustLineLocking: unknown', { exact: false }).first().waitFor()
        assert.equal(await page.getByText('AllowTrustLineLocking: unknown', { exact: false }).count(), 2)
        assert.equal(await page.getByRole('button', { name: 'Check public ledgers' }).isEnabled(), true)
      }
      if (motion === 'reduce') await page.screenshot({ path: `${output}/${route.replaceAll('/', '') || 'home'}-${width}.png`, fullPage: true })
    }
    await context.close()
  }
  const page = await browser.newPage()
  const commands = []
  await page.routeWebSocket(/wss:\/\/.*/, socket => {
    socket.onMessage(raw => {
      const request = JSON.parse(String(raw)); commands.push(request.command)
      socket.send(JSON.stringify({ id: request.id, status: 'success', result: { validated: true, ledger_index: 123, account_data: { Account: request.account, Flags: request.account === ISSUERS[0].account ? 0x80000000 : 0xc0000000 } } }))
    })
  })
  await page.goto(base + 'builder-feedback/'); await page.getByRole('button', { name: 'Check public ledgers' }).click()
  await page.getByText('AllowTrustLineLocking: ON', { exact: false }).waitFor()
  assert.equal(await page.getByText('AllowTrustLineLocking: OFF', { exact: false }).count(), 1)
  assert.deepEqual(commands, ['account_info', 'account_info'])
  await page.close()
} finally {
  writeFileSync(`${output}/checks.json`, JSON.stringify({ capturedAt: new Date().toISOString(), scope: 'Local static site; issuer browser responses mocked for on/off/outage regression. No signing or transactions.', checks: report, failures }, null, 2) + '\n')
  await browser.close(); await scope.close()
}
console.log(JSON.stringify({ checks: report.length, failures }, null, 2))
if (failures.length) process.exit(1)
