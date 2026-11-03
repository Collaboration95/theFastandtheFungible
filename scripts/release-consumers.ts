import { execFileSync, spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import assert from 'node:assert/strict'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { startEngine } from '../server/engine.js'
import type { AskResult } from '../sdk/index.js'
import { Store } from '../server/store.js'
import { sha256 } from './release-contract.mjs'
const manifestFile = resolve(process.argv[2]), root = dirname(manifestFile)
const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'))
const dir = mkdtempSync(join(tmpdir(), 'ra-consumers-'))
const file = (kind: string) => join(root, manifest.artifacts.find((a: {kind: string}) => a.kind === kind).file)
const run = (cmd: string, args: string[]) => new Promise<string>((res, rej) => { const p = spawn(cmd, args, { cwd: dir, env: process.env }); let out = '', err = ''; p.stdout.on('data', c => out += c); p.stderr.on('data', c => err += c); p.on('error', rej); p.on('exit', code => code === 0 ? res(out) : rej(Error(err))) })
const question = 'What is the analyst outlook on the Kestrel Semiconductor deal with TSMC (pricing & margins)?'
const results: object[] = []
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
  await run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', file('tgz')])
  writeFileSync(join(dir, 'consumer.mjs'), `import {createClient} from '@researchagent/sdk'; const c=createClient(${JSON.stringify({ baseUrl: engine.apiUrl, token: engine.apiToken })}); const a=await c.ask(${JSON.stringify(question)},{budgetSgd:999,idempotencyKey:'tgz'}); const b=await c.ask(${JSON.stringify(question)},{budgetSgd:999,idempotencyKey:'tgz'}); console.log(JSON.stringify([a,b]));`)
  const store = new Store(join(dir, 'engine/app.db'))
  try {
    const [a,b] = JSON.parse(await run(process.execPath, ['consumer.mjs'])); check('tgz',a,b,store)
    await run('python3', ['-m','venv',join(dir,'venv')]); const python = join(dir,'venv/bin/python')
    await run(python, ['-m','pip','install','--no-deps',file('wheel')])
    writeFileSync(join(dir,'consumer.py'), `import json\nfrom researchagent import Client\nc=Client(${JSON.stringify(engine.apiUrl)}, token=${JSON.stringify(engine.apiToken)})\na=c.ask(${JSON.stringify(question)},budget=999,idempotency_key='wheel').result()\nb=c.ask(${JSON.stringify(question)},budget=999,idempotency_key='wheel').result()\nassert c.verify(c.receipts(a['run_id']))['ok']\nprint(json.dumps([a,b]))\n`)
    const [pa,pb] = JSON.parse(await run(python, ['consumer.py'])); check('wheel',pa,pb,store)
  } finally { store.close() }
} finally { await engine.close() }
const bundle = join(dir,'bundle'); execFileSync('unzip',['-q',file('mcpb'),'-d',bundle])
const transport = new StdioClientTransport({ command: process.execPath, args: [join(bundle,'mcp/extension.mjs')], env: { ...process.env as Record<string,string>, RA_DATA_DIR: join(dir,'mcp-data'), RA_LIVE:'0' }, stderr: 'pipe' })
const client = new Client({name:'release-consumer',version:'1'})
try {
  await client.connect(transport)
  const ask = async () => { const r = await client.callTool({name:'ask_expert',arguments:{question,budget_sgd:999,idempotency_key:'mcpb'}}); assert(!r.isError); return JSON.parse((r.content as {text:string}[])[0].text) }
  const a = await ask(), b = await ask(); const store = new Store(join(dir,'mcp-data/app.db'))
  try { check('mcpb',a,b,store) } finally { store.close() }
} finally { await client.close() }
writeFileSync(join(root,'consumer-results.json'),JSON.stringify({ sourceSha: manifest.sourceSha, manifestSha256:sha256(manifestFile), mode:manifest.mode, runtime:manifest.runtime, consumers:results },null,2)+'\n')
console.log(JSON.stringify(results,null,2))
