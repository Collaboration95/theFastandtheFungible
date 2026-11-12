import { existsSync, readFileSync, renameSync, truncateSync, writeFileSync, openSync, closeSync, unlinkSync } from 'node:fs'

export function atomicJson(path: string, value: unknown) {
  const temp = `${path}.tmp`
  writeFileSync(temp, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 })
  renameSync(temp, path)
}
export function resumeState<T>(path: string, identity: Record<string, unknown>): T | undefined {
  if (!existsSync(path)) return undefined
  const saved = JSON.parse(readFileSync(path, 'utf8'))
  if (JSON.stringify(saved.identity) !== JSON.stringify(identity)) throw new Error('R3 resume configuration changed; use a new output directory')
  return saved as T
}

/** A killed append can leave a partial final SSE frame. Keep every complete line. */
export function readObservations<T>(path: string): T[] {
  if (!existsSync(path)) return []
  const bytes = readFileSync(path), end = bytes.lastIndexOf(10) + 1
  if (end < bytes.length) truncateSync(path, end)
  return bytes.subarray(0, end).toString('utf8').split('\n').filter(Boolean).map(line => JSON.parse(line) as T)
}

/** One process owns the cumulative cost ledger; a killed owner can be recovered. */
export function lockLedger(path: string): () => void {
  const lock = path + '.lock'
  if (existsSync(lock)) {
    const pid = Number(readFileSync(lock, 'utf8'))
    if (!Number.isSafeInteger(pid) || pid < 1) throw Error('Invalid cost-ledger lock; inspect before retrying')
    let alive = true
    try { process.kill(pid, 0) } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ESRCH') alive = false }
    if (alive) throw Error('Cost ledger is already in use')
    unlinkSync(lock)
  }
  const fd = openSync(lock, 'wx', 0o600)
  try { writeFileSync(fd, String(process.pid)) } finally { closeSync(fd) }
  return () => { if (existsSync(lock) && readFileSync(lock, 'utf8') === String(process.pid)) unlinkSync(lock) }
}

/** Flags alone cannot turn an old/default corpus into the real profile. */
export function assertRealCorpus(corpus: { publishers: { slug: string; synthetic?: boolean }[] }) {
  const required = ['xrpl-docs', 'x402-docs', 'ledger-analytics']
  if (corpus.publishers.some(p => p.synthetic !== false) || !required.every(slug => corpus.publishers.some(p => p.slug === slug))) {
    throw Error('Real profile unavailable or fictional publishers admitted; wait for CONTENT and build public docs')
  }
}

/** Peak input-byte/output-token bounds include all prior unsettled calls. */
export function reserveModelCall(costs: {actual:number;reserved:number;calls:number;missingUsage:number}, requestBytes: number, ceilingUsd = 5): number {
  if (!Number.isFinite(ceilingUsd) || ceilingUsd <= 0 || ceilingUsd > 5) throw Error('Invalid model-spend ceiling')
  if (!Number.isSafeInteger(requestBytes) || requestBytes < 0) throw Error('Invalid model request size')
  const reservation = ((requestBytes + 1024) * .3 + 3000 * 1.2) / 1e6
  if (costs.actual + costs.reserved + reservation > ceilingUsd) throw Error(`US$${ceilingUsd} model-spend ceiling reached`)
  costs.reserved += reservation
  costs.calls++
  costs.missingUsage++
  return reservation
}

/** Planner substitutions have labels, but do not emit writer fallback events. */
export function modelFallbacks(run: {labels:{plan?:string};answers:{provider:string}[];events:{type:string}[]}) {
  const plannerFallbacks = run.labels.plan?.startsWith('fixture') ? 1 : 0
  const writerFallbacks = run.events.filter(e => e.type === 'MODEL_FALLBACK').length
  const fixtureAnswers = run.answers.filter(a => a.provider === 'fixture').length
  return {plannerFallbacks,writerFallbacks,fixtureAnswers,fallbacks:plannerFallbacks+writerFallbacks,liveOnly:plannerFallbacks===0&&writerFallbacks===0&&fixtureAnswers===0}
}
