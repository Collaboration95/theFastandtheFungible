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
request/queue deadlines, 16 KiB response limits and a 15-second, 256-wallet cache.
HTTP redirects are refused. Queue saturation, errors, malformed responses and
wrong network become `check_failed`, displayed as unverified with check unavailable.
Missing, unaccepted and expired credentials are `unverified`. Only an accepted,
trusted and bound credential is `verified`. A credential expiring within the cache
window is conservatively unverified. Revocation can take up to the TTL to appear.

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
