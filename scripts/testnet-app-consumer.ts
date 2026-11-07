import { packedArtifact, withPackedSession, validatedTransactions } from './packed-consumer.js'
import { waitForOutput } from '../shared/resource-scope.js'
// Explicit opt-in (RA_ACCEPT_TESTNET=1): `npx -y <packed mcp tgz> app --testnet` from a fresh npm cache and a fresh
// wallet cache, driven in a real browser, then every hash is checked on s.altnet. Public Testnet only; no real value.
import assert from 'node:assert/strict'
import { mkdirSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { stopProcess } from './release-processes.js'
const { tgz } = packedArtifact(process.argv[2])
await withPackedSession(true, async ({ scope, scratch, spawnPacked }) => {
const evidence = resolve('docs/evidence/round3-d'); mkdirSync(evidence, { recursive: true })
const state = join(scratch, 'state')
const boot = async () => {
  const started = performance.now()
  const child = spawnPacked(tgz, ['app', '--testnet'])
  let out = ''
  child.stdout.on('data', chunk => { out += chunk })
  child.stderr.resume()
  const ready = await waitForOutput(child, /ResearchAgent ready: (http:\/\/127\.0\.0\.1:\d+) · fixture models · XRPL TESTNET · no real value/, 120_000)
  const seconds = (performance.now() - started) / 1000
  const payer = out.match(/payer address: (r[1-9A-HJ-NP-Za-km-z]{24,34})/)?.[1]
  assert(payer, 'ready block must print the public payer address')
  assert(/wallet daily cap S\$5\.00/.test(out), 'daily cap must be labelled')
  assert(!/(?:^|[^a-z])s[1-9A-HJ-NP-Za-km-z]{28,}/.test(out), 'no seed may be printed')
  assert.equal(statSync(join(state, 'researchagent/testnet/wallets.private.json')).mode & 0o777, 0o600)
  return { child, url: ready[1], seconds, payer }
}
  const cold = await boot()
  assert(cold.seconds < 60, `cold start ${cold.seconds}s exceeds 60 s`)
  const browser = scope.own(await chromium.launch())
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage()
    await page.goto(cold.url + '/?pace=real')
    await page.getByRole('button', { name: /^Kestrel–TSMC outlook/ }).waitFor()
    await page.screenshot({ path: join(evidence, 'ready.png') })
    const asked = performance.now()
    await page.getByRole('button', { name: /^Kestrel–TSMC outlook/ }).click()
    await page.getByRole('button', { name: /^Ask/ }).click()
    await page.getByRole('button', { name: 'pricing & margins' }).click()
    await page.getByRole('button', { name: 'Start now' }).click()
    await page.waitForFunction(() => /Answer ready/.test(document.title), undefined, { timeout: 150_000 })
    const lifecycle = page.getByRole('region', { name: 'Key-reveal escrow' }).first()
    await lifecycle.waitFor({ timeout: 30_000 })
    const links = lifecycle.getByRole('link', { name: 'tx ↗' })
    await links.nth(1).waitFor({ timeout: 60_000 })
    // The anchor is written after the run is DONE. Wait for it in the engine first; the page may need a reload to show it.
    const runId = new URL(page.url()).searchParams.get('run')
    assert(runId, 'page must carry ?run=')
    const anchorDeadline = Date.now() + 120_000
    while (!(await (await fetch(`${cold.url}/runs/${runId}`)).json() as { ledgerAnchor?: unknown }).ledgerAnchor) { assert(Date.now() < anchorDeadline, 'anchor never reached the engine'); await new Promise(r => setTimeout(r, 1000)) }
    const anchorLink = page.getByRole('link', { name: /^Anchored on XRPL/ })
    const liveAnchor = await anchorLink.waitFor({ timeout: 10_000 }).then(() => true, () => false)
    if (!liveAnchor) { await page.reload(); await anchorLink.waitFor({ timeout: 30_000 }) }
    const askSeconds = (performance.now() - asked) / 1000
    const hrefs = [await links.nth(0).getAttribute('href'), await links.nth(1).getAttribute('href'), await anchorLink.getAttribute('href')]
    const hashes = hrefs.map(href => href?.match(/^https:\/\/testnet\.xrpl\.org\/transactions\/([A-F0-9]{64})$/i)?.[1]?.toUpperCase())
    await page.screenshot({ path: join(evidence, 'bought.png'), fullPage: true })
    const transactions = await validatedTransactions(hashes)
    await stopProcess(cold.child)
    const warm = await boot()
    assert.equal(warm.payer, cold.payer, 'warm start must reuse the cached wallets')
    await stopProcess(warm.child)
    const probe = { network: 'XRPL Testnet (s.altnet)', question: 'Kestrel–TSMC outlook, pricing & margins', payer: cold.payer, coldReadySeconds: +cold.seconds.toFixed(1), warmReadySeconds: +warm.seconds.toFixed(1), browserAskToAnchorSeconds: +askSeconds.toFixed(1), anchorShownWithoutReload: liveAnchor, transactions }
    writeFileSync(join(evidence, 'probe.json'), JSON.stringify(probe, null, 2) + '\n')
    console.log(JSON.stringify(probe))
  await browser.close()
})
