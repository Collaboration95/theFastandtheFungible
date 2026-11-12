// HTTP end-to-end: real publisher/server entry points, fixture models, Testnet IOU.
// Product modules are deliberately not imported by the spike.
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Wallet } from 'xrpl'
import { connect, funded, submit, save, account } from './lib.mjs'
const c = await connect(), records = [], children = [], dir = mkdtempSync(join(tmpdir(), 'r3-iou-'))
let run, receipt
const api = 'http://127.0.0.1:9588', token = randomBytes(32).toString('hex')
try {
  const buyer = await funded(c), issuer = Wallet.generate(), writer = Wallet.generate()
  const send = async (wallet, tx, label) => { const r = await submit(c, wallet, { ...tx, Account: wallet.address }, { label }); records.push(r.record); assert.equal(r.record.result, 'tesSUCCESS'); save('c', { records }); return r }
  for (const w of [issuer, writer]) await send(buyer, { TransactionType: 'Payment', Destination: w.address, Amount: '6000000' }, 'fund fresh account')
  await send(issuer, { TransactionType: 'AccountSet', SetFlag: 16 }, 'enable AllowTrustLineLocking')
  for (const w of [buyer, writer]) await send(w, { TransactionType: 'TrustSet', LimitAmount: { currency: 'SGT', issuer: issuer.address, value: '1000000' } }, 'SGT trust line')
  await send(issuer, { TransactionType: 'Payment', Destination: buyer.address, Amount: { currency: 'SGT', issuer: issuer.address, value: '10000' } }, 'issue SGT')
  const env = { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, DOTENV_CONFIG_PATH: '.spike-no-env',
    HOST: '127.0.0.1', PORT: '9588', PUBLISHER_PORT: '9590', DEMO_PORT_OFFSET: '800', PUBLISHER_URL: 'http://127.0.0.1:9590',
    RA_API_TOKEN: token, LLM_PROVIDER: 'fixture', DECISION_PROVIDER: 'fixture', SEARCH_EMBEDDINGS: 'off', LANGFUSE_ENABLED: '0',
    SETTLEMENT_RAIL: 'xrpl-testnet', ESCROW_MODE: 'key-reveal', ESCROW_ASSET: 'test-iou', TESTNET_IOU_ISSUER: issuer.address,
    XRPL_PAYER_SEED: buyer.seed, APP_DB: join(dir, 'app.db'), PUBLISHER_DB: join(dir, 'publisher.db'), REPORT_DIR: dir,
    PUBLISHER_SECRET: randomBytes(32).toString('hex') }
  // Isolate all fixture writer roles to one fresh funded wallet for this one purchase.
  const slugs = ['team-builder-notes','team-xrpl-explainers','alphaleak','the-fab-floor','notfinancialtimes','basis-points','load-factor','kopi-contrarian','marketpulse-digest','grid-operators-report','open-records']
  env.ESCROW_WRITERS = slugs.join(',')
  for (const slug of slugs) env[`XRPL_PUBLISHER_${slug.toUpperCase().replaceAll('-', '_')}_SEED`] = writer.seed
  for (const path of ['publisher/server.ts', 'server/index.ts']) children.push(spawn(process.execPath, ['--import', 'tsx', path], { env, stdio: 'ignore' }))
  const get = async path => { const r = await fetch(api + path, { headers: { Authorization: `Bearer ${token}` } }); assert.ok(r.ok, `HTTP ${r.status}`); return r.json() }
  for (let i = 0; ; i++) { try { await get('/api/runs'); break } catch { if (i > 100 || children.some(p => p.exitCode !== null)) throw Error('Local stack failed to start'); await new Promise(r => setTimeout(r, 200)) } }
  const started = performance.now()
  const response = await fetch(api + '/runs', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ question: 'How do XRPL escrow writers get paid when they reveal the article key?', budgetMinor: 100, escrow: true }) })
  assert.equal(response.status, 201); const initial = await response.json()
  for (let i = 0; ; i++) { run = await get(`/runs/${initial.runId}`); if (['DONE','FAILED','STOPPED'].includes(run.phase)) break; if (i > 600) throw Error('Purchase timed out'); await new Promise(r => setTimeout(r, 500)) }
  receipt = await get(`/runs/${initial.runId}/receipts.json`)
  save('c-receipt', receipt)
  const released = run.intents.filter(i => i.escrow?.state === 'RELEASED')
  const result = { verdict: released.length > 0 ? 'works' : 'fails', at: new Date().toISOString(), ms: Math.round(performance.now() - started),
    issuer: issuer.address, flags: (await account(c, issuer)).Flags, buyer: buyer.address, writer: writer.address,
    labels: run.labels, phase: run.phase, spentMinor: run.spentMinor, intents: run.intents, records,
    verifyEscrowCredit: released.length > 0 ? 'passed in server/escrow.ts acceptReveal before RELEASED' : 'not established' }
  save('c', result); console.log(JSON.stringify(result, null, 2)); assert.ok(released.length > 0)
} finally {
  for (const child of children) child.kill('SIGTERM')
  await Promise.all(children.map(child => new Promise(resolve => { if (child.exitCode !== null) return resolve(); child.once('exit', resolve); setTimeout(() => child.kill('SIGKILL'), 3000).unref() })))
  await c.disconnect(); rmSync(dir, { recursive: true, force: true })
}
