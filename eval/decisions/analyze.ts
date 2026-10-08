// Offline analysis of harness runs (#212): a compact port of bench/decisions/analyze.ts. It reads
// eval/decisions/out/runs/*.jsonl and the cached call records, and never calls a provider.
// Per arm × config × gap source × split: purchase precision/recall/F1 and wasted spend against the bank,
// addresses-gap discrimination and Brier against the in-domain labels, paid-relevance Brier, failed
// rounds, latency and cost; paired bootstrap and McNemar against a reference arm; and the calibration a
// dev split would select (reported only: calibrators are fitted in-domain last, in #207, never applied here).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chooseCalibration } from './calibration.js'
import { binaryMetrics, decisionMetrics, mcnemar, pairedBootstrap, percentile } from './metrics.js'
import type { RunRow } from './run.js'
import { outDir, save, type CallRecord } from './transport.js'

const mean = (a: number[]) => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null
export function loadRuns(dir = path.join(outDir(), 'runs')): RunRow[] {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir).filter(f => f.endsWith('.jsonl')).flatMap(f => fs.readFileSync(path.join(dir, f), 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l) as RunRow))
}
const loadCalls = (): Map<string, CallRecord> => {
  const dir = path.join(outDir(), 'cache')
  return new Map(fs.existsSync(dir) ? fs.readdirSync(dir).map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as CallRecord).map(c => [c.key, c]) : [])
}

export function summarizeRows(rows: RunRow[], calls: Map<string, CallRecord> = new Map()) {
  const candidate = rows.flatMap(r => r.judgments.length ? Object.entries(r.labels).map(([id, y]) => ({ y, p: r.judgments[Object.keys(r.labels).indexOf(id)]?.addressesGap ?? NaN, group: r.group })).filter(x => Number.isFinite(x.p)) : [])
  const paid = rows.flatMap(r => r.paid.filter(p => p.p !== null).map(p => ({ y: p.label, p: p.p as number, group: r.group })))
  const used = rows.flatMap(r => r.calls.map(k => calls.get(k)).filter((c): c is CallRecord => Boolean(c)))
  const decisionCalls = used.filter(c => c.kind !== 'paid')
  return {
    n: rows.length, failedRounds: rows.filter(r => r.failed).length, fallbackRounds: rows.filter(r => r.fallback).length,
    purchase: decisionMetrics(rows.map(r => ({ expected: r.expected, selected: r.selected, priceMinor: r.priceMinor }))),
    addressesGap: candidate.length ? { ...binaryMetrics(candidate.map(x => x.y), candidate.map(x => x.p)), bins: undefined } : null,
    paidRelevance: paid.length ? { ...binaryMetrics(paid.map(x => x.y), paid.map(x => x.p)), bins: undefined } : null,
    // Reported for #207 only; calibration is chosen on dev rows and never applied to a decision here.
    calibrationIfFitted: candidate.length && rows.every(r => r.split === 'dev') ? (({ method, cvBrier, nGroups, reason }) => ({ method, cvBrier, nGroups, reason }))(chooseCalibration(candidate.map(x => ({ p: x.p, y: x.y, group: x.group, split: 'dev' })))) : null,
    latency: { roundP50Ms: percentile(rows.map(r => r.decisionElapsedMs), 0.5), roundP95Ms: percentile(rows.map(r => r.decisionElapsedMs), 0.95), callP50Ms: percentile(decisionCalls.map(c => c.latencyMs), 0.5), callP95Ms: percentile(decisionCalls.map(c => c.latencyMs), 0.95), over3s: decisionCalls.filter(c => c.timeout3s).length },
    cost: { calls: used.length, usd: used.reduce((s, c) => s + c.usd, 0), usdPerRound: mean(rows.map(r => r.calls.map(k => calls.get(k)?.usd ?? 0).reduce((s, x) => s + x, 0))) },
  }
}

/** Paired comparison on the same scenario ids: F1 difference (A − B) with lane-clustered bootstrap, and McNemar on exact-match. */
export function compare(a: RunRow[], b: RunRow[]) {
  const ids = a.map(r => r.id).filter(id => b.some(r => r.id === id)).sort()
  const ra = ids.map(id => a.find(r => r.id === id)!), rb = ids.map(id => b.find(r => r.id === id)!)
  const f1 = (rows: RunRow[]) => decisionMetrics(rows.map(r => ({ expected: r.expected, selected: r.selected, priceMinor: r.priceMinor }))).f1
  return { n: ids.length, f1: pairedBootstrap(ra, rb, f1, 2000, undefined, ra.map(r => r.group)), exactMatch: mcnemar(ra.map(r => r.selected === r.expected), rb.map(r => r.selected === r.expected)) }
}

export function analyze(rows = loadRuns(), calls = loadCalls(), reference = 'fixture') {
  const key = (r: RunRow) => `${r.arm}|${r.config}|${r.gapSource}|${r.split}`
  const groups = new Map<string, RunRow[]>()
  for (const r of rows) groups.set(key(r), [...(groups.get(key(r)) ?? []), r])
  const cells = [...groups.entries()].map(([k, rs]) => {
    const [arm, config, gapSource, split] = k.split('|')
    const ref = [...groups.entries()].find(([k2]) => k2 !== k && k2.startsWith(`${reference}|`) && k2.endsWith(`|${gapSource}|${split}`))?.[1]
    return { arm, config, gapSource, split, ...summarizeRows(rs, calls), ...(ref && arm !== reference ? { versusReference: { reference, ...compare(rs, ref) } } : {}) }
  })
  return { generatedAt: new Date().toISOString(), label: 'REAL corpus · in-domain bank labels · SIMULATED purchases', cells }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = analyze()
  for (const c of result.cells) console.log(`${c.arm.padEnd(8)} ${c.config.padEnd(15)} ${c.gapSource.padEnd(11)} ${c.split.padEnd(5)} n=${c.n} F1=${c.purchase.f1.toFixed(3)} wasted=S$${(c.purchase.wastedSpend / 100).toFixed(2)} AUROC=${c.addressesGap?.auroc?.toFixed(3) ?? '–'} failed=${c.failedRounds}`)
  console.log(`Saved ${save('analysis.json', result)}`)
}
