# Reachability evidence

1 local end-to-end SDK ask, 1 simulated purchase, 1 verified receipt bundle,
2 nginx proxies, 0 deployments. Real Testnet package acceptance: 4 validated
transactions, 1 independent Python buyer, 1 installed Hono seller, 1 decrypt,
1 same-finish retry, 1,000 drops reclaimed after explicit expiry cancellation.

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

None for the local MCP proof: its settlement is simulated. Real Testnet
package hashes appear in the seller-package and independent-buyer sections below.

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

## Unpublished seller packages

Express, Hono and typed FastAPI packages preserve `key-reveal-escrow` and the
original v2 headers/envelope fields. A fourth shared Node protocol package
keeps both adapters on the same verification and recovery logic. All include
README, types, offline tests and opt-in Testnet tests; each adapter README has
a 10-line quickstart. Nothing was published to a registry.

Reproduce package-archive tests without root dependency changes:

```sh
node scripts/reach/package-tests.mjs
python3 -m venv /tmp/reach-python
/tmp/reach-python/bin/pip install ./packages/seller-fastapi pytest httpx
/tmp/reach-python/bin/python -m pytest packages/seller-fastapi -q
```

Observed Node archive tests: 8 passed, 2 Testnet-only skipped; public TypeScript
imports compiled. The current opt-in archive run passed all 10 cases (no skips),
including one real purchase per Node framework:

- Express create: `55B23032BA3C63F82F6B24AB756612B0021A2EAFDD516B96DB8D180FB74D94E4`
- Express finish: `81D5FF2B97E33D0A4A37627EE7506BA657EEC9A8BE3A9B9055AFF5CE29639F84`
- Hono create: `49CE4269C95F5E3D8311955A66A2B7A054D8344EF67593B9BFF7E5D29D763F27`
- Hono finish: `D76F261A427FCA5B5AE958A6DAD1225C7959054FE46D3CFF8E0020B8C039461D`

Command: `XRPL_KEY_REVEAL_TESTNET=1 node scripts/reach/package-tests.mjs`.
Python offline: 4 passed, 1 skipped, including restart recovery after a lost finish response.
The built FastAPI wheel also passes these four offline tests (one Testnet case
skipped), and includes its typing marker, module, license and metadata. The additional FastAPI
Testnet run (`XRPL_KEY_REVEAL_TESTNET=1 ... pytest -s`) passed all 5 tests in
55.09 s with these real transactions:

- Create: `16965178A031A17C67A1A95E4B929844D70033AE1034AC50673E24D41B002D3D`
- Finish: `D7102345A24F21ED592760D516943946B84670D61B28F7DAABEC8B95A89E6866`

Before a new finish, validated-ledger checks before and after autofill require
more than eight seconds to expiry. Node/Python regressions first reproduced
key-bearing transaction construction with one second remaining, then passed
with zero such construction. This reduces stale reveals, not all validation races.
The concurrent-new-intent regression also proves the journal capacity stays bounded.
New-invoice regressions reproduced a second signature while an earlier finish
outcome was uncertain in both Node and Python. The signer now refuses another
invoice until the original finish is reconciled. The lost-response restart regression checks a recorded finish hash and returns
its validated result without submitting again. Journals persist keys and the
original signed finish before submission. One process owns a wallet/journal;
the package READMEs describe this limit and external ingress controls.

## Independent buyer acceptance: real Testnet

**PASS, 12 November 2026:** Python/httpx bought from a Hono seller installed
from local npm archives. Four validated transactions prove delivery, same-finish
retry and an explicit expiry cancellation returning 1,000 drops of principal.
The fixture article is synthetic; all four ledger transactions are real Testnet.
Network fees were not refunded. No hosted service, mainnet or registry was used.

```sh
python3 -m venv /tmp/reach-buyer
/tmp/reach-buyer/bin/pip install httpx 'xrpl-py>=4.4,<5' cryptography
PATH=$HOME/.local/share/mise/installs/node/22.23.4/bin:$PATH \
  XRPL_KEY_REVEAL_TESTNET=1 REACH_PYTHON=/tmp/reach-buyer/bin/python \
  node scripts/reach/acceptance.mjs
```

The runner packs `seller-core` and `seller-hono`, installs them in an isolated
consumer, and copies only the HTTP harnesses there. The seller imports installed
packages; the Python buyer imports httpx, xrpl-py and cryptography. Neither uses
repository-internal implementation imports. Wallet seeds and original signed
transactions stay in private durable recovery files, never in this evidence.
The run refuses mainnet, caps principal and network fees independently, records
hashes and private signed blobs before submission, and retains private recovery state on failure.
The launcher uses ResourceScope for child cleanup; its durable evidence directory
is deleted only after successful reconciliation. Never
blindly restart a failed run: reconcile the original recorded hashes first.
`REACH_WALLETS_FILE` optionally reuses dedicated funded Testnet wallets;
`REACH_EVIDENCE` optionally selects the public JSON destination.

Final run, Node v22.23.4, completed 2026-11-12T13:21:22.217Z:

| Transaction | Hash |
| --- | --- |
| Withheld escrow create | `CAD54DBCFB9A3CD9C01D30A6029042C802848FA25651384B4CD4E263FBEE526A` |
| Delivered escrow create | `5B02B41ABD6FFCCC58DC251CC64B6C634CE5D98651A1C1402A8570DD5D93327B` |
| Delivered escrow finish | `0ECB222103F8DB986DA890894DA3F8B8FE59A9B463E959797CD39982EDB58A2A` |
| Expired escrow cancel | `5C45927F70795449769FC1D856AE927ED3C578570D3B887B2ABAD7D0060C2085` |

`testnet-acceptance.json` records the same hashes, verified key/ciphertext/retry
outcomes and SHA-256 of both installed package archives. The final staged
archives used for the live purchase were repacked from the committed package
sources and their digests matched exactly before this evidence shipped. The buyer independently
reads the validated finish, checks owner/sequence/condition/success, derives the
key and verifies AES-GCM plus plaintextHash before releasing the fixture bytes.
The cancellation check measures the buyer balance increase excluding its fee.

Transcript:

```text
withhold create: CAD54DBCFB9A3CD9C01D30A6029042C802848FA25651384B4CD4E263FBEE526A
deliver create: 5B02B41ABD6FFCCC58DC251CC64B6C634CE5D98651A1C1402A8570DD5D93327B
deliver finish: 0ECB222103F8DB986DA890894DA3F8B8FE59A9B463E959797CD39982EDB58A2A
withhold cancel: 5C45927F70795449769FC1D856AE927ED3C578570D3B887B2ABAD7D0060C2085
RESULT PASS: independent Python buyer; installed Hono seller; key, ciphertext, replay and expiry refund verified
```
