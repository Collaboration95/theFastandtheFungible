# Verified writers via XRPL Credentials

Identity is not truth. A credential attests to a seller wallet, not an article,
claim, reputation score or investment recommendation. Issuer trust is operator
policy. Purchase decisions, trust weights, prices, budgets and payment authority
are unchanged: only deterministic policy code can spend. Testnet only; no real value.

Set `WRITER_CREDENTIAL_ISSUERS` to a JSON array (maximum four):

```json
[{"issuer":"rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV","credentialType":"AB","label":"Example issuer"}]
```

This is an example configuration, not an endorsement of that issuer/type.
Credential type is 1–64 bytes encoded as hex; labels come exclusively from
operator configuration. No configuration means unverified writers and no RPC.
Malformed configuration fails closed. Historical `unverified writer` labels and
missing fields read as unverified. The engine replaces publisher-supplied status.

The read-only verifier checks network ID 1, reads a validated ledger header, then
pins `ledger_entry` credential lookup (subject/issuer/type) to its ledger hash.
It requires exact subject and issuer/type binding, Credential entry type,
lsfAccepted (0x10000), and no expiry at the validated close time. The seller wallet
comes from a verified signed manifest matched to the registry. Public discovery
keys alone cannot establish possession: FREE hits remain unverified until their
signed free delivery is checked. Registry-only entries remain unverified.
Two origins using the same seller wallet share one cached observation.

RPC uses the existing `XRPL_RPC_URL` Testnet allowlist. For bounded HTTP reads,
`wss:` becomes `https:` and standard port 51233 becomes 51234; custom ports are
preserved. There are at most two active requests, a 64-slot queue, 1.2-second
request/queue deadlines, 16 KiB response limits and a 5-minute, 256-wallet cache.
HTTP redirects are refused. Queue saturation, errors, malformed responses and
wrong network become `check_failed`, displayed as unverified with check unavailable.
Missing, unaccepted and expired credentials are `unverified`. Only an accepted,
trusted and bound credential is `verified`. A credential expiring within the cache
window is conservatively unverified. See the refresh and staleness bound below.

Verified metadata includes issuerLabel, issuer, credentialType, credentialId,
validated ledgerIndex, optional expiresAt and checkedAt. UI links identify the
XRPL Foundation Testnet technical-explorer ledger object. SDK citations and purchases and MCP results expose advisory
identity with “requires online check”. Python citations expose the same status.
Receipt bundles omit credential observations; signed payment, manifest and grant
semantics are unchanged. Both offline verifiers report credential identity as
SKIP / requires online check. Report exports also omit observations. Online run/SDK presentation is unsigned
advisory data and is never used to validate receipt signatures.

## Issuer runbook

1. Agree with the operator on issuer account, hex type and display label. Check
   the writer's identity by your own process; the engine does not perform KYC.
2. On Testnet, submit CredentialCreate with Account=issuer, Subject=seller wallet,
   CredentialType=agreed hex and optional Ripple-epoch Expiration.
3. The seller submits CredentialAccept with Account=seller, Issuer=issuer and
   the same CredentialType. Acceptance moves owner reserve to the subject.
4. Configure the trusted tuple, search the writer and inspect checkedAt and the
   ledger object. CredentialDelete revokes it; allow the cache TTL to elapse.

Operator proof: `node --import tsx scripts/credentials-testnet.ts --testnet`.
This explicitly provisions credentials using existing `.env` Testnet payer and
publisher signers, with a 2,000-drop fee ceiling and network preflight. It never
prints seeds. It does not run from the engine. Repeated provisioning on the same
date/type may return duplicate-entry errors: preserve evidence and use read-only
checks rather than paying again. No funded wallets were created for Lane N.

