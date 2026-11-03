# Python SDK

Python 3.10+, typed src-layout package, no runtime dependencies. From this checkout:

```sh
python -m pip install ./packages/sdk-python
export RA_URL=http://127.0.0.1:10488 # OFFSET=1700 backend
python examples/python/ask.py
```

Set RA_API_TOKEN to the operator or scoped agent token. Client(base_url, token)
uses bearer authentication and refuses redirects. Never put tokens in URLs.
See examples/python/tool.py for a framework-independent LangChain-style callable.

```python
from researchagent import Client
client = Client('http://127.0.0.1:10488', token='your-token')
task = client.ask('What changed?', budget=2, idempotency_key='intent-1')
for event in task.events:
    print(event['type'], event['label'])
result = task.result()
print(result['answer'], result['citations'], result['receipts'], result['clamped'])
```

ask admits exactly once and returns a synchronous AskTask. Iterate .events for
ordered, deduplicated durable events via read-only polling, including provisional
FREE_DRAFT and checked ANSWER_READY; .result() waits for DONE, STOPPED or FAILED.
Those phases remain visible; FAILED is a run outcome, not an HTTP exception.
Events replay on subsequent iteration. Use a task from one thread at a time.
The server runs independently; abandoning iteration does not cancel research.
There is no automatic admission retry. Reuse the same idempotency_key after an
uncertain response. Each HTTP request times out after 15 seconds by default;
there is no overall run deadline.

Budget is requested SGD, never a client-side spending guarantee. Server policy
clamps it. requestedBudgetMinor, budgetMinor and clamped report the outcome.
get_run(id) reads a presented run with checked delivered citation passages;
its requestedBudgetMinor defaults to the admitted budget (the original request
is available on AskTask's result). wallet_status() reads /api/mcp/status with
remainingMinor. Labels and receipts are retained, including synthetic modes.
ResearchAgentError exposes code and HTTP status; UnauthorizedError,
InvalidRequestError, BackendError and VerificationError are typed subclasses.
Response bodies and low-level errors are not echoed.

verify(export, repo_dir='/path/to/checkout') accepts a JSON object or local
JSON/PDF path and shells without a shell to npm run verify:answer -- FILE --json.
There is no engine verify endpoint. This requires the ResearchAgent checkout,
Node and npm ci; it is not standalone Python cryptographic verification. It runs
offline, returns ok=false for tampering, and raises VerificationError for IO or
invocation failure. Self-contained hashes do not prove independent authenticity.

Tests use the real local engine with synthetic providers, simulated settlement,
and ephemeral ports; no live providers or ledger submission:

```sh
npm ci
python -m pip install pytest
python -m pytest packages/sdk-python
```

CI runs these tests only for changes under packages/sdk-python/. Publication is
not performed; owner action is tracked in #265.

Client endpoints require HTTPS or exact loopback HTTP and refuse credentials/redirects. `Client(..., wait_timeout=60)` bounds each event/result observation using monotonic time; each polling request is bounded by the remaining wait and the configured request timeout. On interrupted observation, `ResearchAgentError.run_id` preserves the admitted run. Retrieve that run instead of creating a new identity. Errors expose safe `code`, `status`, `retryable` and `run_id` fields. Clamped asks continue free-first and include `clampReason`.

## Exact local release artifacts

`make release-artifacts` builds the SDK tgz, Python wheel/sdist and MCPB once,
then tests the installed bytes with fixture models and simulated settlement.
`dist/release/manifest.json` records independent versions, source SHA, runtimes,
bytes and SHA-256; `consumer-results.json` records acceptance separately.
The npm consumer installs declared dependencies normally in a temporary project;
the wheel uses a new venv; MCP starts from the extracted MCPB. Each asks twice
with the same key and checks delivered citations, one receipt/intent and caps.
No registry publication is performed. Python offline verification still invokes
the repository verifier and requires its Node dependencies; wheel installation
alone does not supply that verifier. Minimum supported Node is 22.13 and Python
3.10; hosted artifact acceptance uses those runtimes.

See [release artifact evidence](evidence/round2-d/README.md).

### Independent local origins (Lane F)

`PUBLISHER_URLS=http://127.0.0.1:<port>,http://127.0.0.1:<port>,http://127.0.0.1:<port>` admits at most three operator-configured numeric loopback origins. `PUBLISHER_URL` retains singleton compatibility. This is the labelled pinned-local-origin finals topology; public remote federation is deferred. Discovery/search has one two-second deadline per origin, four HTTP slots, 50 writers/origin and 50 returned hits/query, with healthy partial results.

Federated runtime references carry `source` version 1: origin, signed seller public key, profileId, resourceId and version. `shared/source-identity.ts` supplies the canonical tuple and citation key. TS, Python and MCP preserve that identity; wallet reputation crosses hosts. Receipt bundles dispatch v1/v2 explicitly. Historical missing origins remain unresolved; invoices, signed manifests, blobs, audit entries and intent IDs are unchanged. New obligations save endpoint context before signing; removal prevents new admission while recovery uses the saved endpoint. No engine bearer, delivery token or payment signature is forwarded across origins.

Offline reproduction: `node --import tsx scripts/demo-multi-origin.ts --fixture --output scratch/multi-origin.json`. Evidence and migration handoff: `docs/evidence/round2-f/README.md`. The proof is synthetic, uses simulated payments and an explicit fixture judging/citation rubric, and does not establish adoption or live model quality.

## Kill switch

`client.pause(reason='Unexpected spending')` pauses spending durably and immediately. A scoped bearer pauses only
its own agent; an operator bearer pauses the wallet. Returns `{paused: true,
scope: "agent" | "wallet", agentId?: string}`. Repeated pause is safe. The optional
reason is at most 240 characters, excludes control characters, and is stored in
the audit trail. No client resume method exists: resume remains operator-only.
In-flight unsigned purchases cannot sign; signed obligations reconcile normally
without releasing their reservations. Cached desktop preferences cannot resume it.
