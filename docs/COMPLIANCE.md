# Compliance map: what a regulated deployment would need, and what we have

**Status in one line:** a Testnet prototype with strong *controls and evidence*
and no *licences, screening providers, KYB or key custody*. Nothing here is
legal advice or has been reviewed by a regulator or lawyer. Mainnet is blocked
in code ([`shared/xrpl.ts:13-16`](../shared/xrpl.ts): only `*.rippletest.net`
hosts are accepted). Writers, articles and TEST-SGD are fictional or
substitutes, and labelled as such. "Built" means implemented and tested in this
repository, never approved by anyone.

**How to read it.** Each row names a need, then what exists (with the file or
doc that implements it), then what is **not done**. Statements about law are
marked **Source** (a regulator's page, listed at the end) or
**Interpretation** (our reading, for counsel to confirm). We invent no
requirements.

| Area | What a regulated deployment would need | Built today (cited) | Not done / would need |
|---|---|---|---|
| **Custody of keys** | Payer and writer signing keys in a KMS or HSM, a RegularKey with the master key offline, multisig for a treasury, rotation, access logs | Keys stay server-side and out of logs, audit rows and the browser: seed read in one place ([`server/xrpl.ts:36`](../server/xrpl.ts)), scrubbed from telemetry ([`server/telemetry.ts:12`](../server/telemetry.ts)), refused by the audit writer ([`server/audit.ts:31-39`](../server/audit.ts)). Agents hold scoped bearer tokens, never the payer key ([`server/agent-keys.ts`](../server/agent-keys.ts)) | Today the payer seed is an env var and writer seeds sit in a 0600 file: **no KMS/HSM, rotation, access log or recovery** ([Key custody](#key-custody)). Hire-the-agent is receive-and-forward, so "we never hold funds" is false for it ([Custody](#custody-what-we-never-hold-funds-means)) |
| **Spending authority and limits** | A limit set by the operator, enforced outside the model, with pause and revoke | Per-prompt budget max S$5, S$1 per source ([`shared/contracts/run.ts:19`](../shared/contracts/run.ts)); S$20 per wallet per UTC day, default 2000 minor units ([`server/spend-policy.ts:11`](../server/spend-policy.ts), enforced at [`server/store.ts:501`](../server/store.ts)); pause ([`server/store.ts:500`](../server/store.ts)); per-agent caps and revoke ([`server/agent-keys.ts`](../server/agent-keys.ts)); only policy code starts a purchase ([`server/purchases.ts`](../server/purchases.ts)); audit rules `purchase_without_policy`, `over_budget`, `agent_authority` ([`scripts/gate-audit.ts:14`](../scripts/gate-audit.ts)) | Limits are single-operator config, not a maker-checker workflow; no per-counterparty or velocity limits; no cap on *aggregate* exposure to one writer; no approval tiers above the cap |
| **Audit retention and tamper evidence** | Append-only record of who authorised each spend, independently checkable, retained for the statutory period | Hash-chained `audit_log`, written in the same SQLite transaction as the state change ([`server/audit.ts:58-59`](../server/audit.ts) append-only triggers; [`:101`](../server/audit.ts) `verifyChain`; [`:124`](../server/audit.ts) `--expect-head` pin); money-table cross-check; CSV/JSONL export ([`scripts/audit-export.ts`](../scripts/audit-export.ts)). **Anchored heads:** each finished answer, including a refusal to buy, writes its audit head into an XRPL memo ([`server/anchor.ts:36,44`](../server/anchor.ts), [`server/xrpl.ts:99-100`](../server/xrpl.ts), format in [receipt-spec](receipt-spec.md#xrpl-anchor-v1)); the offline verifier checks head, run and answer commitment ([`sdk/verify.ts:58-60`](../sdk/verify.ts)). Writer-side settlement journal ([`publisher/journal.ts`](../publisher/journal.ts)). Ten rules in `npm run gate:audit` ([`scripts/gate-audit.ts:14`](../scripts/gate-audit.ts)) | Chain is not signed; someone with the database *and* the code can rebuild it ([What the chain does not prove](#audit-trail)). Anchors are on Testnet, which resets, so they are not durable evidence. No WORM storage, backups or off-box copy of the head. **Retention periods are unanswered** (a legal question). `audit:verify` does not itself check anchors; `verify:answer --ledger` does |
| **Sanctions screening** | A screening provider (lists, fuzzy match, ongoing monitoring) called before any payment, fail-closed | **A hook only.** An operator denylist of exact XRPL addresses, checked before signing for article purchases ([`server/purchases.ts:106`](../server/purchases.ts)), escrow ([`server/escrow.ts:33`](../server/escrow.ts)), SDK x402 pays ([`sdk/x402.ts:45`](../sdk/x402.ts)), hire payouts ([`server/hire/service.ts:74,79`](../server/hire/service.ts)) and writer publishing ([`publisher/publishing/publish.ts:53`](../publisher/publishing/publish.ts)). Implementation and the fail-closed rule: [`server/payee-screening.ts:15-22`](../server/payee-screening.ts); test: `tests/audit.test.ts:256-264` | **No sanctions screening exists.** No provider, no list feed, no fuzzy or owner-level matching, no ongoing re-screening of past payees, a hire caller's *inbound* payment is not screened at all (only payouts, including caller refunds, are) |
| **KYB/KYC for writers** | Know who is being paid: business verification, beneficial owners, then a way to gate payees on it | Writers are labelled "unverified writer" unless an XRPL Credential from an operator-trusted issuer is accepted on ledger: CredentialCreate/Accept ([`publisher/publishing/credential.ts:34-37`](../publisher/publishing/credential.ts)), read-only check pinned to a validated ledger ([`docs/writer-verification.md`](writer-verification.md)). Status is advisory display; it never changes who can be paid | **No KYB or KYC is performed**; "the engine does not perform KYC" ([writer-verification](writer-verification.md#issuer-runbook)). No onboarding workflow, no credential-gated payouts, **no XRPL Permissioned Domains** (zero code references; the amendment is live on mainnet per [xrpl.org](https://xrpl.org/docs/references/protocol/transactions/types/permissioneddomainset)). A credential is not a compliance decision |
| **Refunds and disputes** | A defined remedy for non-delivery or a bad delivery, with a record | Key-reveal escrow: the writer is paid only by publishing the decryption key on ledger; no finish means the buyer's policy cancels after `CancelAfter` ([key-reveal-escrow](key-reveal-escrow.md#recovery-and-fraud), policy submits EscrowCancel, [`server/escrow.ts:156`](../server/escrow.ts)). A failed passage proof can be challenged and the writer signs a refund payment, written once ([`publisher/challenge.ts:20`](../publisher/challenge.ts), route [`publisher/routes.ts:247`](../publisher/routes.ts)). Refunds never restore spending authority; audit rules `escrow_finish_without_verified_proof`, `money_chain_reconciliation` | Refunds depend on the writer cooperating (labelled so in the audit rule `missing_rail_label`). **Cooperative, not enforceable**: no arbitration, no loss allocation, no chargeback right ([Disputes gap](BUILDER-FEEDBACK.md#mainnet-readiness-checklist)). Truth of content is not adjudicated |
| **Data protection** | Collect little, keep it briefly, delete on request, say what is logged | No PII is collected: no accounts or emails; questions are stored in the run and as a **salted hash** in the audit log, never on the ledger ([`server/audit.ts:31-39`](../server/audit.ts) rejects question, seed, token and body keys). `npm run data:prune` deletes bodies, salts, events and question text and keeps receipts and the chain ([`server/retention.ts`](../server/retention.ts)). Detail: [Data and retention](#data-and-retention) | Nothing prunes automatically. No encryption at rest, backups or access control on `app.db` (operator's job). No deletion-request flow. Public Langfuse traces carry question text if enabled. No data-protection assessment (e.g. Singapore PDPA) was done |
| **Singapore: MAS Payment Services Act, DPT** | Work out whether the service is a licensable payment service and which licence | Controls above (limits, audit, screening hook) are the kind a licensee must evidence. **Source:** MAS regulates digital payment token services under the PS Act and treats stablecoins outside its own framework as DPTs ([MAS 2026 stablecoin consultation](https://www.mas.gov.sg/news/media-releases/2026/mas-consults-on-legislative-amendments-to-implement-stablecoin-regulatory-framework)); merely accepting DPTs without intending to transmit or arrange transfers is not enough to trigger licensing (MAS PS Act FAQ, [April 2024](https://www.mas.gov.sg/-/media/mas-media-library/regulation/faqs/pd/faqs-on-payment-services-act-2019/payment-services-act-faq--19-april-2024.pdf)); since 30 Jun 2025 providers of digital token services *solely to customers outside Singapore* also need a licence, which MAS says it will generally not grant ([MAS](https://www.mas.gov.sg/news/media-releases/2025/mas-clarifies-regulatory-regime-for-digital-token-service-providers)) | **No licence, no legal opinion.** **Interpretation (unconfirmed):** research purchases pay from the operator's own wallet, which looks unlike a service to others; hire-the-agent (receive, forward royalties, return change) is the case most likely to be a transfer or custody service. Questions for MAS or counsel are listed below |
| **US: GENIUS Act, stablecoin issuer** | If a stablecoin such as RLUSD is the settlement asset, understand that the *issuer* carries the licensing, reserve and AML duties, and what that means for freeze, clawback and redemption | We record the issuer's flags rather than assume them: on 3 Nov the documented Testnet RLUSD issuer had AllowTrustLineClawback on and escrow locking off ([Stablecoin issuer controls](#stablecoin-issuer-controls)); the demo uses a labelled stand-in, TEST-SGD, with no value and no peg ([key-reveal-escrow](key-reveal-escrow.md#threat-model-and-limits)). Before signing, policy checks issuer, trust line, freeze and authorisation state. **Source:** the GENIUS Act is Public Law 119-27 (18 Jul 2025) ([Congress.gov](https://www.congress.gov/119/plaws/publ27/PLAW-119publ27.pdf)); Treasury and FinCEN/OFAC have proposed rules requiring permitted issuers to adopt AML and sanctions programmes ([Treasury, 8 Apr 2026](https://home.treasury.gov/news/press-releases/sb0435)) | **Official RLUSD escrow does not work** until its issuer enables AllowTrustLineLocking; no redemption, FX or peg claim; mainnet issuer behaviour unmeasured. We are a *user* of an issuer's token, not an issuer, so issuer duties are not ours; whether receive-and-forward makes us a money transmitter is **Interpretation**, for counsel. Final rule status and effective dates must be checked at Treasury; we have not tracked them |
| **Travel Rule** | Originator and beneficiary information must accompany transfers by a regulated provider, with identity checks above a threshold | Not implemented. Per-article payments are S$0.05 to S$1. **Source:** FATF lets countries set a de minimis threshold of at most USD/EUR 1,000 for virtual-asset transfers, and *below* it still expects originator and beneficiary names and a wallet address or reference ([FATF](https://www.fatf-gafi.org/content/dam/fatf-gafi/guidance/Updated-Guidance-VA-VASP.pdf)); MAS notice PSN02 requires four data items at or below S$1,500 and identity verification above it, for licensed DPT providers ([MAS PSN02](https://www.mas.gov.sg/-/media/amld-amendments---30-june-2025/mas-notice-psn02.pdf)) | **Small amounts are not an exemption** (an earlier version of this page implied thresholds that remove obligations; corrected below). No originator/beneficiary data capture, no aggregate monitoring, no structuring detection, no suspicious-activity reporting. **Interpretation:** it applies only if a regulated provider is in the chain, which depends on the licensing answer above |
| **Mainnet readiness** | Operating, security and compliance sign-off | Testnet restriction in code; per-control checklist with a status for each ([BUILDER-FEEDBACK](BUILDER-FEEDBACK.md#mainnet-readiness-checklist)): decision is **GAP — Testnet demonstration only**. Merge gate described in [`docs/contracts/local-gate.md`](contracts/local-gate.md) (offline fixtures, not mainnet evidence) | Open: KMS/HSM, price units and FX (#163), facilitator SLA, monitoring and alerts, backup and restore, independent security test, legal review, licensing |

## The five hard gates, as a regulated deployment would read them

| Gate | Control it gives a compliance officer | Enforced in | Checked after the fact by |
|---|---|---|---|
| No premium bytes before a grant | Content is not released until payment is validated | [`server/escrow.ts`](../server/escrow.ts), [key-reveal-escrow](key-reveal-escrow.md#gate-1-interpretation) | `premium_leak`, `citation_without_verified_grant` |
| Budget is the only spending authorisation; only policy code purchases | The model cannot move money; limits are operator-set | [`server/purchases.ts`](../server/purchases.ts), [`server/spend-policy.ts`](../server/spend-policy.ts) | `purchase_without_policy`, `over_budget`, `agent_authority` |
| One charge per intent | No duplicate payments; crash recovery reuses the same signed blob | [`server/store.ts`](../server/store.ts), [key-reveal-escrow](key-reveal-escrow.md#recovery-and-fraud) | `duplicate_settlement`, `money_chain_reconciliation` |
| Real citations | Every claim traces to a delivered, hashed passage | [receipt-spec](receipt-spec.md) | `citation_without_verified_grant`, offline `verify:answer` |
| Anything simulated or substituted is labelled | A reader cannot mistake Testnet or fixtures for production | [`shared/contracts/publisher.ts`](../shared/contracts/publisher.ts) labels | `missing_rail_label` |

`npm run gate:audit -- --db <store>` runs all ten rules read-only against a
database ([`scripts/gate-audit.ts:14`](../scripts/gate-audit.ts)); it exits 1 on a
violation. Design record: [FINAL-PUSH §12](FINAL-PUSH.md).

## Questions to put to MAS or counsel (not answers)

1. Does paying writers from the operator's own wallet, on a user's behalf, amount to a payment service, or is it the operator's own purchase?
2. Does hire-the-agent (receive, forward royalties, return change) make us a DPT transfer or custody service, and would safeguarding apply?
3. Are XRP and an issued stablecoin both "digital payment tokens" for this flow, and does that change if the stablecoin is MAS-regulated or recognised later?
4. Which of the Travel Rule data items must we collect for S$0.05 to S$1 transfers, and from whom, if a licensed provider sits in the chain?
5. What retention period applies to receipts and the audit chain, and does an XRPL memo count as a record we may rely on?
6. Which sanctions lists and screening standard must a payee check meet, and is exact-address matching ever enough?

## Sources used for regulatory statements

- MAS, [Payment Services Act page](https://www.mas.gov.sg/regulation/acts/payment-services-act) and [FAQ, April 2024](https://www.mas.gov.sg/-/media/mas-media-library/regulation/faqs/pd/faqs-on-payment-services-act-2019/payment-services-act-faq--19-april-2024.pdf); [Notice PSN02 (DPT AML/CFT), revised 30 June 2025](https://www.mas.gov.sg/-/media/amld-amendments---30-june-2025/mas-notice-psn02.pdf); [Digital token service providers, 2025](https://www.mas.gov.sg/news/media-releases/2025/mas-clarifies-regulatory-regime-for-digital-token-service-providers); [stablecoin amendments consultation, 2026 (draft; may change)](https://www.mas.gov.sg/news/media-releases/2026/mas-consults-on-legislative-amendments-to-implement-stablecoin-regulatory-framework).
- FATF, [Updated Guidance on virtual assets and VASPs](https://www.fatf-gafi.org/content/dam/fatf-gafi/guidance/Updated-Guidance-VA-VASP.pdf) and the [June 2025 Recommendation 16 update](https://www.fatf-gafi.org/en/publications/Fatfrecommendations/update-Recommendation-16-payment-transparency-june-2025.html).
- US: [GENIUS Act, P.L. 119-27](https://www.congress.gov/119/plaws/publ27/PLAW-119publ27.pdf); Treasury, [FinCEN/OFAC proposed rule, 8 Apr 2026](https://home.treasury.gov/news/press-releases/sb0435) and [licensing proposal](https://home.treasury.gov/news/press-releases/sb0605). Proposals can change; check final status before relying on them.
- XRPL: [PermissionedDomainSet](https://xrpl.org/docs/references/protocol/transactions/types/permissioneddomainset), [XLS-80](https://xls.xrpl.org/xls/XLS-0080-permissioned-domains.html); [RLUSD on the XRPL](https://docs.ripple.com/products/stablecoin/developer-resources/rlusd-on-the-xrpl) (issuer addresses only; we make no claim about the issuer's regulatory status).

Regulatory pages were read on 10 Nov 2026 through search summaries, not the full
legal text; confirm paragraph-level wording before relying on any of it.

---

## Detailed posture

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
| Agent allowances | Per-agent hashed keys, per-call/daily caps under wallet authority, durable pause/revoke, principal attribution and gross spend today/seven days. No separate balance store. | `server/agent-keys.ts`, `server/store.ts`, `npm run agents` | `tests/agent-keys.test.ts`, [Testnet evidence](evidence/agents-280.md) |
| Pause | `SPENDING_PAUSED=1` or an authenticated `POST /api/wallet/pause` stops new spending. Work already submitted still reconciles; pause never undoes a payment. | `server/store.ts` | audit `pause` entry |
| Authorization | Only deterministic policy code can start a purchase. An agent may hold a scoped bearer token, never the payer signing key or a purchase command; operator caps live in policy code. API calls need an operator bearer token off loopback. | `server/purchases.ts`, `server/admission.ts` | `npm run gate:audit` |
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

**What the chain does not prove.** The chain itself is not signed. Since
the current release (v1.0.2), each finished Testnet answer also writes its audit head into an XRPL
memo ([anchor-v1](receipt-spec.md#xrpl-anchor-v1)), which gives *that head* an
external ledger timestamp; `verify:answer --ledger` checks it. `audit:verify`
does not read anchors, simulated runs have none, and Testnet is reset
periodically, so an anchor is not durable evidence. Someone with write access
to the database *and* the code can rebuild a whole new valid chain.
Cutting off the newest entries is caught by
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
every row. `--log` exports the chain itself. `--principal AGENT_ID` filters either export; HTTP receipt exports accept `?principal=AGENT_ID`. Agent tokens cannot export other agents' money records; operator authentication protects exports.

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

None of it is implemented. Correction (10 Nov): an earlier version said the
Travel Rule "applies from" USD/EUR 1,000 and S$1,500, as if smaller amounts
were out of scope. The sources say otherwise. FATF allows countries a de minimis
threshold of at most USD/EUR 1,000 for virtual-asset transfers, but below it a
provider should still collect originator and beneficiary names and a wallet
address or reference. MAS Notice PSN02 requires four data items at or below
S$1,500 and identity verification above it, for licensed digital payment token
service providers ([FATF](https://www.fatf-gafi.org/content/dam/fatf-gafi/guidance/Updated-Guidance-VA-VASP.pdf),
[MAS PSN02](https://www.mas.gov.sg/-/media/amld-amendments---30-june-2025/mas-notice-psn02.pdf);
we read them via search summaries, so confirm the paragraphs). Per-article
payments (S$0.05 to S$1) sit far below both thresholds, which affects what is
verified, not whether data is collected. **Interpretation:** the rule binds
regulated providers, so whether it reaches us depends on the licensing answer
in the map above. We have no originator/beneficiary capture, aggregate
monitoring, structuring detection or suspicious-activity reporting.

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
- That the audit chain is immutable or notarised; it is tamper-evident to the extent above (anchored heads are Testnet-only).
- That "we never hold funds" holds for hire-the-agent.
- That the denylist is complete, or that a clean `audit:verify` means a payment was lawful or the writer honest.
- That the fixture-labelled and SIMULATED parts of a run (planner, search mode, decision model, ledger) are live.
- Anything about mainnet: it is disabled, and the [readiness checklist](BUILDER-FEEDBACK.md#mainnet-readiness-checklist) lists the gaps.

## Per-answer independent verification (#278)

Answer/report JSON and newly generated PDFs contain portable receipt evidence.
`npm run verify:answer -- <report> [--testnet]` and SDK `verifyAnswer()` recompute writer
signatures, delivered passage hashes, citation references, grants, quote/receipt
bindings and the disclosed audit segment. `--testnet` reuses the operator
verifier for payment and refund destination, exact delivered amount/asset,
InvoiceID, sender and validation; partial refunds are refused too. Offline
output explicitly leaves ledger checks unconfirmed. No signer is loaded.

A writer signature is control of a key, not verified personal identity or truth.
The per-run audit segment contains opaque commitments for other runs and needs
an independently pinned head to resist a rewritten export. It supplements the
full operator `audit:verify`; it does not replace money-table coverage. PDF
attachments are integrity envelopes, not digital signatures. Legacy exports
without proofs fail with a re-export instruction. See
[the evidence and precise limits](evidence/verify-278.md).
