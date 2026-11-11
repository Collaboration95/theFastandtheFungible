# Python SDK

[Release v1.1.0](https://github.com/Collaboration95/theFastandtheFungible/releases/tag/v1.1.0): release · not yet on npm/PyPI/MCP Registry. Install without cloning.

```sh
pip install https://github.com/Collaboration95/theFastandtheFungible/releases/download/v1.1.0/researchagent-1.1.0-py3-none-any.whl
```


## Start engine → connect → ask → verify

<!-- BEGIN generated:sdk-quickstart -->
Start in an empty folder. Requires Node ≥22.13 (including for the Python engine); Python ≥3.10 for the Python client. Terminal 1, macOS/Linux:

```sh
export MCP_MAX_BUDGET_MINOR=200 MCP_DAILY_CAP_MINOR=500
```

Terminal 1, Windows PowerShell:

```powershell
$env:MCP_MAX_BUDGET_MINOR="200"; $env:MCP_DAILY_CAP_MINOR="500"
```

Then, in the same terminal on any platform:

```sh
npx -y https://github.com/Collaboration95/theFastandtheFungible/releases/download/v1.1.0/researchagent-mcp-1.1.0.tgz app --port 6400
```

Keep it running. This uses fixture models, fictional writers and SIMULATED payments (no real value). Caps authorize up to S$2 per ask and S$5 gross per UTC day. For XRPL Testnet append `--testnet`; for TEST-SGD (stand-in for RLUSD, no real value) also append `--iou`. Cold IOU setup can take about two minutes. Use another port if 6400 is busy.

The UI port (6400 here) is **not** the engine port. Copy the printed engine baseUrl and token-file path for Terminal 2. The token is read from its private file; never paste it into source or a URL.

Terminal 2, create an isolated environment:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install https://github.com/Collaboration95/theFastandtheFungible/releases/download/v1.1.0/researchagent-1.1.0-py3-none-any.whl
```

Windows PowerShell equivalent:

```powershell
py -3 -m venv .venv
.venv/Scripts/python.exe -m pip install https://github.com/Collaboration95/theFastandtheFungible/releases/download/v1.1.0/researchagent-1.1.0-py3-none-any.whl
```

Save this as `ask.py`:

```python
import json
import sys
from pathlib import Path
from researchagent import Client
if len(sys.argv) != 3:
    raise SystemExit('Usage: python ask.py ENGINE_URL TOKEN_FILE (copy both from app output)')
client = Client(sys.argv[1], token=Path(sys.argv[2]).read_text().strip())
run = client.ask("What's the analyst outlook on Kestrel Semiconductor's latest deal with TSMC (pricing & margins)?", budget=2, idempotency_key='quickstart-python-1').result()
print(run['answer'], run['labels'], run['citations'])
receipts = client.receipts(run['run_id'])
Path('receipts.json').write_text(json.dumps(receipts, indent=2))
verified = client.verify(receipts)
print(verified)
if not verified['ok']:
    raise SystemExit(1)
```

Run `.venv/bin/python ask.py "ENGINE_URL" "TOKEN_FILE"` (PowerShell: `.venv/Scripts/python.exe ask.py "ENGINE_URL" "TOKEN_FILE"`), replacing both quoted values with the app output.

Success means an answer with mode labels/citations, a local `receipts.json`, and verification `ok: true` (Python: `True`). Verification above is offline. For read-only Testnet settlement **and anchor** checks use TS `{ onlineLedger: true }` or Python `python -m researchagent verify receipts.json --ledger` with the installed interpreter. Simulated evidence has no ledger proof, so those checks print as skipped, never as passed. Reuse the same idempotency key after an uncertain response; read the retained run rather than buying again.
<!-- END generated:sdk-quickstart -->

The wheel has no runtime dependencies. Checkout-only `examples/python/` files require a clone; they are not installed into the consumer folder. Client(base_url, token) uses bearer authentication and refuses redirects. Never put tokens in URLs.

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

`Client.verify(export)` independently verifies a JSON object or JSON path in
Python. See **Verify receipts without Node** below. Explicitly supplying
`repo_dir='/path/to/checkout'` selects the legacy Node wrapper, which also accepts
PDF exports and requires Node and `npm ci`; invocation failures raise
VerificationError. The Python verifier is independent; the engine also exposes `/api/verify` for HTTP callers. Self-contained hashes
do not prove independent authenticity.

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
No registry publication is performed. The installed Python wheel now independently
verifies its exported receipts as part of the clean consumer check. Minimum
supported Node for the engine/legacy wrapper is 22.13; Python is 3.10. Hosted
artifact acceptance uses those runtimes.

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

Receipt contribution v3 exposes exact claim/passage use with semantic assessment
labelled not independently verified. See [receipt contribution contract](contracts/CONTRIBUTION.md)
and [offline fixture evidence](evidence/round2-g/README.md). Python callers can use
`Client.receipts(run_id)`; the existing offline verifier accepts v1/v2/v3.

## Verify receipts without Node

The installed wheel verifies v1, v2 and v3 offline, without a repository, Node,
network access, API token or wallet. Runtime has no external dependencies;
MIT-licensed pure-Python ecdsa and six are vendored for real Ed25519/secp256k1
signature verification. Signatures are never delegated or silently skipped.

```sh
python -m researchagent verify receipts.json --json
```

Exit codes: 0 valid, 1 invalid, 2 usage/unreadable JSON. Python API:

```python
from researchagent.verify import verify
result = verify('receipts.json', expect_head=independently_saved_head)
assert result['ok']
```

`Client.verify(export)` also uses Python by default. Supplying `repo_dir=...`
explicitly retains the old Node wrapper. Default offline verification does not contact Testnet;
ledger checks are labelled SKIP. An independent audit head detects rewritten
chains; a self-contained export alone cannot. Structural contribution evidence
does not certify semantic truth. See [receipt spec](receipt-spec.md) and
[conformance evidence](evidence/round2-k/README.md).

## Verify against the ledger

`researchagent verify receipts.json --ledger` (or `python -m researchagent verify ...`)
uses bounded, read-only JSON-RPC `tx` lookups against `s.altnet.rippletest.net:51234`,
then Clio, with no wallet or backend. The Python API is `verify(bundle, ledger=True)`.
`--ledger` checks the anchor *and* every payment, refund and escrow event, and prints
`PASS testnet N/N (read-only, s.altnet)`; `--testnet` alone checks the payments.
`audit anchor` becomes PASS for validated matching anchor-v1 evidence, or FAIL with a
reason; a simulated export prints `Skipped audit anchor: simulated run (no ledger)`.
A key reveal whose article broke its promises passes (`key-reveal-proof`) only with a
validated writer refund. Without the flag, ledger checks remain SKIP (requires online
check); offline fixture behavior is unchanged. Each endpoint has a five-second deadline
and 256 KiB response cap. The implementation uses Python's standard library.
Anchor fees are separate from article spend. See receipt-spec.md.
