import { Worker } from 'node:worker_threads'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname } from 'node:path'
import { execFileSync } from 'node:child_process'

export async function proofSim({ runs = 1000000, seed = 279, workers = 4, output = 'docs/evidence/proof/sim-summary.json' } = {}) {
  if (![runs,seed,workers].every(Number.isSafeInteger) || runs < 1 || seed < 1 || seed > 0xffffffff - workers + 1 || workers < 1 || workers > 4) throw Error('Invalid runs/seed/workers (workers must be 1–4)')
  const startedAt = new Date().toISOString()
  const testedCommit = execFileSync('git', ['rev-parse','HEAD'], { encoding: 'utf8' }).trim()
  const worktreeDirty = Boolean(execFileSync('git', ['status','--porcelain'], { encoding: 'utf8' }).trim())
  const sourceFiles = ['server/purchases.ts','server/store.ts','server/proofs.ts','server/xrpl.ts','scripts/proof/simulation.ts','scripts/proof/sim.mjs','scripts/proof/sim-worker.mjs']
  const sourceSha256 = Object.fromEntries(sourceFiles.map(path => [path, createHash('sha256').update(readFileSync(path)).digest('hex')]))
  const started = performance.now(), count = Math.min(workers,runs)
  const counts = Array.from({ length: count }, (_,i) => Math.floor(runs/count) + (i < runs%count ? 1 : 0))
  const active = [], progress = counts.map(() => 0)
  let results
  try {
    results = await Promise.all(counts.map((runs,i) => new Promise((resolve,reject) => {
      const worker = new Worker(new URL('./sim-worker.mjs', import.meta.url), {
        workerData: { runs, seed: seed+i }, execArgv: ['--import','tsx'],
        env: { PATH: process.env.PATH, HOME: process.env.HOME, LANGFUSE_ENABLED: '0', LLM_PROVIDER: 'fixture', DECISION_PROVIDER: 'fixture', SETTLEMENT_RAIL: 'simulated', SEARCH_EMBEDDINGS: 'off', DOTENV_CONFIG_PATH: '.playwright/no-env' },
      })
      active.push(worker)
      let result
      worker.on('message', msg => {
        if (msg.error) reject(Error(msg.error))
        else if (msg.result) result = msg.result
        else {
          progress[i] = msg.progress
          console.log(`proof schedules: ${progress.reduce((a,b) => a+b,0)}/${counts.reduce((a,b) => a+b,0)}`)
        }
      })
      worker.on('error', reject)
      worker.on('exit', code => code || !result ? reject(Error(`Proof worker exited ${code}`)) : resolve(result))
    })))
  } catch (error) {
    mkdirSync(dirname(output), { recursive: true })
    writeFileSync(output, JSON.stringify({ failed: true, testedCommit, sourceSha256, runs, seed, error: String(error) },null,2)+'\n')
    throw error
  } finally { await Promise.all(active.map(worker => worker.terminate())) }
  const durationMs = performance.now()-started
  const summary = {
    label: 'SYNTHETIC in-memory ledger; real PurchaseManager/SQLite Store; logical crash exceptions, pre-signed fixture blobs; no Testnet or live models',
    testedCommit, worktreeDirty, sourceSha256, startedAt, nodeVersion: process.version, platform: process.platform, runs, seed, workers: count, durationMs, schedulesPerSecond: runs/(durationMs/1000),
    violations: Object.fromEntries(['G1','G2','G3','G4','G5'].map(g => [g, results.reduce((a,r) => a+r.violations[g],0)])), results,
  }
  mkdirSync(dirname(output), { recursive: true })
  writeFileSync(output, JSON.stringify(summary,null,2)+'\n')
  console.log(JSON.stringify(summary))
  return summary
}
