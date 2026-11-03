# Compliance posture

ResearchAgent is a **Testnet prototype**. It is not a regulated payment service,
nothing here is legal advice, and no part of it has been reviewed by a regulator
or a lawyer. Every payment is XRPL Testnet XRP or an issued test currency (no value), or a labelled
SIMULATED rail; mainnet is disabled in code. The eight writers and their
articles are fictional. This page says what the software does today, what it
does not, and what a mainnet launch would need. Where it says "real" it means
implemented and tested in this repository, not approved by anyone.

## What is real today

| Control | What it does | Where | Verify |
|---|---|---|---|
| Spend limits | S$5 per run, S$1 per source, S$20 gross per wallet per UTC day (`WALLET_DAILY_CAP_MINOR`); MCP caps default to zero. Refunds never restore authority. | `server/spend-policy.ts`, [SECURITY](contracts/SECURITY.md#admission-and-operator-controls-286) | `tests/admission.test.ts` |
| Pause | `SPENDING_PAUSED=1` or an authenticated `POST /api/wallet/pause` stops new spending. Work already submitted still reconciles; pause never undoes a payment. | `server/store.ts` | audit `pause` entry |
| Authorization | Only deterministic policy code can start a purchase. The model never holds a key, a cap or a purchase command. API calls need an operator bearer token off loopback. | `server/purchases.ts`, `server/admission.ts` | `npm run gate:audit` |
| Audit trail | A hash-chained, append-only `audit_log` of who or what authorised or refused each spend, under which policy, caps, model and version. See below. | `server/audit.ts` | `npm run audit:verify` |
| Receipt export | One row per charge as CSV or JSONL, labelled Testnet or SIMULATED. | `scripts/audit-export.ts`, `GET /api/audit/receipts.csv` | row-for-row against run snapshots in `tests/audit-scenarios.test.ts` |
| On-ledger check | `audit:verify --testnet` looks every receipt up on a public Testnet node (destination, delivered amount, InvoiceID, and the refund). Read-only; no key is loaded. | `shared/xrpl.ts` | below |
| Payee denylist | An operator-edited list of XRPL addresses that policy code refuses to pay, checked before anything is signed (article purchases and hire payouts). | `server/payee-screening.ts` | `tests/audit.test.ts` |
| Retention | `npm run data:prune` deletes premium bodies, salts, events, answers and question text from old finished runs, and keeps receipts and the chain. | `server/retention.ts` | `tests/audit.test.ts` |

## Custody: what "we never hold funds" means

**Research purchases (shipped).** The operator's wallet pays the writer's
address directly, per article, over x402. ResearchAgent does not receive anyone
else's funds, so this flow is non-custodial towards writers and callers. The
operator does hold the payer key (see Key custody) and the signed-payment
journal; that is the operator's own money.

**Hire the agent (#274, Testnet).** A caller pays ResearchAgent over x402;
ResearchAgent spends part of that on articles, pays the writers it cited
(royalties, including free writers), and returns the change. That is
**receive-and-forward custody**: between the caller's payment and the payouts,
the funds sit in the ResearchAgent wallet, which is not a segregated escrow
account; the operator controls the development seed and keeps the retained
service fee. For that flow the sentence "we never hold funds" is **false**, and
so is a blanket "non-custodial" claim. Network fees are paid separately by each
sender. Unsigned denylisted royalties are cancelled and returned to the caller
with unspent budget (#310); signed or ambiguous failures stay reserved for
reconciliation. A refused caller refund stays reserved. Receiving a payment
promises no fulfilment during an outage. On mainnet,
receiving and forwarding value for third parties is a payment-service question
(licensing, safeguarding, customer identification, monitoring) that needs legal
review before it is switched on. The audit log records each inbound payment,
each royalty and change payout (reserve, signature, confirmation) and any
refusal, and the export lists them as `inbound`, `royalty` and `change` rows
next to the `purchase` rows.

## Audit trail

`audit_log` (SQLite, `data/app.db`) has one row per event: `seq`, `at`,
`prev_hash`, `hash`, `run_id`, `intent_id`, `surface`, `principal`, `kind`,
`data`. Each row's hash covers its fields and the previous row's hash.

- **Same transaction as the state change.** A purchase cannot be reserved, signed
  or settled without its row, and the row cannot exist without the change. If
  an entry cannot be written, the change rolls back.
- **Kinds:** `admission` (requested and admitted budget, caps in force, surface,
  principal, policy version, mode labels, a salted hash of the question),
  `decision` (provider, model, prompt version, calibration, threshold, selected
  article), `reserve`, `sign` (transaction hash only), `settle` (ledger index,
  amount, payee), `deliver` (content digest only), `proof`, `challenge`,
  `refund`, `refusal` (with the reason, including a denylist hit), `pause`,
  `policy` (caps and policy version at each boot, so a cap change is visible),
  `prune`, and a one-off `baseline` when an older database is upgraded. For
  hire-the-agent: `inbound` (the caller's settled payment, payer and invoice),
  `payout-reserve`, `payout-sign`, `payout-settle`, and `payout-cancel` for royalties and caller refunds.
- **Never in it:** premium bytes, passage text, salts, seeds, tokens, signed
  blobs or the question. The writer rejects such keys and secret-shaped values.
- **Tamper evidence.** `npm run audit:verify` recomputes the chain, checks that
  the sequence is contiguous and ends where SQLite's own counter says, and
  checks that every receipt, signed payment and refund in the money tables has a
  matching entry with the same transaction, amount and payee. Editing,
  deleting or reordering a row fails at that `seq` (`tests/audit.test.ts`).
  SQLite triggers also refuse `UPDATE` and `DELETE`, but that only stops
  accidents: someone with the file can drop them.

```
$ npm run audit:verify -- --testnet          # a copy of the 7-9 Oct 2026 demo database
AUDIT CHAIN   OK   2 entries, head #2 c505817279d8de3e5db7b66d9875aaef8320e8a221f35527d34c050c09f38bb3
COVERAGE      0 receipts, 0 signed payments, 0 refunds matched to their audit entries
TESTNET       OK   5 of 5 lookups confirmed (read-only; XRPL Testnet only, no real value)
  OK       payment AA857CB13A0854D1…  intent 6185af46-…  ledger 21350585 · 10000 drops → rEjDBaHAJ1nct3kcqFdzGCX6oS7GYi8b8C
  …
RESULT        PASS            # exit 0; 1 on tampering or a mismatch; 2 if it could not run
```

That database predates the log, so its five receipts are listed in the
`baseline` entry (coverage 0) and only the Testnet lookups check them. On a
database written by this version, coverage counts every receipt, signed
payment and refund.

**What the chain does not prove.** It is not signed and not externally
timestamped. Someone with write access to the database *and* the code can
rebuild a whole new valid chain. Cutting off the newest entries is caught by
the SQLite counter and by pinning the head you saw earlier
(`audit:verify --expect-head <hash>`; record it somewhere the database owner
cannot write). Receipts are independently checkable against the ledger. A
database created before this feature starts with a `baseline` entry that lists
the older intents; their history is not covered.

**Export.** `npm run audit:export -- --format csv|jsonl [--from 2026-11-01 --to 2026-11-30] [--out file]`
or `GET /api/audit/receipts.csv|.jsonl` (same bearer token as the other
operator routes). One row per article charge, plus one per hire-the-agent
inbound payment and signed royalty or change payout (the `kind` column).
Columns: kind, run, intent, surface, principal, policy version,
writer, payee address, payer, SGD budget minor units, settlement asset, delivered amount and legacy `amountDrops`, transaction hash,
InvoiceID, ledger index, explorer URL, status, refund transaction, reserved and
settled times, and a `label`/`network` that says XRPL Testnet or SIMULATED on
every row. `--log` exports the chain itself.

## Payee screening and sanctions

There is **no sanctions screening**. What exists is a hook: policy code asks
`server/payee-screening.ts` before signing, and a payee on
`data/payee-denylist.json` (override with `PAYEE_DENYLIST_FILE`) is refused with
"Payee is on the operator denylist; nothing was charged". No submission row is
written, and the audit log gets a `refusal` entry with the listed reason.

```json
[{ "address": "rExampleOperatorListedAddress", "reason": "Operator list: example" }]
```

It matches exact addresses only. A missing file means no list; an unreadable
or malformed file refuses every payment (fail closed). A real provider (an
address-screening API or a list feed) would be called from the same function
before signing. Writers are shown as **unverified writer**: there is no KYC or
KYB on Testnet, and a Testnet address says nothing about who controls it.

## Key custody

Today the payer seed is an environment variable in an ignored `.env`, and
writer keys live in a mode-0600 `.env.writer`. That is a development setup. It
has no rotation, no access log and no recovery. For mainnet the plan, not yet
built, is a KMS or HSM signer, an XRPL RegularKey with the master key disabled
or offline, and multisig for any treasury; the macOS app (#259) moves the token
and seed to the Keychain. Never put a seed in an issue, a log or an audit entry.

## KYC / AML, Travel Rule

None of it is implemented. For the record, as we understand the thresholds (to
be confirmed by counsel): the FATF Travel Rule applies from USD/EUR 1,000, and
Singapore's MAS from S$1,500 for digital payment token transfers. Per-article
payments (S$0.05 to S$1) sit far below both, but that is not an exemption:
aggregate monitoring across a customer, structuring detection and suspicious
activity reporting would be needed on mainnet, and we do not have them.

## Stablecoin issuer controls

RLUSD direct payments are supported on Testnet alongside XRP (#275). The
[official Ripple documentation](https://docs.ripple.com/products/stablecoin/developer-resources/rlusd-on-the-xrpl)
names issuer `rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV`. On 3 Nov its account
had Flags **2174353408**: DefaultRipple true, RequireAuth false, GlobalFreeze
false, NoFreeze false, AllowTrustLineClawback true. Freeze and clawback are issuer
powers; holders bear that risk. These observations are Testnet only.

The documented faucet returned HTTP 401 Authentication required. The live demo
therefore uses our Testnet issuer `rMfxn8xXFttYg9FZqGSX7chjpb7JmPd9FG`, labelled
**test USD (substitute for RLUSD)**, with Flags **8388608**: DefaultRipple true,
RequireAuth/GlobalFreeze/NoFreeze/AllowTrustLineClawback false. This is neither
Ripple-issued nor backed by dollars. Evidence: `docs/evidence/rlusd-275-refund-310.json`.
NoFreeze false means the stand-in issuer still has freeze power. There is no
mainnet approval or stablecoin redemption promise.

Before signing, policy screens both issuer and payee; checks payer and writer
trust lines, frozen/authorization state, source token balance, destination limit,
and native XRP fee headroom after the live base plus OwnerCount reserve. Setup
checks the incremental owner reserve before TrustSet (observed 0.2 XRP per line;
read live, never assumed). Transfer fees are refused. Exact settlement compares
currency, issuer and decimal `delivered_amount` without floating point and rejects
`tfPartialPayment`, paths, SendMax and DeliverMin. Missing/unknown delivery earns
no receipt. Issued-currency escrow is disabled; native XRP escrow stays opt-in.

#310 now returns refused unsigned royalties to the settled caller using stable
refund intent IDs. Cancellation, release of the royalty reservation and creation
of the replacement caller obligation share one SQLite transaction with the audit
rows. A signed or ambiguous payout cannot be cancelled or reassigned. Pause/caps
still apply to refunds. If the caller itself is denylisted, or the denylist is
malformed, caller refunds fail closed and stay reserved for operator resolution.
Removing a writer from the list never revives a cancelled payout. Refunds do not
restore research spending authority. The fixed service fee remains retained
except for its deterministic royalty pool; cancelled royalties are returned,
not retained. Audit verification checks cancellation-to-refund coverage.

## Data and retention

- **What we keep:** `data/app.db` holds run snapshots (the question, answers,
  decisions, events), premium bodies and manifest salts behind each grant,
  intents, receipts and signed payments, plus the audit log. The publisher keeps
  its own settlement journal.
- **Prune:** `npm run data:prune -- --older-than 30d [--dry-run]`. It deletes the
  bodies, salts, events, answers, decisions and question text of runs that are
  finished and older than the window, deletes their report files, and compacts
  the database. It skips runs with money in flight or a failed proof that can
  still be challenged. It keeps intents, receipts, signed payments, manifests
  and every audit row. The salted question hash in the log cannot be linked to
  a question once its salt is deleted. Nothing prunes automatically.
- **Why 30 days:** long enough to challenge and refund a bad delivery and to
  replay a demo; short enough that paid article bodies (a writer's licensed
  content) and users' questions are not kept indefinitely. Receipts and the
  chain are the financial record and are kept. Statutory retention periods on
  mainnet are a legal question we have not answered.
- **Langfuse:** traces are off unless configured. `LANGFUSE_PUBLIC_TRACES=1`
  makes traces publicly readable and they **carry question text**; leave it off
  for anything but a demo.
- **Backups, encryption at rest and access control** on `app.db` are the
  operator's job; there are none built in.

## What we do not claim

- That ResearchAgent is licensed, registered or approved in any jurisdiction.
- That Testnet receipts are financial records, or that XRPL Testnet is durable (it is reset periodically).
- Sanctions screening, KYC, KYB, AML monitoring, or Travel Rule compliance.
- That the audit chain is immutable or notarised; it is tamper-evident to the extent above.
- That "we never hold funds" holds for hire-the-agent.
- That the denylist is complete, or that a clean `audit:verify` means a payment was lawful or the writer honest.
- That the fixture-labelled and SIMULATED parts of a run (planner, search mode, decision model, ledger) are live.
- Anything about mainnet: it is disabled, and the [readiness checklist](BUILDER-FEEDBACK.md#mainnet-readiness-checklist) lists the gaps.
