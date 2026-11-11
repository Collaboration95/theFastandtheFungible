# Fixture method latency diagnostic

Separate from the paired comparison: 19 fresh fixture-only HOSTED=1 asks, live DeepSeek, simulated settlement.
Timers wrap method completion, including concurrent scheduling; they are not a network round trip.
362 calls: p50 0.996 ms, p95 3.007 ms, max 5.691 ms. OpenAI calls/spend: zero.

The scratch harness was the committed `scripts/evidence/live-decisions.ts` with the following instrumentation.
It ran `--arms fixture --sets presets,judges --reps 3 --judge-reps 1 --cap-usd 0.1`.
For a scratch copy outside the repository, resolve its existing relative imports to this checkout and use an
ES-module `.mts` extension. The diff below excludes those path-only changes. No provider, policy or cap was changed.

```diff
--- scripts/evidence/live-decisions.ts
+++ scratch-instrumented-harness.ts
@@ -237,6 +237,17 @@
 const writerServer = publisher.listen(0, '127.0.0.1'); await once(writerServer, 'listening')
 const publisherUrl = `http://127.0.0.1:${(writerServer.address() as { port: number }).port}`
 process.env.PUBLISHER_URL = publisherUrl
+const fixtureTimings: { run: string; method: string; ms: number }[] = []
+const { FixtureDecisionProvider } = await import('../../server/agents/decision.js')
+for (const method of ['judgeRound', 'judgeCandidate', 'judgeCoverage', 'judgePaidRelevance'] as const) {
+  const prototype = FixtureDecisionProvider.prototype as any
+  const original = prototype[method]
+  if (!original) continue
+  prototype[method] = async function(...args: unknown[]) {
+    const start = performance.now()
+    try { return await original.apply(this, args) } finally { fixtureTimings.push({ run: currentRun, method, ms: performance.now() - start }) }
+  }
+}
 const { createApiApp } = await import('../../server/routes.js')
 const { OpenAIDecisionsProvider } = await import('../../server/agents/openai-decisions.js')
 type Gateway = { arm: Arm; port: number; api: Awaited<ReturnType<typeof createApiApp>>; close: () => Promise<void> }
@@ -318,7 +329,7 @@
 // ---- Run: interleaved, fixture arm first so the openai arm replays its DeepSeek tape ----
 mkdirSync(out, { recursive: true })
 const results: Result[] = []
-const save = () => writeFileSync(join(out, 'raw-results.json'), JSON.stringify({ note: 'LIVE-DEC raw results. One row per arm × question × repetition. No request bodies, headers or keys.', startedAt, results, decisionCalls: calls, proxy: proxyStats, openaiUsdUpperBound: Number(openaiUsd().toFixed(4)) }, null, 1) + '\n')
+const save = () => writeFileSync(join(out, 'raw-results.json'), JSON.stringify({ note: 'LIVE-DEC raw results. One row per arm × question × repetition. No request bodies, headers or keys.', startedAt, results, fixtureTimings, decisionCalls: calls, proxy: proxyStats, openaiUsdUpperBound: Number(openaiUsd().toFixed(4)) }, null, 1) + '\n')
 const startedAt = new Date().toISOString()
 let stopped = ''
 try {
```
