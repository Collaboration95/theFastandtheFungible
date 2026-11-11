import { packedArtifact, withPackedSession, packedStdio } from './packed-consumer.js'
import { waitForOutput } from '../shared/resource-scope.js'
import { execFileSync, spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import assert from 'node:assert/strict'
import { stopProcess, assertNoProcesses } from './release-processes.js'
import { startEngine } from '../server/engine.js'
import type { AskResult } from '../sdk/index.js'
import { Store } from '../server/store.js'
import { sha256 } from './release-contract.mjs'
const { manifestFile, manifest, file } = packedArtifact(process.argv[2]), root = dirname(manifestFile)
await withPackedSession(false, async ({ scope, scratch: dir, run, spawnPacked }) => {
const question = 'How did the Kestrel-TSMC deal change margins?'
const results: object[] = []
const engine = scope.own(await startEngine({ dataDir: join(dir, 'engine') }))
const check = (kind: string, a: AskResult, b: AskResult, store: Store) => {
  assert.equal(a.run_id, b.run_id); assert(a.citations.length > 0); assert.equal(a.receipts.length, 1); assert(a.spentMinor <= 200); assert(a.budgetMinor <= 200)
  const snapshot = store.getRun(a.run_id)!
  assert.equal(snapshot.intents.length, 1)
  assert.equal(snapshot.intents[0].status, 'VERIFIED')
  for (const c of a.citations) assert(snapshot.contents.some(d => d.resourceId === c.resourceId && d.version === c.version && d.spans.some(s => s.id === c.spanId && s.text === c.passage)))
  results.push({ kind, sha256: sha256(file(kind)), citations: a.citations.length, receipts: a.receipts.length, intents: snapshot.intents.length, idempotent: true, capPreserved: true })
}
  writeFileSync(join(dir, 'package.json'), '{"type":"module","private":true}')
  const tsStart = performance.now()
  await run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', pathToFileURL(file('tgz')).href])
  writeFileSync(join(dir, 'consumer.mjs'), `import {createClient} from '@researchagent/sdk'; const c=createClient(${JSON.stringify({ baseUrl: engine.apiUrl, token: engine.apiToken })}); const a=await c.ask(${JSON.stringify(question)},{budgetSgd:999,idempotencyKey:'tgz'}); const b=await c.ask(${JSON.stringify(question)},{budgetSgd:999,idempotencyKey:'tgz'}); console.log(JSON.stringify([a,b]));`)
  const store = scope.own(new Store(join(dir, 'engine/app.db')))
    const [a,b] = JSON.parse(await run(process.execPath, ['consumer.mjs'])); check('tgz',a,b,store); results.push({timing:'TypeScript',seconds:(performance.now()-tsStart)/1000})
    const receiptPath=join(root,'accepted-receipt.json')
    const receiptResponse=await fetch(engine.apiUrl+`/runs/${encodeURIComponent(a.run_id)}/receipts.json`,{headers:{Authorization:'Bearer '+engine.apiToken}})
    assert(receiptResponse.ok);writeFileSync(receiptPath,JSON.stringify(await receiptResponse.json(),null,2)+'\n')
    console.log(await run('npm',['--prefix',process.cwd(),'run','verify:answer','--',receiptPath,'--json']))
    const pyStart = performance.now()
    for (const kind of ['wheel', 'sdist']) {
      const python = join(dir, kind+'-venv/bin/python')
      await run('python3', ['-m','venv',join(dir,kind+'-venv')])
      await run(python, ['-m','pip','install','--no-deps',pathToFileURL(file(kind)).href])
      console.log(await run(python,['-m','researchagent','verify',join(root,'accepted-receipt.json'),'--json']))
      writeFileSync(join(dir,'consumer.py'), `import json\nfrom researchagent import Client\nc=Client(${JSON.stringify(engine.apiUrl)}, token=${JSON.stringify(engine.apiToken)})\na=c.ask(${JSON.stringify(question)},budget=999,idempotency_key='${kind}').result()\nb=c.ask(${JSON.stringify(question)},budget=999,idempotency_key='${kind}').result()\nassert c.verify(c.receipts(a['run_id']))['ok']\nprint(json.dumps([a,b]))\n`)
      const [pa,pb] = JSON.parse(await run(python, ['consumer.py'])); check(kind,pa,pb,store)
      if (kind === 'wheel') results.push({timing:'Python',seconds:(performance.now()-pyStart)/1000})
    }
  store.close()
await engine.close()
// H8-02: what the hosted judge demo exports must verify with the PACKED verifiers (the exact wheel in a clean venv and
// the packed TS CLI, `researchagent-mcp verify`), offline. Fresh HOSTED=1 fixture exports (one purchase; one decline
// carrying a synthetic stand-in anchor so "anchor binding" runs) plus the committed real Testnet export from the
// hosted demo. Release fails if any of them does not verify.
const hostedDir = join(dir, 'hosted-exports'), hostedStart = performance.now()
execFileSync(process.execPath, ['--import', 'tsx', resolve('scripts/hosted-export-fixture.ts'), hostedDir], { env: process.env, stdio: ['ignore', 'inherit', 'inherit'], timeout: 120_000 })
const hostedExports = [
  { kind: 'fixture-purchase', file: join(hostedDir, 'hosted-purchase.receipts.json') },
  { kind: 'fixture-anchored-decline', file: join(hostedDir, 'hosted-anchored-decline.receipts.json'), anchor: 'synthetic stand-in (simulated rail)' },
  { kind: 'testnet-hosted', file: resolve('docs/evidence/hosted-export-nov11/receipts.json'), anchor: 'XRPL Testnet (hosted demo)' },
]
const verifyWith = (cmd: string, args: string[], kind: string, who: string) => {
  const r = spawnSync(cmd, args, { cwd: dir, env: process.env, encoding: 'utf8', timeout: 120_000, maxBuffer: 16 * 1024 * 1024 })
  let result: { ok: boolean; checks: { check: string; status: string }[] } | undefined
  try { result = JSON.parse(r.stdout) } catch { /* reported below */ }
  assert(result?.ok === true && r.status === 0, `${who} rejected the ${kind} hosted export: ${r.stdout.slice(0, 600)}${r.stderr.slice(0, 400)}`)
  return result
}
const hostedRows = hostedExports.map(({ kind, file: path, anchor }) => {
  const python = verifyWith(join(dir, 'wheel-venv/bin/python'), ['-m', 'researchagent', 'verify', path, '--json'], kind, 'packed wheel')
  const typescript = verifyWith('npx', ['--yes', '--cache', join(dir, 'npx-cache'), pathToFileURL(file('mcp-tgz')).href, 'verify', path, '--json'], kind, 'packed TS CLI')
  const binding = (r: typeof python) => r.checks.find(c => c.check === 'anchor binding')?.status ?? 'absent'
  if (anchor) assert(binding(python) === 'PASS' && binding(typescript) === 'PASS', `anchor binding not checked on the ${kind} hosted export`)
  return { kind, sha256: sha256(path), ...(anchor ? { anchor } : {}), anchorBinding: binding(python), python: { pass: true }, typescript: { pass: true } }
})
results.push({ timing: 'hosted exports (packed wheel + TS CLI)', exports: hostedRows.length, seconds: (performance.now() - hostedStart) / 1000 })
const bundle = join(dir,'bundle'); execFileSync('unzip',['-q',file('mcpb'),'-d',bundle])
for (const kind of ['mcpb', 'mcp-tgz']) {
const started = performance.now()
const child = scope.spawn(kind === 'mcpb' ? process.execPath : 'npx', kind === 'mcpb' ? [join(bundle,'mcp/extension.mjs')] : ['--yes', '--cache', join(dir,'npx-cache'), pathToFileURL(file(kind)).href], { env: { ...process.env, RA_DATA_DIR: join(dir,kind+'-data'), RA_LIVE:'0' }, cwd: dir })
const { client, call } = await packedStdio(scope, child)
  assert((await client.listTools()).tools.some(t => t.name === 'ask_expert'))
  const ask = () => call('ask_expert', { question, budget_sgd: 999, idempotency_key: 'mcpb' })
  const a = await ask(), b = await ask(); const store = new Store(join(dir,kind+'-data/app.db'))
  try { check(kind,a,b,store); if (kind === 'mcp-tgz') results.push({timing:'MCP npx',seconds:(performance.now()-started)/1000}) } finally { store.close() }
await client.close()
}
// `app`: the packed tgz serves the web UI and engine on one command (simulated; the Testnet variant is opt-in elsewhere).
{
  const started = performance.now()
  const child = spawnPacked(file('mcp-tgz'), ['app'], { XDG_STATE_HOME: join(dir, 'app-state') })
  child.stderr.resume()
    const url = (await waitForOutput(child, /ResearchAgent ready: (http:\/\/127\.0\.0\.1:\d+) · fixture models · SIMULATED rail · no real value/, 90_000))[1]
    const readySeconds = (performance.now() - started) / 1000
    // The same web-surface path the UI uses: POST /runs through the app origin, which adds the engine bearer.
    const post = () => fetch(url + '/runs', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'app' }, body: JSON.stringify({ question, budgetMinor: 200 }) })
    const first = await post(); assert.equal(first.status, 201)
    const { runId } = await first.json() as { runId: string }
    type Snap = { runId: string; phase: string; budgetMinor: number; spentMinor: number; intents: { status: string }[]; receipts: unknown[]; contents: { resourceId: string; version: number; spans: { id: string; text: string }[] }[]; answers: { claims: { citations: { resourceId: string; spanId: string; version: string | number }[] }[] }[] }
    let run: Snap
    const deadline = Date.now() + 90_000
    for (;;) {
      run = await (await fetch(`${url}/runs/${runId}`)).json() as Snap
      if (['DONE', 'FAILED', 'STOPPED'].includes(run.phase)) break
      assert(Date.now() < deadline, 'app run did not finish'); await new Promise(r => setTimeout(r, 250))
    }
    assert.equal(run.phase, 'DONE'); assert.equal(run.intents.length, 1); assert.equal(run.intents[0].status, 'VERIFIED'); assert.equal(run.receipts.length, 1)
    assert(run.spentMinor > 0 && run.spentMinor <= 200 && run.budgetMinor <= 200)
    const citations = run.answers.at(-1)?.claims.flatMap(claim => claim.citations) ?? []; assert(citations.length > 0)
    for (const c of citations) assert(run.contents.some(d => d.resourceId === c.resourceId && String(d.version) === String(c.version) && d.spans.some(sp => sp.id === c.spanId && sp.text.length > 0)))
    const again = await post(); assert.equal(again.status, 200); assert.equal(((await again.json()) as { runId: string }).runId, runId)
    assert.equal((await fetch(`${url}/runs/${runId}/receipts.json`)).status, 200)
    const store = new Store(join(dir, 'app-state/researchagent/app/app.db'))
    try { assert.equal(store.getRun(runId).intents.length, 1) } finally { store.close() }
    results.push({ kind: 'app', sha256: sha256(file('mcp-tgz')), citations: citations.length, receipts: run.receipts.length, intents: run.intents.length, idempotent: true, capPreserved: true })
    results.push({ timing: 'app (simulated)', readySeconds, seconds: (performance.now() - started) / 1000 })
  await stopProcess(child)
}
await assertNoProcesses()
writeFileSync(join(root,'consumer-results.json'),JSON.stringify({ sourceSha: manifest.sourceSha, manifestSha256:sha256(manifestFile), mode:manifest.mode, runtime:manifest.runtime, verifiers:{receiptSha256:sha256(join(root,'accepted-receipt.json')),typescript:{command:'npm run verify:answer -- accepted-receipt.json --json',pass:true},python:{command:'python -m researchagent verify accepted-receipt.json --json',installation:'exact wheel in clean venv',pass:true},hosted:{wheelSha256:sha256(file('wheel')),typescriptSha256:sha256(file('mcp-tgz')),commands:['python -m researchagent verify <export> --json','npx <researchagent-mcp tgz> verify <export> --json'],exports:hostedRows}}, consumers:results },null,2)+'\n')
console.log(JSON.stringify(results,null,2))

})
