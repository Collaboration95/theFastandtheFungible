import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import assert from 'node:assert/strict'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { ReadBuffer, serializeMessage } from '@modelcontextprotocol/sdk/shared/stdio.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import { managedSpawn, stopProcess, assertNoProcesses } from './release-processes.js'
import { startEngine } from '../server/engine.js'
import type { AskResult } from '../sdk/index.js'
import { Store } from '../server/store.js'
import { sha256 } from './release-contract.mjs'
const manifestFile = resolve(process.argv[2]), root = dirname(manifestFile)
const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'))
const dir = mkdtempSync(join(tmpdir(), 'ra-consumers-'))
const file = (kind: string) => join(root, manifest.artifacts.find((a: {kind: string}) => a.kind === kind).file)
const run = async (cmd: string, args: string[]) => {
  const p = managedSpawn(cmd, args, { cwd: dir, env: process.env })
  let out = '', err = ''
  p.stdout.on('data', c => out += c)
  p.stderr.on('data', c => err += c)
  try {
    await new Promise<void>((res, rej) => {
      p.once('error', rej)
      p.once('exit', code => code === 0 ? res() : rej(Error(err)))
    })
    return out
  } finally { await stopProcess(p) }
}
const question = 'How did the Kestrel-TSMC deal change margins?'
const results: object[] = []
try {
const engine = await startEngine({ dataDir: join(dir, 'engine') })
const check = (kind: string, a: AskResult, b: AskResult, store: Store) => {
  assert.equal(a.run_id, b.run_id); assert(a.citations.length > 0); assert.equal(a.receipts.length, 1); assert(a.spentMinor <= 200); assert(a.budgetMinor <= 200)
  const snapshot = store.getRun(a.run_id)!
  assert.equal(snapshot.intents.length, 1)
  assert.equal(snapshot.intents[0].status, 'VERIFIED')
  for (const c of a.citations) assert(snapshot.contents.some(d => d.resourceId === c.resourceId && d.version === c.version && d.spans.some(s => s.id === c.spanId && s.text === c.passage)))
  results.push({ kind, sha256: sha256(file(kind)), citations: a.citations.length, receipts: a.receipts.length, intents: snapshot.intents.length, idempotent: true, capPreserved: true })
}
try {
  writeFileSync(join(dir, 'package.json'), '{"type":"module","private":true}')
  const tsStart = performance.now()
  await run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', pathToFileURL(file('tgz')).href])
  writeFileSync(join(dir, 'consumer.mjs'), `import {createClient} from '@researchagent/sdk'; const c=createClient(${JSON.stringify({ baseUrl: engine.apiUrl, token: engine.apiToken })}); const a=await c.ask(${JSON.stringify(question)},{budgetSgd:999,idempotencyKey:'tgz'}); const b=await c.ask(${JSON.stringify(question)},{budgetSgd:999,idempotencyKey:'tgz'}); console.log(JSON.stringify([a,b]));`)
  const store = new Store(join(dir, 'engine/app.db'))
  try {
    const [a,b] = JSON.parse(await run(process.execPath, ['consumer.mjs'])); check('tgz',a,b,store); results.push({timing:'TypeScript',seconds:(performance.now()-tsStart)/1000})
    const receiptPath=join(root,'accepted-receipt.json')
    const receiptResponse=await fetch(engine.apiUrl+`/runs/${encodeURIComponent(a.run_id)}/receipts.json`,{headers:{Authorization:'Bearer '+engine.apiToken}})
    assert(receiptResponse.ok);writeFileSync(receiptPath,JSON.stringify(await receiptResponse.json(),null,2)+'\n')
    console.log(await run('npm',['--prefix',process.cwd(),'run','verify:answer','--',receiptPath,'--json']))
    const pyStart = performance.now()
    await run('python3', ['-m','venv',join(dir,'venv')]); const python = join(dir,'venv/bin/python')
    await run(python, ['-m','pip','install','--no-deps',pathToFileURL(file('wheel')).href])
    console.log(await run(python,['-m','researchagent','verify',join(root,'accepted-receipt.json'),'--json']))
    writeFileSync(join(dir,'consumer.py'), `import json\nfrom researchagent import Client\nc=Client(${JSON.stringify(engine.apiUrl)}, token=${JSON.stringify(engine.apiToken)})\na=c.ask(${JSON.stringify(question)},budget=999,idempotency_key='wheel').result()\nb=c.ask(${JSON.stringify(question)},budget=999,idempotency_key='wheel').result()\nassert c.verify(c.receipts(a['run_id']))['ok']\nprint(json.dumps([a,b]))\n`)
    const [pa,pb] = JSON.parse(await run(python, ['consumer.py'])); check('wheel',pa,pb,store); results.push({timing:'Python',seconds:(performance.now()-pyStart)/1000})
    await run('python3',['-m','venv',join(dir,'sdist-venv')])
    const sdistPython=join(dir,'sdist-venv/bin/python')
    await run(sdistPython,['-m','pip','install','--no-deps',file('sdist')])
    writeFileSync(join(dir,'sdist-consumer.py'),readFileSync(join(dir,'consumer.py'),'utf8').replaceAll("idempotency_key='wheel'","idempotency_key='sdist'"))
    const [sa,sb]=JSON.parse(await run(sdistPython,['sdist-consumer.py']));check('sdist',sa,sb,store)
  } finally { store.close() }
} finally { await engine.close() }
const bundle = join(dir,'bundle'); execFileSync('unzip',['-q',file('mcpb'),'-d',bundle])
for (const kind of ['mcpb', 'mcp-tgz']) {
const started = performance.now()
const child = managedSpawn(kind === 'mcpb' ? process.execPath : 'npx', kind === 'mcpb' ? [join(bundle,'mcp/extension.mjs')] : ['--yes', '--cache', join(dir,'npx-cache'), pathToFileURL(file(kind)).href], { env: { ...process.env, RA_DATA_DIR: join(dir,kind+'-data'), RA_LIVE:'0' }, cwd: dir })
const buffer = new ReadBuffer()
const transport: Transport = {
  async start() {
    child.on('error', error => transport.onerror?.(error))
    child.stderr.resume()
    child.stdout.on('data', chunk => {
      try {
        buffer.append(chunk)
        let message
        while ((message = buffer.readMessage()) !== null) transport.onmessage?.(message)
      } catch (error) { transport.onerror?.(error as Error) }
    })
    child.once('exit', () => transport.onclose?.())
  },
  async send(message) {
    await new Promise<void>((done, fail) => child.stdin.write(serializeMessage(message), error => error ? fail(error) : done()))
  },
  async close() { await stopProcess(child); buffer.clear() },
}
const client = new Client({name:'release-consumer',version:'1'})
try {
  await client.connect(transport)
  assert((await client.listTools()).tools.some(t => t.name === 'ask_expert'))
  const ask = async () => { const r = await client.callTool({name:'ask_expert',arguments:{question,budget_sgd:999,idempotency_key:'mcpb'}}); assert(!r.isError); return JSON.parse((r.content as {text:string}[])[0].text) }
  const a = await ask(), b = await ask(); const store = new Store(join(dir,kind+'-data/app.db'))
  try { check(kind,a,b,store); if (kind === 'mcp-tgz') results.push({timing:'MCP npx',seconds:(performance.now()-started)/1000}) } finally { store.close() }
} finally { try { await client.close() } finally { await stopProcess(child) } }
}
// `app`: the packed tgz serves the web UI and engine on one command (simulated; the Testnet variant is opt-in elsewhere).
{
  const started = performance.now()
  const child = managedSpawn('npx', ['--yes', '--cache', join(dir, 'npx-cache-app'), pathToFileURL(file('mcp-tgz')).href, 'app'], { cwd: dir, env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, XDG_STATE_HOME: join(dir, 'app-state') } as NodeJS.ProcessEnv })
  let out = ''
  child.stdout.on('data', chunk => out += chunk)
  child.stderr.resume()
  try {
    const url = await new Promise<string>((done, fail) => {
      const timer = setTimeout(() => fail(Error('app never printed its ready line')), 90_000)
      const poll = setInterval(() => { const m = out.match(/ResearchAgent ready: (http:\/\/127\.0\.0\.1:\d+) · fixture models · SIMULATED rail · no real value/); if (m) { clearTimeout(timer); clearInterval(poll); done(m[1]) } }, 50)
      child.once('exit', code => { clearTimeout(timer); clearInterval(poll); fail(Error('app exited early (' + code + ')')) })
    })
    const page = await (await fetch(url)).text()
    assert(/<div id="root"/.test(page) && /<script type="module"/.test(page), 'UI HTML not served')
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
  } finally { await stopProcess(child) }
}
await assertNoProcesses()
writeFileSync(join(root,'consumer-results.json'),JSON.stringify({ sourceSha: manifest.sourceSha, manifestSha256:sha256(manifestFile), mode:manifest.mode, runtime:manifest.runtime, verifiers:{receiptSha256:sha256(join(root,'accepted-receipt.json')),typescript:{command:'npm run verify:answer -- accepted-receipt.json --json',pass:true},python:{command:'python -m researchagent verify accepted-receipt.json --json',installation:'exact wheel in clean venv',pass:true}}, consumers:results },null,2)+'\n')
console.log(JSON.stringify(results,null,2))

} finally {
  await assertNoProcesses()
  if (process.env.KEEP_CONSUMER_SCRATCH === '1') console.log('Consumer scratch retained: ' + dir)
  else rmSync(dir, {recursive:true, force:true})
}
