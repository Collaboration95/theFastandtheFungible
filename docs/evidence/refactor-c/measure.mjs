// Run with node --import tsx. Local packed bytes; public Testnet faucet only.
import { ResourceScope } from '../../../shared/resource-scope.ts'
import { writeFileSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
const evidence = resolve('docs/evidence/refactor-c')
const tgz = resolve(process.argv[2])
const results = { node: process.version, tgzBytes: statSync(tgz).size, runs: [] }
for (let run = 1; run <= 3; run++) {
  for (const mode of ['init', 'app', 'try']) {
    const scope = new ResourceScope()
    const root = scope.evidenceDir(`refactor-c-${run}-${mode}-`, 'Private Testnet wallets and journals; retain for manual reconciliation')
    const started = performance.now()
    let output = '', stderr = '', timedOut = false
    try {
      const child = scope.spawn('npx', ['-y', '--cache', join(root, 'npm-cache'), pathToFileURL(tgz).href, ...(mode === 'init' ? ['--testnet'] : [mode, '--testnet'])], { cwd: root, env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, XDG_STATE_HOME: join(root, 'state') } })
      child.stdout.on('data', d => { output += d })
      child.stderr.on('data', d => { stderr += d })
      const code = await new Promise(resolveCode => {
        const timer = scope.timer(setTimeout(() => { timedOut = true; resolveCode(null) }, 90_000))
        const finish = code => { clearTimeout(timer); resolveCode(code) }
        child.once('error', () => finish(-1))
        child.once('exit', finish)
        if (mode === 'init') child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'refactor-c', version: '1' } } }) + '\n')
        if (mode !== 'try') child.stdout.on('data', () => {
          if (mode === 'init' ? /"id":1/.test(output) : /ResearchAgent ready: http:\/\/127\.0\.0\.1:\d+ · fixture models · XRPL TESTNET · no real value/.test(output)) finish(0)
        })
      })
      const seconds = (performance.now() - started) / 1000
      const pass = code === 0 && !timedOut && (mode !== 'try' || (/RESULT PASS/.test(output) && !/SIMULATED/.test(output) && (output.match(/^\d\. .*https:\/\/testnet.xrpl.org\/transactions\/[A-F0-9]{64}$/gm) ?? []).length === 6))
      results.runs.push({ run, mode, seconds, exitCode: code, timedOut, pass, freshNpmCache: true, coldWallets: true })
      // Only public, redacted process output enters repository evidence.
      const safe = text => text.replace(/\bs(?:Ed[1-9A-HJ-NP-Za-km-z]{20,}|[1-9A-HJ-NP-Za-km-z]{27,})\b/g, '[REDACTED]').replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
      writeFileSync(join(evidence, `run-${run}-${mode}.txt`), safe(output + '\nSTDERR\n' + stderr))
      writeFileSync(join(evidence, 'timings.json'), JSON.stringify(results, null, 2) + '\n')
      console.log(JSON.stringify(results.runs.at(-1)))
    } finally { await scope.close() }
  }
}
