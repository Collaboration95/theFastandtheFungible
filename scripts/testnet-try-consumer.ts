import { packedArtifact, withPackedSession } from './packed-consumer.js'
// Explicit network opt-in. Simulated fallback never satisfies live admission.
import assert from 'node:assert/strict'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { stopProcess } from './release-processes.js'
const { manifest, tgz } = packedArtifact(process.argv[2])
await withPackedSession(true, async ({ spawnPacked }) => {
const started = performance.now()
const child = spawnPacked(tgz, ['try', '--testnet'])
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

})
