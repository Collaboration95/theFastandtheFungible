// Per-window memory table and baseline what-if for same-engine soak reports (read-only).
// Usage: node docs/evidence/soak-nov11/windows.mjs <soak.json|soak.json.gz>... [--window 200] [--json out.json]
import { readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { basename } from 'node:path'

const MiB = 1024 ** 2
const quantile = (xs, q) => { const a = xs.filter(Number.isFinite).sort((x, y) => x - y); return a.length ? a[Math.max(0, Math.ceil(q * a.length) - 1)] : NaN }
const median = xs => quantile(xs, 0.5)
const args = process.argv.slice(2)
const flag = name => { const i = args.indexOf(name); if (i < 0) return undefined; const v = args[i + 1]; args.splice(i, 2); return v }
const W = Number(flag('--window') ?? 200)
const jsonOut = flag('--json')

/** Same formulas as scripts/soak-same-engine.mjs compare(): MiB per 100 asks, median of last 100 minus first 100. */
function gatesFrom(rows) {
  const xbar = rows.reduce((s, r) => s + r.n, 0) / rows.length, ybar = rows.reduce((s, r) => s + r.rss, 0) / rows.length
  const slope = rows.reduce((s, r) => s + (r.n - xbar) * (r.rss - ybar), 0) / rows.reduce((s, r) => s + (r.n - xbar) ** 2, 0) * 100 / MiB
  const growth = (median(rows.slice(-100).map(r => r.rss)) - median(rows.slice(0, 100).map(r => r.rss))) / MiB
  return { asks: rows.length, slope: +slope.toFixed(3), medianGrowth: +growth.toFixed(1) }
}

const out = []
for (const file of args) {
  const raw = readFileSync(file)
  const r = JSON.parse((file.endsWith('.gz') ? gunzipSync(raw) : raw).toString('utf8'))
  // Global ask order: warm-up first, then measured; n counts successful asks from the first warm-up ask.
  const asks = [...r.asks.filter(a => a.stage === 'warmup'), ...r.asks.filter(a => a.stage === 'measured')].filter(a => a.ok).map((a, n) => ({ ...a, n }))
  const warm = r.options.warmup
  // Per-second samples carry the measured-stage completion count; warm-up samples belong to the first `warm` asks.
  const samples = r.samples.filter(s => s.worker && (s.stage === 'warmup' || s.stage === 'measured')).map(s => ({ ...s, n: s.stage === 'warmup' ? 0 : warm + s.completed }))
  const windows = []
  for (let lo = 0; lo < asks.length; lo += W) {
    const win = asks.slice(lo, lo + W), hi = lo + win.length
    const ss = samples.filter(s => (s.stage === 'warmup' ? lo < warm : s.n >= lo && s.n < hi))
    const m = f => +(median(ss.map(f)) / MiB).toFixed(0)
    windows.push({
      asks: `${lo}-${hi - 1}`, stage: win[0].stage,
      rssMedianMiB: +(median(win.map(a => a.rss)) / MiB).toFixed(0), rssMaxMiB: +(Math.max(...win.map(a => a.rss)) / MiB).toFixed(0),
      engineHeapUsedMiB: m(s => s.worker.memory.heapUsed), engineHeapTotalMiB: m(s => s.worker.memory.heapTotal), engineExternalMiB: m(s => s.worker.memory.external),
      harnessHeapUsedMiB: m(s => s.hostMemory.heapUsed), harnessHeapTotalMiB: m(s => s.hostMemory.heapTotal),
      outsideHeapsMiB: m(s => s.rss - s.worker.memory.heapTotal - s.hostMemory.heapTotal),
      loopP99MaxMs: +Math.max(...ss.map(s => s.worker.loopP99Ms)).toFixed(1), samples: ss.length,
    })
  }
  // What-if: baseline after B successful asks from the first warm-up ask, then the next 2,000 (or what remains).
  const whatIf = []
  for (const B of [200, 400, 600, 800, 1000, 1200, 1500, 2000]) {
    const rows = asks.slice(B, B + 2000).map(a => ({ n: a.n, rss: a.rss }))
    if (rows.length >= 1000) whatIf.push({ baselineAfter: B, ...gatesFrom(rows) })
  }
  const recorded = Object.fromEntries(Object.entries(r.summary?.gates ?? {}).map(([k, v]) => [k, +Number(v.value).toFixed(3)]))
  out.push({ file: basename(file), source: r.source, node: r.host.node, runs: r.options.runs, warmup: warm, recorded, windows, whatIf })
}

for (const run of out) {
  console.log(`\n# ${run.file} · ${run.source.slice(0, 8)} · Node ${run.node} · ${run.warmup} warm-up + ${run.runs} measured`)
  console.log('recorded gates', JSON.stringify(run.recorded))
  console.table(run.windows)
  console.table(run.whatIf)
}
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(out, null, 2) + '\n')
