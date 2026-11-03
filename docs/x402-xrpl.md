# x402 and XRPL integration contract

## As built (8 Oct 2026)

Every writer is a facilitator: the publisher host serves `/w/:slug/...`, and
the buyer pays the writer's own wallet on XRPL Testnet (`xrpl:1`, scheme
`exact`, asset XRP in integer drops). Code: `publisher/routes.ts`,
`publisher/facilitator.ts`, `publisher/challenge.ts`, `shared/x402.ts`,
`server/purchases.ts`.

1. **Search.** `GET /w/:slug/search?q=&k=` returns abstracts, signals and a
   signed manifest per hit. The buyer verifies the manifest signature and that
   its key derives to the payee wallet before it will sign anything.
2. **402.** `GET /w/:slug/articles/:id` without `PAYMENT-SIGNATURE` returns 402
   with `PAYMENT-REQUIRED` (base64 JSON, `x402Version: 2`, one `accepts` entry)
   and no body. `extra.invoiceId` is canonical JSON of `{quoteId, articleId,
   version, manifestRoot, amount, payTo}`; the on-ledger XRPL `InvoiceID` is
   `sha256(invoiceId)` in uppercase hex. The buyer takes the manifest root from
   the verified search manifest, never from the 402 alone.
3. **Pay.** The buyer (policy code only) signs a Payment with that `InvoiceID`
   and retries with `PAYMENT-SIGNATURE` (base64 JSON carrying the signed blob).
4. **Facilitate.** The writer's `facilitator/verify` and `/settle` check the
   quote, payee, amount, `InvoiceID`, article and version, `LastLedgerSequence`,
   then submit and wait for a validated `tesSUCCESS`. Settlement is recorded
   once per tx hash. `facilitator/supported` lists `exact` on `xrpl:1`. Header
   decoding is capped at 8 KiB.
5. **Deliver.** The response carries `PAYMENT-RESPONSE` plus the body,
   passages and salts. Resending the same signed blob returns the same
   delivery and never charges twice. The buyer then runs the proof check
   against the manifest.
6. **Challenge and refund.** A failed proof sends `POST /w/:slug/challenge`.
   The writer re-checks the bytes and salts it stored and, if the claim is
   broken, sends a Payment of the full amount from its own wallet back to the
   payer with `InvoiceID` = the original tx hash; write-once per payment.
   The buyer lowers the writer's trust whether or not the refund arrives.

The offline demo uses a labelled simulated rail with a SIMULATED payer, never
a fake Testnet hash.

## Reference notes

_Extracted 6 Oct 2026 from the archived `company-research-context-v1.md`; kept
for protocol background._

The current t54 XRPL exact scheme documentation describes x402 v2 headers:

| Direction | Header | Meaning |
| --- | --- | --- |
| Server → client | `PAYMENT-REQUIRED` | Base64 payment requirements |
| Client → server | `PAYMENT-SIGNATURE` | Base64 signed payment payload |
| Server → client | `PAYMENT-RESPONSE` | Settlement result |

Some XRPL and older x402 examples use different headers. Do not combine them
from memory. Pin the facilitator and SDK versions, capture the actual challenge
and retry exchange in an integration test, and record the version in the
technical receipt.

Relevant CAIP-2 network identifiers are `xrpl:0` for Mainnet, `xrpl:1` for
Testnet, and `xrpl:2` for Devnet. The first live proof should use XRP on
Testnet. One XRP equals one million drops; quote amounts must use exact integer
drop strings.

### Required validation before signing

1. Supported x402 version and exact scheme.
2. Expected network and asset/issuer.
3. Exact destination and any destination tag.
4. Exact amount within per-purchase and cumulative limits.
5. Unique invoice bound to the signed transaction.
6. Expected resource and quote/terms hashes.
7. Valid expiry and bounded `LastLedgerSequence`.
8. Explicit approval reference when policy requires it.
9. No partial-payment or unintended cross-currency behavior.
10. An unused idempotency key and invoice.

The invoice should be committed through the documented memo or `InvoiceID`
mechanism. A valid payment without invoice binding can be replayed against a
different resource and must be rejected.