Protocol reference: [Credential fields and acceptance flag](https://xrpl.org/docs/references/protocol/ledger-data/ledger-entry-types/credential),
[ledger_entry credential lookup](https://xrpl.org/docs/references/http-websocket-apis/public-api-methods/ledger-methods/ledger_entry).
See `docs/evidence/round2-n/README.md` for live Testnet and fixture evidence.

Issuer configuration accepts XRPL wire-format `credentialType` hex as before, or `credentialTypeText` (for example `ResearchAgent-writer-2026-11-03`), converted from UTF-8 to uppercase hex. Types must encode 1–64 bytes; if both fields are provided they must agree. Committed evidence stores `credentialTypeText`; runtime observations and XRPL comparisons retain wire-format hex.

## Permissioned Domain

The sandbox operator’s Testnet domain lists the credential tuples accepted for
identity display. Domain configuration takes precedence over the legacy env array;
a missing, malformed, unvalidated, wrong-ledger or oversized domain never falls
back to that array. The app supports 1–4 distinct issuer/type tuples. Without a
domain, `WRITER_CREDENTIAL_ISSUERS` continues to work; with neither setting, there
are no identity RPCs. A domain is an identity allowlist, not a restriction on
searching, buying or publishing. It does not enforce KYC or attest article quality.

The server checks `network_id=1`, reads a validated ledger header and pins both
`ledger_entry {index: domainId}` and every credential lookup to that same ledger
hash. It shares that snapshot and wallet observations for **five minutes**. A
wallet first checked late in the window expires with the snapshot, preventing
stacked TTLs. Refresh starts one minute before expiry.
Expired or unaccepted credentials observed on the ledger remain unverified. RPC failures read
“unverified writer · check unavailable”. Credentials identify the operator’s
attestation only: the UI title is “Identity, not quality”.

Only **Build notes**, **XRPL explainers** and **Open Records** receive credentials
of type `researchagent/writer-v1`, expiring **30 November 2026 at 00:00 UTC**.
Other fictional writers remain fictional and unverified. The displayed label is:
“XRPL Credential · issued by ResearchAgent operator (Testnet, identity only, not KYC)”.
The credential link uses its validated `PreviousTxnID` (the acceptance transaction)
and the domain link uses its ledger index. Neither changes decision input, trust
weights, policy, spending authority or gate-audit.

### Operator setup and VM hand-off

Run `node scripts/writer-credentials-testnet.mjs` locally where the private hosted
wallet directory exists. It checks Testnet before creating a new issuer and funds
that issuer once from the Testnet faucet. The issuer seed is stored mode 0600 at
`~/.config/researchagent-hosted/wallets/XRPL_CREDENTIAL_ISSUER_SEED`. It reads only
the three named writer seeds, inside the script, and never prints signing material.
An unfunded free-only Open Records account receives 2 Testnet XRP from the issuer
so it can accept its credential and hold its reserve. Fees are capped at 2,000 drops
per transaction. Before issuing, accepting or creating the domain it reads existing
ledger objects; repeat runs submit nothing when the setup already exists. Public
addresses, transaction hashes, ledger indexes and domain evidence are in
`docs/evidence/writer-credentials-nov12/ledger.json`.

At the next VM redeploy, the orchestrator must add exactly:

```sh
WRITER_CREDENTIAL_DOMAIN=D0B5DB2A87E03E375B3CF519B2323971C9E4D0300D31F93F8EAA927F0680B998
```

The issuer seed stays with the operator; the read-only verifier does not need it.
This lane does not modify the VM or `docker/hosted/**`. Local hosted screenshots
and latency evidence demonstrate local behavior only; hosted deployment remains
the orchestrator’s step. FIN-prep can describe a Testnet Permissioned Domain
listing accepted writer credentials; production would need an appropriate KYB
issuer and separate operational/compliance work.

Protocol: [PermissionedDomain fields](https://xrpl.org/docs/references/protocol/ledger-data/ledger-entry-types/permissioneddomain).

`domainId` and `credentialTxHash` are optional presentation fields. The v1.1.1
published wheel and MCP CLI both accept a local export containing them (see the
published-artifact outputs in this lane's evidence). Normal receipt/report exports
continue to omit writer observations; no signed proof format changes.
They also pass the existing hosted v3 export annotated only with matching advisory
identities: 11/11 Testnet checks and the validated audit anchor pass in both CLIs.
The evidence distinguishes this compatibility annotation from a new hosted run.

## Refresh and bounded waiting

The API starts domain and registry-wallet prewarming in the background at boot;
startup and readiness never await it. Wallet warming is paced so it does not fill the bounded RPC queue.
Registry wallets only seed the cache: presentation still requires the signed manifest/delivery binding described above.
New wallets also warm lazily at their first signed search or free read.

With no completed observation, callers wait **at most 300 ms**, then receive
`check_pending` ("unverified writer · check pending", styled like check unavailable).
The read continues within the existing per-RPC/queue deadlines. A later search
uses its result; slow reads alone never become a negative credential observation.
Genuine cold RPC failures return `check_failed`; malformed domains and missing,
unaccepted or expired credentials retain their existing unverified behavior.

Completed observations return immediately, including across TTL expiry. Each
wallet has at most one refresh in flight. Unreferenced timers start refresh
**60 seconds before the five-minute expiry**; wallets share the pinned domain
refresh. Refresh failures retry once per minute without discarding the last
observation. Cache eviction or operator configuration changes discard observations.

On refresh failures, an observation may be **up to ten minutes stale beyond its
five-minute TTL** (at most fifteen minutes from the snapshot read's start).
At that bound the display becomes "check unavailable", even during another
refresh. A credential's explicit expiry is an earlier hard cutoff. Successful
revocation/domain reads replace the old value immediately; during an outage,
revocation can take up to this fifteen-minute maximum to stop showing verified.
`checkedAt` remains the original observation time while serving stale data.
No credential state, including pending, is included in decision-model input or
spending policy; this is unsigned advisory identity display only.

## X2b local latency evidence (12 November 2026)

`npx vitest run tests/writer-credentials-hosted.test.ts` exercises the signed
publisher-search fan-out for both team writers over local HTTP with `HOSTED=1`.
Writer signatures and ledger responses are synthetic; each mocked RPC takes
750 ms, giving a three-second domain/credential read. The production five-minute
TTL is forced past expiry by advancing the observation clock; transport deadlines
still use real time. Each preset has five search samples, including one forced
expiry; p95 uses nearest rank (therefore also the maximum at this sample size).
This measures search, not model planning, purchases or end-to-end answers. No
live demo, cloud resource, live model or Testnet transaction was used.

| Preset | Original #482 p95 / max | Background refresh p95 / max |
| --- | ---: | ---: |
| x402 payment (XRPL2) | 3022.01 ms | 8.78 ms |
| RLUSD escrow (XRPL1) | 3014.97 ms | 11.14 ms |
| Account reserves (XRPL3) | 3009.92 ms | 9.96 ms |

The original implementation fails the new <300 ms forced-expiry assertion;
the fixed implementation passes all presets. Fake-timer tests separately pin
the cold wait to exactly 300 ms and verify the later verified result. Real
Testnet latency is the orchestrator's reported 2.87-second observation, not a
new live-network measurement from this lane.
