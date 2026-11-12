import { runChild } from './chaos/child.mjs'
// Seeded fault schedule; isolated real child processes, bounded summary, no live credentials inherited.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { performance } from 'node:perf_hooks'

export const FAULTS = ['kill-before-sign','kill-after-sign','kill-after-submit','kill-after-validation','submit-timeout-before','submit-timeout-after','duplicate-submit','publisher-down','publisher-slow','engine-restart','identical-intents','sdk-retry','mcp-retry','hire-replay','refund-replay','sse-drop','caps','decision-down','provider-down']
export function random(seed) { let s = seed >>> 0; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296 } }
const childEnv = work => ({ PATH: process.env.PATH, HOME: work, NODE_NO_WARNINGS: '1', OFFSET: '1800', DEMO_PORT_OFFSET: '1800', LANGFUSE_ENABLED: '0',
  LLM_PROVIDER: 'fixture', DECISION_PROVIDER: 'fixture', SEARCH_EMBEDDINGS: 'off', SETTLEMENT_RAIL: 'simulated',
  RA_API_TOKEN: 'chaos-fixture-token', MCP_MAX_BUDGET_MINOR: '200', MCP_DAILY_CAP_MINOR: '1000', WALLET_DAILY_CAP_MINOR: '1000' })
const percentile = (xs, p) => [...xs].sort((a,b) => a-b)[Math.max(0, Math.ceil(xs.length*p)-1)] ?? null
export async function chaos({ runs = 500, seed = 279, soakMs = 0, output = 'scratch/chaos/latest.json' } = {}) {
  if (!Number.isSafeInteger(runs) || runs < 1 || !Number.isSafeInteger(seed) || seed < 1 || seed > 0xffffffff || !Number.isFinite(soakMs) || soakMs < 0) throw new Error('Invalid runs, seed or soak duration')
  const rng = random(seed), started = Date.now(), work = mkdtempSync(join(tmpdir(), 'ra-chaos-'))
  const summary = { schema: 'chaos-v1', label: 'SYNTHETIC fixture ledger; real SIGKILL; production API/SDK/MCP/publisher; no Testnet, providers or real value', seed,
    testedCommit: execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
    worktreeDirty: Boolean(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim()),
    startedAt: new Date(started).toISOString(), durationMs: 0, iterations: 0, faultsInjected: 0, processKills: 0, payments: 0, refunds: 0,
    recovered: 0, failedCleanly: 0, doubleCharges: 0, invariantViolations: 0, stuckReservations: 0, reservationsHeld: 0, byFault: {}, byUseCase: {},
    maxRssBytes: 0, maxHandles: 0, latencyMs: {}, lastMetrics: null, escrow: { iterations: 0, faultsInjected: 0, creates: 0, releases: 0, cancellations: 0, invariantViolations: 0 }, scope: 'Single payer writer; independent fresh stores per iteration, retained across crash; four escrow timeout/restart/downtime probes every 20 iterations' }
  const first = [], last = [], windows = [], samples = []
  summary.resourcePhases = {}; summary.windows = windows; summary.failures = []; summary.attempts = 0
  const flushWindow = () => {
    if (!samples.length) return
    windows.push({ endIteration: summary.attempts, samples: samples.length, elapsedMs: Date.now()-started, p95Ms: percentile(samples.map(s => s.elapsed), .95), childRssP50Bytes: percentile(samples.map(s => s.rss), .5), childRssMaxBytes: Math.max(...samples.map(s => s.rss)), parentRssBytes: process.memoryUsage().rss, maxHandles: Math.max(...samples.map(s => s.handles)), byFault: Object.fromEntries(FAULTS.map(f => [f, samples.filter(s => s.fault === f).length])) })
    samples.length = 0
  }
  const save = () => { summary.durationMs = Date.now()-started; summary.latencyMs = { firstWindowP95: percentile(first,.95), lastWindowP95: percentile(last,.95), p95DriftMs: first.length && last.length ? percentile(last,.95)-percentile(first,.95) : null }; mkdirSync(dirname(resolve(output)), { recursive: true }); writeFileSync(resolve(output)+'.tmp', JSON.stringify(summary,null,2)+'\n'); renameSync(resolve(output)+'.tmp', resolve(output)) }
  try {
    for (let n = 0; soakMs ? Date.now()-started < soakMs : n < runs; n++) {
      // Cover the complete fault matrix before drawing additional seeded faults.
      const fault = n < FAULTS.length ? FAULTS[n] : FAULTS[Math.floor(rng()*FAULTS.length)]
      const uc = ['refund-replay','identical-intents'].includes(fault) ? 'UC3' : ['kill-before-sign','kill-after-sign','kill-after-submit','kill-after-validation','submit-timeout-before','submit-timeout-after','duplicate-submit','publisher-down','publisher-slow','hire-replay','decision-down','provider-down','caps'].includes(fault) ? 'UC2' : `UC${1+Math.floor(rng()*4)}`
      const dir = join(work, 'iteration'); mkdirSync(dir)
      let begin = performance.now()
      summary.attempts++
      const checkWatchdog = (code, stage) => {
        if (!code.timedOut) return
        const context = { stage, iteration: n, fault, useCase: uc, seed: seed+n, ...code }
        for (const name of ['progress','phase','diagnostic']) {
          const path = join(dir, name+'.json')
          if (existsSync(path)) context[name] = JSON.parse(readFileSync(path,'utf8'))
        }
        const path = resolve(output)+`.watchdog-${n}.json`
        mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, JSON.stringify(context,null,2)+'\n')
        throw new Error(`Watchdog violation: iteration=${n} fault=${fault}/${uc} seed=${seed+n} stage=${stage} elapsedMs=${code.elapsedMs} report=${path} ${code.tail}`)
      }
      try {
        if (n % 20 === 0 && existsSync('server/escrow.ts')) {
          const probe = await runChild(['--import','./scripts/chaos/diagnostics.mjs','--import','tsx','scripts/chaos/escrow.ts',String(seed+n)], {
            env: { ...childEnv(work), CHAOS_DIAGNOSTIC_DIR: dir } })
          checkWatchdog(probe, 'escrow')
          if (probe.code !== 0) throw new Error(`Escrow probe violation: iteration=${n} seed=${seed+n} ${JSON.stringify(probe)}`)
          const escrow = JSON.parse(probe.tail.trim().split('\n').at(-1))
          for (const key of Object.keys(summary.escrow)) summary.escrow[key] += escrow[key]
        }
        begin = performance.now()
        for (let restart = 0; ; restart++) {
          const code = await runChild(['--import','./scripts/chaos/diagnostics.mjs','--import','tsx','scripts/chaos/worker.ts',dir,fault,uc,String(seed+n)], {
            cwd: fileURLToPath(new URL('..',import.meta.url)), env: childEnv(work) })
          checkWatchdog(code, 'worker')
          if (code.signal === 'SIGKILL' && restart === 0 && ['kill-before-sign','kill-after-sign','kill-after-submit','kill-after-validation','engine-restart'].includes(fault)) { summary.processKills++; continue }
          if (code.code !== 0) throw new Error(`iteration ${n} ${fault}/${uc}: exit=${code.code} signal=${code.signal} watchdog=${code.timedOut} elapsedMs=${code.elapsedMs} ${code.tail}`)
          break
        }
        const r = JSON.parse(readFileSync(join(dir,'result.json'),'utf8'))
        if (!r.faultsInjected) throw new Error(`Fault not exercised: ${fault}/${uc}`)
        summary.iterations++; summary.faultsInjected += r.faultsInjected; summary.payments += r.payments; summary.refunds += r.refunds
        summary[r.payments ? 'recovered' : 'failedCleanly']++
        summary.stuckReservations += r.stuckReservations; summary.reservationsHeld += r.reservationsHeld
        summary.maxRssBytes = Math.max(summary.maxRssBytes,r.rss); summary.maxHandles = Math.max(summary.maxHandles,r.handles)
        summary.byFault[fault] = (summary.byFault[fault]??0)+1; summary.byUseCase[uc] = (summary.byUseCase[uc]??0)+1
        summary.lastMetrics = r.metrics
        for (const row of r.phaseMetrics ?? []) summary.resourcePhases[row.phase] = Math.max(summary.resourcePhases[row.phase] ?? 0, row.rss)
        const elapsed = performance.now()-begin; samples.push({ elapsed, fault, rss: r.rss, handles: r.handles }); if (samples.length === 50) flushWindow(); if (first.length < 100) first.push(elapsed); last.push(elapsed); if (last.length>100) last.shift()
        save()
        if (summary.iterations % 20 === 0) console.log(JSON.stringify({ iterations: summary.iterations, durationMs: summary.durationMs, invariantViolations: summary.invariantViolations }))
      } catch (e) { summary.invariantViolations++; if (/Double charge/.test(String(e))) summary.doubleCharges++; summary.failure = String(e); if (summary.failures.length < 100) summary.failures.push({ iteration: n, fault, useCase: uc, error: String(e) }); console.error(summary.failure); save() }
      finally { rmSync(dir,{ recursive:true,force:true }) }
    }
    flushWindow(); save(); console.log(JSON.stringify(summary)); return summary
  } finally { rmSync(work,{recursive:true,force:true}) }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const proofMode = process.argv.includes('--proof-sim')
  const args = process.argv.slice(2).filter(a => a !== '--proof-sim'), value = name => { const i = args.indexOf(name); return i<0 ? undefined : args[i+1] }
  if (proofMode) {
    if (args.length%2 || args.some((a,i) => i%2===0 && !['--runs','--seed','--workers','--output'].includes(a))) throw new Error('Usage: npm run proof:sim -- [--runs 1000000] [--seed 279] [--workers 4] [--output path]')
    const { proofSim } = await import('./proof/sim.mjs')
    await proofSim({ runs: Number(value('--runs')??1000000), seed: Number(value('--seed')??279), workers: Number(value('--workers')??4), output: value('--output') })
  } else {
  if (args.some((a,i) => i%2===0 && !['--runs','--seed','--soak','--output'].includes(a)) || args.length%2) throw new Error('Usage: npm run chaos -- [--runs 500] [--seed 279] [--soak 12h] [--output path]')
  let soakMs = 0
  if (value('--soak')) { const m = /^(\d+(?:\.\d+)?)(s|m|h)$/.exec(value('--soak')); if (!m || Number(m[1])<=0) throw new Error('Use --soak 12h (or 30m)'); soakMs = Number(m[1])*({s:1000,m:60000,h:3600000}[m[2]]) }
  const result = await chaos({ runs: Number(value('--runs')??500), seed: Number(value('--seed')??279), soakMs, output: value('--output') }); if (result.invariantViolations) process.exitCode = 1
  }
}
