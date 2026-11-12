# Reachability evidence

1 local end-to-end SDK ask, 1 simulated purchase, 1 verified receipt bundle,
2 nginx proxies, 0 deployments. Real Testnet package acceptance: pending.

## Local MCP proof (12 November 2026)

Reproduce under Node 22.23.4 with local nginx installed. Set `NGINX_BIN` and
`NGINX_MIME` if its paths differ from Homebrew:

```sh
node --import tsx docker/hosted/prove-local.mjs
npx vitest run tests/reach-mcp.test.ts tests/mcp-http.test.ts
```

Observed transcript (native equivalent of the hosted stack, real front and VM
nginx configurations; fixture models, simulated settlement; readiness overridden
only in this local harness):

```json
{"kind":"native-two-nginx-hosted-gateway","models":"fixture","settlement":"simulated","readiness":"test override; no Testnet balance proof","tools":["ask_expert","get_run","status","search_expertise","lookup_receipt","verify_answer"],"sse":true,"ask":"DONE","purchases":1,"retrySameRun":true,"receiptsVerified":true,"publicLinks":true,"headerWhitelist":true,"oneForwardedHop":true,"sseUnbuffered":true,"unreachablePaused503":true,"cloud":false}
```

The SDK connects without credentials. Its ask traverses front nginx, VM nginx,
the hosted API, and the same `/runs` admission route as the web. MCP responses
use SSE. The retained synthetic proxy checks also verify the header whitelist,
one forwarded hop, a first SSE frame before 900 ms, and a paused 503 when the
backend is unreachable. Both proxies disable buffering and caching and preserve the original Host
authority, including an explicitly configured local port. The test covers denied
Host/Origin/forwarded chains, unsupported protocol versions (400), optional
GET refusal (405), other-IP run isolation, reconnect, idempotency,
receipts, verification and an operator pause. Metadata keeps writer provenance
and links to reachable public article pages instead of the internal publisher.
Signed source identities and external passage URLs are preserved. Search
marks partial writer failures as `unavailable: true`. Local bearer MCP retains its
numeric-loopback Host check and rejects all Origin headers. Transport behavior
follows the [MCP Streamable HTTP specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports).

## Deployment configuration (owner only)

Set `MCP_PUBLIC=on` in the API's hosted env file to opt in (default `off`). Keep
`HOSTED_ORIGIN` equal to the exact public HTTPS origin; the public path is
`<HOSTED_ORIGIN>/mcp`. Keep the existing trusted proxy, IP HMAC secret, question
caps, provider qualification, control file and budget-stop configuration.
No extra listener or cloud resource is needed. Public MCP is stateless HTTP;
GET and DELETE return 405. Stable idempotency keys retrieve the original run.
Anonymous identities share an address (IPv6 /64), persist for up to 24 hours,
and are private only with respect to other addresses; users behind NAT share
this anonymous history. Changing public address loses access to that history.

The existing S$40 infrastructure budget stop remains outside the application:
stopping the VM also stops both public agent entry points. No alternate payer,
model allowance or bypass of the pause/signing guard is introduced.

Cloud Run's default request timeout is 300 seconds and its maximum is 3600.
The front's nginx read/send timeouts are 3600 seconds; these do not override the
Cloud Run revision timeout. MCP asks wait at most 45 seconds and return a run ID
for later `get_run`; clients should reconnect with the same idempotency key.
The owner should retain/set the front revision timeout to 3600 seconds when
redeploying. A disconnected request does not authorize another purchase.
Source: [Cloud Run request timeouts](https://docs.cloud.google.com/run/docs/configuring/request-timeout).

## Client installation

Open “Use it from your own agent” on hosted, or Settings → Connect an agent
locally. The panel reads `/api/connect`; hosted derives its URL from
`HOSTED_ORIGIN` when `MCP_PUBLIC=on`. Optional `MCP_CONNECT_URL` overrides it (no
default). A disabled server displays that URL access is not enabled instead of
offering a broken install. Local bearer servers still require their agent key.

- Cursor: choose **Add to Cursor**, inspect the URL config, and approve the
  client's install prompt. Link format:
  `cursor://anysphere.cursor-deeplink/mcp/install?name=researchagent&config=<URL-encoded base64 JSON {"url":"<configured URL>"}>`.
- VS Code: choose **Add to VS Code**, inspect and confirm installation. Format:
  `vscode:mcp/install?<URL-encoded JSON {"name":"researchagent","type":"http","url":"<configured URL>"}>`.
- Claude: 1. Open **Settings → Connectors**. 2. Choose **Add custom connector**
  and paste the URL from **Copy URL**. For the public endpoint, choose **No sign in**
  if asked. Availability depends on the client/account.
- Claude Code: copy `claude mcp add --transport http researchagent '<configured URL>'`.

Claude custom connectors connect from Anthropic infrastructure and require an
internet-reachable URL; a loopback server needs a separately configured public
endpoint. Cursor, VS Code and Claude Code can use a local URL with its bearer
key. Sources: [Claude custom connectors](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp),
[Claude Code HTTP setup](https://code.claude.com/docs/en/mcp).

These are generated instructions and decoded-link tests; no claim that each
native client has been installed or that any hosted deployment is enabled.
Sources: [Cursor install links](https://prod.cursor.com/docs/mcp/install-links),
[VS Code MCP installation URLs](https://code.visualstudio.com/api/extension-guides/ai/mcp).
Public hire remains disabled in MCP.

## Testnet transaction hashes

None for the local MCP proof: its settlement is simulated. Package acceptance
will add real hashes here; none are inferred from fixtures.

## Hosted paid-answer route

`PAID_ENDPOINT_PUBLIC=on` (default off) exposes `/v1/ask` through both proxies.
`docs/reach/paid-answer.md` has curl and installed SDK examples. Public hosted
budgets accept 100 or 200 cents and respect the configured question cap; the
service fee remains 20 cents. No public MCP hire tool is added.

`npx vitest run tests/reach-paid.test.ts tests/hire.test.ts` checks opt-in,
Testnet-only refusal, hostile Host, oversized budget refusal before signing,
durable quota binding, synthetic-ledger settlement/retry, operator pause and
same-IP MCP access to a paid run, its receipts and verification (other-IP
access is refused). The public route uses its anonymous session for run
ownership while preserving the verified wallet for settlement and change.
This is synthetic-ledger evidence for the hosted paid route, distinct from the
real Testnet package acceptance below. No hosted endpoint was contacted. The native proof additionally checks that
`/v1/ask` reaches the API and returns 404 with the flag off, and that a dummy
`PAYMENT-SIGNATURE` arrives unchanged through both nginx proxies. It submits no
payment.
