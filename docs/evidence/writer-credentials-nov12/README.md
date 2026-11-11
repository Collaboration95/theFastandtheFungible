# X2 writer identity evidence

Local implementation acceptance, 11 November 2026 (SGT). No VM changes or hosted
questions. Live XRPL Testnet identity; local HOSTED=1, fixture models, simulated
buyer rail; screenshots use a zero-budget x402 question, with no purchase.

- `ledger.json`: three accepted credentials observed through `account_objects`,
  domain `AcceptedCredentials` through `ledger_entry`, pinned to the same validated
  ledger hash. Public addresses and all observed setup hashes/indexes only.
- `latency.json`: all-writer signed search on each of the three XRPL presets,
  seven warm samples after one cold sample for each configuration.
- `sources-{1280,390}.png`, `writers-{1280,390}.png`: real local API observations.
- `local-hosted.ts`: evidence-only harness adapted from the existing hosted UI
  helper. Real writer signers on the publisher; simulated buyer with zero budget,
  readiness stub, throwaway TLS certificate. It cannot demonstrate a live purchase.

Issuer: `rBK3EpmEiS7mxY1HdxNihwiGUzF8xLX5eg`.
Domain: `D0B5DB2A87E03E375B3CF519B2323971C9E4D0300D31F93F8EAA927F0680B998`.

Build notes `rnFqpNSS2rcDoFe72cwneSzwZAhoxqduqr`, XRPL explainers
`r9hkhUEsqcUBAhzp5dfVbPeX37UE6dEQ8c`, Open Records
`rQaq2QSmirDQSebX35vyx42qvMBqB4Jkoi`. Credential type is
`researchagent/writer-v1`; expiration is 30 Nov 2026, 00:00 UTC.

## Setup and rerun accounting

The new issuer was faucet-funded once. Open Records did not yet exist on-ledger;
the script funded it with 2 Testnet XRP from that issuer. Two initial creates
before that correction validated with `tecNO_TARGET`. The first reruns exposed
an order-sensitive JSON comparison and created two extra domains. That comparison
now compares issuer/type fields, and both extra domains were deleted. All these
hashes, including failures and cleanup, are retained in `ledger.json`: 14 total
transactions, 168 Testnet drops in fees. No real money. The retained domain is the
original domain. A final repeat run kept the same domain and transaction count
(14 before, 14 after): no duplicate credential, accept, funding or domain tx.

## Validation

39 targeted tests pass: malformed/oversized/duplicate/wrong-ledger domain,
wrong-issuer/type/subject credentials, expiration, acceptance, RPC faults,
five-minute shared cache, exact label and links, decision projection equivalence,
and both paid-search/free-delivery guards for issuers only, domain only, both,
and neither. `server/agents/decision.ts` and `scripts/gate-audit.ts` are unchanged.

| Preset | Baseline search p50 | Domain search p50 | Delta |
|---|---:|---:|---:|
| x402 | 9.74 ms | 10.20 ms | +0.46 ms |
| RLUSD | 7.35 ms | 7.53 ms | +0.18 ms |
| Reserves | 8.40 ms | 8.51 ms | +0.12 ms |

The first uncached x402 identity lookup took 2,869 ms. The cache makes the median
flat; this is not a claim that the first network lookup is under 300 ms. The
other two presets reused the same snapshot. Warm observations expire together
within five minutes. The buyer has no grant for paid sources in the UI probe;
only signed public metadata is displayed.

To reproduce the local harness, build the app, allocate three ephemeral ports,
set HOSTED_WEB_PORT / HOSTED_API_PORT / HOSTED_PUBLISHER_PORT and HOSTED_STACK_DIR,
then run `node scripts/writer-credentials-testnet.mjs --local-hosted`. Only that
operator script reads private seeds; the child receives them through its private
environment. Stop with SIGTERM. The process prints only addresses, hashes and
the domain ID. The local HTTPS certificate is self-signed.

VM env hand-off (orchestrator only):

```sh
WRITER_CREDENTIAL_DOMAIN=D0B5DB2A87E03E375B3CF519B2323971C9E4D0300D31F93F8EAA927F0680B998
```

Nothing loosened. No policy or money-path changes. Live hosted acceptance is
pending the orchestrator's env/redeploy step.

## Published v1.1.1 compatibility

Both newly declared identity fields are **optional**. `receipts-with-identity.json`
is a local zero-budget export with the server's live advisory writer observations
attached to matching candidates for the compatibility probe. The normal exporter
still omits writer observations. No signed receipt, manifest or audit bytes were
modified. The probe includes `domainId` and `credentialTxHash` on verified writers.

Downloaded the **published v1.1.1** wheel and MCP tgz through authenticated `gh`:

```sh
python3 -m venv /tmp/x2-published/venv
/tmp/x2-published/venv/bin/pip install /tmp/x2-published/researchagent-1.1.1-py3-none-any.whl
/tmp/x2-published/venv/bin/researchagent verify docs/evidence/writer-credentials-nov12/receipts-with-identity.json --ledger
npx --yes --package /tmp/x2-published/researchagent-mcp-1.1.1.tgz researchagent-mcp verify docs/evidence/writer-credentials-nov12/receipts-with-identity.json --ledger
```

Both say **RESULT PASS**; full outputs are in `published-python-with-identity.txt`
and `published-ts-with-identity.txt`. The CLI correctly skips ledger/anchor checks
for this simulated buyer export. This proves parser/verification compatibility
with the optional identity fields, not a live payment or anchor. Identity still
requires an online lookup. The two generated Python schema snapshots were
regenerated only after both published artifacts passed; no verifier logic or
conformance expectation was changed. Report exports still omit observations too.

### V3 hosted-export compatibility

`hosted-v3-with-identity.json` supplements the local zero-budget probe with the
existing committed hosted export `public/judge/hosted-run-nov11.receipts.json`
(source commit `0f7a2c25`, run `953af12e-c87c-4c83-85f6-e172ad372bfe`, two
real Testnet receipts). Only
matching unsigned writer observations were added to its 12 candidates. Removing
those observations reproduces the original parsed export exactly; no signed
manifest, receipt, grant, audit event or anchor was changed. This is a local
compatibility annotation of an existing export, not a new hosted question.

Both published v1.1.1 CLIs also say **RESULT PASS** on this v3 file with `--ledger`:
Python reports **46 passed, 0 failed, 2 skipped**; both pass **11/11 Testnet checks**
and the audit anchor at validated ledger **22228575**. Complete outputs are in
`published-python-hosted-v3.txt` and `published-ts-hosted-v3.txt`. The npm command
ran from an empty temporary directory and resolved the released v1.1.1 binary,
not a workspace executable. Writer identity remains an advisory online check.

`check-unavailable-390.png` injects a synthetic `check_failed` catalogue response
only to demonstrate failure copy. `ui-acceptance.json` records the distinction.
Open Records now appears with the other operator writers in Writers; the remaining
fictional writers stay in the fictional group and unverified. `gate-audit.json`
records zero violations on the local zero-budget runs; the auditor source is unchanged.
