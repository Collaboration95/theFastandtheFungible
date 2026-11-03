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
