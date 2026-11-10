# Local HTTP integration

[OpenAPI 3.1 JSON](openapi.json) is also served at `GET /openapi.json` on the **engine URL** printed by `app`. This tiny discovery route stays behind the existing Host/Origin guard; all research authority checks are unchanged. Use bearer authentication for developer calls. `x-internal` operations inventory UI/owner endpoints; they are not a stable integration surface and owner Settings additionally requires browser/CSRF metadata.

Start the engine with the [SDK quickstart](../sdk.md#start-engine--connect--ask--verify), then save the no-framework Node ≥22.13 example below as `ask-http.mjs` in your empty consumer folder. Run `node ask-http.mjs "ENGINE_URL" "TOKEN_FILE"`, substituting the two printed values. Same command on macOS, Linux and PowerShell; no npm package is required.

```js
import { readFileSync, writeFileSync } from 'node:fs'
const [baseUrl, tokenFile] = process.argv.slice(2)
if (!baseUrl || !tokenFile) throw Error('Usage: node ask-http.mjs ENGINE_URL TOKEN_FILE')
const headers = { Authorization: `Bearer ${readFileSync(tokenFile, 'utf8').trim()}`, 'Content-Type': 'application/json' }
async function request(path, init = {}) {
  const response = await fetch(new URL(path, baseUrl), { ...init, headers, redirect: 'error', signal: AbortSignal.timeout(15000) })
  if (!response.ok) throw Error(`HTTP ${response.status}; preserve http-quickstart-1 and any returned runId for recovery`)
  return response.json()
}
let run = await request('/api/mcp/runs', { method: 'POST', body: JSON.stringify({ question: "What's the analyst outlook on Kestrel Semiconductor's latest deal with TSMC (pricing & margins)?", budget_sgd: 2, idempotency_key: 'http-quickstart-1' }) })
const deadline = Date.now() + 180000
while (!['DONE', 'STOPPED', 'FAILED'].includes(run.phase)) {
  if (Date.now() > deadline) throw Error(`Still active: ${run.runId}; resume with GET /api/mcp/runs/${run.runId}`)
  await new Promise(resolve => setTimeout(resolve, 250))
  run = await request(`/api/mcp/runs/${run.runId}`)
}
console.log(run.labels, run.answers)
const receipts = await request(`/runs/${run.runId}/receipts.json`)
writeFileSync('http-receipts.json', JSON.stringify(receipts, null, 2))
const verified = await request('/api/verify', { method: 'POST', body: JSON.stringify(receipts) })
console.log(verified)
if (!verified.ok || run.phase !== 'DONE') process.exitCode = 1
```

SGD request budgets are whole currency amounts (`budget_sgd: 2` = S$2); response `*Minor` fields use cents. Caps default to zero and policy clamps the request. The engine has a default four-active-work limit with immediate overload refusal. Admission returns 201 (new) or 200 (same intent), often while still active. Follow GET/SSE using the run ID. Preserve the stable idempotency key through uncertainty; do not retry with a fresh identity. Raw HTTP runs retain mode labels and provisional answers; use the SDK for its presented citation/grant checks. Default verification is offline; `?testnet=1` adds read-only settlement checks only. Use SDK `onlineLedger: true` or Python verifier `--ledger` for settlement **and** answer-anchor checks.

## x402 and Starter Kit compatibility

Optional `POST /v1/ask` is x402 v2 HTTP hiring, **not A2A**. It uses JSON `budgetMinor` (100/200/500 cents), `Idempotency-Key`, a 402 `PAYMENT-REQUIRED` quote, explicit caller-signed `PAYMENT-SIGNATURE`, then `PAYMENT-RESPONSE`. Its S$0.20 service fee is additional; response moneyChain exposes royalties and change. It requires Testnet settlement and caller signing authority, distinct from asking with an operator budget.

Native XRP exact-payment compatibility with the **pinned x402-xrpl 0.3.4** Starter Kit dependency is executed in both directions by [the interop test](../../tests/starter-kit-interop.test.ts); [evidence and limitations](../evidence/starter-kit-interop.md) distinguish synthetic-ledger interop from Testnet evidence. Key-reveal escrow and TEST-SGD IOU (stand-in for RLUSD, no real value) are project extensions, not generic upstream support. No Mainnet, A2A Agent Card or remote t54 facilitator acceptance is claimed.
