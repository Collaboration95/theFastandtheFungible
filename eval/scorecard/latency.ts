import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { setTimeout as pause } from 'node:timers/promises'
import type { RunSnapshot } from '../../shared/contracts/index.js'
import type { World } from '../decisions/world.js'
import type { Question } from '../questions/bank.js'
import type { Observation } from '../../tests/scenarios/harness.js'

export async function measureLatency(dir: string, questions: Question[], world: World, live: boolean) {
  mkdirSync(dir, { recursive: true })
  // No demo keys, wallet seeds, tracing or ambient provider configuration reaches the child.
  const env: NodeJS.ProcessEnv = { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR,
    ...Object.fromEntries(Object.entries(process.env).filter(([k]) => k.startsWith('EVAL_'))),
    LLM_PROVIDER: 'fixture', DECISION_PROVIDER: 'openai', DECISION_MODEL: 'gpt-6-luna', DECISIONS_WORDING: 'evidence', DECISIONS_GAP_WORDING: 'plain', DECISIONS_MAX_QUESTIONS: '25',
    DECISION_VALUE_POLICY: process.env.DECISION_VALUE_POLICY, DECISION_CALIBRATION: '', BUY_THRESHOLD: '', SETTLEMENT_RAIL: 'simulated', SEARCH_EMBEDDINGS: 'off', LANGFUSE_ENABLED: '0' }
  const started = performance.now()
  const child = spawn(process.execPath, ['--import', 'tsx', 'eval/scorecard/boot.ts', resolve(dir), ...(live ? ['--live'] : [])], { env, stdio: ['ignore', 'pipe', 'pipe'] })
  let output = '', endpoint: { base: string; publisher: string } | undefined
  child.stdout.on('data', d => { output += String(d); for (const line of output.split('\n')) try { const v = JSON.parse(line); if (v.base) endpoint = v } catch { /* startup text */ } })
  child.stderr.resume() // No provider errors or environment values are published.
  const observations: Observation[] = [], samples: { questionId: string; runId: string; firstMs: number; finalMs: number }[] = []
  try {
    const deadline = performance.now() + 30_000
    while (!endpoint) { if (child.exitCode !== null || performance.now() > deadline) throw new Error('Scorecard boot failed or timed out'); await pause(10) }
    const { base, publisher } = endpoint
    const health = await fetch(base + '/health', { signal: AbortSignal.timeout(5000) })
    if (!health.ok) throw new Error('Scorecard API unhealthy')
    const coldStartMs = performance.now() - started
    for (const q of questions) {
      const t = performance.now()
      const response = await fetch(base + '/runs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: q.question, budgetMinor: 200, ...(q.answers ? { answers: q.answers } : {}) }), signal: AbortSignal.timeout(5000) })
      if (!response.ok) throw new Error('Scorecard ask failed')
      const initial = await response.json() as RunSnapshot
      let firstMs: number | undefined, final: RunSnapshot | undefined
      const abort = new AbortController()
      const sse = await fetch(`${base}/runs/${initial.runId}/events`, { signal: abort.signal })
      if (!sse.ok || !sse.body) throw new Error('Scorecard SSE unavailable')
      const reader = sse.body.getReader()
      const stream = (async () => {
        let pending = ''; const decoder = new TextDecoder()
        try {
          while (true) {
            const next = await reader.read(); if (next.done) break
            pending += decoder.decode(next.value, { stream: true })
            const frames = pending.split('\n\n'); pending = frames.pop()!
            for (const frame of frames) {
              const raw = frame.split('\n').find(l => l.startsWith('data: '))?.slice(6); if (!raw) continue
              const v = JSON.parse(raw)
              const snapshot = frame.startsWith('event: snapshot') ? v as RunSnapshot : undefined
              if (snapshot?.answers.length && firstMs === undefined) firstMs = performance.now() - t
              observations.push({ kind: 'SSE', raw, runId: initial.runId, grants: snapshot?.grants.filter(g => snapshot.intents.some(i => i.intentId === g.intentId && i.status === 'VERIFIED')) ?? [] })
            }
          }
        } catch (e) { if (!abort.signal.aborted) throw e }
        finally { await reader.cancel().catch(() => undefined) }
      })()
      try {
        const timeout = performance.now() + (live ? 180_000 : 20_000)
        while (!final) {
          const r = await fetch(`${base}/runs/${initial.runId}`, { signal: AbortSignal.timeout(5000) })
          if (!r.ok) throw new Error('Scorecard snapshot failed')
          const snapshot = await r.json() as RunSnapshot
          if (snapshot.answers.length && firstMs === undefined) firstMs = performance.now() - t
          if (['DONE', 'FAILED', 'STOPPED'].includes(snapshot.phase)) final = snapshot
          else { if (performance.now() > timeout) throw new Error('Scorecard run timed out'); await pause(10) }
        }
        if (final.phase !== 'DONE' || firstMs === undefined || !final.answers.length) throw new Error('Scorecard run failed to produce a complete answer')
        samples.push({ questionId: q.id, runId: final.runId, firstMs, finalMs: performance.now() - t })
      } finally { abort.abort(); await stream }
      // Audit real wire search hits independently of the API's schema projection.
      for (const p of world.corpus.publishers) {
        const r = await fetch(`${publisher}/w/${p.slug}/search?q=${encodeURIComponent(q.question)}&k=3`, { signal: AbortSignal.timeout(5000) })
        if (!r.ok) throw new Error('Scorecard search audit failed')
        observations.push({ kind: 'search hit', raw: await r.text(), runId: initial.runId, grants: [] })
      }
    }
    const operations = await (await fetch(base + '/api/metrics', { signal: AbortSignal.timeout(5000) })).json()
    return { operations, coldStartMs, boot: 'booted demo API + publisher (fresh child process; module load included)', samples, observations, dbPath: resolve(dir, 'api.db') }
  } finally {
    if (child.exitCode === null) { const exited = once(child, 'exit'); child.kill('SIGTERM'); const timer = setTimeout(() => child.kill('SIGKILL'), 3000); await exited; clearTimeout(timer) }
  }
}
