# Reachability evidence

1 local end-to-end SDK ask, 1 simulated purchase, 1 verified receipt bundle,
2 nginx proxies, 0 deployments. Real Testnet package acceptance: pending.

## Local MCP proof (12 November 2026)

Reproduce under Node 22.23.4:

```sh
node --import tsx docker/hosted/prove-local.mjs
npx vitest run tests/reach-mcp.test.ts tests/mcp-http.test.ts
```

Observed transcript (native equivalent of the hosted stack, real front and VM
nginx configurations; fixture models, simulated settlement; readiness overridden
only in this local harness):

```json
{"kind":"native-two-nginx-hosted-gateway","models":"fixture","settlement":"simulated","readiness":"test override; no Testnet balance proof","tools":["ask_expert","get_run","status","search_expertise","lookup_receipt","verify_answer"],"sse":true,"ask":"DONE","purchases":1,"retrySameRun":true,"receiptsVerified":true,"cloud":false}
```

The SDK connects without credentials. Its ask traverses front nginx, VM nginx,
the hosted API, and the same `/runs` admission route as the web. MCP responses
use SSE. Both proxies disable buffering and caching. The test covers denied
Host/Origin/forwarded chains, other-IP run isolation, reconnect, idempotency,
receipts, verification and an operator pause. Local bearer MCP retains its
numeric-loopback Host check and rejects all Origin headers.

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

Pending the connect-panel step. Use the configured public `/mcp` URL, without a
bearer token. Public hire is disabled in MCP.

## Testnet transaction hashes

None for the local MCP proof: its settlement is simulated. Package acceptance
will add real hashes here; none are inferred from fixtures.
