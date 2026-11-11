// Reproduces the harness's old per-ask report rewrite in isolation (no engine). Usage: node save-sim.mjs <out.json> <save every N asks>
import { writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
const out = process.argv[2], every = Number(process.argv[3] ?? 1)
const r = { asks: [], samples: [] }
const MiB = 2 ** 20, rows = []
for (let i = 0; i < 4200; i++) {
  r.asks.push({ pid: 1, engineId: 'e0b6f3c4-0000-4000-8000-000000000000', workerId: 1, storeId: 's', ok: true, runId: randomUUID(), phase: 'DONE', reservedMinor: 0, index: i, uc: 'UC1', stage: 'measured', ms: Math.random() * 200, rss: 6e8 + Math.random() * 1e8 })
  if (i % 5 === 0) r.samples.push({ at: Date.now(), worker: { memory: process.memoryUsage(), v8: { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8, i: 9, j: 10, k: 11, l: 12, m: 13 }, gc: { pausesMs: Array.from({ length: 8 }, () => Math.random()) } }, load: [1, 2, 3] })
  if (i % every === 0) writeFileSync(out, JSON.stringify(r, null, 2) + '\n')
  if (i % 300 === 0) { const m = process.memoryUsage(); rows.push(`${i}: rss ${(m.rss / MiB).toFixed(0)} heapTotal ${(m.heapTotal / MiB).toFixed(0)} outside ${((m.rss - m.heapTotal) / MiB).toFixed(0)} file ${(JSON.stringify(r, null, 2).length / MiB).toFixed(1)}MiB`) }
}
console.log(`save every ${every}:\n` + rows.join('\n'))