### Submission and finality

```text
construct exact Payment
  → preview and compare with approved intent
  → sign outside model/browser authority
  → persist transaction identity
  → submit
  → wait for validated ledger result
  → require tesSUCCESS
  → record hash, ledger, payer, payee, and amount
```

A preliminary submit or facilitator response is not final settlement. After a
timeout, reconcile the transaction hash, account sequence, invoice, and ledger
before enabling retry. Blind resubmission can double-settle.

### Fulfilment after settlement

Settlement and delivery are independent states. After validated payment:

1. request the exact resource;
2. verify resource ID and version;
3. verify content hash or signed delivery metadata;
4. apply license and retention rules;
5. grant access to the exact evidence spans;
6. update the receipt; and
7. allow synthesis only from accessible evidence.

If fulfilment fails, preserve the settled receipt, keep content locked, and
offer recovery without charging again.

## XRPL wallet and data safety

- Never expose, log, screenshot, or send wallet seeds to a model.
- An ignored local environment variable is acceptable only for Testnet
  development; production needs KMS/HSM or an external signer.
- Confirm the signing address matches the transaction `Account`.
- Treat memo text as public and untrusted. Store only an opaque receipt or
  correlation identifier, never customer objectives, private reasoning,
  personal data, credentials, or secret URLs.
- Use SourceTag only as a stable workflow/agent attribution value.
- Keep mainnet disabled until custody, approval, reconciliation, monitoring,
  legal, and incident-response controls are reviewed.

XRPL native features such as multisigning, DepositAuth, escrow, Checks, issued
currencies, and trust lines can strengthen a real product when a requirement
exists. Do not add them merely to make the architecture look sophisticated.

## Primary references

### XRPL and Ripple

