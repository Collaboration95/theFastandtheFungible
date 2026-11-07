import { ResourceScope } from '../shared/resource-scope.js'
// Explicit network opt-in. Simulated fallback never satisfies live admission.
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { stopProcess } from './release-processes.js'
if (process.env.RA_ACCEPT_TESTNET !== '1') throw Error('RA_ACCEPT_TESTNET=1 required')
const manifestFile = resolve(process.argv[2] ?? 'dist/release/manifest.json')
const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'))
const tgz = resolve(dirname(manifestFile), manifest.artifacts.find((a: { kind: string }) => a.kind === 'mcp-tgz').file)
const scope = new ResourceScope()
try {
const scratch = scope.evidenceDir('ra-try-consumer-', 'Testnet wallets and potentially signed obligations; retain for manual reconciliation')
const started = performance.now()
const child = scope.spawn('npx', ['-y', '--cache', join(scratch, 'cache'), pathToFileURL(tgz).href, 'try', '--testnet'], { cwd: scratch, env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, XDG_STATE_HOME: join(scratch, 'state') } })
let output = ''
child.stdout.on('data', data => { output += data })
child.stderr.resume()
const timer = setTimeout(() => { void stopProcess(child) }, 90_000)
try {
  const code = await new Promise<number | null>((done, fail) => { child.once('error', fail); child.once('exit', done) })
  const seconds = (performance.now() - started) / 1000
  const evidence = resolve('docs/evidence/round4-j2'); mkdirSync(evidence, { recursive: true })
  writeFileSync(join(evidence, 'try-output.txt'), output)
  writeFileSync(join(evidence, 'try-timing.json'), JSON.stringify({ sourceSha: manifest.sourceSha, seconds, exitCode: code, freshNpmCache: true, freshWallets: true }, null, 2) + '\n')
  assert.equal(code, 0); assert(seconds <= 90, 'cold try exceeded 90 s')
  assert(!output.includes('SIMULATED'), 'fallback is labelled but cannot satisfy live acceptance')
  assert.match(output, /RESULT PASS\s*$/)
  assert.equal((output.match(/^\d\. .*https:\/\/testnet.xrpl.org\/transactions\/[A-F0-9]{64}$/gm) ?? []).length, 6)
  assert.match(output, /writer-signed/); assert.match(output, /sha256\(K\) = Condition ✓/)
  console.log(output)
} finally { clearTimeout(timer); await stopProcess(child);  }

} finally { await scope.close() }
