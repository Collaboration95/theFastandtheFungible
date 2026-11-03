# Lane P1 — XRPL truth on first touch

> What this proves: 13/13 committed Testnet transactions matched live validated tesSUCCESS responses.
> Scope: Read-only public Testnet, 4 Nov 2026 Singapore; synthetic content, no real value.
> Limits: Historical settlement and identity binding do not prove content truth or mainnet readiness.

## Live evidence

`live-validation.json` records all thirteen hash checks over
`wss://s.altnet.rippletest.net:51233`, with two concurrent lookups, a five-second
response timeout and 256 KiB response limit. All matched committed fee, ledger,
operation and available amount, destination, InvoiceID or credential fields.
`endpoint-comparison.json` independently compares the same RLUSD hash over HTTP:
xrpl-labs returns txnNotFound; s.altnet and Clio return validated tesSUCCESS.
Ripple HTTP responses omit Access-Control-Allow-Origin; xrpl-labs advertises `*`.
The page uses WebSocket and auto-checks on load; failures retain historical labels.
No signing, wallet, funding, submit, .env, account queries or mainnet access.

## Reproduce

After `npm ci`, run `node scripts/repro/07-endpoint-history.mjs`.
`repro-results.json` records all seven scripts and elapsed times. Scripts 1, 5
and 6 replay dated evidence (flags, explicit cancellation, funding refusal), not
new network experiments. Script 2 exercises adversarial delivered-amount fixtures;
3 executes the default invoice store extracted from pinned x402-xrpl 0.3.4;
4 exercises the pinned client with a header-only challenge and mock transport.
Every script asserts its finding and completes within 30 seconds, with a 29-second
watchdog for the live check. Upstream bodies in `docs/feedback/upstream/` remain
**draft, not filed**; owner-only filing.

## Presentation

README links each XRPL primitive to a committed Testnet explorer hash.
Writer badges link known credential object IDs to their committed CredentialCreate
hash; other verified identities retain their ledger-entry link. These are identity
observations, never endorsements. Simulated purchase events show SGD and the quoted
asset equivalent with an explicit no-ledger-transaction label.

## Verification

All required local checks pass: `npm run check:fast` (131 files, 1,153 tests;
20 chaos iterations, zero double charges or invariant violations), `npm run hygiene`,
`npx playwright test --config playwright.ledger.config.ts` (4 tests), and
`python3 -m pytest packages/sdk-python` (205 tests). `npm run readme:check` also passes.
The repository commit hook repeats check:fast. Browser tests bind an ephemeral port.

Recorded repro durations: issuer permission 0.047 s; delivered amount 0.048 s;
invoice consumption 0.050 s; header-only challenge 0.146 s; expiry/cancel replay
0.052 s; funding-auth replay 0.065 s; endpoint/history 10.250 s.
No hard gate, threshold or test has been loosened. The stale browser row-count
assertion was corrected from nine to thirteen to cover the four credential rows.
