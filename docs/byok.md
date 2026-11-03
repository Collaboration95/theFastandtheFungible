# One-key compatible engine

Set `LLM_PROVIDER=openai-compatible`, `LLM_BASE_URL`, `LLM_MODEL` and
`LLM_API_KEY`. Set `DECISION_PROVIDER=compatible` to reuse that key, base and
model for a generic JSON judge. Optional `DECISION_BASE_URL`, `DECISION_MODEL`
and `DECISION_API_KEY` override the corresponding LLM fields independently.
Clear any old `DECISION_MODEL` value to reuse `LLM_MODEL`.
Existing DeepSeek/Groq research and OpenAI Decisions/Clef configurations retain
their defaults and legacy keys.

Compatible research uses streaming Chat Completions, JSON response format,
`max_tokens`, and streamed usage. Unsupported responses fall back to an explicitly
labelled extractive fixture; citations still require exact accessible passages.
The generic JSON judge is `compatible`, labelled **UNCALIBRATED**, with prompt
version `UNCALIBRATED-json-v1`. It receives bounded sanitized public candidate
metadata and public read-source references, never a pay tool, credentials or
ungranted bodies. It cannot activate Luna/Clef calibration or value fits.
Policy prohibits all purchases from this judge, even valid maximum-confidence
scores, a zero threshold or a model named `gpt-6-luna`. Invalid judgments fail
the round closed. Coverage is reported unknown when this judge cannot assess it.

`SETTLEMENT_RAIL=simulated` works without a wallet. Selecting `xrpl-testnet`
requires the separate Testnet wallet configuration; missing configuration fails
startup rather than silently selecting simulation. Model fees are separate from
article principal caps. Unknown usage or rates means unknown cost (`null`),
never zero. Operator rates are estimates, not a provider invoice.

## Endpoint boundary

Compatible profiles support HTTPS on port 443 only for these reviewed origins:
`api.openai.com`, `api.deepseek.com`, `api.groq.com`, `openrouter.ai`.
Base paths are supported (for example `/v1`). Arbitrary remote origins and
`localhost` aliases are deliberately unsupported. Explicit numeric `127.0.0.1`
and `[::1]` endpoints may use HTTP or HTTPS and an operator-selected port.
No userinfo, query, fragment or redirects are accepted. Public hostnames resolve
to IPv4; private, shared, link-local, metadata, multicast and reserved destinations
are refused before a socket opens. The checked address is pinned to that socket;
TLS authenticates the original hostname. There is no second DNS lookup that can
rebind the socket, and redirect targets receive no request or credential.
Loopback is explicit operator trust in a local process. No insecure TLS option
is provided. This boundary applies to the new compatible adapter and test route;
legacy named-provider transport behavior remains compatible.

## Desktop C2 contract

`POST /api/providers/test` accepts an optional JSON body `{baseUrl, model}`.
The key comes only from the engine environment, never from the body. The actual
socket peer must be loopback, and a valid operator `RA_API_TOKEN` bearer is
required even when other local routes permit anonymous use. Agent keys cannot
use this route. It makes one small non-streaming JSON call (no retries), with a
1,024-token maximum and the decision deadline (default 15 seconds).

Response: `{ok, latencyMs, inputTokens?, outputTokens?, costUsd?: number|null,
error?: {code, message}}`. Failures contain only fixed safe messages. The response
never contains the key, upstream errors or response text. Supplying any body key
other than `baseUrl` or `model` fails validation. Test cost exists only when both
usage counts and `MODEL_INPUT_USD_PER_MILLION` / `MODEL_OUTPUT_USD_PER_MILLION`
are available. The fixture's synthetic 1,000 input × $2/M + 500 output × $4/M
is $0.004. This is test cost, not a per-query estimate.

## Active work and Stop

`ACTIVE_WORK_LIMIT` is a positive integer, default 4. One engine pool covers
admission/planning, scope, startup/resumed runs, verified-answer recovery,
reports, hire requests and connection tests. Slots release in `finally`.
New admission at capacity receives HTTP 503 with the existing typed `overloaded`
error envelope. An identical durable idempotency retry returns its existing run
before checking capacity. Existing runnable rows wait for the next recovery sweep
when full; no new durable queue is created. Payment reconciliation remains
independent per intent and continues even when inference slots are full.

Run Stop aborts planning, synthesis, decision scoring/coverage, discovery and
retry backoff. Drain also aborts scope/test/report provider work. Existing provider
deadlines remain in force. No new policy purchase starts after Stop; signed or
ambiguous obligations retain their original reservation and reconciliation path.
This does not promise cancellation of already signed ledger obligations or of
Chromium report rendering.

Evidence: `docs/evidence/round2-c1/`. Only fake endpoints, synthetic keys,
fixture publishers and simulated settlement were used. No real-provider, Testnet,
desktop recovery, installed app or native hardware acceptance is claimed here.
Desktop belongs to Lane C2. Legacy convenience launchers that force named or
fixture providers must be configured by their owning lane; use the engine env
contract above rather than treating `make live` as a BYOK selector.
