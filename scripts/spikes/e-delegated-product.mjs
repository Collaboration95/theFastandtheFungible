// HTTP end-to-end: real publisher/server entry points, fixture models, Testnet XRP.
// Product modules are deliberately not imported by the spike.
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import { Wallet } from 'xrpl'
import { sign } from 'ripple-keypairs'
import { connect, funded, submit, save, account } from './lib.mjs'
const c = await connect(), records = [], children = []
let run, receipt
const api = 'http://127.0.0.1:9588', token = randomBytes(32).toString('hex')
try {
  const buyer = await funded(c), visitor = Wallet.generate(), writer = Wallet.generate()
  const send = async (wallet, tx, label) => { const r = await submit(c, wallet, { ...tx, Account: wallet.address }, { label }); records.push(r.record); assert.equal(r.record.result, 'tesSUCCESS'); save('e-delegated', { records }); return r }
  for (const w of [visitor, writer]) await send(buyer, { TransactionType: 'Payment', Destination: w.address, Amount: '6000000' }, 'fund fresh account')
  await send(visitor, { TransactionType: 'DelegateSet', Authorize: buyer.address, Permissions: [{ Permission: { PermissionValue: 'EscrowCreate' } }] }, 'visitor grant')
  const env = { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, DOTENV_CONFIG_PATH: '.spike-no-env',
    HOST: '127.0.0.1', PORT: '9588', PUBLISHER_PORT: '9590', DEMO_PORT_OFFSET: '800', PUBLISHER_URL: 'http://127.0.0.1:9590',
    RA_API_TOKEN: token, LLM_PROVIDER: 'fixture', DECISION_PROVIDER: 'fixture', SEARCH_EMBEDDINGS: 'off', LANGFUSE_ENABLED: '0',
    SETTLEMENT_RAIL: 'xrpl-testnet', ESCROW_MODE: 'key-reveal', ESCROW_ASSET: 'XRP', WALLET_MODE: 'delegated',
    XRPL_PAYER_SEED: buyer.seed, APP_DB: ':memory:', PUBLISHER_DB: ':memory:', REPORT_DIR: 'scratch/r3-spike-c',
    PUBLISHER_SECRET: randomBytes(32).toString('hex') }
  // Isolate all fixture writer roles to one fresh funded wallet for this one purchase.
  const slugs = ['team-builder-notes','team-xrpl-explainers','alphaleak','the-fab-floor','notfinancialtimes','basis-points','load-factor','kopi-contrarian','marketpulse-digest','grid-operators-report','open-records']
  env.ESCROW_WRITERS = slugs.join(',')
  for (const slug of slugs) env[`XRPL_PUBLISHER_${slug.toUpperCase().replaceAll('-', '_')}_SEED`] = writer.seed
  children.push(spawn(process.execPath, ['--import', 'tsx', 'publisher/server.ts'], { env, stdio: 'ignore' }))
  for (let i = 0; ; i++) { try { if ((await fetch(env.PUBLISHER_URL + '/health')).ok) break } catch { /* starting */ } if (i > 100) throw Error('Publisher startup timeout'); await new Promise(r => setTimeout(r, 200)) }
  children.push(spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], { env, stdio: 'ignore' }))
  const get = async path => { const r = await fetch(api + path, { headers: { Authorization: `Bearer ${token}` } }); assert.ok(r.ok, `HTTP ${r.status}`); return r.json() }
  for (let i = 0; ; i++) { try { await get('/api/runs'); break } catch { if (i > 100 || children.some(p => p.exitCode !== null)) throw Error('Local stack failed to start'); await new Promise(r => setTimeout(r, 200)) } }
  const post = async (path, body) => {
    const r = await fetch(api + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) })
    assert.ok(r.ok, `HTTP ${r.status}`); return r.json()
  }
  const { message } = await post('/api/wallet/delegation/challenge', {})
  await post('/api/wallet/delegation/connect', { address: visitor.address, publicKey: visitor.publicKey, signature: sign(message, visitor.privateKey) })
  const started = performance.now()
  const response = await fetch(api + '/runs', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ question: 'Can an XRPL escrow hold RLUSD today, and what must the issuer enable before a buyer can lock it?', budgetMinor: 100, escrow: true }) })
  assert.equal(response.status, 201); const initial = await response.json()
  for (let i = 0; ; i++) { run = await get(`/runs/${initial.runId}`); if (['DONE','FAILED','STOPPED'].includes(run.phase)) break; if (i > 600) throw Error('Purchase timed out'); await new Promise(r => setTimeout(r, 500)) }
  receipt = await get(`/runs/${initial.runId}/receipts.json`)
  save('e-delegated-receipt', receipt)
  const released = run.intents.filter(i => i.escrow?.state === 'RELEASED')
  for (const intent of released) for (const [label, hash] of [['product create', intent.escrow.createHash], ['product writer finish', intent.escrow.finishHash]]) {
    const { result } = await c.request({ command: 'tx', transaction: hash, api_version: 2 })
    assert.equal(result.meta.TransactionResult, 'tesSUCCESS')
    records.push({ label, hash, explorer: `https://testnet.xrpl.org/transactions/${hash}`, validated: result.validated, result: result.meta.TransactionResult, ledger: result.ledger_index, tx: result.tx_json, meta: result.meta })
  }
  const result = { verdict: released.length > 0 ? 'works' : 'fails', at: new Date().toISOString(), ms: Math.round(performance.now() - started),
    visitor: visitor.address, agent: buyer.address, visitorBalance: (await account(c, visitor)).Balance, writer: writer.address,
    labels: run.labels, phase: run.phase, spentMinor: run.spentMinor, intents: run.intents, records,
    delegated: released.every(i => i.escrow.owner === visitor.address) }
  assert.ok(result.delegated)
  await send(visitor, { TransactionType: 'DelegateSet', Authorize: buyer.address, Permissions: [] }, 'visitor revoke')
  const denied = await post('/runs', { question: 'Can an XRPL escrow hold RLUSD today, and what must the issuer enable before a buyer can lock it?', budgetMinor: 100, escrow: true })
  let deniedRun
  for (let i = 0; ; i++) { deniedRun = await get(`/runs/${denied.runId}`); if (['DONE','FAILED','STOPPED'].includes(deniedRun.phase)) break; if (i > 600) throw Error('Revocation run timed out'); await new Promise(r => setTimeout(r, 500)) }
  assert.equal(deniedRun.spentMinor, 0); assert.equal(deniedRun.grants.length, 0)
  assert.ok(deniedRun.intents.every(i => !i.escrow?.createHash))
  result.revokedRun = { spentMinor: deniedRun.spentMinor, grants: deniedRun.grants.length, intents: deniedRun.intents }
  save('e-delegated', result); console.log(JSON.stringify(result, null, 2)); assert.ok(released.length > 0)
} finally {
  for (const child of children) child.kill('SIGTERM')
  await Promise.all(children.map(child => new Promise(resolve => { if (child.exitCode !== null) return resolve(); child.once('exit', resolve); setTimeout(() => child.kill('SIGKILL'), 3000).unref() })))
  await c.disconnect()
}