- [Agentic transactions](https://xrpl.org/docs/agents/agentic-transactions)
- [Getting started with agentic transactions](https://xrpl.org/docs/agents/getting-started-with-agentic-transactions)
- [Agentic x402 payments](https://xrpl.org/docs/agents/agentic-payments-x402)
- [Track agent behavior](https://xrpl.org/docs/agents/track-agent-behavior)
- [XRPL payment skill](https://xrpl.org/docs/agents/xrpl-payments-skill)
- [XRPL wallet skill](https://xrpl.org/docs/agents/xrpl-agent-wallet-skill)
- [Token trust lines](https://xrpl.org/docs/concepts/tokens/fungible-tokens/trust-line-tokens)
- [RLUSD on XRPL](https://docs.ripple.com/products/stablecoin/developer-resources/rlusd-on-the-xrpl)
- [XRPL Testnet faucets](https://xrpl.org/resources/dev-tools/xrp-faucets)
- [Ripple XRPL AI Starter Kit](https://ripple.com/insights/xrpl-ai-starter-kit/)
- [Ripple stablecoin payments checklist](https://ripple.com/insights/fintech-checklist-stablecoin-payments-journey/)

### x402 and risk

- [t54 XRPL facilitator overview](https://xrpl-x402.t54.ai/docs/overview)
- [XRPL exact scheme](https://xrpl-x402.t54.ai/docs/xrpl-scheme)
- [Verifiable Intent](https://xrpl-x402.t54.ai/docs/verifiable-intent)
- [t54 Trustline overview](https://www.t54.ai/docs/trustline/overview)
- [t54 async underwriting](https://www.t54.ai/docs/trustline/async-underwriting)
- [t54 compliance and audit](https://www.t54.ai/docs/trustline/compliance-audit)
- [Agentic Risk Standard](https://github.com/t54-labs/AgenticRiskStandard)
- [Open Wallet Standard](https://github.com/open-wallet-standard/core)

### Future operating rails

- [Unlimit BaaS payments](https://www.baas.unlimit.com/payments/)
- [Unlimit developer portal](https://www.baas.unlimit.com/dev-portal/)


### Signed fact menu (manifest v2, #260)

Paid search hits include `claims[].covers: { entity, measure, period?, comparison? }`:
what the bound passage answers, never the answer value. Each field is at most
48 characters / six words, letters/spaces/hyphens only; no digits, prices,
markup, control characters or extra fields. Period years are spelled out.
`schemaVersion: 2` selects the `researchagent-manifest-v2:` signing domain;
legacy manifests without that field and without `covers` retain v1 signatures
and kind-only checks. Article versions and body roots are unchanged.

The synthetic corpus's authoring helper uses a fixed noun vocabulary over the
story's passages, without model calls or evaluation-bank access. Run
`node --import tsx scripts/generate-fact-menu.ts` to regenerate existing menus;
`generate-corpus.mjs` also adds them to newly assembled paid articles. AlphaLeak's
story-bible claim intentionally promises a missing entity and period.

Both decision providers receive at most eight distinct, schema-validated menu
entries from a verified signature, labelled `untrustedSignedFactMenu`. They
receive no leaves, salts, signature, wallet or private prose. A signed promise
can justify considering a buy, never coverage or payment authorization.
Candidate text and tags are capped; the requested-fact batch omits the
source-influenced conclusion. The broader injection pack belongs to #286.

After delivery, the **same bound passage** must contain the entity and measure,
match any declared period/comparison, and satisfy the existing claim-kind value
pattern. This is a lexical check, not proof of semantic truth or relevance.
Wrong promises follow the existing CLAIM_FAILED → quarantine → challenge/refund
path. No test, leak threshold or spending rule was relaxed.
## Hire an agent: `/v1/ask` (Testnet, #274)

`POST /v1/ask` takes `{ question, budgetMinor: 100 | 200 | 500 }` and a stable
`Idempotency-Key` header. The #301 Host/Origin/token guard applies unchanged;
remote callers also need the operator's bearer token. A 402 quotes the research
budget plus a fixed **20 SGD cents service fee**, using the demo conversion
**1 SGD cent = 1,000 Testnet drops** (not an exchange-rate claim). The invoice
binds the exact request, tier, service version and receiving wallet. It expires
after 60 seconds. An expired unpaid intent needs a new idempotency key.

Before submission, the existing `admit()` reserves the entire budget and fee
under the wallet-wide daily cap as `surface: x402`, `principal: <signed payer>`.
No research starts until that invoice is ledger-settled. A clamped admission
refuses settlement. The budget remains the only purchase authority: the caller
cannot name purchases or royalty recipients. The run and fee stay reserved
through pending payout/restart, even after the research phase is DONE.

Settlement policy **hire-v1** is deterministic:

- Purchases keep the normal signed-manifest, proof, per-source and budget gates.
- **5,000 drops (25% of the 20,000-drop fee)** is split equally across distinct
  publisher/writer personas in the final validated citation list, including
  free sources. Multiple passages from one writer count once. Sort slugs in
  ascending code-point order; each gets `floor(5000 / N)` drops, and the first
  `5000 mod N` slugs receive one extra drop. Minimum payment: one drop. Over
  5,000 distinct writers fails closed. With no citations there are no royalties
  and the entire service fee is retained.
- Free writers advertise their existing Testnet wallet in `/registry`, even
  without premium articles. The synthetic `open-records` persona uses the
  existing `XRPL_PUBLISHER_GRID_OPERATORS_REPORT_ADDRESS` official-records
  wallet when its own address is absent. Missing addresses fail closed; funds
  remain reserved rather than silently skipping a cited writer.
- Change is `(quoted budget cents - gross purchase cents) * 1000`, returned to
  the settled payer; zero change produces no transaction. Refunds from disputed
  purchases do not restore spending authority. Each royalty/change Payment has
  a memo containing the run id, kind and stable intent id; its InvoiceID is the
  SHA-256 of that intent id. Sender network fees are separate, capped at 2,000
  drops per transaction, and paid by the sender's wallet; caller change is not
  reduced by network fees. Caps measure transferred principal, as for purchases.
- Payment blobs are stored write-once before submission. A timeout keeps the
  same blob and reservation. Retry the original request and idempotency key;
  never create a replacement payment for an uncertain outcome. Failed/expired
  payouts remain reserved for operator reconciliation; there is no automatic
  replacement signature. Pausing or lowering caps also blocks payout resends.
- Completed replay returns the exact saved result with all citations, labels,
  purchases, royalties, change and explorer links. A second signed blob for an
  already bound invoice is refused before submission. Prepaid hire runs do not
  auto-start on boot: replay the paid request to resume safely.

The visible API money chain reconciles exactly:
`inbound = gross purchases + royalties + change + retained service fee`.
`npm run gate:audit -- --db <app.db>` also checks royalty recipients/amounts and
this identity. This is API/CLI only; the `src/` money-chain view is deferred to
the queued UX overhaul. Payouts have durable rows and XRPL events, and the
inbound payment, each payout's reserve, signature and confirmation, and any
denylist refusal are entries in the hash-chained `audit_log` (#288);
`npm run audit:verify -- --testnet` re-reads them on the ledger and
`npm run audit:export` lists them as `inbound`, `royalty` and `change` rows
([COMPLIANCE.md](COMPLIANCE.md)).

### Generic SDK buyer (any x402-on-XRPL seller)

```ts
import { Wallet } from 'xrpl'
import { payAndFetch } from './sdk/x402.js'
import { openPaymentJournal } from './sdk/x402-journal.js'

const journal = openPaymentJournal('private/caller.db') // private directory
const { response, receipt, payment } = await payAndFetch(sellerUrl, {
  wallet: Wallet.fromSeed(process.env.XRPL_CALLER_SEED!),
  maxDrops: '220000', journal, idempotencyKey: 'my-question-1',
  method: 'POST', headers: {
    'Content-Type': 'application/json', Authorization: `Bearer ${process.env.RA_API_TOKEN}`,
  },
  body: JSON.stringify({ question: 'What changed in pricing?', budgetMinor: 200 }),
})
const answer = await response.json()
journal.close()
```

For writer articles use GET without a body. The helper checks x402 v2, exact,
`xrpl:1`, XRP, resource URL, maximum amount and timeout; binds InvoiceID; signs
once under a payer queue; persists before retry; then independently verifies
the receipt hash/payer and validated `tesSUCCESS`/delivered amount on Testnet.
It refuses Mainnet and the public simulated signing key. All ledger access uses
the existing Testnet-only connection. It does not verify article manifests or
content proofs: a research buyer still needs the existing grant/proof layer.
The default journal survives only in-process; always supply a durable journal
for a real caller and reuse its wallet, URL, method, body and idempotency key
on retry. Do not delete uncertain journals. A transport error can mean settled
but not delivered. An HTTP error with a valid settlement receipt is likewise a
delivery failure, not permission to pay again.

`createHireClient` in `sdk/hire.ts` wraps this exchange for remote callers.
MCP's optional `hire_researcher` uses that SDK when the operator supplies
`RA_HIRE_URL`, `RA_HIRE_TOKEN`, `XRPL_CALLER_SEED` and `RA_HIRE_MAX_DROPS`.
The calling model cannot select a URL, wallet or cap. The caller journal lives
under `RA_DATA_DIR` (default `data/mcp`).

Run `node --import tsx scripts/hire-demo.mjs` for an explicitly labelled fake
ledger/fixture run on ephemeral ports. For the real chain use
`OFFSET=1300 node --import tsx scripts/hire-demo.mjs --live`. It uses its own
faucet caller wallet, existing writer wallets, a fixture-labelled research
answer and genuine Testnet settlement; API/publisher ports are 10088/10090.
Private state stays under `data/hire-demo-live`; only `chain.json` is public
receipt data. Default fixture state uses a fresh temporary directory and is cleaned
after each run; an explicitly configured fixture directory must be fresh. Replay uses the same
key and journal; the script verifies every hash and refuses a gross movement
plus network-fee total of 1 XRP or more. Faucet funding is excluded from that
spend figure. No real money or cloud resources are involved.

## Opted-in `escrow-v1` extension (#273, 3 Nov 2026)

This ResearchAgent extension is XRP on **Testnet only**. It is buyer-verified
release and ledger-enforced cancellation. The ledger checks a hashlock and time;
it does not verify article claims. Writers accept the risk that a dishonest
buyer reads and refuses payment. `exact` remains the default.

Writer operator: set `ESCROW_WRITERS=load-factor,alphaleak` on the publisher.
The same buyer setting opts those writers into `escrow-policy-v1`. Alternatively,
POST `/runs` with `escrow: true`, or use
`client.ask(question, {budgetSgd: 2, escrow: true})`. A run's explicit `false`
disables the buyer default. Publisher opt-in is always required. Quarantined or
delisted writers are excluded first; opted-in newcomers (`passes === 0`) or
writers with `T < 0.8` use escrow. Established writers use `exact`. Unsupported
escrow is SKIPPED without a paid fallback. Budget and plan confirmation remain
the spending authorization; no per-purchase confirmation is added.

The opted-in writer advertises `escrow-v1` alongside `exact`. Its initial 402
advertises `extra.quoteEndpoint`: those are discovery terms, not a signable
escrow quote. Buyer policy generates a fresh 32-byte secret, then POSTs
`{payer, intentId, condition, cancelAfter}` to the article's `/escrow-quote`.
The signed response binds network, asset, payer/payee, amount, article/version,
manifest root, intent nonce, condition and deadline. The buyer checks that
signature against the signed search manifest and evaluated price before signing.
`CancelAfter` is validated ledger time +120 s; no new finish within the final
15 s (rechecked inside the payer queue). A 2,000-drop per-transaction fee ceiling
applies. The generic exact `sdk/x402.payAndFetch` refuses escrow; the backend
policy service owns the article proof and secret.

```mermaid
sequenceDiagram
  participant B as Buyer policy and durable journal
  participant W as Opted-in writer
  participant L as XRPL Testnet
  B->>W: Buyer condition and deadline; request bound signed quote
  W-->>B: Signed escrow-v1 terms
  B->>B: Reserve budget; persist secret and create blob
  B->>L: EscrowCreate (typed canonical invoice memo)
  L-->>B: Validated LOCKED
  B->>W: Same signed create blob
  W->>W: Verify quote, validated tx and exact escrow object; persist conditional grant
  W-->>B: LOCKED grant and quarantined delivery
  B->>B: Verify manifest and delivery
  alt Proof passes with deadline margin
    B->>B: Persist VERIFIED_FOR_RELEASE and finish blob
    B->>L: EscrowFinish (reveal secret)
    L-->>B: Validated RELEASED; grant becomes accessible
  else Failed or missing proof, Stop, pause or expiry
    B->>L: EscrowCancel after ledger CancelAfter
    L-->>B: Validated CANCELLED; principal returned
  end
```

`EscrowCreate` has no InvoiceID. Its only memo uses
`MemoType = HEX("researchagent/escrow-v1")` and
`MemoData = HEX(UTF8(canonical signed terms))`. The facilitator validates the
whole memo, signature, account, amount, destination, condition, deadline,
LastLedgerSequence and fee. `/facilitator/verify` checks binding;
`/facilitator/settle` and paid GET confirm the validated create and object,
then journal a conditional exact-version grant. Response `success: false,
escrowState: "LOCKED"` explicitly distinguishes locked funds from settlement.
Only the private proof worker receives these bytes. A passed proof alone never
makes them accessible: a validated finish is also required. Direct-payment
challenge/refund logic does not apply to escrow cancellation.

Buyer SQLite stores a separate escrow row and `(intent, operation)` outbox,
with UNIQUE intent/invoice, transaction hash and `(owner, create Sequence)`.
The existing direct-payment submissions table is untouched. All three
operations share the payer queue. A restart looks up and resubmits the same
create; no timeout authorizes another principal. Expired/failed terminal
signatures may be archived and replaced **only after ledger proof**, referencing
the same object. An unresolved escaped finish is reconciled before cancellation.
A Stop cannot undo a submitted finish. If a revealed fulfillment is relayed by
another account, recovery checks the validated object and paginated account
history, then confirms the winning terminal hash. Missing object/history alone
never means refunded. The live reconciler cancels due objects
without writer connectivity; expiry itself does not return funds.

LOCKED principal stays `reservedMinor`; only RELEASED becomes spent. A
CANCELLED receipt records zero spent principal and the cancel hash, rather than
inventing a refund Payment. Cancelled authority cannot be reused inside the run
or wallet day. Public API/SDK intents and receipts carry `escrow.state`, owner,
create Sequence, deadline, transaction hashes and `proofOk`; no secret or blob.
`src/` is unchanged. The balance check includes live base + OwnerCount reserve,
one extra owner increment (currently 0.2 XRP), principal and create/terminal fee
headroom. After creation, refreshed validated balance already excludes principal;
it is not deducted twice.

Evidence: [product Testnet finish and cancel](evidence/escrow-273.md).

Recovery RPC references: [ledger_entry](https://xrpl.org/docs/references/http-websocket-apis/public-api-methods/ledger-methods/ledger_entry), [account_tx](https://xrpl.org/docs/references/http-websocket-apis/public-api-methods/account-methods/account_tx).

After #288, escrow signatures and verified proof transitions append to the same
hash chain inside their SQLite transactions. Validated `ESCROW_CREATE`,
`ESCROW_FINISH` and `ESCROW_CANCEL` entries carry transaction hashes, parent
object identity and ledger results. `npm run audit:verify -- --testnet` checks
both escrow receipt transactions and validated events, including creates still
awaiting a terminal receipt. CSV/JSONL exports identify escrow state and parent
create identity; direct Payment verification remains unchanged.

## Issued Testnet currency (#275) and refused hire payouts (#310)

XRP remains the default. Set `XRPL_PUBLISHER_<SLUG>_CURRENCY=RLUSD` on the
publisher to advertise issued currency first, with a separately invoiced XRP
alternative. `XRPL_RLUSD_ISSUER` defaults to Ripple's documented Testnet issuer;
a different issuer is always labelled **test USD (substitute for RLUSD)**.
`asset` is `XRP` or the ResearchAgent extension `{currency, issuer, label}`.
The currency hex is `524C555344000000000000000000000000000000`. Issued `amount`
is a decimal token value. This extension has local publisher/SDK integration
coverage; compatibility with external facilitators is not claimed.

Existing prices and budgets remain SGD minor units (#163 is still open).
The explicitly fixed demo conversion is **1 SGD = 1 test USD**, while XRP keeps
1 SGD cent = 1,000 drops. Neither is live FX or an exchangeability claim.
The invoice binds the exact asset/issuer, amount, article/version, root and payee.
The buyer validates against the signed manifest price, screens issuer/payee and
checks token balance, both trust lines, writer limit and XRP reserve plus fees.
Trust lines are provisioned only by operator tooling, never implicitly by a buy.
Escrow remains XRP only; opting a token writer into escrow refuses without fallback.

Quotes, API/SDK purchase results, receipts and audit exports carry `asset`.
For compatibility `amountDrops` is the settlement value string: integer drops
for XRP, decimal token value for issued assets; consume it together with `asset`.
Receipts/audit rows also carry the independently verified `deliveredAmount`.
The facilitator refuses tfPartialPayment and conversion fields before submission;
validated delivery must equal the quote's value/currency/issuer. It binds the
invoice to the first signed hash before submission, including ambiguous retries.

The generic SDK stays XRP by default. For tokens, explicitly supply
`issued: { asset: {currency, issuer, label}, maxAmount: '0.60' }` alongside the
existing `maxDrops` native cap. Replay rechecks the asset and current limit.
Use the same durable journal. No API/UI settings in `src/` were changed.

Hire policy cancels unsigned denylisted royalties and creates write-once change
refunds to the original caller; ordinary refused purchases already release their
reservation and increase unspent-budget change. `cancelledRoyalties` explains
those refunds in the money chain. Cancelled rows never sign; signed/uncertain
payouts remain reserved. `payout-cancel` and replacement `payout-reserve` rows are
atomic with the change; signatures/settlement use the original audit flow.
The caller may itself be denied, in which case policy holds funds rather than
bypassing the screen. See COMPLIANCE.md and the public evidence JSON.

## Starter Kit compatibility

Researched 3 Nov 2026. Ripple's [Phase 1 Starter Kit announcement](https://ripple.com/insights/xrpl-ai-starter-kit/)
is a curated collection, not a single installable repository. Its payment
integration is t54's [XRPL exact scheme](https://xrpl-x402.t54.ai/docs/xrpl-scheme).
The executable interop target is npm **x402-xrpl 0.3.4**, pinned exactly as a
**devDependency** so tests run the real upstream client and Express middleware;
production adapters require no new runtime dependency. npm publishes no
repository or gitHead for this artifact: no SDK source commit is claimed.
The lockfile pins its tarball and SHA-512 integrity.

Public source snapshots inspected through authenticated gh:

- `XRPLF/xrpl-dev-portal` at `41478c9faea94103646998e6f59fca3a27cd99ce`:
  `.claude/skills/xrpl-skills/xrpl-agent-wallet` and `xrpl-payments`, the actual
  skill paths linked by Ripple. These are skills, not an x402 SDK.
- `t54-labs/rlusd-cli` **@rlusd/cli 0.2.0** at
  `155ab72076c9cb455a6c6c2d46254768e941193b`: wallet/faucet/transaction tooling
  and `src/services/x402-fetch.ts`; declares x402-xrpl ^0.1.1.
- `t54-labs/rlusd-skills` at `0166aff93a62b22949009562ee2916570f7c784e`:
  skills/docs backed by the separate CLI runtime.
- `t54-labs/monid-x402-xrpl` **0.1.0** at
  `3eba1346710985c9c9373852eff71b3de7046fb3`: public Python gateway,
  pins Python x402-xrpl 0.3.4. Inspected, not executed in this proof.
- `t54-labs/payments-mcp` package **@coinbase/payments-mcp 1.0.5** at
  `dddbf890d6d81d79ca4007c7dee7316687ebbbed`: a separate payments MCP project;
  not evidence that Ripple's documentation MCP is a wallet service.
- Ripple links the [Context7 XRPL docs MCP](https://context7.com/websites/xrpl).
  This is hosted documentation retrieval, with no release/commit pinned by the
  announcement; no MCP execution or wallet compatibility is claimed here.

The [Express example](https://xrpl-x402.t54.ai/docs/merchant-guides/express)
uses `requirePayment`; the [client example](https://xrpl-x402.t54.ai/docs/client-guides/typescript)
uses `x402Fetch`. Our harness executes these exported implementations. Both use
v2 PAYMENT-REQUIRED / PAYMENT-SIGNATURE / PAYMENT-RESPONSE, `exact`, `xrpl:1`,
XRP integer drops and signedTxBlob. The adapter preserves validated uint32 source
and destination tags, permits absent `areFeesSponsored` (true remains refused),
and sends `payload.invoiceId` as well as `accepted.extra.invoiceId`. Unknown
extra fields are preserved for upstream term equality; crossCurrency is refused.
Our publisher mirrors its header challenge into the 402 JSON body because t54
x402Fetch reads that body. Neither response contains premium bytes.

Both sign SHA-256(invoiceId) into InvoiceID. t54 defaults to both memo and
InvoiceID binding; memo-only clients are deliberately refused by our publisher.
No memo-only fallback weakens quote/resource binding. Issued-currency wire
formats differ (t54 currency string + extra.issuer versus our asset object):
**this compatibility claim covers native XRP only**, not RLUSD, upto or escrow.
Our SDK retains its 300-second timeout cap; examples use 60 seconds.

Spending remains an explicit bounded SDK operation with a journal, or the
existing deterministic ResearchAgent purchase policy. No model tool, policy
bypass or new purchase route is added. Exact amount, delivered_amount,
validated tesSUCCESS, InvoiceID and one-charge journal checks remain in force.
The t54 merchant consumes invoices, so a second request may refuse delivery;
our SDK retains the original signed blob and does not authorize a replacement.
See [executable proof and live receipts](evidence/starter-kit-interop.md).
