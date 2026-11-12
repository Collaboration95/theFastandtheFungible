# Builder feedback: building on XRPL, x402 and the AI Starter Kit

Six weeks of building ResearchAgent on XRPL Testnet with x402, `x402-xrpl` and RLUSD, written for the SFF judges and for the teams who maintain these tools. **Read this page in 90 seconds; everything below it is the evidence.**

**XRPL TESTNET · no real value.** Offline settlement is **SIMULATED**. Research writers are fictional or labelled team-authored; TEST-SGD is a labelled stand-in for RLUSD. None of this is evidence of mainnet readiness.

**In one line:** 7 ranked findings, each with a runnable offline repro · 35 numbered log items (B01–B35) · 15 submissions on 4–5 Sep · 8 upstream issue drafts, **0 filed** (filing is owner-only, pinned issue #265 B1).

## Top 7 ranked findings

This is the single canonical ranking, ordered by what it would cost a team taking this to mainnet and by how solid the evidence is. Class says whether we saw it happen or derived it from code. Every row has a repro under `scripts/repro/` that runs offline in under 30 seconds (`npm ci` first).

| # | Finding · class · severity | Mainnet impact | Evidence | Workaround → suggested fix | Upstream status |
|---|---|---|---|---|---|
| 1 | **Issuer permission blocks RLUSD escrow.** TokenEscrow is enabled on Testnet and Mainnet, but the official issuer lacks `AllowTrustLineLocking`. *Observed: rippled `simulate` → `tecNO_PERMISSION` on Testnet (ledger 22244249) and Mainnet (108262329); matched TEST-SGD control `tesSUCCESS`; nothing signed or submitted · High* | Issuer flags measured on Mainnet: 2174353408, no AllowTrustLineLocking. | [Unsigned RPC evidence](evidence/dry-run-nov12/README.md), [historical rlusd.md](evidence/rlusd.md), repro `01 --live` | Official RLUSD stays on exact payment with a cooperative refund; escrow runs on a labelled TEST-SGD stand-in → publish a network **and** issuer preflight with dated flags. | Draft [01](feedback/upstream/01-issuer-permission.md) → `XRPLF/xrpl-dev-portal`. Not filed. |
| 2 | **An issued amount must mean the delivered amount.** `Amount`/`DeliverMax` cannot prove what arrived; only validated `delivered_amount` can. *Code-derived, adversarial fixtures · High* | Accepting an underpayment is an integrity risk on any network; no live attack seen. | [rlusd.md](evidence/rlusd.md), `tests/rlusd.test.ts`, PR #275, repro `02` | Reject partial and conversion fields; compare currency, issuer and exact decimal → publish negative issued-asset vectors. | Draft [02](feedback/upstream/02-delivered-amount.md) → `t54-labs/rlusd-cli`. Not filed. |
| 3 | **A signed IOU quote overflowed the 1 KiB Memo limit.** The server refused it with "The memo exceeds the maximum allowed size"; `MemoData` alone was 997 bytes, about 1,027 serialized (computed). *Observed live, 7 Nov · High (integration blocker until fixed)* | The same limit applies on mainnet. Our fix leaves 18 bytes of headroom. | [m1-iou/README.md](evidence/m1-iou/README.md), PR #384 (`5a0f48fe`), repro `08` | Same 256-bit intent id as base64url, 21 bytes shorter → check serialized Memos size before signing and put the size in the error. | Draft [08](feedback/upstream/08-memo-size.md) → `XRPLF/xrpl.js`. Not filed. |
| 4 | **Escrow expiry does not return funds by itself.** A failed-proof escrow stayed locked past its 120 s deadline; an explicit `EscrowCancel` returned 29,988 of 30,000 drops. *Observed Testnet · Medium (B18 rated it High before the workaround)* | Liquidity and the 0.2 XRP reserve stay locked until cancelled; mainnet untested. | [escrow-273.md](evidence/escrow-273.md), PR #273, repro `05` | Durable `CANCEL_DUE` state driven by ledger time → document expiry versus cancellation in the tutorials. | Draft [05](feedback/upstream/05-expiry-cancel.md) → `XRPLF/xrpl-dev-portal`. Not filed. |
| 5 | **Public endpoints disagree on retained history; HTTP lacks browser CORS.** One endpoint answered `txnNotFound` for a hash the others validated. *Observed read-only Testnet · Medium* | Analogous endpoint-selection risk; unmeasured on mainnet. | [live-validation.json](evidence/round2-p1/live-validation.json), [rpc-attempt.json](evidence/round2-e/rpc-attempt.json), repro `07` | s.altnet WebSocket, then Clio, then xrpl-labs; `txnNotFound` is "pending", never "failed" → publish an endpoint matrix (retention, transports, CORS). | Draft [07](feedback/upstream/07-endpoint-history.md) → `XRPLF/xrpl-dev-portal`. Not filed. |
| 6 | **Settled invoice consumption obstructs recovery.** The pinned middleware deletes the invoice on settlement, so a same-payment retry is refused while delivery still needs recovering. *Code-derived, reproduced offline · Medium* | Re-signing after an ambiguous response risks a second charge; none observed. | [starter-kit-interop.md](evidence/starter-kit-interop.md), repro `03` | Keep the signed blob and re-send it; our publisher supports same-blob redelivery → persist a settlement-to-delivery mapping with idempotent replay. | Draft [03](feedback/upstream/03-invoice-consumption.md) → `t54-labs/rlusd-cli`. Not filed. |
| 7 | **A header-only v2 challenge is not retried.** `x402Fetch` returns the unpaid 402 when the challenge is only in `PAYMENT-REQUIRED`. *Observed offline and in an exploratory Testnet run · Medium* | Valid header-only sellers are unreachable; no mainnet incident. | [starter-kit-interop.md](evidence/starter-kit-interop.md), repro `04` | Mirror the challenge into the JSON body → read the v2 header first and report unsupported layouts. | Draft [04](feedback/upstream/04-header-only.md) → `t54-labs/rlusd-cli`. Not filed. |

Just outside the top 7, and also drafted: official RLUSD funding needs an authenticated session (draft [06](feedback/upstream/06-funding-auth.md)). The full filing table, with a title and target for each draft, is in the [filing kit](feedback/upstream/FILING-KIT.md). The 15 September research submissions each received an acceptance response; we have no public tracker links for them.

**Newest (10 Nov):** a cold Testnet IOU start takes about 96 s, longer than the documented 60 s MCP tool timeout. See [the 10 Nov entry](#2026-11-10--cold-testnet-iou-start-versus-the-mcp-tool-timeout-observed) and the B32 update.

**Exact strings other surfaces should use** (counts are query-defined, so they cannot drift): "7 ranked findings with runnable repros" · "35 numbered findings (B01–B35)" (`grep -cE '^\| B[0-9]+ ·' docs/BUILDER-FEEDBACK.md`) · "15 submissions on 4–5 Sep" · "8 upstream drafts, 0 filed" until the owner files, then "N filed" with links in the table above. The ranked order on every slide, Q&A answer and README line is the order of this table.

## What worked well

Balanced feedback is more useful, so these are things the platform got right, each seen in our own evidence:

- **Escrow primitives behave as documented.** `EscrowCreate`, `EscrowFinish` and `EscrowCancel` with crypto-conditions validated on Testnet, and a wrong preimage failed with `tecCRYPTOCONDITION_ERROR` as expected (B17, B18).
- **`delivered_amount` in validated metadata** is a precise check for issued-currency payments; our rank-2 workaround is built on it.
- **Credentials worked first time.** `CredentialCreate` and `CredentialAccept` ran on Testnet with no amendment or RPC blocker (Lane N entry).
- **Fast finality.** One 60,000-drop payment validated with an idempotent repeat in 8.85 s; 61 recorded transactions re-validate from a browser over WebSocket.
- **The faucet works from CI.** A GitHub-hosted runner funded a buyer and completed the full purchase flow in 51.9 s (one observation, not a rate-limit claim).

## Mainnet readiness checklist

**Decision: GAP, Testnet demonstration only.** "Handled" means implemented and covered locally or on Testnet, never a mainnet approval. No mainnet transaction was attempted. Compliance items are questions for qualified review, not claims that a law applies.

**What we already handle**

| Topic | How | Evidence |
|---|---|---|
| RLUSD escrow permission (`AllowTrustLineLocking`) | Official RLUSD uses exact payment with a cooperative refund and token escrow is refused for it; escrow demos use a labelled TEST-SGD issuer that sets the flag. | B20, B26, rank 1 |
| Faucet limits | One faucet-funded buyer funds the writers with Testnet XRP (concurrent public-faucet funding failed); wallets are cached with mode 0600; funding is submitted back to back and awaited once (57.7 s to 18–19 s); a failed faucet falls back to a labelled SIMULATED mode. | B08, B28, 4 Nov entries |
| Memo size (1 KiB) | IOU quote identity is base64url so the full 256 bits fit; no preflight yet, 18 bytes of headroom. | rank 3 |
| Fees and fee escalation | `EscrowFinish` costs 423 drops for a 36-byte fulfillment (12 for create and cancel); every transaction is capped at 2,000 drops and terminal fee headroom is held per open escrow. Load-scaled fees were not tested. | B19, Lane R entry |
| Reserves | Live base and owner reserve are read; each escrow object and trust line locks 0.2 XRP; balances are checked before `TrustSet` and `EscrowCreate`. | B19, #275 entry |
| Credential types | `CredentialType` is stored as public text and the wire hex derived; lookups use a bounded queue. Issuance, expiry and revocation policy are open. | Lane N entries |
| Crash and finality | Persist the signed blob before submit; a missing transaction is "pending", not "failed"; same-blob redelivery. | B01–B03, B06 |
| Testnet resets and history | Wallets can be re-funded in place; receipts keep their ledger index; not-found is its own status. | B08, B22 |
| Network ids and tags | `xrpl:1` is frozen; destination and source tags are validated as uint32 and preserved. | B12, Starter Kit table |
| Delivered amount | Validated `delivered_amount`, exact decimal, partial payments rejected. | rank 2 |

**What we need before mainnet**

| From | Need | Why | Ref |
|---|---|---|---|
| RLUSD issuer (Ripple) | Confirm whether the mainnet issuer sets `AllowTrustLineLocking`, and publish transfer-fee and trust-line authorization behaviour for escrowed RLUSD. | Without the flag, token escrow is impossible whatever the amendment says. | rank 1, B26 |
| XRPL docs and SDK | Serialized-Memo preflight in xrpl.js; expiry-versus-cancel in the tutorials; an endpoint retention and CORS matrix; a documented full-history mainnet endpoint. | Our audit trail must outlive a public node's history window. | ranks 3, 4, 5, B22 |
| x402 and the Starter Kit (t54) | A published source repository, release commit and facilitator build revision; an availability commitment beyond best-effort; idempotent settlement replay; header-only v2 support; typed issued-asset terms; an escrow extension contract. | Pinned package 0.3.4 cannot be reproduced from source today; a lost response must never need a second signature. | ranks 6, 7, B12, September #1 |
| Us and the operator | A KMS or external signer for payer keys; real FX quotes (#163); alerts on pending age and refund refusal; KYB, sanctions screening and a Travel Rule review; a dispute process (#261); an independent security review. | Each is open in the detailed table at the end of this page. | [detail](#part-d-mainnet-controls-detail) |

## Ranked findings in detail

Original wording and evidence for the seven, in rank order. Each can be reproduced offline; none claims a mainnet incident.

### 1. Issuer permission blocks RLUSD escrow

Runnable: `node scripts/repro/01-issuer-permission.mjs` (<30 s). [Upstream draft](feedback/upstream/01-issuer-permission.md).

- Filed: draft ready → [docs/feedback/upstream/01-issuer-permission.md](feedback/upstream/01-issuer-permission.md); not filed (owner-only, #265).
- Date / class: 11 Nov 2026; observed unsigned rippled dry-run refusal on both networks (historical 3 Nov refusal was document-derived).
- Pinned package/source: Committed rlusd.md and corresponding public JSON at this repository revision; official Testnet issuer rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV where applicable.
- Evidence / reproduction: [raw unsigned reads](evidence/dry-run-nov12/README.md); `tecNO_PERMISSION` on Testnet ledger 22244249 and Mainnet 108262329; matched TEST-SGD control `tesSUCCESS`. Nothing signed or submitted. `node scripts/repro/01-issuer-permission.mjs --live` refreshes the evidence.
- Workaround: Use official RLUSD exact with cooperative refund; refuse token escrow.
- Suggested fix: Publish network AND issuer preflight, with dated flags.
- Severity: High.
- Mainnet consequence: Mainnet issuer flags measured as 2174353408, without AllowTrustLineLocking; amendment enablement alone cannot authorize token escrow.

### 2. Exact issued amount must mean delivered amount

Runnable: `node scripts/repro/02-delivered-amount.mjs` (<30 s). [Upstream draft](feedback/upstream/02-delivered-amount.md).

- Filed: draft ready → [docs/feedback/upstream/02-delivered-amount.md](feedback/upstream/02-delivered-amount.md); not filed (owner-only, #265).
- Date / class: 2026-11-03; Code-derived; adversarial fixture proof.
- Pinned package/source: Committed rlusd.md and corresponding public JSON at this repository revision; official Testnet issuer rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV where applicable.
- Evidence / reproduction: [record](evidence/rlusd.md); Amount/DeliverMax alone cannot prove exact delivered value; wrong issuer and partial payment fixtures are rejected.
- Workaround: Reject partial/conversion fields; compare validated delivered_amount currency, issuer and exact decimal.
- Suggested fix: Publish negative issued-asset conformance vectors.
- Severity: High.
- Mainnet consequence: Underpayment acceptance is an integrity risk on mainnet; no live attack observed.

### 3. A signed IOU quote overflowed the 1 KiB Memo limit

Runnable: `node scripts/repro/08-memo-size.mjs` (<30 s, offline). [Upstream draft](feedback/upstream/08-memo-size.md).

- Filed: draft ready → [docs/feedback/upstream/08-memo-size.md](feedback/upstream/08-memo-size.md); not filed (owner-only, #265).
- Date / class: 2026-11-07; Observed on a live Testnet submission (refused by the server's local checks, so no principal applied and no grant was issued). The 1,024-byte rule is our reading of rippled's memo check.
- Pinned package/source: xrpl.js 4.7.0, ripple-binary-codec 2.11.0; ResearchAgent at `5a0f48fe` (#384).
- Evidence / reproduction: [m1-iou README](evidence/m1-iou/README.md); the 7 Nov log entry below; `MemoData` alone was 997 bytes (observed), which is 1,027 bytes serialized with the 23-byte `MemoType` and overhead (computed); the repro reconstructs this offline with synthetic values.
- Workaround: Encode the full SHA-256 intent identity in base64url for IOU runs (43 characters instead of 64, all 256 bits kept, every signed quote field kept); the quote now serializes to 1,006 bytes (computed), 18 under the limit.
- Suggested fix: Check serialized Memos size before signing, expose the size and the limit in the rejection, and state in the docs that overhead counts.
- Severity: High (integration blocker until fixed).
- Mainnet consequence: The same Memo size limit applies; mainnet execution was not attempted.

### 4. Escrow expiry does not return funds automatically

Runnable: `node scripts/repro/05-expiry-cancel.mjs` (<30 s). [Upstream draft](feedback/upstream/05-expiry-cancel.md).

- Filed: draft ready → [docs/feedback/upstream/05-expiry-cancel.md](feedback/upstream/05-expiry-cancel.md); not filed (owner-only, #265).
- Date / class: 2026-11-03; Observed Testnet.
- Pinned package/source: Committed escrow-273.md and corresponding public JSON at this repository revision; official Testnet issuer rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV where applicable.
- Evidence / reproduction: [record](evidence/escrow-273.md); Failed-proof escrow stayed locked through 120-second deadline; explicit EscrowCancel returned 29988 of 30000 drops after fee.
- Workaround: Durable CANCEL_DUE with ledger-time ticks and terminal fee headroom.
- Suggested fix: Document expiration versus validated cancellation and reserve liquidity.
- Severity: Medium.
- Mainnet consequence: Recovery availability and liquidity matter before real-money use; mainnet untested.

### 5. Public endpoints disagree on retained history; HTTP lacks browser CORS

Runnable: `node scripts/repro/07-endpoint-history.mjs` (<30 s). [Upstream draft](feedback/upstream/07-endpoint-history.md).

- Filed: draft ready → [docs/feedback/upstream/07-endpoint-history.md](feedback/upstream/07-endpoint-history.md); not filed (owner-only, #265).
- Date / class: 2026-11-04; observed read-only Testnet; historical HTTP attempt and fresh WebSocket verification.
- Evidence: [13/13 live verification](evidence/round2-p1/live-validation.json), original [HTTP attempt](evidence/round2-e/rpc-attempt.json).
- Workaround: s.altnet WebSocket, then Clio; retain committed evidence during outages.
- Suggested fix: document endpoint retention, browser transport support and recommended archival lookup URL.
- Severity: Medium; unavailable history must not be presented as failed settlement.
- Mainnet consequence: analogous availability risk only; no mainnet measurement.

### 6. Settled invoice consumption obstructs recovery

Runnable: `node scripts/repro/03-invoice-consumption.mjs` (<30 s). [Upstream draft](feedback/upstream/03-invoice-consumption.md).

- Filed: draft ready → [docs/feedback/upstream/03-invoice-consumption.md](feedback/upstream/03-invoice-consumption.md); not filed (owner-only, #265).
- Date / class: 2026-11-03; Code-derived; reproduced offline.
- Pinned package/source: x402-xrpl 0.3.4; npm source commit and hosted facilitator revision unknown.
- Evidence / reproduction: [record](evidence/starter-kit-interop.md); Pinned t54 middleware consumes the invoice; a repeated signed payment can be refused while delivery recovery is needed.
- Workaround: Retain the same signed blob; ResearchAgent supports same-blob redelivery.
- Suggested fix: Persist settlement-to-delivery mapping with idempotent replay.
- Severity: Medium.
- Mainnet consequence: New signing after ambiguity risks a second charge; none observed here.

### 7. Header-only v2 challenge is not retried

Runnable: `node scripts/repro/04-header-only.mjs` (<30 s). [Upstream draft](feedback/upstream/04-header-only.md).

- Filed: draft ready → [docs/feedback/upstream/04-header-only.md](feedback/upstream/04-header-only.md); not filed (owner-only, #265).
- Date / class: 2026-11-03; Observed offline and exploratory Testnet.
- Pinned package/source: x402-xrpl 0.3.4; npm source commit and hosted facilitator revision unknown.
- Evidence / reproduction: [record](evidence/starter-kit-interop.md); x402Fetch returned unpaid 402 when challenge was only PAYMENT-REQUIRED.
- Workaround: Mirror the challenge into JSON.
- Suggested fix: Read v2 header first and report unsupported challenge layouts.
- Severity: Medium.
- Mainnet consequence: Valid header-only sellers become unreachable; no mainnet incident observed.

### Also drafted: official RLUSD funding requires authenticated access

Runnable: `node scripts/repro/06-funding-auth.mjs` (<30 s). [Upstream draft](feedback/upstream/06-funding-auth.md).

- Filed: draft ready → [docs/feedback/upstream/06-funding-auth.md](feedback/upstream/06-funding-auth.md); not filed (owner-only, #265).
- Date / class: 2026-11-03; Observed Testnet HTTP.
- Pinned package/source: Committed rlusd.md and corresponding public JSON at this repository revision; official Testnet issuer rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV where applicable.
- Evidence / reproduction: [record](evidence/rlusd.md); Official mint endpoint returned 401 despite activated account and trust line; CLI faucet only discovers token funding.
- Workaround: Historical bounded native Testnet DEX acquisition; separate provisioning from purchases.
- Suggested fix: Document authenticated native XRPL faucet access and typed asset results.
- Severity: Medium.
- Mainnet consequence: No mainnet API or FX inference; onboarding/redemption remain separate.

---

# Full log

Everything below is the evidence behind the summary. Nothing was dropped in the 10 Nov restructure; entries were regrouped and given stable handles.

## How to read the log

**Three classes, never mixed in one claim.**

- **Observed**: we saw it happen, on Testnet or in our own tooling. Each entry names the evidence path. "Observed" never implies mainnet.
- **Code-derived**: a failure mode we found by reading source or documents and reproduced with fixtures. It is not a claim that a production incident happened.
- **Historical research**: the 15 submissions of 4–5 September 2026 and earlier model evaluations. These describe the materials as they were then and are not re-measured.

**Where things are.** Part A is the numbered catalogue B01–B35. Part B holds dated entries that were never numbered: B.1 observed on XRPL, x402, the Starter Kit or the Testnet faucet; B.2 code-derived failure modes; B.3 observed friction in our own tooling (not XRPL). Part C is the September research submissions. Part D is the detailed mainnet controls table.

**Stable IDs.** B01–B35 are permanent: never renumber, never reuse. `scripts/check-feedback-ids.mjs` fails on a duplicate. New numbered items continue at B36; update the counts above when you add one.

**Severity** describes the consequence without the workaround: **critical** can risk money or unauthorized access; **high** blocks correctness or operation; **medium** complicates integration. Repro commands use local fixtures; no faucet, live model or Testnet funds are required. The 606-second host sleep in the 4 Nov soak is observed and distinguished from inferred runtime risk (see `evidence/soak-nov4.md`); it is not a ledger incident.

## Part A. Numbered catalogue (B01–B35)

One row per ID, in ID order. Wording is unchanged from the original rows; the Class column was added on 10 Nov. Where the text of a row separates an observation from a code-derived point, both labels appear. Rows whose Area is `tooling` are friction in our own tooling, not XRPL or x402. B26–B29 come from the 7 Nov review of `421f5f9f` (retained extract: [round4-l4/judge-path.md](evidence/round4-l4/judge-path.md)); they are retained observations, not fresh network measurements.

| ID · recorded | Area | Class | What happened / evidence | Our workaround (path) | Suggested upstream fix | Severity | Mainnet impact |
|---|---|---|---|---|---|---|---|
| B01 · 2026-11-02 | XRPL | Code-derived | A single account must not sign concurrent payments with the same Sequence; integration `36ae0b7`. | `server/xrpl.ts`: hold the payer queue through the facilitator response. | Provide a per-account sequence queue example, including multiple processes. | critical | In-process locking is done; distributed signer coordination is a gap. |
| B02 · 2026-11-02 | XRPL | Code-derived | A restart after signing loses payment identity unless persisted first; `tests/xrpl.test.ts` restart case. | `server/xrpl.ts`, `server/store.ts`: persist signed blob before send. | Include a durable outbox in the quickstart. | critical | Done locally; backup/recovery and durable production storage remain gaps. |
| B03 · 2026-11-02 | XRPL | Code-derived | A missing tx lookup can coexist with an advanced payer sequence; `tests/xrpl.test.ts` reservation case. | `server/xrpl.ts`: validated ledger + LastLedgerSequence + account Sequence proof, otherwise pending. | Specify pending and provable expiry in SDK return types. | critical | Done locally; reconciliation service and alarms are gaps. |
| B04 · 2026-11-02 | x402 | Code-derived | HTTP invoice JSON and ledger InvoiceID have different representations; `433b971`. | `shared/x402.ts`: canonical JSON → SHA-256 uppercase hex. | Publish cross-language binding vectors. | critical | Binding done; ecosystem interoperability still needs external validation. |
| B05 · 2026-11-02 | x402 | Code-derived | Invalid base64, schema and oversized headers need explicit rejection; `tests/x402.test.ts`. | `shared/x402.ts`: schema validation and 8 KiB encoded-header cap. | State header limits and test negative cases at proxy boundaries. | high | Local parsing done; deployed proxy limits untested. |
| B06 · 2026-11-02 | x402 | Code-derived | Duplicate retries must return the same delivery; `tests/facilitator.test.ts` duplicate and parallel cases. | `publisher/facilitator.ts`, `publisher/journal.ts`: inflight deduplication and settlement by hash. | Include concurrent retry and restart conformance tests. | critical | Done locally; multi-instance facilitator correctness needs validation. |
| B07 · 2026-11-02 | XRPL | Code-derived | Preliminary submit success is not validated delivered value; `tests/xrpl.test.ts` wrong ledger amount case. | `shared/xrpl.ts`, `publisher/facilitator.ts`: validated tesSUCCESS and exact payment checks. | Show delivered-amount verification beside submit. | critical | Done for XRP/Testnet; issued-currency checks remain a gap. |
| B08 · 2026-11-02 | Testnet | Code-derived | Reset recovery must retain wallet identities; wallet helper explicitly supports resets. | `scripts/wallets.mjs`: fund existing addresses; write new seeds before faucet calls. | Document idempotent reset recovery and faucet failure handling. | high | Testnet tool only; mainnet funding must never use a faucet. |
| B09 · 2026-11-02 | tooling | Observed | ECDSA runtime import prevented Node 22 publisher startup; `8c7e24a` (7 Oct). | `publisher/registry.ts`: type-only ECDSA import. | Test the TypeScript starter against the declared Node runtime. | high | Pin and verify runtime/package compatibility before deployment. |
| B10 · 2026-11-02 | XRPL | Code-derived | Refunds are cooperative; the writer can refuse or time out (FINAL-PUSH D5). | `publisher/challenge.ts`, `server/challenges.ts`: write-once refund and trust penalty independent of repayment. | Document the limitation; offer a separately evaluated dispute design. | high | Enforceable dispute settlement is a gap; #261 is not shipped. |
| B11 · 2026-11-02 | XRPL | Code-derived | S$ display and XRP settlement use a fixed demo conversion; #163 stays open. | `server/purchases.ts`, `shared/contracts/`: integer drops and quote matching. | Add issuer-aware RLUSD or expiring rate quotes with rounding/refund rules. | high | Mainnet price formation is a gap. |
| B12 · 2026-11-02 | Starter Kit | Code-derived | Our Node flow implements the XRPL x402 handshake itself; generic/older header examples cannot be mixed (integration contract). | `docs/x402-xrpl.md`, `shared/contracts/x402.ts`: freeze v2 PAYMENT-* headers and xrpl:1. | Supply one tested XRPL-first TypeScript quickstart and compatibility matrix. | medium | Our implementation is not upstream Starter Kit conformance certification. |
| B13 · 2026-11-02 | Testnet | Code-derived | Offline signed blobs must not masquerade as Testnet; `tests/xrpl.test.ts` rail refusal cases. | `server/xrpl.ts`, `publisher/facilitator.ts`: reject SIMULATED payer on Testnet and label receipts. | Ship an explicitly labelled simulator with rail mismatch tests. | critical | Simulation boundary done; mainnet remains disabled. |
| B14 · 2026-11-02 | tooling | Observed (historical evaluation) | Historical decision run bought too little: F1 0.24, S$1.60 wasted of S$4.05; `eval/REPORT-decisions.md` (9 Oct, `4e3a2a5`). | `server/agents/loop.ts`: requested-fact rounds; report preserves keyword search, fixture writer and simulated payment substitutions. | Pair agent-payment starters with value-of-information evals, not payment counts alone. | medium | Payment correctness does not demonstrate economic utility. |
| B15 · 2026-11-02 | tooling | Observed (historical evaluation) | Writer self-grading called 22/76 supported snapshots partial; `eval/REPORT-coverage.md` (9 Oct). | `server/agents/requirements.ts`: explicit coverage rubric; separate decision-model grading adopted in `a8b60cc`. | Include evidence-coverage and false-complete checks in agent examples. | medium | Historical model evidence only; ongoing quality measurement is still needed. |
| B16 · 2026-11-03 | XRPL tooling | Observed | Observed: #277 Testnet demo settled successfully but the Node process retained sockets after cleanup. Code-derived cause: parallel account/fee/ledger requests could create three clients before any connected, retaining only the last. Evidence: `docs/evidence/publish-site-277.md`, `tests/xrpl-connection.test.ts`. | `shared/xrpl.ts`: share one in-flight connection promise; close waits for it. No second payment was made. | Document sharing a connecting client in concurrent RPC examples; this is our wrapper bug, not an XRPL ledger defect. | medium | Resource lifetime issue on any rail; no payment correctness change. |
| B17 · 2026-11-03 | XRPL escrow | Observed + code-derived | Observed wrong preimage → `tecCRYPTOCONDITION_ERROR`; the ledger did not evaluate article content. Code-derived fairness limit: buyer secret permits withholding payment after reading. Evidence: [spike and tx links](spikes/escrow.md), [raw observations](spikes/escrow-testnet.json). | Keep secret in buyer signing state until the shared proof passes; label buyer-controlled release and publisher opt-in. | Add an article-delivery example distinguishing hashlock enforcement from fair exchange and oracle trust. | high | Native hashlock alone cannot enforce semantic correctness or honest buyers on any network. |
| B18 · 2026-11-03 | XRPL escrow timing | Observed | Observed early cancel and expired finish both validated `tecNO_PERMISSION`; neither failure restored principal. Explicit later cancel returned it, 54.871 s after create submission including probes. Evidence: [timings and hashes](spikes/escrow-testnet.json). | Compare validated ledger close time with CancelAfter, leave finish margin, reconcile and submit cancellation explicitly. | Include expiry cleanup, Stop/restart and fee-consuming negative cases in escrow tutorials. | high | Expiry is eligibility, not an automatic refund; abandoned objects retain liquidity/reserve. |
| B19 · 2026-11-03 (updated 11 Nov) | XRPL fees and reserve | Observed | Buyer pays 12 drops to lock, writer pays 423 to reveal. xrpl.js 4.7.0 computes `33 + bytes/16` fractionally with a 1.2× cushion; rippled uses `base × (33 + floor(bytes/16))`: 350 for 36 bytes, measured by unsigned `simulate` at ledger 22244249. OwnerCount 0→1→0 at 0.2 XRP increment. Evidence: [signing fees](spikes/escrow-testnet.json), [dry run](evidence/dry-run-nov12/README.md). | Retain the 12/423-drop signing fees, reserve-aware balance check, terminal headroom and 2,000-drop cap. | Document integer division in rippled; floor the size term in xrpl.js, showing the cushion separately. | medium | Micropayment capacity depends on concurrent object reserve as well as fees; distinguish SDK signing estimates from ledger minimums. |
| B20 · 2026-11-03 | XRPL capability / x402 | Observed + code-derived | Observed feature RPC: TokenEscrow and fixTokenEscrowV1 enabled; retired Escrow false although XRP create/finish/cancel succeeded. Static exact facilitator requires Payment, and EscrowCreate has no InvoiceID. Evidence: [live RPC snapshot](spikes/escrow-testnet.json), `publisher/facilitator.ts:verify`, [protocol references](spikes/escrow.md). | Probe operations, check issuer flags separately; propose a separate escrow-v1 scheme and invoice memo rather than substituting EscrowCreate into exact. | Provide network-specific capability/issuer checks and an explicit locked-versus-settled extension contract. | high | Amendment enabled does not prove RLUSD support; exact compatibility must not be claimed for escrow. |
| B21 · 2026-11-03 | Desktop tooling | Observed | Observed: staged Electron app passed, but the first installed DMG exited before a window because utilityProcess received an ASAR virtual cwd. Unpacking the same app restored UC1–UC3; final installed proof in `docs/evidence/macos-app-259.md`, packaging fix in #303. Validation run 41562664758 also exposed automatic draft publishing; unpublished drafts removed via gh and builder publishing explicitly disabled. | `desktop/build.mjs`: package real files and compile the shared worker; second DMG installed and passed. | Add a utilityProcess + SQLite/corpus example using a real cwd and test the installed artifact, not just the dev shell. This is our packaging error, not an XRPL failure. | medium | Prevents app startup on either rail; no ledger defect or live-money incident observed. |
| B22 · 2026-11-03 | XRPL Testnet / `tx` lookup | Observed + code-derived | Observed: `npm run audit:verify -- --testnet` re-read five payments made on 7 and 9 Oct (ledgers 21350585–21407660) from the public Testnet endpoint in 3.15 s total; each validated `tesSUCCESS` with the expected destination, `delivered_amount` and InvoiceID. Code-derived, not observed: Testnet is reset periodically and a node may not keep old history, and a `txnNotFound` answer cannot say "pruned" from "never existed", so `shared/xrpl.ts:lookupTx` reports `pending`. Evidence: command output in the #288 PR; `tests/audit.test.ts` (Testnet block, fake ledger). | `audit:verify` reports not-found as its own non-passing status instead of OK; receipts keep their ledger index so a full-history node can be pointed at via `XRPL_RPC_URL`. | Document public-node history retention and give `tx` a way to say "outside this node's history". | medium | A mainnet audit older than a public node's window needs a full-history node or an archive; the audit trail must not depend on a Testnet endpoint. |
| B23 · 2026-11-03 | tooling | Observed | Observed: worktrees that symlink the main checkout's `node_modules` (disk was 98% full) lack `@modelcontextprotocol/sdk`, which is in `package.json`, so local `tsc` and `tests/mcp.e2e.test.ts` fail in the worktree while CI is green. Evidence: `npx tsc --noEmit` on the #288 branch; main's `node_modules/.package-lock.json` has no entry for it. | Treat the MCP-only type errors as environment noise locally and rely on CI for those files; no code changed. | Preflight (`make doctor`) should compare installed packages with the lockfile and say which workspace is stale. | low | None: no ledger or payment involvement. |
| B24 · 2026-11-03 | tooling | Observed | Observed restart recovery: #286 WIP `99f8545` remained attached to an abandoned clean worktree, so the requested branch checkout failed as already in use. | Verified the old checkout was clean, detached it at the WIP, then rebased the recovered branch in the active worktree. | Agent restart handoff should retain checkout ownership and give an explicit recovery action. | medium | No ledger incident or Testnet call; production recovery must preserve the durable payment DB, not just Git state. |
| B25 · 2026-11-03 | tooling | Observed | Observed #286 CI run `41561017423`: testing Vite's denylist against an absent `.env` returned the SPA fallback (200), while the local operator file returned 403. | `tests/client-admission.test.ts` now creates its own synthetic credential file and asserts 403 plus no canary bytes. | Security test examples should create their fixtures and test response bytes, rather than depend on developer secrets being present. | medium | Test portability failure; no credential disclosure observed, and no mainnet calls. |
| B26 · 2026-11-07 | XLS-85 / RLUSD | Observed + code-derived | Observed issuer flags 2174353408 lack AllowTrustLineLocking at ledger 22058675; TokenEscrow enabled. Evidence: `docs/evidence/round3-e/runs.json`, 4 Nov control re-query above. Code-derived: official RLUSD escrow blocked; no rejection transaction submitted. | XRP default or explicitly labelled TEST-SGD stand-in. | Publish issuer preflight and enable SetFlag 17 on the official Testnet issuer if supported. | high | Issuer consent remains required; mainnet issuer flags unmeasured. |
| B27 · 2026-11-07 | MCP tooling | Observed | Observed fresh-cache 21.4 MB tgz takes 56.5 s to initialize; review §0/§5 in retained extract. Client timeout risk is an inference. | Retry with warm cache; round-3 warm measurement about 11 s. | Bundle stdio separately and defer app UI dependencies; measure clean-cache startup. | medium | Startup availability risk on either rail; no settlement failure observed. |
| B28 · 2026-11-07 | Faucet | Observed | Observed wallet setup 24.3 s MCP / 19.1 s app; prior README reports 17 s. Evidence: retained review §0/§5; `docs/evidence/round3-a/README.md`. | Persist Testnet wallets and show setup progress; bounded retries. | Document faucet timing and separate provisioning from initialize. | medium | Testnet-only funding; no inference about mainnet funding. |
| B29 · 2026-11-07 | Devcontainer CI | Observed | Observed nightly Testnet jobs green 6/7 Nov, about 130 s job / 43.9 s purchase; evidence: retained review §0/§5, `.github/workflows/codespace-testnet.yml`. | Use devcontainers/ci as the Codespace substitute, labelled explicitly. | Keep validated-hash CI evidence; measure actual Codespace separately. | low | No mainnet measurement; CI is not interactive Codespace acceptance. |
| B30 · 2026-11-07 | Fixture threshold borrowed from luna | Code-derived (+ observed J5 result) | Code-derived: metadata-fixture uses the default 0.20 luna threshold despite a different heuristic; observed J5 held-out buy-and-cite is 8/20. Evidence: `server/agents/decision.ts; docs/evidence/j5-coverage/README.md`. | Keep policy unchanged and disclose misses. | Calibrate a versioned fixture-only threshold on dev, with blind held-out and negative gates; ship nothing if gates fail. | medium | Availability of expertise may be reduced; no mainnet execution or live-model calibration claim. |
| B31 · 2026-11-07 | Discovery does not guarantee purchase | Observed | Observed in the 7 Nov review: a published on-topic note was discovered but declined at value 0.159 below 0.20. Evidence: `docs/evidence/r5-r/review-timings.txt; docs/evidence/round4-j3/slim-onboarding.json`. | Explain policy declines and retain decision rows; never promise onboarding creates demand. | Distinguish zero candidates from low-value candidates and expose reasons. | medium | Same product distinction applies; no mainnet adoption or purchase measured. |
| B32 · 2026-11-07 | IOU cold start blocks the first tool call | Observed | Observed: 102.9 s provisioning within a 134.1 s first ask; about 103–134 s depending on the boundary. Evidence: `docs/evidence/r5-r/review-timings.txt; docs/evidence/m1-iou/README.md`. **Update 2026-11-10:** the cold `app --testnet --iou` start took 95.841 s to ready in the v1.0.2 audit, and `docs/mcp.md` still documents a 60 s tool timeout; see [the 10 Nov entry](#2026-11-10--cold-testnet-iou-start-versus-the-mcp-tool-timeout-observed) and [evidence](evidence/nov10-reachability/README.md). | Reuse private cached faucet wallets and warn about first-call latency. | Expose provisioning progress; batch read-only checks while keeping signing serial. | high onboarding friction | Faucet timing is Testnet-only; no mainnet latency established. |
| B33 · 2026-11-07 | Anchor on abstention is an explicit product decision | Observed + code-derived | Observed: no-purchase J5 exports fail online verification because they lack an anchor. Code-derived decision: anchoring every DONE Testnet run adds a network fee even when no article is bought. Evidence: `docs/evidence/j5-coverage/cli-ledger-abstention.json; docs/evidence/j5-coverage/README.md`. | Label failed verification and do not claim current no-purchase exports pass. | Lane A must align DONE anchoring and export semantics, label anchor fees, and retain FAIL for missing or fabricated proofs. | medium evidence UX | A fee for audit anchoring is separate from purchasing authority; mainnet execution and costs unmeasured. |
| B34 · 2026-11-07 | No-purchase Testnet verification (pre-A artifact) | Observed | Observed packed MCP declines export without an audit anchor; online verification fails on these runs. Evidence: `docs/evidence/r5-k/v3/V01.verification.json` and matching receipts. | Keep the failure visible; lane A owns no-purchase anchoring. | Anchor completed abstentions as well as purchased answers, preserving verifier checks. | medium | Testnet observation only; no mainnet run or principal loss. |
| B35 · 2026-11-07 | Disclosure / paid-content collision | Observed | Observed full-state UC3 `try` gate audit flagged the unchanged refund disclosure because it also appeared in paid `team-recovery` (#403). Static runtime-label scan also found the TEST-SGD asset label in paid `team-rlusd`: nine overlapping eight-word windows in total. Evidence: `docs/evidence/r5-k/public-label-before.json`, `public-label-scan.json`, `fresh-uc3-try.gate-audit.json`. | Paraphrase paid passages; preserve public labels, disclosure and detector. Fresh packed UC3: 67.8 s, ledger PASS, full-state gate audit 0. | Lint every paid note against runtime strings and public metadata before network acceptance. | medium acceptance tooling | No mainnet execution or funds lost; do not weaken premium-byte detection to accommodate disclosure reuse. |

## Part B. Dated entries (not numbered)

#### 11 Nov 2026 · Unsigned rippled verdicts and fee autofill (X1a)

- Observed read-only public RPC: RLUSD EscrowCreate → `tecNO_PERMISSION` on Testnet ledger 22244249 and Mainnet 108262329; matched Testnet TEST-SGD control → `tesSUCCESS`. No wallet, signature, submission or fee; this is simulation evidence, not a Mainnet transaction.
- Evidence: [requests, responses and recipe](evidence/dry-run-nov12/README.md). Issuer flags are 2174353408 on both networks. A 36-byte dummy finish autofills 350 drops; our existing signing estimate stays 423 (xrpl.js fractional size term and 1.2× cushion). Buyer pays 12 to lock; writer pays 423 to reveal.
- **12 Nov X1c correction (code-derived leak, regression-tested):** finish guard is a read-only ledger pre-check; the key is never sent before the signed finish. It checks the existing validated object, owner/writer/amount/deadline, locally derived Condition and 30 s margin; LastLedgerSequence stays current + 5. The production path never simulates a finish. The standalone unsigned fee probe used a public dummy, not K, and is retained. A real-key simulate could disclose K even on refusal, so the application RPC wrapper now rejects Fulfillment in simulate. Evidence: `tests/writer-reveal-guard.test.ts`, `tests/xrpl-connection.test.ts`, [guard contract](key-reveal-escrow.md). Severity: High; no mainnet transaction or loss measured.
- Workaround: exact Payment for official RLUSD, labelled TEST-SGD for token escrow; keep current fee cushions. Suggested fix: issuer/network preflight and explicit integer-division fee docs; floor the SDK size term. Severity: High for issuer permission, Medium for fee clarity. Mainnet impact: issuer permission is measured, but no Mainnet funds moved and no readiness is claimed.


Original wording, regrouped by class. Each entry carries a class line; entries that mix classes label each point inline ("Observed", "Code-derived") as the original did. Dates are the original dates.

### B.1 Observed on XRPL Testnet, x402, the Starter Kit and the faucet

#### 3 Nov 2026 · Observed escrow integration (#273)

*Class: observed on Testnet, plus one code-derived point labelled inline*

Evidence: [product-path Testnet observations](evidence/escrow-273.md) and
[allowlisted transaction metadata](evidence/escrow-273.json), implementing the
[GO spike](spikes/escrow.md). These are fresh Testnet observations with synthetic
articles, not mainnet measurements or Starter Kit compatibility results.

- **Observed: cancellation needs an explicit transaction.** The failed-proof
  30,000-drop object remained locked through the 120 s deadline; buyer recovery
  submitted EscrowCancel with the writer offline. Net return was 29,988 drops
  after its 12-drop fee. Workaround: durable CANCEL_DUE plus ledger-time ticks.
  Suggested upstream fix: a recovery example that retains escrow identity until
  terminal validation, clearly explaining expiry versus actual return.
  Severity: medium operational risk. Mainnet impact: the same lifecycle must be
  handled before any real-money enablement; mainnet was not tested.
- **Observed: liquidity dwarfs a small purchase.** Both cases had OwnerCount
  0→1→0 and needed 0.2 XRP additional reserve, besides 0.06/0.03 XRP principal.
  Workaround: fresh reserve-aware balance checks and held terminal fee headroom
  for every outstanding escrow. Suggested upstream fix: wallet/Starter Kit
  preflight showing locked principal, owner reserve and terminal fees separately.
  Severity: medium usability risk. Mainnet liquidity impact is code-derived,
  not a measured mainnet result.
- **Code-derived: exact x402 cannot represent LOCKED delivery.** Native escrow
  is not Payment and has no InvoiceID. Workaround: explicit `escrow-v1`, a
  domain-typed canonical invoice memo, signed bound quotes and conditional grants;
  exact remains default. Suggested upstream fix: document an extension interface
  for lock/proof/release receipts rather than treating lock as settlement.
  Severity: medium interoperability risk. Mainnet interoperability is untested.

#### 3 Nov 2026 · Issued-currency integration (#275 / #310)

*Class: observed on Testnet, plus one code-derived point labelled inline*

Evidence: `docs/evidence/rlusd-275-refund-310.json`,
`docs/evidence/rlusd-275-refund-310.md`, `tests/rlusd.test.ts`.

- **Observed: official RLUSD faucet requires authentication.** Ripple documents
  Testnet issuer rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV; its account exists.
  The faucet mint endpoint returned HTTP 401 Authentication required.
  Workaround: a Testnet issuer labelled **test USD (substitute for RLUSD)**.
  Suggested fix: document authenticated funding or a bounded developer faucet
  with machine-readable failure guidance. Severity: medium setup friction.
  Mainnet impact: no mainnet inference; issuer onboarding/redemption remain gaps.
- **Observed: trust lines lock XRP reserve.** Payer and writer each needed a
  trust line; setup reads live reserve (0.2 XRP increment observed), checks extra
  owner reserve and keeps 2,000 drops fee headroom. Purchase checks token balance
  separately. Full UC2 writer received 0.9 issued units; fee 12 drops, gate audit zero. Suggested fix:
  quickstarts should show recipient trust lines, limits, token and XRP liquidity.
  Severity: medium. Mainnet impact: production funding/alerts still needed.
- **Code-derived partial-payment trap, prevented.** Amount/API-v2 DeliverMax is
  not delivered_amount. Reject tfPartialPayment and conversion fields, then
  compare exact decimal value/currency/issuer in validated metadata. Tests inject
  underpayment, wrong issuer and unavailable delivery; no live attack claimed.
  Suggested fix: adversarial issued-currency x402 reference tests. Severity:
  high integrity risk; the same failure mode matters on mainnet.
- **Observed #310:** a denied 2,500-drop royalty was cancelled before signing,
  audited and returned via a stable refund intent; 110,000 unused budget drops
  returned separately. Reservation zero, replay identical, audit/gate pass.
  Suggested fix: reference custody flows must distinguish unsigned refusal from
  ambiguous ledger settlement; only unsigned payouts permit automatic cancel.
  Severity: high custody risk. Mainnet still needs policy/legal review.

#### 3 Nov 2026 · Observed Testnet reliability measurement

*Class: observed (wall-clock), plus code-derived provider findings labelled inline*

Evidence: `docs/evidence/live-reliability.md` and the paired
`live-reliability-{before,after}.json` files. Real Testnet purchase validation
contributes several seconds per intent to UC3's sequential purchase/refund/
replacement path. This is observed wall-clock behavior, not a ledger failure or
mainnet latency claim. Workaround: publish the validated free-source draft while
settlement continues and retain the original intent/journal through recovery.
Suggested tooling improvement: expose settlement percentiles alongside model
latency, with null for runs that make no purchase. Severity: low (demo latency);
mainnet impact: unmeasured. No faucet reset, Starter Kit failure, x402 mismatch
or exhausted Testnet wallet was observed in this experiment.

Code-derived provider/tooling findings (separate from ledger behavior): the
planner can echo economic vocabulary rejected by its unchanged spending-language
validator; Groq short Retry-After values were inflated to 60 seconds; embedding
errors were immediately evicted and could fan out again. The prompt and recovery
fixes retain labelled substitutions and all five gates. Fault tests establish
retry/cooldown behavior; they are not live Groq quota measurements.

#### 3 Nov 2026 · Starter Kit interoperability

*Class: per row, observed or code-derived as labelled*

Evidence for all entries: `docs/evidence/starter-kit-interop.md`,
`scripts/interop/starter-kit.ts`, `tests/starter-kit-interop.test.ts`, and
`tests/x402.test.ts`; exact package/source pins in `docs/x402-xrpl.md`.

| Class / date | Friction and evidence | Workaround | Suggested fix | Severity | Mainnet impact |
| --- | --- | --- | --- | --- | --- |
| Observed · 2026-11-03 | t54 Express 0.3.4 returns HTTP 400 missing_invoiceId when only accepted.extra.invoiceId is sent. | Also send payload.invoiceId; retain signed InvoiceID binding. | Document both fields in the scheme example, or derive the duplicate field from accepted terms. | Medium | Otherwise valid clients cannot purchase; no mainnet incident observed. |
| Observed · 2026-11-03 | x402Fetch returns the unpaid 402 without retry when challenge exists only in PAYMENT-REQUIRED; reproduced offline and in exploratory Testnet direction B. | Publisher mirrors the header challenge into JSON. | Read the v2 header first; surface a diagnostic rather than silently returning the challenge. | Medium | Header-only v2 servers cannot sell to this client; no mainnet incident observed. |
| Observed · 2026-11-03 | Our required areFeesSponsored field and stripping of source/destination tags prevented matching upstream terms; tested against real middleware. | Optional false-only fees flag, preserve extras, validate/sign uint32 tags. | Publish cross-implementation conformance vectors for accepted terms and tags. | Medium | Lost destination tags can misroute credit; no mainnet incident observed. |
| Observed · 2026-11-03 | npm x402-xrpl 0.3.4 metadata omits repository/gitHead; hosted /supported has no deployed revision. | Pin exact tarball/integrity; label source/deployment commits unknown. | Publish source repository, release commit and facilitator build revision. | Low | Supply-chain reproducibility gap, not a payment incident. |
| Code-derived, reproduced offline · 2026-11-03 | t54 middleware consumes invoices after settlement; replay is refused even though delivery recovery may be needed. | Our SDK journal retains the original blob and refuses replacement signing; publisher supports same-blob redelivery. | Retain a settled receipt/delivery mapping for idempotent recovery. | Medium | Integrators who re-sign after an ambiguous response could double-pay; none observed here. |
| Code-derived · 2026-11-03 | t54 issued assets are currency strings plus extra.issuer; ResearchAgent uses typed asset objects. t54 memo-only mode also omits our required InvoiceID. | Scope proof to native XRP and upstream default both binding; reject unsupported forms. | Document explicit asset/binding profiles and shared negative vectors. | Medium | Unsupported profiles must fail closed; no mainnet execution. |

#### 3 Nov 2026 · Official Testnet RLUSD

*Class: per row, observed, source-confirmed or code-derived as labelled*

Evidence for every row: [execution record](evidence/rlusd.md),
[HTTP/CLI/funding metadata](evidence/rlusd-funding.json),
[product transactions](evidence/rlusd.json). Observed incidents are distinguished
from source/document-derived constraints. No mainnet execution.

| Kind / date | Friction | Workaround | Suggested fix | Severity | Mainnet impact |
| --- | --- | --- | --- | --- | --- |
| Observed · 2026-11-03 | npm `@rlusd/cli@0.2.0` installation returned E404. Source package version is not proof of npm availability. | Fetch pinned t54 source via authenticated gh; run actual CLI with tsx and isolated config. | Publish the documented package or state source-install instructions and release provenance. | Medium | Tool availability only; mainnet funding untested. |
| Observed · 2026-11-03 | Initial source `npm ci --prefix` failed (`Missing: source@0.2.0`); same lock installed successfully from source cwd. | Run npm ci from the extracted source directory. No upstream lock edit. | Show a cwd-explicit source-install recipe; do not describe this environment-specific invocation failure as a broken upstream lock. | Low | No ledger impact established. |
| Observed + source-confirmed · 2026-11-03 | CLI faucet funds XRP, then prints claim_rlusd guidance; it never requests RLUSD for an activated XRPL account. | Follow official faucet; distinguish activation XRP from token funding. | Clarify that this is faucet discovery, with typed asset/result reporting. | Medium | Developer setup only, not an alternative mainnet mint. |
| Observed · 2026-11-03 | Official POST /api/mint-xrpl returns HTTP 401 Authentication required despite a valid fresh wallet and issuer trust line. Sponsored status exposes EVM networks only. | Bounded native Testnet DEX acquisition of official-issuer RLUSD; supplied payer zero balance rechecked before funding. | Document sign-in/access requirements and native XRPL automation support; distinguish native XRPL from XRPL EVM. | Medium | No evidence of mainnet API behavior; mainnet onboarding/redemption still separate. |
| Observed · 2026-11-03 | Native Testnet DEX has issuer-specific liquidity but arbitrary test exchange rates (about 25.1 Testnet XRP for 2 RLUSD in each sample). | Exact self-payment, SendMax 26 Testnet XRP, fee cap 2,000 drops, no partial flag; inspect validated delivered_amount. Keep provisioning separate from product purchases. | Provide a bounded authenticated developer faucet and reset-aware fixtures; never imply Testnet rates are FX. | Medium | No economic/mainnet rate inference; product fixed SGD conversion remains a demo. |
| Observed flags + document-derived failure · 2026-11-03 | Official issuer Flags 2174353408 omit AllowTrustLineLocking. XLS-85 requires issuer permission independently of network amendment enablement; predicted tecNO_PERMISSION was not submitted. | Keep RLUSD on exact plus cooperative refund; existing token escrow refusal remains. | Publish network AND issuer capability status and explain who can enable escrow. | High for proof-or-refund escrow | RLUSD mainnet escrow permission not measured; never infer it from Testnet/amendments. |
| Code-derived, covered by render regression · 2026-11-03 | Ledger UI treated issued decimal amountDrops as XRP drops; wallet receivedDrops aggregate mixed assets. | Render official RLUSD label and decimal token units; restrict XRP aggregate to native receipts. | Include asset-tagged amounts throughout sample UIs and never divide token values by 1e6. | Medium | Same representation error is possible on mainnet; no live mainnet incident claimed. |

#### 4 Nov 2026 · Endpoint history retention and browser transport

*Class: observed, read-only Testnet*

Observed read-only: xrpl-labs returned `txnNotFound` for the committed RLUSD hash,
while s.altnet and Clio returned validated `tesSUCCESS` in the judge review.
This establishes endpoint-specific availability, not a Testnet reset or invalid payment.
Ripple JSON-RPC preflight lacked CORS (400 in the review); the fresh HTTP
comparison confirms no Access-Control-Allow-Origin on s.altnet or Clio.
xrpl-labs does advertise CORS but lacks these hashes. The original attempt
is retained in `docs/evidence/round2-e/rpc-attempt.json`; `docs/evidence/round2-p1/endpoint-comparison.json` records that comparison; the fresh P1 WebSocket
check validates 13/13 on s.altnet in `docs/evidence/round2-p1/live-validation.json`.
Workaround: bounded WebSocket tx lookup on s.altnet, Clio alternative, xrpl-labs last.
Suggested fix: publish an endpoint matrix with retained ledger ranges, CORS and
WebSocket URLs; explain that txnNotFound is not proof of failed settlement.
Severity: medium verification friction. Mainnet impact: analogous endpoint-selection
risk only, unmeasured on mainnet. No writes, signing, funding or account queries.

#### 4 Nov 2026 · Lane N credential lookup admission and HTTP transport

*Class: observed, with one SDK limitation code-derived from xrpl.js 4.7.0*

Observed local integration friction: the initial strict two-request admission
returned check_failed for the third concurrent wallet while two valid credentials
were verified. Evidence: `docs/evidence/round2-n/availability.json` (initial run),
`observations.json` (read-only retry), `tests/writer-credentials.test.ts`.
Workaround/fix: bounded queue with deadlines and two active requests; no repeat
credential transactions. Suggested fix: XRPL SDK expose response-byte limits and
bounded queue configuration for read-only clients; current xrpl.js Client has
request deadlines but no public maxPayload setting, so this lane uses capped HTTP
reads on the configured Testnet host. SDK limitation is code-derived from 4.7.0;
the initial admission failure is observed. Severity: low, identity display only.
Mainnet impact: none observed; feature restricted to Testnet. Both CredentialCreate
and CredentialAccept worked; no amendment or RPC support blocker was observed.

#### 4 Nov 2026 · First-touch public faucet fan-out

*Class: observed*

- Evidence: `docs/evidence/round2-p2/README.md`; cold `make testnet ARGS=--capture`.
- Incident: concurrent public faucet funding for buyer plus seven fixture writers
  failed provisioning; the launcher selected visibly labelled SIMULATED fallback.
  Raw faucet bodies were discarded because they can contain wallet secrets; an
  exact HTTP status was not retained, so rate limiting is suspected, not proven.
- Workaround: one faucet-funded buyer provisions writers with Testnet XRP; cache
  the private wallets with mode 0600. Successful cold first validated product hash:
  60.005 s, including sequential writer funding.
- Suggested fix: document per-IP faucet limits and support a bounded batch funding
  route or retry-after response for demos with multiple actors.
- Severity: medium for onboarding. Mainnet impact: none directly (no faucet);
  provisioning latency must not be mistaken for product settlement latency.

#### 4 Nov 2026 · Key reveal as a delivery channel (Lane R)

*Class: observed on Testnet, plus one code-derived limit labelled inline*

- **Observed:** successful writer-signed key-reveal EscrowFinish costs 423 drops
  for the 36-byte encoded fulfillment of a 32-byte AES key; create/cancel cost 12
  each. Full 60,000-drop no-show principal returns only after explicit cancellation.
- **Evidence:** `docs/evidence/round2-r/transactions.json` (four validated hashes),
  `happy-receipt.json`, `no-show-receipt.json`; protocol `docs/key-reveal-escrow.md`.
- **Workaround:** buyer persists ciphertext/quote before its create; writer persists
  K and signed finish before submit; buyer reads only a validated fulfillment.
  Use XRP, a 120-second ledger deadline, terminal fee headroom and a 2,000-drop cap.
- **Suggested fix:** Starter Kit documentation should include writer-owned key
  delivery, serialized fulfillment-size fee arithmetic and explicit cancellation,
  alongside buyer-owned proof-policy examples. Distinguish cryptographic delivery
  from semantic correctness and offline evidence from online finality.
- **Severity:** medium (fees/liquidity), high if a hashlock is presented as a truth oracle.
- **Mainnet impact:** the fee/reserve pattern matters for micropayments, but no
  mainnet execution or issuer permission was measured here. The prior observed
  RLUSD issuer-flag block still applies; no new RLUSD escrow attempt was made.
- **Code-derived limit:** a writer can sign and reveal a key for bad content;
  exported fraud evidence supports the existing reputation/challenge path,
  without a new automatic recovery-of-money promise.

#### 4 Nov 2026 · Transient Testnet provisioning fallback

*Class: observed*

- Evidence: `docs/evidence/round2-t/README.md`; the first isolated faucet-wallet launcher returned its generic public network/faucet unavailable error; retry produced the committed anchor in ledger 22048303. Root cause not identified; no claim of faucet rate limiting.
- Workaround: reuse the ignored scratch wallets and retry the same isolated provisioning path. Both s.altnet and Clio server_info reported Testnet network ID 1.
- Suggested fix: report a sanitized provisioning stage and retryability in the launcher, without including faucet bodies or wallet material.
- Severity: low, transient first-touch friction. Mainnet impact: unmeasured; Testnet faucet provisioning does not apply to mainnet. No real-money testing.

#### 4 Nov 2026 · Lane X cold-wallet setup

*Class: observed*

- 2026-11-04 · observed, Lane X cold-wallet setup: public Testnet ledger was reachable; first provisioning attempt timed out waiting for writer funding validation, retrying the same scratch wallet set succeeded. Evidence: `docs/evidence/lane-x/validation.json` provisioningIncident and cold acceptance hashes. Workaround: retain the private scratch cache and retry (never publish seeds). Suggested fix: expose faucet/funding validation progress and a retryable receipt hash. Severity: demo startup delay; mainnet impact: faucet-specific setup does not apply, ledger validation delay still requires durable reconciliation.

#### 4 Nov 2026 · Zero-clone Testnet MCP: serial faucet-wallet funding (Lane A round 3)

*Class: observed*

- Evidence: `docs/evidence/round3-a/README.md`. Cold wallet provisioning through the packed MCP took 57.67 s when each fixture-writer funding Payment waited for validation before the next was signed; submitting all funding Payments back to back (the open-ledger `Sequence` advances) and then waiting once took 18–19 s on the same Testnet.
- Workaround: submit-then-wait-once in `scripts/testnet-wallets.ts`, with the existing one-shot `tefPAST_SEQ` retry. Suggested fix: docs for `xrpl.js` `autofill` could show queued-sequence batching for faucet-style setup, and say whether `account_info` with `ledger_index: current` is the supported source of the next Sequence.
- Severity: low (first-touch latency). Mainnet impact: none; Testnet faucet only. Observed, not code-derived.

#### 4 Nov 2026 · Devcontainer-in-CI Testnet boot (Lane A round 3)

*Class: observed*

- Evidence: workflow run 41804181845 (devcontainers/ci, ubuntu-latest): the faucet funded a buyer from a GitHub-hosted IP and UC3 completed in 51.9 s with validated EscrowCreate and EscrowFinish hashes (`docs/evidence/round3-a/README.md`). That is one observation, not a statement about faucet rate limits from CI IPs.
- Tooling friction: `gh workflow run` returns 404 for a workflow file that exists only on a feature branch (dispatch needs it on the default branch), so the first run needed a temporary branch-scoped `push` trigger.
- Severity: low. Mainnet impact: none.

#### 4 Nov 2026 · RLUSD TokenEscrow control re-query

*Class: observed (flags); the refusal itself is document-derived and was not submitted*

Read-only s.altnet JSON-RPC `feature` reports TokenEscrow enabled; `account_info`
for official RLUSD issuer rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV at ledger
22058675 reports Flags 2174353408, lacking lsfAllowTrustLineLocking (0x40000000).
Flag-gated, not amendment-gated; one AccountSet away (SetFlag 17).
Evidence: Lane E commit; `docs/evidence/round3-e/runs.json` has the stand-in
escrow transaction hashes and timings. Workaround: dedicated Testnet issuer,
SGT currency labelled TEST-SGD with no real value, zero transfer fees. Suggested
fix: official Testnet issuer enables flag 17. Severity: demo integration blocked
for official RLUSD escrow. Mainnet impact: not tested; issuer permission remains
a prerequisite. No authenticated RLUSD faucet or rejection transaction attempted;
this is an issuer-flags control, not evidence of a live tecNO_PERMISSION.
No upstream report filed (owner-only).

#### 7 Nov 2026 · Zero-clone TEST-SGD bootstrap and the 1 KiB Memo rejection

*Class: observed. This is the evidence behind ranked finding 3 and the Memo upstream draft*

Cold public-faucet IOU provisioning took 92.19 s; cached setup took 12.83 s.
Evidence: M1 IOU probe and docs/evidence/m1-iou/. Existing bootstrap repeated
AccountSet/TrustSet on every restart; this lane queries validated flags and
lines and submits only missing setup. Suggested tooling fix: expose a batched,
idempotent Testnet token-escrow wallet bootstrap. Severity: low (demo latency).
Mainnet impact: not tested; this uses faucet funds and a labelled stand-in only.

The live MCP IOU attempt was rejected with invalidTransaction:
"fails local checks: The memo exceeds the maximum allowed size."
MemoData alone was 997 bytes; MemoType and serialization pushed it over
XRPL's 1 KiB Memo limit. No principal applied and no grant was issued.
Workaround: encode the full SHA-256 intent identity in base64url for IOU runs,
retaining all 256 bits and all signed quote fields. Suggested SDK fix:
check serialized Memo size before signing and expose the rejection reason.
Severity: integration blocker until fixed. Mainnet impact: the same Memo
size limit applies; mainnet execution was not attempted.

#### 7 Nov 2026 · Cold judge-command latency

*Class: observed*

Two fresh-cache Testnet judge runs exceeded the unchanged 90 s consumer deadline;
other runs passed (73.8 s, 87.1 s, and 84.2 s after the verifier follow-up).
Evidence: docs/evidence/round4-j2/try-timeout.json,
try-exact-timeout.json and try-timing.json. The precise cause of the slow runs
was not isolated; concurrent local suites and public Testnet latency varied.
Workaround: bundle dependencies, reuse validated transaction reads within one
verification, and overlap independent proof checks. Suggested tooling fix:
provide a cold-start timing breakdown and batched validated transaction reads.
Severity: medium onboarding latency. Mainnet impact: not tested; these runs used
only faucet XRP on Testnet, with fixture models and fictional writers.

#### 7 Nov 2026 · Repeated npm tarball resolution delays writer validation (J3)

*Class: observed*

Evidence: `docs/evidence/round4-j3/timings.json` and `README.md`. A fresh-cache
init took 37.364 s; the next tarball malformed-note command took 45.903 s,
while the installed executable rejected the same input in 0.428 s. Workaround:
reuse an installed executable for retries. Suggested fix: reduce the portable
runtime/package dependency footprint and provide a small stable install path.
Severity: high first-touch friction. Mainnet impact: none observed; public Testnet
only, no changes to spending authority or settlement validation.

J3 re-measurement after J2 #387: fresh-cache init 1.396 s, malformed-note
rejection 1.510 s, and publish-to-Credential 32.491 s. The bundled package fixes
the observed retry latency; initial misses remain historical evidence.

#### 2026-11-10 · Cold Testnet IOU start versus the MCP tool timeout (observed)

*Class: observed measurements, with a derived client-timeout risk that is labelled as derived*

Evidence: [nov10-reachability/README.md](evidence/nov10-reachability/README.md), a committed extract of the 10 Nov reachability audit of release v1.0.2 (main at `2d3999f8`). The audit lane took the measurements; they were not re-run for this entry.

- **Observed:** a cold `app --testnet --iou` took 95.841 s to ready, of which 93.16 s was wallet, issuer, trust-line and issuance setup. Progress lines appeared at 0.0, 0.0, 12.9 and 81.6 s, then nothing until ready. A warm IOU MCP wallet status took 7.935 s.
- **Observed:** a cold `try --testnet` (empty npm cache, fresh Testnet state) passed in 76.15 s with purchase, failed proof, refund, re-buy, anchor and 12/12 live ledger checks. With the 7 Nov runs (73.8, 87.1 and 84.2 s passing; two runs over 90 s) that is four passes from five cold runs, so the 84.2 s figure remains one measurement, not a bound.
- **Code-derived, not an observed cancellation:** `mcp/testnet.ts` runs this same preparation on the first tool call, after `initialize` has already returned, and `docs/mcp.md:34` documents `tool_timeout_sec = 60`. A cold IOU start is therefore longer than the documented client tool timeout. Raising only a startup timeout would not help. No real Codex or Claude Code chat was seen to cancel the call.
- **Workaround:** reuse the cached private wallets (warm start 7.9 s), run the app once first, or give Testnet/IOU configs a longer tool timeout such as 180 s; keep the fixture timeout short.
- **Suggested fix (ours, docs owner):** a Testnet/IOU-specific client config with `tool_timeout_sec = 180` and a sentence that the first operation can take about two minutes; progress output through the whole wait. **Suggested fix (upstream):** the same as B32: expose provisioning progress and a batched, idempotent Testnet token-escrow bootstrap.
- **Severity:** medium onboarding friction. **Mainnet impact:** none; faucet provisioning does not exist on mainnet, so this is a Testnet setup cost only.
- **Synthetic probe, not observed:** the 10 Nov web sweep injected an HTTP 503 from the faucet host into a separate app process; the app started in 2.2 s in labelled SIMULATED mode with no ledger transactions, but the reason was not shown in the browser. That is a product message gap, not a Testnet incident.

### B.2 Code-derived failure modes

#### 3 Nov 2026 · Local evaluation tooling (#276)

*Class: code-derived, reproduced by a new store test*

The receipt exporter assumed every paid re-answer was answer version `j + 2`.
A kept free follow-up can shift that mapping and attribute free gain to a paid
purchase (code-derived failure mode, reproduced by a new store test). Workaround:
record each intent's before/after answer versions on the ANSWER event and use
that transition in the read-only export; preserve the legacy follow-up offset.
Evidence: `tests/eval/labels-export.test.ts`, `scripts/export-decision-labels.ts`.
Suggested SDK/example fix: make receipt-to-answer transitions explicit rather
than infer them from answer order. Severity: medium for calibration reliability;
mainnet impact: no incident observed; bad labels could encourage wasted buying.
All this task's evaluation payments are SIMULATED. Separately, the UC3 regression
test caught a local lexical false duplicate: a free paragraph contained capacity
figures and explicitly no lead times. Sentence-scoped affirmative matching fixes
that without changing any refund, leak, or spending test. This is local
application/evaluation tooling evidence, not an XRPL or x402 network failure.

#### Earlier ranking (3–4 Nov): what we would fix first

*Class: code-derived design recommendations. Superseded as a ranking by the top 7 above; kept because each item names its repro and the commit that implemented it*

1. **Ship a TypeScript payment recovery example, not just a successful payment.**
   Restart between signing and delivery and a naive retry can sign twice. Our
   `server/xrpl.ts` persists the blob before sending; `server/purchases.ts`
   reconciles the same hash. Repro: `npx vitest run tests/xrpl.test.ts` includes
   “after a restart, settles a stored payment that validated without signing
   again”. Original integration: `36ae0b7` (5 Oct). Suggested upstream example:
   durable intent → signed blob → validated ledger → delivery, with a crash at
   every boundary. A submit response is not finality.

2. **Give timeout a third state: pending.** A missing transaction on one node
   is not proof that money never moved. `XrplPayer.status` in `server/xrpl.ts`
   keeps the reservation when account sequence has advanced; expiry requires
   a validated ledger past LastLedgerSequence and an unused sequence. Repro:
   the “keeps the reservation when the payer Sequence moved” case in
   `tests/xrpl.test.ts`. Suggested fix: document this proof of absence and
   expose pending separately from failed in facilitator SDKs. Mainnet cannot
   safely treat an RPC timeout as permission to pay again.

3. **Publish one exact invoice-binding fixture across x402 and XRPL.** The
   HTTP `extra.invoiceId` is canonical JSON; XRPL `InvoiceID` is its SHA-256,
   uppercase hex. Mixing these representations breaks binding to the article,
   version, price and payee. Repro: `npx vitest run tests/x402.test.ts` checks
   key-order stability and every bound field; `tests/xrpl.test.ts` rejects
   settling a different quote. Workaround: `shared/x402.ts`, shipped in
   `433b971` (7 Oct). Suggested fix: cross-language vectors with the raw JSON,
   base64 header and ledger hash together, including malformed examples.

4. **Make the refund trust boundary explicit.** A ledger payment proves value
   transfer, not that an article kept its promise. `publisher/challenge.ts`
   refunds from the writer wallet; `server/challenges.ts` penalizes trust even
   if the writer refuses. Repro: `npx vitest run tests/challenge.test.ts
   tests/alphaleak.test.ts tests/xrpl.test.ts`. These are synthetic adversarial
   cases, not claims about real publishers. `docs/FINAL-PUSH.md` D5 explicitly
   records the limitation. Suggested fix: describe cooperative refunds and
   arbitration separately. The standalone #261 spike now demonstrates cancellation; product integration remains #273.

5. **Treat pricing units as a deployment blocker.** S$ minor units map to XRP
   drops at a fixed demonstration rate, not a market quote. See
   `shared/contracts/` and `server/purchases.ts`; repro: compare the invoice
   drops against `DROPS_PER_MINOR` in `shared/`. #163 deliberately defers rate
   sourcing, rounding and refund drift. Suggested fix: a fully tested RLUSD
   path with issuer validation and trustline onboarding, or an expiring XRP
   rate quote. Mainnet pricing is a gap; this PR does not implement #163.

#### 3 Nov 2026 · Live recovery and sequencing (#287)

*Class: code-derived failure mode (injected local faults); the Testnet finality bullet is observed and labelled*

- **Code-derived failure mode, reproduced with injected local faults:** a paid-GET
  response couples ledger finality to body delivery; the old payer lock kept the
  next writer waiting up to the 60 s HTTP timeout even after validation. Evidence:
  `docs/evidence/payment-ops-287.md`, `scripts/payment-ops-proof.ts`,
  `tests/xrpl.test.ts`. Workaround: keep the signed blob and reservation, query
  validated status independently, release sequencing on ledger proof, and retry
  delivery with the same hash. A missing transaction or submit timeout is not
  proof of no charge. Suggested fix: Starter Kit/x402 examples should separate
  settlement finality from body delivery, persist before submit, and demonstrate
  crash-before-submit and lost-response recovery. Severity: high (wallet-wide
  stall and unsafe naive retries); mainnet impact: correctness and availability,
  not mainnet validation.
- **Observed Testnet finality, 3 Nov:** one 60,000-drop payment validated at ledger
  22025680; purchase plus idempotent repeat took 8.85 s, with one receipt.
  Hash: `0109AE3D362011C2E277B3A617770162304651A93C5884CCC403D459C4FE9FC5`. No submit edge case
  occurred in this real check; crash/timeout cases are explicitly synthetic.
  Workaround: retain journal and poll ledger instead of signing a replacement.
  Suggested fix: expose independent settlement and delivery timing in facilitator
  examples. Severity: informational for this successful check; mainnet latency
  and custody remain unmeasured.

#### 3 Nov 2026 · Hire x402 retry and fixture isolation (#274)

*Class: mixed, labelled per bullet (observed in local tests, code-derived, observed roster gap)*

- **Observed in local tests/tooling:** reusing a fixture journal for a Testnet
  run caused a stale signed-payment retry and a missing PAYMENT-RESPONSE header.
  No second charge was submitted. Evidence: `sdk/x402.ts`,
  `scripts/hire-demo.mjs`, `tests/hire.test.ts`, `docs/evidence/hire-274.md`.
  Workaround: separate default private directories for fixture and live; retain
  uncertain live journals and resend the original signature. Suggested SDK fix:
  namespace persistent payment state by rail and surface typed settlement versus
  delivery errors. Severity: medium developer friction; mainnet impact: a caller
  must never treat delivery failure as permission to pay a new intent.
- **Code-derived failure mode, prevented for hire:** de-duplicating by tx hash
  alone cannot stop two different signed blobs paying the same invoice before
  a unique settlement row is inserted. Workaround: bind each hire invoice to
  its first signed blob *before* facilitating; test alternate-blob refusal.
  Suggested facilitator fix: reserve invoice plus signed hash before submitting.
  Severity: high payment-safety concern; mainnet impact: duplicate-charge risk
  without invoice-level admission. This is not a claimed live XRPL incident.
- **Observed roster gap:** the free Open Records persona had no dedicated
  wallet variable. Reused its existing official-records Testnet wallet via an
  explicit documented alias; every cited free writer is payable. Suggested
  starter-kit fix: register public royalty addresses for free writers too.
  Severity: low setup friction; mainnet impact: verified recipient ownership
  and receive-and-forward licensing need separate review, not a Testnet claim.

#### 4 Nov 2026 · x402 publisher-origin identity

*Class: code-derived, reproduced with offline simulated fixtures*

- **Code-derived failure mode, reproduced with offline simulated fixtures:**
  independent publishers can reuse article/version/span IDs and the same XRPL
  wallet. Local IDs or wallet identity alone therefore cannot select an HTTP
  delivery endpoint or a cited writer's royalty recipient. Evidence:
  `docs/evidence/round2-f/origins.json`, `tests/source-identity.test.ts` and
  `tests/hire-source-identity.test.ts`. Workaround: persist the approved origin,
  signer key and complete source identity before signing; retain that endpoint
  for same-blob recovery and fail closed on unresolved recipients. Suggested
  tooling fix: include origin-qualified routing context in client journals and
  examples without changing signed x402 bytes. Severity: high for federated
  attribution and credential routing. Mainnet impact: code-derived risk only;
  no live provider, Testnet or mainnet operation was performed for this proof.

Unsigned escrow and budget refusals also retain their source-qualified audit
context; offline receipt verification distinguishes these uncharged outcomes
from signed reservations. Evidence: `tests/purchase.test.ts`.
Exact source matching also prevents collided local IDs from mislabelling report
citations or measuring one writer’s calibration against another’s delivery;
offline regressions cover both (`tests/report.test.ts`, `tests/reputation.test.ts`).

#### 4 Nov 2026 · Cold faucet validation race (Lane V2)

*Class: code-derived from the round-2 cold incident*

Code-derived failure mode from the round-2 cold incident: faucet HTTP success did not guarantee the buyer was visible in the validated ledger before writer funding. Workaround: poll validated account_info for up to 20 seconds, then sign; retry actNotFound/tefPAST_SEQ once. Three fresh-wallet launches and three clean-clone captures succeed after the change (docs/evidence/lane-v2/). Fallback distinguishes faucet HTTP status, validation timeout and funding tx result without bodies or secrets. Suggested tooling fix: expose a validated-funding readiness contract. Severity: demo reliability; mainnet impact: faucet-specific, while sequence/validation races also require reconciliation on mainnet (not tested).

### B.3 Observed friction in our own tooling (not XRPL, x402 or the Starter Kit)

#### 3 Nov 2026 · SDK packaging (npm ENOTEMPTY)

*Class: observed (local npm)*

The first SDK-lane npm ci failed with ENOTEMPTY while removing an Electron
transitive dependency; a retry completed without dependency changes. Evidence:
SDK v1 lane check output and `scripts/check-sdk-package.mjs` for the subsequent
clean tarball check. Workaround: retry installation. Suggested fix: make npm ci
cleanup tolerate transient nonempty dependency directories. Severity: low;
mainnet impact: none observed. This was local npm tooling, not XRPL or x402.

#### 3 Nov 2026 · Verification tooling incident (#278)

*Class: observed (local evidence tooling)*

The #278 UC3 runner created its first run using Store's default SIMULATED label
while injecting a real Testnet payer; the gate audit refused the inconsistent
snapshot (`missing_rail_label`). Evidence: `docs/evidence/verify-278.md` and
`verify-278/summary.json`. Workaround: pass the explicit Testnet mode labels,
correct the harness metadata and re-export/re-check the same durable run; no
replacement payment. Suggested fix: require explicit rail labels in standalone
Testnet harness constructors. Severity: low (local evidence tooling). Mainnet
impact: none observed; no value funds. This was not a ledger or x402 failure.

#### 3 Nov 2026 · Scorecard evaluation hit an inference outage

*Class: observed (model tooling)*

Local scorecard evaluation at `5953559`: an initial attempt hit OpenAI Decisions
HTTP 503 ("Decision inference is unavailable") on one coverage request and
correctly refused to publish a baseline. Evidence:
`eval/scorecard/out/2026-11-02T16-27-35.998Z-live/requests.jsonl` and `cost.json`
(local ignored artifacts; US$0.1233354 including all calls). Workaround: one
bounded transient retry, with both attempts cached/metered; the next complete
run published the pre-menu baseline in `eval/scorecard/history.jsonl`.
Suggested tooling fix: retain per-phase progress and retry transient inference
errors without discarding successful calls. Severity: low for local evaluation;
mainnet impact: none observed (all settlement SIMULATED). This was a model/tooling
incident, not an XRPL, x402, Starter Kit or Testnet failure. Signing the menu with
existing XRPL keys required no new wallet/API operation; no signing friction
was observed. The local `.env` key also needs an explicit evaluation mapping;
`make scorecard LIVE=1` now handles that without loading wallet seeds.

#### 3 Nov 2026 · Evaluation tooling incident (completion)

*Class: observed (model tooling)*

At `f0951d4`, the local Decisions sweep refused one candidate judgment for Q02;
`eval/scorecard/out/2026-11-03T01-30-59.942Z-live/failed-evaluation.json` and its
meter record US$0.0879638, with no published scorecard. Short, single-predicate
wording with contextual matching guidance in the state completed successfully;
refusal still fails the round, and no scores/tests were substituted. Suggested
fix: expose a structured refusal reason to distinguish ambiguous predicates
from access/inference errors. Severity low for local eval; no observed mainnet
impact, all settlement SIMULATED. This is model/tooling friction, not an XRPL
incident. Total attempts, including the interrupted run, are itemized in
`eval/scorecard/lane-b-spend.json`.

#### 3 Nov 2026 · Recording startup race (#311)

*Class: observed (local tooling)*

- 2026-11-03 · Observed local recording startup race (#311): Vite was reachable
  before `/api/health`; proxy logged ECONNREFUSED and the new disabled composer
  correctly refused the early clip submit. Evidence: `scripts/record.mjs`
  readiness fix and `docs/design/UX-1-EVIDENCE.md`; first take failed, later UC3
  take succeeded. Workaround/fix: wait for API health as well as the page before
  driving keyboard input. Suggested tooling fix: one shared engine-ready signal
  for demo and clip drivers. Severity: low, recording only. Mainnet impact: none;
  no payment was initiated by the failed take. This is local tooling friction,
  not an observed XRPL/x402 incident.

#### 3 Nov 2026 · x402 payAndFetch diagnostic on a refused budget (#280)

*Class: observed (synthetic integration)*

- **3 Nov 2026, observed in synthetic integration (#280):** x402 `payAndFetch` reported "PAYMENT-RESPONSE header missing" when the service refused an agent's budget before settlement (HTTP 409). Evidence: `tests/hire.test.ts` agent-key/fee-cap case; submit count unchanged. Workaround shipped: classify non-success HTTP refusals explicitly and retain the original signed intent. Suggested fix: buyer tooling should distinguish unpaid policy refusals from malformed settlement receipts without discarding recovery state. Severity: low (diagnostic); mainnet impact: confusing recovery can encourage new intents, so preserving one signed blob matters. The two-agent live Testnet demo itself had no ledger/tooling failure (`docs/evidence/agents-280.md`).

#### 3 Nov 2026 · Vite and symlinked fonts (#312)

*Class: observed (local tooling)*

- 2026-11-03 · Observed local tooling friction (#312): sharing node_modules to save disk makes Vite reject the symlinked Geist font path during `make record OFFSET=2100` (403, clip log). Workaround: allow only the resolved node_modules directory in Vite dev fs; existing .env/corpus/store deny rules remain. Suggested fix: Vite should recognize dependency asset realpaths consistently with bundled imports. Severity: low; mainnet impact: none (development recording only).

#### 3 Nov 2026 · Occupied ephemeral port (#312)

*Class: observed (local tooling)*

- 2026-11-03 · Observed local tooling friction (#312): a Playwright demo startup found its allocated ephemeral port already occupied (evidence: `docs/design/ux2/README.md`, first-take console message). Rerunning with a fresh allocation started successfully. Suggested fix: retain the bound port lease until the child server is ready, rather than closing the allocator first. Severity: low; mainnet impact: none (local test startup only).

#### 3 Nov 2026 · Historical release tooling (#279)

*Class: observed (GitHub release tooling)*

- **Observed GitHub tooling behavior, not an XRPL incident:** the pre-desktop
  release workflow marked a newly published older tag as Latest. Evidence:
  `docs/evidence/release-day2.json`, release run `41567080081`. Workaround:
  publish the immutable Day 2 commit/tag with explicit historical notes, then
  set v0.3.0 `--latest=false` and restore v0.4.0 as Latest. Suggested fix:
  release automation should compare version tags and set Latest explicitly;
  the updated workflow does this. Severity: low release navigation friction;
  mainnet impact: none; no ledger or wallet operation was involved.

#### 3 Nov 2026 · Evaluation tooling friction after integration

*Class: observed (local evaluation)*

- **Observed evaluation tooling friction after integration:** full
  `scorecard --check` refuses the frozen `server/agents/loop.ts` hash after the
  merged escrow path adds its purchase flag. The actual hash equals main;
  evidence: `docs/evidence/chaos-279-scorecard-freeze.json`. Workaround: preserve
  the quality gate and display independently labelled historical reliability
  with `--reliability-only` (cannot combine with quality/live flags). Suggested
  fix: review/version frozen inputs whenever integrated runtime source changes;
  retain prior quality history. Severity: low (quality comparison blocked);
  mainnet impact: none; no ledger or model call occurred in the refused run.
  Resolved by the upstream v5 freeze; the subsequent full heldout fixture check
  passed (`docs/evidence/chaos-279-scorecard.json`).

#### 3 Nov 2026 · Local chaos tooling (#279)

*Class: observed (local harness; cause partly inferred)*

- **Observed local harness interruption; cause partly inferred, not an XRPL incident:**
  the first integrated soak stopped at iteration 248 after 52 escrow probes,
  without worker assertion output. The original harness could not distinguish
  its watchdog from an external kill. Evidence: `docs/evidence/chaos-279-interrupted-soak.json`
  and `docs/evidence/chaos-279.md`. A successful diagnostic replay reached 1.53 GB
  RSS; duplicate concurrent SSE snapshots inflated audit work. Workaround:
  hash identical snapshot/run/grant context and audit each distinct observation;
  regression preserves every distinct state. Record exit signal/watchdog/elapsed
  diagnostics; retain the 45 s watchdog and all invariants. The repaired 30-minute
  soak passed 609 main episodes plus 124 escrow probes. Suggested tooling fix:
  bounded, deduplicated observation collectors and explicit child-exit diagnostics.
  Severity: medium local test reliability; mainnet impact: none observed, no
  live ledger was used and no production money bug was confirmed.

#### 3 Nov 2026 · Release backfill test inherited Git hook variables

*Class: observed (local tooling)*

- 2026-11-03 · Observed tooling incident: release backfill test inherited Git hook GIT_DIR/GIT_INDEX_FILE and wrote its fixture commit into the caller worktree; hook then failed on an existing tag. Evidence: docs/evidence/stream-281.md and tests/release.test.ts. Workaround: restore caller ref/index, strip inherited GIT_* variables from fixture subprocesses. Suggested fix: isolate Git subprocess environments in temporary-repository tests. Severity: high local tooling; no XRPL/mainnet action or funds affected.

#### 3 Nov 2026 · Node fetch and the rebinding test

*Class: observed (local tooling)*

- 2026-11-03 · Observed tooling friction · `tests/mcp-http.test.ts`: Node fetch did not transmit the overridden Host in the rebinding test, so the request reached MCP content negotiation (406). Workaround: use `node:http.request` for the hostile Host assertion (403). Suggested fix: document forbidden/rewritten header behavior in client test tooling. Severity low; no XRPL mainnet impact.

#### 3 Nov 2026 · Packaged utility crash left an MCP connection open

*Class: observed (desktop)*

Evidence: `docs/evidence/app-acceptance.md`; isolated DMG fixture crash test killed
the engine after signed-blob persistence. The first run timed out waiting for a
restart because an active HTTP POST held listener shutdown open. Workaround/fix:
close active HTTP sockets before awaiting MCP listener shutdown, then restart with
bounded backoff against the same x402 journal. Suggested tooling fix: expose a
bounded abort/drain primitive for embedded MCP HTTP hosts. Severity: medium
(desktop availability). Mainnet impact: availability/reconciliation delay; the
persisted payment blob must remain authoritative and must never be re-signed.
No mainnet transaction was attempted.

#### 4 Nov 2026 · Soak watchdog and host sleep

*Class: observed (local fixture tooling)*

- **4 Nov 2026 — observed local fixture tooling incident (no Testnet/mainnet transaction):** the 12-hour soak on `eae85ed` stopped on a watchdog at iteration 3031; host power logs establish a matching 606-second clamshell sleep. Stdout was discarded and no stack was retained. Evidence: `docs/evidence/soak-nov4-run1.json` and `docs/evidence/soak-nov4-host-sleep.json`, analysis: `docs/evidence/soak-nov4.md`. Workaround/fix: bounded LLM awaits and nonblocking cancellation, sequential leak-audit token sets, preloaded sanitized diagnostics and continue-on-violation watchdogs. Suggested tooling fix: always preserve bounded child output and phase/resource samples. Severity: high for soak reliability; mainnet impact: no observed mainnet incident, model timeout availability risk is code-derived, fixture audit allocation is test-only.

#### 4 Nov 2026 · Release and tooling admission (Lane D)

*Class: code-derived release-tooling failure mode, plus observed CI and browser-readiness friction labelled inline*

Code-derived tooling failure mode, not an XRPL incident: release publishing
previously depended only on desktop build, could rebuild different MCP bytes,
and the release helper could push an untested version commit directly to main.
Evidence: Lane D scripts/release-contract.mjs negative tests and
`docs/evidence/round2-d/release-contract.json`. Workaround/fix: version PR first;
same-SHA reusable CI including coverage/browser/Python/installed artifacts, then
hash-bound receipt admission and reuse of accepted files. Severity: high for
release provenance; no observed funds loss. Mainnet impact: no rail change;
prevents distributing unaccepted payment code. Suggested upstream/tooling fix:
provide artifact admission as a standard release prerequisite.

Observed CI tooling friction in this lane: run 41703318583 at 6bad2b6e rejected
publisher branches (434/535 vs floor 435/536) under Node 22 despite a local
Node 26 pass. Workaround: reproduce with the hosted Node version and add
publishing-guide and truthful-control cases; thresholds remain intact. Suggested
fix: match local coverage runtime to CI. Severity: low; no direct mainnet effect.

Observed offline browser tooling friction: during concurrent local coverage,
Vite became ready before the fixture API; the first health request failed and
the preset stayed disabled (local /tmp/lane-d-e2e-ratchet.log). Workaround/fix:
wait for proxied /api/health before browser admission. The 13-case rerun passes
in docs/evidence/round2-d/browser-ready.log. Severity: low; no direct mainnet
impact. No readiness timeout was raised.

#### 4 Nov 2026 · Receipt amount animation during axe inspection

*Class: observed (local tooling)*

Observed local tooling friction, Lane G on Lane F c0450fa6. An axe inspection
during the receipt amount fade-in measured transient insufficient contrast.
Workaround/fix: remove receipt entrance/amount animation; static money and refund
states remain readable. Evidence: `docs/evidence/round2-g/accessibility.json` and
`scripts/contribution-screenshots.ts`. Suggested fix: inspect static final state
and avoid ornamental money transitions. Severity: low tooling/UX; mainnet impact:
none observed, no ledger or provider calls in this inspection.

#### 4 Nov 2026 · SDK wheel packaging (Lane K)

*Class: observed (local tooling)*

- 2026-11-04 — Observed local SDK packaging friction (Lane K, docs/evidence/round2-k/README.md): a clean wheel without site packages exposed a remaining absolute six.moves import masked by the development environment. Workaround: relocate every vendored import; extend the existing clean-wheel consumer to run independent receipt verification. Suggested tooling fix: exercise optional SDK capabilities from installed artifacts with --no-deps, not just source imports. Severity: low, caught before release; no ledger interaction or mainnet impact observed, but an uncorrected package would block offline verification on a clean installation.

#### 4 Nov 2026 · GitGuardian treats a public XRPL credential type as a secret

*Class: observed (scanner)*

Observed scanner friction, Lane N PR #357, GitGuardian incident 39528977:
all 12 flagged locations are `credentialType` values encoding the public UTF-8
string `ResearchAgent-writer-2026-11-03`, not signer credentials. Evidence:
`docs/evidence/round2-n/transactions.json`, `observations.json`, `engine.json`,
`site/ledger/transactions.json`, and PR #357's GitGuardian check/comment. Each
flagged commit line was independently checked against the public decoded type.
Workaround: retain accurate ledger evidence and request incident classification
in pinned issue #265; do not disable scanning or merge with a failed check.
Suggested fix: distinguish public XRPL CredentialType blobs from authentication
secrets, or expose a scoped false-positive classification through authenticated
CLI tooling. Severity: medium release/tooling blocker, no runtime impact.
Mainnet impact: none observed; these operations and evidence are Testnet only.

- 2026-11-04 — Observed tooling friction: GitGuardian incident #39528977 classified the public XRPL CredentialType as a generic secret in PR #357 (`docs/evidence/round2-n/transactions.json`). Workaround: store public UTF-8 text, derive wire hex, squash PR history. Suggested fix: recognize public XRPL CredentialType context. Severity: CI blocker; mainnet impact: none, representation only.

#### 4 Nov 2026 · Release consumer check timed out (#364)

*Class: observed (CI tooling)*

- 2026-11-04 — Observed release tooling failure: CI run 41740868918 printed all consumer results (MCP npx 28.399 s) then timed out at 180 s. Evidence: PR #364. Workaround/fix: own consumer process groups, terminate grandchildren, close pipes, assert groups empty; suggested upstream SDK improvement: process-tree cleanup for stdio npm launchers. Severity: release blocker; mainnet impact: none observed, fixture-only tooling.

#### 4 Nov 2026 · V1 capture: no-show cancellation and answer resumption

*Class: observed (demo capture on Testnet)*

Observed locally on XRPL Testnet with faucet wallets: a writer refusing signed delivery leaves the HTTP run FAILED while policy keeps the escrow reserved and later cancels it. Cancellation uses FAILED_NOT_SETTLED (principal returned, fees paid), rather than a cooperative REFUNDED payment. Retrying the fixture decision without withdrawing the offline writer's offers can consume the three-round limit. Evidence: `docs/evidence/round2-v1/README.md` and its HTTP/SSE trace. Workaround: the labelled capture harness waits for validated cancellation, injects an explicitly labelled fixture quarantine for that writer (not automatic reputation scoring), then resumes the existing policy loop. No engine or wallet reliability changes. Suggested tooling fix: expose an explicit cancellation-complete/replan capture hook and terminal-state wait, rather than treating every FAILED snapshot as capture failure. Severity: demo tooling; no mainnet execution or mainnet incident claimed. Early in-memory capture attempts were aborted before export and are not included as completed refund evidence.

#### 4 Nov 2026 · Post-DONE anchor visibility delay

*Class: observed (our client lifecycle, Testnet)*

- Evidence: `docs/evidence/round3-d/probe.json` records `anchorShownWithoutReload: false`; the validated anchor existed in the engine before a reload displayed it.
- Workaround: reload the answer. RC.2 preparation adds a bounded read-only run poll and browser success/timeout regressions (`tests/ux2.spec.ts`).
- Suggested fix: expose the post-run anchoring lifecycle to clients until validation or timeout; do not treat DONE as completion of asynchronous audit anchoring.
- Severity: medium UX/evidence discoverability. Mainnet impact: the same client lifecycle failure could hide an existing anchor; this observation was Testnet only, with no mainnet test.

#### 7 Nov 2026 · Shared-workstation acceptance contention

*Class: observed (local fixture tests)*

- Class: observed local fixture test timeouts, not a Testnet incident.
- Evidence: `docs/evidence/settings/README.md`; default-worker verifier/audit CLI tests exceeded existing 5 s limits; combined Playwright build/start exceeded the unchanged 45 s startup limit.
- Workaround: opt-in `RA_TEST_WORKERS=1` (default remains three); compile before running the settings evidence config. Assertions and timeouts unchanged.
- Suggested fix: run acceptance on a quiet host and separate build time from server readiness in evidence runners.
- Severity: medium for local release verification.
- Mainnet impact: none established; no mainnet request or payment was made.

#### 7 Nov 2026 · J1 packaging friction

*Class: observed (local tooling)*

Observed: a concurrent web UI build cleared `dist/release/` during the packed
judge-bank Testnet acceptance. Question 19 had completed and its public receipt
was exported, but rereading the tgz digest then failed with ENOENT. Evidence:
`docs/evidence/round4-j1/README.md` and `scripts/judge-bank-testnet.ts`.
Workaround: retain the original unpacked package and private durable state,
record the artifact digest once, and resume the frozen bank with the same
idempotency keys. Suggested tooling fix: stage acceptance packages outside the
frontend build output and persist artifact identity before launch. Severity:
low (local evidence capture interrupted; no new purchase needed for recovery).
Mainnet impact: no ledger defect observed and no mainnet execution attempted.

#### 7 Nov 2026 · J5 receipt and content acceptance

*Class: observed (acceptance tooling)*

Observed tooling incidents, not ledger defects: the first J5 packed-MCP run detected an eight-word overlap because new paid text repeated the public team-authorship label. The unchanged leak gate rejected it; removing the duplicate phrase from paid bodies retains the public disclosure without weakening detection. Evidence: `docs/evidence/j5-coverage/initial-attempt/` and its README. Suggested fix: add a corpus lint against public writer metadata before network acceptance. Severity: acceptance tooling, no mainnet execution.

Observed verifier contract mismatch: a no-purchase Testnet run exports no ledger anchor; `--ledger` then reports `No ledger anchor in export`, while purchased runs verify online. Evidence: `docs/evidence/j5-coverage/initial-attempt/heldout/H01.verification.json`. Workaround: report abstentions separately and preserve the failed check; no verifier or MCP patch in this lane. Suggested fix: align the explicitly labelled no-purchase export and independent verifier semantics in the owning lane. Severity: evidence UX; mainnet impact unmeasured, no funds moved in that abstention.

#### 7 Nov 2026 · Source URLs trip the search-leak oracle (Lane X)

*Class: observed (content authoring)*

- 2026-11-07 — Lane X, observed tooling friction: publishing source URLs both in public search metadata and paid-body references trips the unchanged eight-word search-leak oracle. Evidence: `docs/evidence/x-explainers/README.md`, `tests/search-leak.test.ts`. Workaround: public URL/access-date metadata plus numbered body citations; no duplicate URL prose in paid bodies. Suggested fix: document this authoring convention in the publisher guide. Severity: low; mainnet impact: none established, content-authoring boundary only.

#### 7 Nov 2026 · Local acceptance and repeated CI waits

*Class: observed (tooling)*

Evidence: `docs/evidence/ci-speed/README.md` and its raw history/timing JSON.
The serial acceptance baseline on the 10-CPU Mac missed loop p99 at 60.981 ms
against the unchanged <50 ms limit; its four memory/latency gates passed.
Concurrent acceptance attempts also missed at 99.615 ms and 167.248 ms.
Workaround: isolate the full soak by default (27.394 ms passing cold; 24.789 ms
passing on explicit verified reuse), retain every miss, and reuse only unchanged
outputs on the exact clean source/runtime. Cold acceptance is 554.5 s; prepared
reuse with a fresh full soak is 301.2 s. Suggested fix: content-keyed local merge
receipts and bounded release scheduling, with full hosted release verification
retained. Severity: medium development/acceptance delay. Mainnet
impact: none measured; synthetic fixtures and simulated settlement only.

#### 10 Nov 2026 · Standalone key-reveal example: RPC metadata at the SDK boundary

- **Observed, Testnet (developer integration friction; Low).** `tx` API v2 adds
  `ctid`, `date` and `ledger_index` inside `tx_json`; comparing the whole response
  object with the decoded signed blob rejected a successful EscrowCreate.
  Evidence: [standalone example and live receipts](../examples/x402-key-reveal-escrow/README.md),
  preliminary create `ACE5E576450557CF5CBDA57B6C1A273480180CF3919098207A13010A38968566`.
- **Workaround:** require matching transaction hash, validated `tesSUCCESS`,
  exact escrow fields and invoice/envelope Memo, then verify the live object.
  Compare transaction fields rather than RPC annotations. No gate weakened.
- **Suggested fix:** add an annotated-response vector to escrow tutorials.
  **Mainnet impact:** the same comparison mistake can block delivery; mainnet
  was not run. The example remains faucet-only Testnet.
- **Code-derived SDK boundary:** pinned `x402-xrpl@0.3.4` preserves the custom
  scheme in its codecs, but its exact payer refuses it, as tested. Use the
  codecs with a separate escrow handler, not a hidden `exact` fallback. This is
  an experimental example, not an observed exact-facilitator escrow capability.

## 10 November 2026: exact-corpus audit context in packed bank tooling

- Class: observed local tooling mismatch, not an XRPL or x402 settlement incident.
- Evidence: `docs/evidence/c3-index-corpus/` baseline v3 original results record a premium-leak audit finding while the unchanged packed baseline was buying older article versions. The runner loaded the edited worktree corpus for later banks; a raw-store re-audit using the exact baseline package corpus reports zero violations. Original results and logs are retained.
- Workaround: audit each immutable package against its own extracted corpus, with unchanged audit rules, and keep the original mismatch alongside the corrected audit context.
- Suggested fix: make the packed bank runner resolve its audit corpus from the packed artifact, rather than the invoking worktree.
- Severity: medium for evaluation integrity. Mainnet impact: none observed; fixture models and faucet Testnet only. No threshold or policy change.

## Part C. Historical research: September 2026 submissions

Preserved from `docs/DEV-FEEDBACK.md` (introduced in `ff68f38`). These are
**historical research submissions**, not newly reproduced defects. The inventory
records acceptance responses, not confirmation that upstream fixed the issues.

Developer feedback on the XRPL and x402 documentation and integration experience. These research-based observations were submitted on 4–5 September 2026 and describe the materials reviewed at that time.

#### Submission inventory

All 15 submissions below received an acceptance response. Times are Singapore time (UTC+8).

| # | Topic | Submitted |
|---|---|---|
| 1 | Facilitator reliability and reconciliation | 2026-09-04 23:56:25 |
| 2 | Bounded autonomous signing | 2026-09-04 23:56:25 |
| 3 | Wrong chain starter examples | 2026-09-04 23:56:25 |
| 4 | Package version pinning | 2026-09-04 23:57:53 |
| 5 | Network and asset validation | 2026-09-04 23:57:53 |
| 6 | Python version prerequisites | 2026-09-05 00:09:10 |
| 7 | TypeScript quickstart coverage | 2026-09-05 00:09:10 |
| 8 | RLUSD trustlines and issuer onboarding | 2026-09-05 00:09:10 |
| 9 | SourceTag default mismatch | 2026-09-05 00:09:10 |
| 10 | Payment retry and duplicate settlement | 2026-09-05 00:14:16 |
| 11 | Network identifier compatibility | 2026-09-05 02:28:03 |
| 12 | DestinationTag and X address support | 2026-09-05 02:28:04 |
| 13 | SourceTag ownership and attribution | 2026-09-05 02:28:04 |
| 14 | Testnet reset recovery | 2026-09-05 02:28:05 |
| 15 | Endpoint transport and network identity | 2026-09-05 02:28:06 |

#### Submitted feedback

##### 1. Facilitator reliability and reconciliation

While preparing an XRPL agentic-payment flow, I found a reliability gap in the x402 quickstart: it requires T54's hosted testnet facilitator, which the XRPL documentation labels best-effort with no committed SLA, but the guide does not provide a local facilitator, deterministic simulator, or clear reconciliation guidance for facilitator outages versus invalid payments. A local test harness plus documented retry, idempotency, and receipt-reconciliation behavior would make hackathon and production integration much easier to debug.

##### 2. Bounded autonomous signing

The XRPL agent documentation has an autonomy ambiguity: the x402 guide describes payment as requiring no human in the loop, while the Agent Wallet skill requires explicit human confirmation for every signature by default. The docs mention auto-signing but do not show one concise, end-to-end example of bounded autonomy with network, destination, amount, and expiry constraints. A single approved-autonomy example, clearly separated from production policy-gated signing, would prevent builders from either blocking unattended x402 flows or weakening authorization controls.

##### 3. Wrong chain starter examples

The general x402-secure reference examples default to Base Sepolia and generic x402.org facilitator endpoints, while the XRPL path uses the separate x402-xrpl package, XRPL-specific network identifiers, and a different facilitator. For an XRPL hackathon, following the generic starter path can produce a syntactically valid but wrong-chain prototype before the mismatch is obvious. An XRPL-first quickstart, install command, and runtime validation that rejects unsupported network and asset combinations would prevent this expensive integration detour.

##### 4. Package version pinning

The XRPL x402 documentation warns that the x402-xrpl package is early-stage and recommends pinning a specific version, but its quickstart installs x402-xrpl without a version pin and provides no tested lockfile or compatibility matrix. That makes a hackathon demo vulnerable to silent SDK changes and makes bug reports hard to reproduce. Publishing the exact tested package version, a lockfile, and a small protocol-compatibility table would materially improve reliability for builders.

##### 5. Network and asset validation

The XRPL x402 payer quickstart sets network_filter=None, meaning the client accepts any network declared by the server, while the same wallet guidance emphasizes explicit network checks and safe authorization. Because a 402 response supplies the payment terms that the client signs, the example should default to an explicit testnet network and asset allowlist, with a clear warning before accepting mainnet or unexpected terms. A fail-closed network and destination validation example would prevent a misconfigured or malicious paywall from steering an agent into an unintended payment path.

##### 6. Python version prerequisites

The XRPL agent documentation has conflicting Python prerequisites: the general Getting Started tutorial says Python 3.9+, while the XRPL x402 guide requires Python 3.11+. A builder following the first page can pass the stated prerequisite and still fail when installing or running the x402 path. The docs should declare one supported matrix per workflow and publish a tested requirements or lock file so environment failures are distinguishable from XRPL integration failures.

##### 7. TypeScript quickstart coverage

The XRPL x402 landing page advertises a TypeScript client, but the XRPL-specific implementation guide explicitly says it currently includes Python examples only. This leaves Node.js builders to infer the XRPL header, signing, receipt, and retry flow from a different ecosystem example. A minimal tested TypeScript quickstart using the XRPL package, with the exact network and facilitator configuration, would make the advertised client support real rather than discoverable only through reverse engineering.

##### 8. RLUSD trustlines and issuer onboarding

The XRPL x402 guide says x402-xrpl supports RLUSD for stable pricing, but the runnable quickstart demonstrates XRP only and does not show the required trustline creation, issuer verification, reserve impact, or the failure mode when the recipient cannot hold the issued currency. XRPL trustline tokens cannot be delivered without an appropriate trust line. A complete RLUSD example should provision and validate the trustline before signing, and explain how to surface tecPATH_DRY or issuer mistakes.

##### 9. SourceTag default mismatch

Agent attribution is inconsistent across the XRPL agent materials: the Agent Wallet and Payments skills use SourceTag 20260530, while the XRPL x402 quickstart defaults to 20260601. A builder combining the wallet skill with the x402 middleware can produce valid payments that split across attribution queries, making agent volume and audit trails incomplete. The ecosystem should publish one canonical tag policy or clearly define separate tags and their intended ownership.

##### 10. Payment retry and duplicate settlement

The XRPL x402 quickstart describes payment, facilitator receipt retrieval, and the HTTP retry as one automatic flow, but it does not explain the crash window where the on-ledger Payment succeeds and the client times out before receiving the receipt or final resource. A naive retry could submit a second payment for the same request, while abandoning the request loses a successful settlement. The client and merchant examples should show an invoice or idempotency key, hash-based reconciliation, and a safe retry-after-settlement procedure.

##### 11. Network identifier compatibility

The XRPL x402 guide uses xrpl:1 for Testnet and xrpl:0 for Mainnet, while the OpenWallet Standard reference uses the canonical CAIP-2 identifiers xrpl:testnet and xrpl:mainnet. A builder combining x402 payments with a policy-gated wallet can pass a valid-looking identifier that another layer rejects or interprets differently. Publishing one canonical mapping and a conversion helper would remove a subtle cross-tool integration failure.

##### 12. DestinationTag and X address support

The XRPL x402 quickstart models payTo as a plain classic address, but many hosted accounts require a DestinationTag and XRPL payments can fail when the destination account enforces one. The quickstart should explain whether x402 payment requirements can carry a destination tag or X-address, how the client validates it, and how a merchant advertises the requirement. Without that path, an agent can pay the right institution but still receive a validated failure such as tecDST_TAG_NEEDED.

##### 13. SourceTag ownership and attribution

The XRPL x402 payer example says the on-chain SourceTag is the value declared by the merchant, while the Agent Wallet guidance presents SourceTag as a way to attribute agent-generated activity. Those ownership models conflict: an untrusted paywall can choose the tag that appears in the payer’s transaction and distort agent or merchant analytics. The protocol should define whether the payer, merchant, or facilitator owns each attribution field and provide a tamper-resistant convention for both sides.

##### 14. Testnet reset recovery

The XRPL faucet documentation warns that testnet balances and ledger history may be reset, while the agentic-payment quickstart presents a wallet, payment, and explorer flow without a reset-aware test fixture or verification strategy. After a reset, saved addresses, transaction hashes, and trustline state can silently become invalid and make a demo look nondeterministic. A documented disposable-wallet bootstrap, network-health check, and reset-safe integration test would make agent demos much easier to reproduce.

##### 15. Endpoint transport and network identity

The XRPL agent materials use a WebSocket endpoint on port 51233 for the wallet flow and an HTTP JSON-RPC endpoint on port 51234 for the x402 payer, but do not explain why the transports and ports differ or how to health-check that they refer to the same network. A builder can copy the wrong endpoint into an otherwise correct payment flow and get opaque connection or ledger-state errors. The quickstarts should show a network-identity check and a small endpoint matrix for WebSocket, JSON-RPC, Testnet, and Mainnet.

## Part D. Mainnet controls detail

**Decision: GAP — Testnet demonstration only.** “Done” means implemented and
covered locally, never a mainnet approval. No live verification was performed
for this audit. Compliance items below are questions for qualified review, not
claims that a law applies or that a credential satisfies it.

| Status | Control | Evidence or next required work |
|---|---|---|
| done (local) | Budget-only authority, policy-only purchases, no premium bytes before grant | `server/purchases.ts`, `tests/purchase.test.ts`; preserve all five gates. |
| done (local) | One intent / one charge, persist-before-submit, reconciliation | `server/store.ts`, `server/xrpl.ts`, `tests/xrpl.test.ts`. |
| done (local) | Exact XRP amount, invoice binding and Testnet restriction | `shared/x402.ts`, `shared/xrpl.ts`, `publisher/facilitator.ts`. |
| gap | Key custody and signer policy | Replace development environment seeds with KMS/HSM or external signer; rotate keys, audit access and implement recovery. |
| gap | Price units: RLUSD vs XRP drops (#163) | SGD budget units retained; fixed demo 1 SGD = 1 test USD. Issuer/trust-line checks implemented on Testnet; mainnet FX and redemption remain open. |
| gap | Facilitator SLA and distributed operation | Define availability, latency, idempotency across instances, durable storage, incident ownership and fallback reconciliation. |
| partial | Reserves, fees and funding | #275 reads live base/owner reserve and checks trust-line balances, limits and incremental reserve before TrustSet. Production alerts, funding and refund liquidity remain open. |
| gap | Monitoring and operations | Alert on pending age, failed delivery after settlement, duplicate intents, balance/fee changes and refund refusal. Test failover and backup restore. |
| gap | Writer identity and compliance | Review writer onboarding, KYC, sanctions and whether Travel Rule obligations apply. Assess XRPL Credentials as an identity attestation mechanism; credentials alone are not a compliance decision. |
| done (local) | Operator audit trail and receipt export (#288) | Hash-chained `audit_log` in the same transaction as each spend decision, CSV/JSONL export, `npm run audit:verify [--testnet]`: [COMPLIANCE.md](COMPLIANCE.md). Not signed or externally timestamped; pin the head to catch truncation. |
| partial | Payee screening (#288) | Operator denylist checked before signing, fail-closed. It is an integration point, not a sanctions provider: a real screening service, KYB and aggregate monitoring remain open. |
| partial | Privacy and retention | `npm run data:prune` removes premium bodies, salts, events and question text and keeps receipts and the chain; questions stay off the ledger. Remaining: deletion requests, encryption at rest, mainnet retention periods, public Langfuse traces carry questions. |
| gap | Disputes and refunds | Cooperative refunds are built, enforceable settlement is not. Evaluate #261; document refusal, escalation and loss allocation. |
| gap | Independent security / production validation | Multi-process concurrency, external x402 interop, abuse/load testing and explicit network enablement review before mainnet. |

### 2026-11-10 — Hosted image qualification needs a running Docker daemon (observed local tooling)

HO's Docker CLI 28.0.1 was installed, but `docker info` refused the local daemon
socket, so image build/run acceptance could not proceed. Evidence:
[hosted ops local proof](evidence/hosted-ops/README.md). Workaround: production
Vite build plus native bundled API/publisher and nginx at OFFSET 1700, clearly
labelled partial paused-shell/fixture/simulated evidence while HG is pending.
Suggested tooling fix: add daemon availability to the orchestrator preflight and
run exact Linux images before public launch. Severity: low local tooling blocker;
mainnet impact: none observed, and native proof does not qualify container
persistence or a mainnet deployment. No cloud resource or live ledger call ran.

## 2026-11-10 — Hire royalties need funded recipient accounts (code-derived, W3)

- **Class / severity:** code-derived integration constraint · Medium; not a new observed ledger rejection. The normal Testnet provisioner intentionally skipped the two free-source accounts, but hire-v1 also pays citation royalties to free writers. A 2,500-drop first payment cannot create an unfunded XRPL account.
- **Evidence:** `publisher/publishing/testnet-funding.ts` previously excluded `open-records` and `grid-operators-report`; `server/hire/policy.ts` includes distinct cited free writers. W3's packed Testnet chains and hashes are in `docs/evidence/w3-hire/`.
- **Workaround:** hire mode explicitly funds free-source accounts and a separate client agent in the existing faucet-funded provisioning batch; normal `try` provisioning is unchanged.
- **Suggested fix:** x402 agent-to-agent royalty examples should preflight account existence/reserve before promising a small payout, and show durable retry handling.
- **Mainnet impact:** reserve/funding policy needs an operator decision before onboarding real royalty recipients. W3 is Testnet only, no real value; no mainnet attempt was made.

## 2026-11-10 — Anchor and royalties contend for one payer sequence (observed, W3)

- **Class / severity:** observed Testnet integration interruption · Medium. A packed hire run settled inbound, escrow, change and the first royalty, then delivery returned HTTP 500 while an answer anchor held the payer sequence; the second royalty remained unsigned. No duplicate payment was observed.
- **Evidence:** W3 development-attempt summary in `docs/evidence/w3-hire/README.md`; the subsequent successful packed runs retain all hashes there. The raw failed output and original signed journals are retained privately for reconciliation.
- **Workaround:** the background worker resumes the saved obligation; the CLI retries delivery with the same key and original signed inbound blob for up to 180 seconds. The payer still refuses new signing while a previous sequence is ambiguous.
- **Suggested fix:** agent-to-agent x402 examples should separate temporary response failure from payment failure and expose a durable delivery retry handle.
- **Mainnet impact:** the same sequencing/response distinction would matter for a real shared signer; no mainnet measurement or transaction was made. No timeout or safety threshold was loosened.

## 2026-11-11 — Large GitHub commit responses overflow local status capture (local tooling)

- **Class / severity:** internal tooling incident reported by GF; medium shipping blocker, not an XRPL or x402 defect.
- **Evidence:** `scripts/local-gate.test.mjs` exercises pending/success/failure publication with 2 MiB fixture commit responses and a 2 MiB Git blob; R #433. GF reported `spawnSync gh ENOBUFS` after busy-main merges exceeded the default capture buffer.
- **Workaround / fix:** use a 64 MiB buffer for every Git/GitHub capture in the local gate, including failure-status reporting. Requesting only needed SHA/tree fields is another bounded-output approach. Keep remote identity and source-race checks intact.
- **Suggested tooling improvement:** command wrappers should set explicit output limits and test large responses alongside exact-source status admission.
- **Mainnet impact:** none observed; the change affects local verification/status publication, not ledger signing, spending authority or payment execution.

## 11 November 2026: Testnet fallback reason was lost at the browser boundary (code-derived, UI)

- **Evidence:** `mcp/testnet.ts`, `server/routes.ts`, `tests/mcp-testnet.test.ts`, and `docs/evidence/ui-nov11/README.md`. The launcher labelled `faucet_unavailable` in its terminal output, but the browser received only simulated settlement labels. This is a code-derived UX failure mode; no new faucet outage was observed in this lane.
- **Workaround:** pass only an allowlisted reason class through engine environment and health metadata, then explain the simulated preview in environment details. No automatic spending or Testnet retry.
- **Suggested fix:** Starter Kit launchers should expose safe setup/fallback status to every UI alongside the rail label.
- **Severity / mainnet impact:** medium UX friction; no mainnet execution, no real funds. This change conveys status and does not establish mainnet readiness.

## 11 November 2026: public Testnet RPC tail latency from Singapore reached visitors (observed, hosted demo)

- **Evidence:** `docs/evidence/h6/README.md` (live sample of the hosted `/ready`, 30 requests, 04:18–04:21 UTC) and `docker/hosted/start.mjs`. HG's readiness refresh asks `wss://s.altnet.rippletest.net:51233` for `account_info` and `server_info` from asia-southeast1: about 0.38 s typically, 1.31 s once, and over 1.5 s once in 30. Our packaged guard waited on that refresh with a 1.5 s timeout on every request, so the uptime check and real visitors got the paused page. The latency is an observed Testnet property. The paused page was our design fault, fixed in H6.
- **Workaround / fix:** the guard qualifies HG once per Host and re-checks in the background, so no visitor request waits on a ledger round trip to be admitted. A slow ledger can no longer show the paused page.
- **Suggested fix:** the Starter Kit could document regional Testnet endpoints (or expected cross-region latency), and recommend that readiness or balance checks run off the request path with a cached last-known value.
- **Severity / mainnet impact:** medium availability friction on Testnet. On mainnet, use a nearby or owned rippled/Clio node and treat ledger reads as asynchronous health signals. No real funds; no ledger write involved.

## 12 November 2026: Node gzip differences hid a deploy bundle failure (observed local tooling)

- **Evidence:** `docs/evidence/deploy-fix/README.md`; main `039c497a` built files measure 170,326 bytes gzip on Node 22.23.4 versus 169,998 on Node 26.3.1. Main's successful local-gate receipt used Node 26; the Node 22 deploy failed the same <170,000-byte assertion before cloud mutation.
- **Workaround / fix:** lazy-load optional UI to reach 159,261 bytes on Node 22; share the manifest/gzip calculation between production builds and deploy performance checks, require Node 22, and preserve the existing threshold.
- **Suggested tooling improvement:** use the deploy toolchain for local admission and report runtime/compression versions alongside byte budgets.
- **Severity / mainnet impact:** medium shipping blocker in our tooling, not an XRPL or x402 defect. No ledger or mainnet impact was measured; no payment or cloud change occurred in this lane.

## 2026-11-12 · public feed cache policy through two proxies (code-derived tooling finding)

- Evidence: `docker/hosted/nginx.conf:20,39` and `docker/hosted/front/default.conf.template:13,79` at `43ced6a8`; feed contract and local tests in `docs/evidence/feed/FEED.md`.
- Finding: the general API locations inherit `Cache-Control: no-store`. An upstream public JSON response also carries that inherited policy; the existing stats route has exact-location overrides at both proxies.
- Workaround: the API feed is opt-in and correct locally. Before hosted activation, the R3-REACH owner must add exact feed locations that forward the API cache policy once, retain `no-store` for SSE, and keep buffering disabled. This lane does not own `docker/hosted/**`.
- Suggested fix: make public endpoint cache ownership explicit in the shared proxy configuration and test raw headers through both hops for JSON and SSE.
- Severity: low (cache efficiency; no spending or privacy gate bypass). Mainnet impact: none established; this is hosting configuration, not an XRPL incident. No transactions or upstream issues were filed.

## 2026-11-12 — Settlement observation overhead (code-derived and observed local Testnet)

- **Evidence:** `server/xrpl.ts` polls validated-ledger plus transaction status every second; `server/escrow.ts` then fetches the validated create again and polls the writer finish separately. `docs/evidence/speed/SPEED.md` records 30/30 verified local Testnet purchases: quote-to-unlock p50 14.065 s / p90 17.411 s; create-submit-to-validation p50 5.668 s / p90 5.935 s and finish-submit-to-validation p50 4.302 s / p90 7.214 s. All 60 purchase hashes are in `before.json`; example create `53DA9A51A691AA29D45B1C9E1E2AC9244C27289995A07B5DA276019C1C9479E0`, finish `887B98F98F466849110EFEE7B5ACC66D523F4B2EF8BA007EC96806117DDB9828`.
- **Workaround:** add opt-in, hash-chained phase observations (`SETTLEMENT_TIMING=1`) and measure before changing waits. Writer observations are explicitly writer-reported; elapsed wall time is not a consensus timestamp.
- **Suggested fix:** XRPL/x402 examples should subscribe before submission, retain the validated transaction metadata and preserve LastLedgerSequence/account-sequence expiry proof during fallback.
- **Severity / mainnet impact:** medium visible latency and RPC overhead. Code-derived, with Testnet measurements reported separately; no mainnet execution or latency claim.

## 2026-11-12 — Validated streams reduce local settlement tail (observed Testnet; adversarial cases synthetic)

- **Evidence:** `docs/evidence/speed/SPEED.md`, `before.json` and `after.json` retain 30 before + 30 after purchases and all 120 create/finish hashes. Quote-to-verified-unlock p50 14.065 → 13.302 s; p90 17.411 → 14.684 s. After example create `767A379B775A4482C2F0E0883B09D55D4C0F3CA3AB7767248C42E2E9EE89FA59`, finish `22DDA48ED8B80F200EAF740FF9C1C77363B536766C1CC344D5137939551E1943`. All 60 offline receipts passed. One successful subscription, no subscription failures and 178 cache hits across the final after batch; no live disconnect observed. An earlier optimized batch is retained separately as `after-initial.json`; the final 30 were rerun after scoping transaction wakeups to the matching hash. All 90 receipts across the three batches passed.
- **Workaround:** opt-in `XRPL_STREAM_WAITS=1` retains validated metadata, wakes on ledger/transaction activity and polls on disconnect/refusal. A bounded watchdog handles silence. Writer finish metadata is reused instead of fetched again. Fake-ledger tests cover duplicates, out-of-order/proposed events, missed events, disconnect/refusal and LastLedgerSequence/sequence proof.
- **Suggested fix:** x402/XRPL starter examples should subscribe before submitting, retain metadata and clearly separate local observations from ledger-certified facts. A validated ledger event can precede the matching transaction event; readers must handle that race (tested synthetically here, not claimed as a live incident).
- **Severity / mainnet impact:** medium regional Testnet latency/RPC friction. Finish validation median did not improve (4.302 → 4.721 s); its tail did (7.214 → 6.053 s). Create validation p90 rose 5.935 → 6.221 s. This local fixture-content comparison does not establish hosted or mainnet speed. No mainnet transaction, production-cap change or relaxed gate.

## 2026-11-12 — local build outputs race during the full gate (observed)

- Evidence: content gate at `c074461afa56066445483eb850c535ff5bd825ff`; receipt `1794474650280-27304-f5d75ed4-a9e7-4193-a90d-58471695dcee.json`; `docs/evidence/content/CONTENT.md`. Hosted startup lost `dist/.vite/manifest.json` while desktop staging rebuilt the same directory. No transaction: local verification only.
- Workaround: make desktop staging depend on completion of the hosted browser suite. Suggested fix: give independently scheduled build consumers separate output directories, or encode every shared-output dependency.
- Severity: Medium tooling friction. Mainnet impact: no ledger incident; this blocks reliable release admission and does not establish mainnet readiness.

## 12 November 2026: crash between x402 reservation and manifest persistence lost the delivery proof (observed local fixture)

- **Evidence:** `tests/proof/recovery.test.ts`, `docs/evidence/proof/PROOF-REPORT.md`; the real PurchaseManager/Store plus HTTP publisher reproduced `CLAIM_FAILED` after a crash immediately following a committed reservation, although the article was honest. No Testnet transaction; this is our integration bug, not an observed upstream defect.
- **Workaround / fix:** before signing a resumed RESERVED intent, recover the candidate's verified manifest only after quote/price/payee/signature binding passes. The manifest remains write-once; retries retain the same signed payment.
- **Suggested fix:** x402 integration examples should persist the evaluated proof binding with the reservation, or explicitly recover it before signing; include a crash test between those operations.
- **Severity / mainnet impact:** medium delivery/recovery bug. Without this repair the analogous crash could charge for content that stays quarantined; no leak or duplicate charge was observed, and mainnet was not exercised.

## 2026-11-12 — Shared writer sequence contention in the 20-purchase pilot (observed)

- Evidence: `data/evidence/testnet-1000/pilot-verify.json` independently re-fetched 20/20 successful pairs, zero mismatches. The longest purchase took 88.989 s end to end: create `E1E3379483D7EDABE41AB55F83A02D04726D89C5D9F61E50C9BCEF5FAD054605`, finish `4FD8D97BA8F4FE6A02DEC2302C0902154A7BB179B9973F3572F7145A4F8F1F27`. Pilot create p99 was 7.587 s and finish p99 7.990 s (local submit-to-first-validated-read observations). The shared signer and its sequence/reconciliation queue are the likely source (inference from code and run configuration); queue wait was not separately instrumented. This is not evidence of an 89 s ledger settlement or a public-node rate-limit incident.
- Workaround: independent local publisher journals and writer wallets for the scale batch; at most eight purchases and eight RPC requests in flight. The same team-authored resource is served on each isolated publisher; these wallets are not independent writers.
- Suggested fix: document how account sequence queues affect multi-buyer throughput, expose queue wait separately from ledger validation, and add a multiple-buyer/single-writer load example.
- Severity: Medium for throughput and tail latency. Mainnet impact: analogous account sequencing constraints; no mainnet load measured. No Testnet faucet or node errors had been observed in the completed pilot.


## 2026-11-12 — Fresh scale-runner funding allocation (code-derived, then live acceptance)

- Evidence: the original runner combined 90 XRP of helper allocations with 98 XRP of planned payer top-ups from a 100-XRP grant. The offline funding regression reproduces that shortfall; no failed live funding transaction is claimed. The earlier 1,000 run had staged pilot funding. The final fresh bootstrap independently verifies 20/20 purchases in `data/evidence/testnet-1000/fresh-pilot-verify.json`: create `C06F0C74CA725AAB27A7B9C9082D476E6544B38B039569FCE1E423E80286AF60`, finish `33F56BD6118E98F14A3070607DB21C77B42E95EF44DD431632771920B1D2E246`. Setup hashes are in `fresh-funding.json` alongside that result.
- Workaround: return 4.2 XRP from one funded writer to the buyer, then top up each other payer by 1 XRP. All eight payers retain enough principal, reserves and maximum capped fees for up to 1,100 purchases of this 40-minor resource; writer fee reserves remain funded. Persist the funding-complete checkpoint so a resume does not request an unnecessary faucet refill.
- Suggested fix: expose a helper's planned allocation and remaining buyer balance before signing fleet top-ups. This was an integration error in our scale tooling, not an observed faucet or XRPL node defect.
- Severity: Medium for reproducibility. Mainnet impact: the same allocation arithmetic needs checking for any wallet fleet; no mainnet funding or payment was attempted.
## 12 November 2026: local model packaging qualified after Docker recovery (observed tooling)

- **Evidence:** `docs/evidence/models/container.json` and `MODELS.md`; prior WIP `707d74b0` records ENOSPC and unresponsive Docker. After the orchestrator enlarged Docker to a 64 GB disk / 4 CPUs / 4 GB RAM and pruned build cache, both opt-in hosted model targets built and a network-disabled API container embedded a query.
- **Workaround:** Debian/glibc model targets with a bounded CPU dependency closure and pinned build-time model acquisition. Existing Alpine targets remain available. Builder cache was pruned afterwards; images and volumes were retained.
- **Suggested fix:** document minimal glibc/CPU ONNX distributions and bounded Docker diagnostics/recovery after disk exhaustion.
- **Severity / mainnet impact:** medium local packaging friction resolved for this build; no XRPL transaction, cloud deployment or mainnet effect.


## 12 November 2026: retained eval snapshots entered ESLint discovery (observed tooling)

- **Evidence:** embedding qualification head `a637e567`; ignored `scratch/pr-a-first-check-fast.log` reported 1,444 errors because the retained `scratch/r3-live-tree` source snapshot introduced a second ESLint/TypeScript root. This stopped `check:fast` before typecheck or unit tests.
- **Workaround:** preserve the old snapshot and scratch source files outside the checkout's lint root; the local retention path is recorded in `scratch/retained-source-location.txt`. Re-running the unchanged `npm run lint` passes with zero errors (15 existing warnings).
- **Suggested fix:** document that source snapshots belong outside the source lint root, or explicitly define the intended TypeScript config root for local tooling.
- **Severity / mainnet impact:** low local gate setup friction; no lint rule, test, threshold, production behavior or ledger operation changed.


## 12 November 2026: browser publishing requires an address-bound signer (code-derived)

- **Evidence:** `publisher/publishing/web.ts`, `shared/manifest.ts`, and `docs/evidence/publish/PUBLISH.md`; the scripted Testnet first sale finishes in transaction `505FD24BFDCF4C9402701E1C1B1114D5D0BA3702095D6A73FA99A1D4A3125347`.
- **Finding / severity:** medium integration friction. A pasted payout address alone cannot sign a wallet-bound manifest or finish its key-reveal escrow. This is derived from the contract, not an observed wallet compromise.
- **Workaround:** create and fund a custodial Testnet account, or use an operator-held matching signer. Browser inputs reject seeds. Faucet calls now have a 30-second local deadline; no faucet outage was observed.
- **Suggested fix:** provide a wallet-signing publishing example that separately proves address ownership and signs manifests without exposing a seed to a web form.
- **Mainnet impact:** a real deployment needs a noncustodial wallet integration and appropriate key custody; this Testnet flow establishes neither mainnet custody nor compliance.
## 2026-11-12 — public ledger analytics needs complete scans (observed)

- Evidence: `docs/evidence/content/CONTENT.md`, `rlusd-snapshot.json`, `ledger-analytics-sample.json`, `testnet-purchase.json`. RLUSD issuer pagination required 259 public reads and 135.574 seconds. A shorter 131-read probe was incomplete. Three filtered `ledger_data` pages returned no Escrow objects while still carrying a marker; they cannot establish a zero global escrow total. One later read returned JSON-RPC `tooBusy` over HTTP 200.
- Workaround: fixed-ledger pagination, exact decimal aggregation, four-minute scan cap, background prewarming/periodic refresh, signed per-topic freshness (RLUSD K=256, AMM/project accounts K=64), withdrawal of expired snapshots, quarantine/refund on stale or unverifiable delivery, and backoff for both HTTP and RPC overload. Global escrow reports are disabled pending a complete measured scan. Never sell partial totals or wait for a scan in search. Suggested fix: a documented ledger-bound aggregate endpoint or indexed filtered pagination with completeness proofs.
- Severity: Medium for on-demand analytics. Mainnet impact: observed read latency/overload only; no Mainnet writes. A live S$0.40 Testnet report purchase verified at `46D61B480AC861E5F35C5604510BFC9D1A7FA45D9287E1F6DA1AFAF4F3EDB4F4`; same-intent retry retained one receipt.

## 2026-11-12 — Vite port zero selects a fixed port (observed tooling)

- Evidence: `docs/evidence/content/CONTENT.md`, `.devcontainer/start.ts` and `tests/codespaces.test.ts`. The clean integration fast check at `8db4ca2d3615667473819be29056d1d17ebd93e5` failed only on `Port 5173 is already in use`; an isolated regression assertion confirmed that `webPort: 0` bound 5173 rather than an ephemeral port.
- Workaround: bind Vite's public HTTP server to OS-assigned port zero for that fixture, retain exact host/origin checks, and close Vite if startup fails. Suggested fix: document and support port zero consistently in Vite's public listen API.
- Severity: Low tooling friction, with intermittent parallel-suite failures. Mainnet impact: none; fixture-only startup, no ledger transaction, disabled check or changed timeout.

## 2026-11-12 — replay receipt dismissal blocked an accessibility check (observed tooling)

- Evidence: content full-gate receipt `1794485991609-26693-29efce53-0b1d-4cca-b975-a3e5e1fc72dc.json` at `35727b70aa8ae2dcc4c7f56025e6162b75aeef2d`; 19/20 checks passed. The desktop replay accessibility test sent a global Escape, then its citation click was intercepted by the still-open receipt dialog. No ledger transaction.
- Workaround: wait for the complete lazy-loaded receipt, send Escape to that dialog and assert dismissal before the next interaction. Suggested fix: browser examples should synchronize modal readiness and closure explicitly around accessibility tooling. The standalone rerun also reproduced the previously documented lint discovery of copied source under `scratch/`; its generated Pages tree was retained outside the checkout rather than excluding checks.
- Severity: Low tooling friction. Mainnet impact: none; existing accessibility, keyboard and timeout assertions are retained.


## 2026-11-12 — failed exact payments surface as receipt mismatch (observed offline)

- **Evidence:** `tests/reach-paid.test.ts`, failed-inbound reconciliation case:
  the synthetic ledger returns `tecUNFUNDED_PAYMENT`; HTTP is 402 with a failed
  `PAYMENT-RESPONSE`, while the existing TypeScript payer reports
  `x402 settlement receipt mismatch; reuse this intent`. No real transaction
  was sent in this test. Hosted terminal-hold reconciliation is fixed here.
- **Workaround:** keep the original signed journal and request key; inspect the
  HTTP failure and reconcile the original ledger hash before retrying. Never
  sign a replacement because the error text is generic.
- **Suggested fix:** retain a safe facilitator reason and HTTP status in the SDK
  error for failed settlement responses, separately from mismatched successful
  receipts. Keep original-intent recovery authority unchanged.
- **Severity / mainnet impact:** low diagnostic friction; the failure reason is
  obscured, while retry safety is retained. The same SDK error path could affect
  mainnet diagnostics, but this observation is synthetic and mainnet was not
  written or tested.
## 2026-11-12 — paid-site leak audit exceeded its unit timeout (observed tooling)

- Evidence: real-profile head `47536f0cf6101a669c86840b0d48f2fc29b31707`; full-gate receipt `1794488629187-62523-9a437b23-2211-4761-a0a9-d37482b6e6fd.json`. The paid-site HTML leak audit exceeded 30 seconds; the same head passed 3,233 fast tests with four existing skips. The cause is not established. No ledger transaction.
- Workaround: retain the failure and rerun verification with the existing timeout and leak threshold. Suggested fix: retain per-audit timing and host-load measurements so failures can be classified from evidence.
- Severity: Low tooling friction. Mainnet impact: none; no leak was demonstrated and no assertion, check or threshold is removed.

## 2026-11-12 — Upstream reverification: pinned Batch SDK mismatch, rollback reconciliation and RLUSD issuer policy

- **Observed / evidence:** `docs/feedback/upstream/r3/README.md` packages five unfiled items. The pinned xrpl.js 4.7.0/codec 2.11.0 pair reproduces `No field account`; upstream already fixed Batch V1_1 in XRPLF/xrpl.js#3371, so no duplicate patch is proposed. Read-only lookup of Testnet Batch `7C162D61DE09381ED8B36E6DD25898D0E19AD728D75A894564D7F323B2955857` reconfirms outer tesSUCCESS and both uncommitted inner hashes returning txnNotFound. Spike D flags are independently reconfirmed: both RLUSD issuers have Flags 2174353408, locking off, despite TokenEscrow being enabled.
- **Workaround:** use the spike's explicit version-compatible Batch payload, reconcile committed inner transactions only with complete-ledger coverage, and retain exact RLUSD Payment or the labelled TEST-SGD escrow control. No new ledger submission by this lane.
- **Suggested fix:** upgrade/backport the product's pinned Batch helper in its owning lane; clarify missing inner metadata in docs; ask Ripple for a documented per-network RLUSD escrow policy. Delegation fee docs and generic issuer-opt-in docs already cover their requested rules and were dropped from filing.
- **Severity / mainnet impact:** medium SDK/receipt-integration friction; high constraint for RLUSD escrow. Mainnet issuer flags were read only; no Mainnet signing, transaction or operational acceptance. No upstream issue, fork, PR, comment or support message was posted; owner approval remains #265 A11.
## 12 November 2026: public-docs archive acquisition exceeds the buffer limit (observed tooling)

- **Evidence:** ignored `scratch/public-docs-build.log` shows `spawnSync gh ENOBUFS` when the merged builder captures the pinned XRPL documentation tarball with a 128 MB `execFileSync` buffer. `scratch/public-docs-streamed-build.log` records the successful workaround; the rebuilt index exactly matches committed SHA-256 `f0ec75b8ea5426d6c25fd40415d2d673dc6b00599082e891cfa67419cee15383` (12,104 passages / 1,136 chunks).
- **Workaround:** stream authenticated `gh api` tarball output directly into temporary files, extract outside the checkout, then use the existing `PUBLIC_DOCS_ARCHIVES_DIR` option. Temporary archives were deleted after the verified rebuild. CONTENT-owned source and manifest remain unchanged.
- **Suggested fix:** stream tarball bytes to disk in the builder rather than collecting an entire upstream repository archive in a bounded Node buffer.
- **Severity / mainnet impact:** medium local build/evaluation setup blocker, worked around; no model calls, XRPL transactions or mainnet writes.

## 12 November 2026: two-slot heavy queue can bypass its first pending ticket (observed wait; code-derived fairness failure)

- **Evidence:** `scratch/heavy-lock-fairness.json` pins the shared wrapper hash, pending ticket order, holder process start times and observation time. This lane remained queued after becoming first pending while other holders changed. The wrapper admits both tickets where `position < SLOTS`; with one free slot, the later eligible ticket can win its 15-second polling race. The entire wait is not attributed to this race; active verification also held the slots.
- **Workaround:** preserve the original ticket and the two-slot limit. After repeated bypasses, wake only this lane's oldest queued waiter at two-second intervals to recheck admission; no other lane's process, shared wrapper, lock, slot count or gate is changed.
- **Suggested fix:** reserve a free slot for the earliest pending ticket, or let only the front ticket claim any free slot before removing its ticket.
- **Severity / mainnet impact:** medium local verification throughput issue; no model spend, XRPL transaction, policy change or mainnet impact.


## 2026-11-12 — key-reveal scheme needs a dedicated payer adapter (observed offline)

- **Evidence:** `node --test examples/x402-key-reveal-escrow/example.test.mjs`
  passes 2 offline tests (1 Testnet test skipped). Pinned `x402-xrpl@0.3.4`
  preserves the custom `key-reveal-escrow` fields through its v2 header codec,
  while `XRPLPresignedPaymentPayer.supports()` returns false for that scheme.
  The new reference packages and real Testnet hashes are in
  `docs/evidence/reach/REACH.md`.
- **Workaround:** use a dedicated policy-bound EscrowCreate buyer and verify the
  validated finish/key/ciphertext. The isolated Python HTTP buyer interoperates
  with the locally installed Hono seller; exact-payment SDK hire remains a
  separate endpoint, with no silent scheme substitution.
- **Suggested fix:** publish a custom-scheme adapter interface and conformance
  vectors covering challenge commitments, pending/failed reveal, same-blob
  recovery and explicit expiry cancellation. The proposal under `docs/upstream/`
  is a draft only, not filed or adopted.
- **Severity / mainnet impact:** medium interoperability gap. The same scheme
  negotiation issue would affect other networks, but mainnet was not written
  or tested; current packages deliberately support XRPL Testnet only.


## 2026-11-12 — inline ciphertext expands the payment-required header (code-derived)

- **Evidence:** `packages/seller-core/index.mjs` and
  `packages/seller-fastapi/src/researchagent_seller_fastapi/__init__.py` preserve
  the example's complete ciphertext envelope in both 402 JSON and the base64
  `PAYMENT-REQUIRED` header. Hex and base64 expand each plaintext byte to roughly
  8/3 header bytes before fixed metadata. This is a code-derived transport limit,
  not a recorded Testnet outage; the acceptance payload is a short fixture.
- **Workaround:** bound content and qualify the server, intermediary and buyer
  response-header limits before exposing long articles. Existing packages keep
  the scheme name and fields unchanged; they do not silently drop the envelope.
- **Suggested fix:** define an explicitly negotiated body-only or
  content-addressed ciphertext extension while retaining the complete challenge
  commitment and verifying content before release. Add large-payload
  interoperability vectors across common HTTP stacks.
- **Severity / mainnet impact:** medium interoperability limit for large content.
  It is independent of ledger network and could affect mainnet transport too;
  mainnet was not written or tested. No large-article transport success is claimed.


## 2026-11-12 — uncertain finishes need exclusive wallet sequence ownership (observed synthetic)

- **Evidence:** the Node core pending-wallet regression and the typed FastAPI
  restart regression first reproduced two autofills/submissions for different
  invoices while the first finish outcome was unresolved. Both use synthetic
  clients; no public-node collision or mainnet transaction is claimed.
- **Workaround:** implemented in both seller cores: a persisted unfinished
  signature prevents another invoice from allocating a finish signature. Retry
  and reconcile the original invoice/blob; do not replace it after a timeout.
- **Suggested fix:** escrow seller templates and SDK sequence allocators should
  preserve an exclusive lease through uncertain submission, expose a recovery
  operation and include interleaved-invoice timeout conformance cases.
- **Severity / mainnet impact:** medium recovery/availability risk. A lagging
  sequence allocator could replace a pending finish, while a fulfillment may
  already be public. The risk is ledger-independent; this observation is
  synthetic, and mainnet was not written or tested.


## 2026-11-12 — existing escrow does not imply finish headroom (observed synthetic)

- **Evidence:** near-expiry Node core and typed FastAPI regressions first reached
  autofill with one second remaining on a still-existing validated escrow.
  No real key or transaction was submitted by those synthetic tests.
  The current package Testnet purchases are recorded in
  `docs/evidence/reach/REACH.md` and pass after the fix.
- **Workaround:** check validated ledger close time before and after autofill;
  refuse a new finish unless more than eight seconds remain. Retain the original
  signed finish on uncertain recovery; never sign a replacement. This bound
  reduces stale revelation but cannot guarantee validation before expiry.
- **Suggested fix:** include explicit finish-headroom and expiry-race vectors in
  scheme adapters and documentation. A live escrow entry alone is insufficient.
  [EscrowFinish rules](https://xrpl.org/docs/references/protocol/transactions/types/escrowfinish)
  reject settlement once the escrow has expired.
- **Severity / mainnet impact:** medium confidentiality/atomicity risk for late
  reveals; the ledger does not hide a signed fulfillment that fails settlement.
  The same failure mode could affect mainnet, but this regression is synthetic
  and mainnet was not written or tested.

## 2026-11-12 — A buyer holdback needs three reserved sequences and two inner-result checks (observed Testnet; crash cases synthetic)

- **Evidence:** `docs/evidence/money/HOLDBACK.md`, `holdback-transactions.json`, `tests/holdback.test.ts`. First real product Batch `6D6730D6EF2C1501E6FA419353D2BAF5BC9F30189F21D1EA68D83505CF1500AD`; buyer holdback finish `488F8B4EDE3C879CAB4191F907EB4BE404CD48FD22DF585F94A01E6679CFD197`. The prior money spike observed outer `tesSUCCESS` with rolled-back inner creates; this lane reproduces that adversarial shape on a fake ledger.
- **Workaround:** reserve outer Sequence and both inner Sequences durably before signing, retain the exact Batch across crashes, and read both validated inner transactions plus both escrow objects at the creation ledger. `ParentBatchID` is in inner metadata, not `tx_json`. Single-account signing works without the spike's multi-account SDK workaround. Buyer policy keeps the holdback fulfillment private until release; failure uses buyer `EscrowCancel` after the deadline.
- **Suggested fix:** make single-account Batch examples persist sequence reservations before signing and explicitly demonstrate outer-success/inner-rollback handling. Return an application-level success helper that checks inner results and expected ledger objects.
- **Severity / mainnet impact:** high payment-integrity risk if wrapper success is mistaken for settlement or a retry allocates new principal. This is Testnet implementation evidence plus synthetic crash coverage, not a mainnet run. The non-cooperative refund covers the holdback only; the key-release portion and fees remain paid.


## 2026-11-12 — A two-escrow IOU Batch exceeds the x402 payment-header cap with duplicate full-quote memos (observed local fixture)

- **Evidence:** `tests/holdback.test.ts` reproduces `PAYMENT-SIGNATURE header exceeds 8192 bytes` through the real buyer/publisher HTTP path with a fake IOU ledger. The original full-quote XRP Testnet trials fit; this is not an observed issued-token Testnet failure.
- **Workaround:** new holdback creates carry the SHA-256 commitment to the canonical signed quote in each memo, while receipts and the create audit entry retain the signed terms. The verifier also accepts the original exact full-quote memos from the initial Testnet trial. The 8 KiB header cap and 1 KiB memo limit are unchanged.
- **Suggested fix:** document serialized header-size budgets for Batch examples, including base64 and issued-asset metadata, and use quote commitments rather than repeating the entire quote inside each inner transaction.
- **Severity / mainnet impact:** medium interoperability failure. A Batch could lock principal before the client discovers its signature cannot fit the delivery header. Compact commitments fix that shape locally; no mainnet or official-RLUSD settlement is claimed.

## 2026-11-12 — Corpus and paid-site audits time out in a clean-head gate (observed tooling)

- **Evidence:** clean holdback head `f714e18115bf84dee5d83fbd66b483e355d706f8`; local-gate receipt `1794494374334-1512-a6879b4b-631d-4925-9979-8fd2bb3c1c8e.json`. Two `tests/corpus-v2.test.ts` cases exceeded 5 seconds and `tests/site-leak.test.ts` exceeded 30 seconds. The same head passed `check:fast` (3,279 tests, four skips); an unchanged targeted rerun passed all nine tests in 21.85 seconds. No ledger transaction was involved.
- **Workaround:** retain the failed receipt, rerun the affected files with the original limits, then require a fresh full gate. Shared-host contention is a possible cause; it is not established from these timings alone. No test, leak threshold or timeout was changed.
- **Suggested fix:** retain per-audit elapsed time and host-load data alongside the gate receipt, and give CPU-sensitive corpus/site audits an exclusive execution phase.
- **Severity / mainnet impact:** low local verification friction; no content leak was observed and no mainnet operation was run. A timeout remains a failing gate until verification passes.

### 2026-11-12 — money spikes: delegation and Batch SDK (observed)

- **Delegation works, including revocation (informational).** Evidence: `docs/evidence/money/a.json`, delegated EscrowCreate `3CA31F98B5137ED91ADAE2E4AD01DDE0841FC4911430B74042359492E0504015`, revoke `B376A2CBBD7BEED9004195B954A7D56D2300D7C07961381A2F18B96F96FB9E60`. Fee 12 drops comes from delegate; 100,000 principal from visitor. Payment and post-revoke create return `terNO_DELEGATE_PERMISSION` without validation. Workaround: none. Suggested fix: document fee payer and explicit negative probes beside the delegate example. Mainnet impact: permission scope must remain enforced by policy; no Mainnet write tested.
- **Outer Batch success does not prove inner settlement (medium).** Evidence: `docs/evidence/money/b-initial.json`, failed-inner batch `3C7E2C363AE54D3BAE9AA834B3AFAEA032D4F28165023D0C7A8A46B5B0F76DC8` returns outer `tesSUCCESS` while escrow count stays at two. Workaround: inspect objects and inner results. Suggested fix: a prominent warning in Batch settlement examples. Mainnet impact: false settlement if an integrator checks only outer status; not measured on Mainnet.
- **Pinned xrpl.js multi-account Batch signing fails locally (high integration blocker).** Evidence: `scripts/spikes/b-batch.mjs`, xrpl 4.7.0 `signMultiBatch` -> `No field account` before submission, resolved ripple-binary-codec 2.11.0 requires Batch V1_1 account/sequence fields. Workaround being tested: encode full V1_1 payload via xrpl exports. Suggested fix: update signMultiBatch with outer account, sequence and batch signer account and add an integration vector against the resolved codec. Mainnet impact: same client-side failure; no Mainnet transaction sent.
- **Official RLUSD locking is still off on both networks (high).** Evidence: `docs/evidence/money/d.json`; Ripple-documented Mainnet issuer `rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De` ledger 108278852 and Testnet issuer `rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV` ledger 22263716, Flags 2174353408 (`0x819a0000`), locking bit `0x40000000` absent. `feature` reports TokenEscrow enabled on both. Workaround: labelled SGT stand-in or exact RLUSD Payment. Suggested fix for Ripple: publish issuer opt-in policy and dated network-and-issuer readiness. Mainnet impact: token escrow unavailable for official RLUSD at the observed issuer settings; read-only evidence.
- **Batch V1_1 signing workaround validated (observed, informational follow-up).** Evidence: `docs/evidence/money/b.json`; parent `91650D3BC2F04BFC18C2F9429D29FF81E3781FAA6FA8707CDE335D1F8B6EBAF7`, inner create `91F0B5660AAD9E4B4600C4C1FB79A450FF98D11C62C95C036C2F58610B00CBDF` and writer finish `A2839CF6B29A8E4BF77D52350BE3B45294B00BA621490217C91F2CED9C585277` both `tesSUCCESS` in ledger 22263740. Workaround: supply outer account/sequence and batchAccount to the codec; freeze buyer inner sequence and writer OfferSequence before writer signs. Suggested fix: publish a create-then-finish multi-account escrow example. One measurement: 6,242 ms / 2 ledger advances versus 14,202 ms / 4 normally, including client polling. Mainnet impact: protocol opportunity only; untested there, and fulfillment publication still needs application delivery safeguards.
- **TEST-SGD key-reveal credit works end to end (observed, informational).** Evidence: `docs/evidence/money/c.json` and `c-receipt.json`; create `8600167DCF721AA3FB80318D0268DE6754E82116EACA4F51592A5CC1D054B1E6`, finish `950451C760C37F21158C423D6D62E1E7C932711A01D8B7B76791D59FC13803EE`. Real HTTP product path reaches VERIFIED/RELEASED only after `verifyEscrowCredit` checks the writer's SGT RippleState delta. Workaround for official RLUSD remains a labelled custom issuer with `asfAllowTrustLineLocking` (17, not clawback 16). Suggested fix: docs should pair named flag constants with a post-setup flag assertion and exact recipient-delta example. Severity: informational; mainnet impact: no mainnet delivery or issuer-permission evidence implied.

## 2026-11-12 — Recorded-strip request audit raced Home arrival (observed tooling; cause inferred from code)

- **Evidence:** clean spike head `fd7c00fce24ced8e716d52ac828ddd4ddf30c8cd`, full-gate receipt `1794493358178-90304-0cbeddc0-9c00-4f12-8fb4-80bca1d8109c.json`: 18 steps passed, hosted browser failed, dependent desktop staging skipped. The strip audit captured one `GET /api/runs`; no spending request was reported. Its arrival counter was cleared after the allowance label appeared, while Home's separate history effect could still start. This timing explanation is code-derived, not a traced causal attribution to a strip action.
- **Workaround:** await the initial history response before clearing arrival traffic and exercising the strip. The zero-new-app-request assertion, quota assertion and all thresholds remain unchanged; the failed receipt is retained and the full gate is rerun.
- **Suggested fix:** synchronize request-audit windows with their explicit initialization requests rather than an unrelated visible label.
- **Severity / mainnet impact:** low browser-test reliability friction; no XRPL submission, Mainnet write, observed charge or changed product behavior.

### 12 Nov 2026 — Fresh credential enforcement and operator key rotation

- **Classification:** observed Testnet credential lifecycle and key rotation; code-derived advisory-cache enforcement boundary.
- **Evidence:** `docs/evidence/publish/regulated-testnet.json`; CredentialAccept `2A947326D8C1D7FDED6BF6B5D22456119B43FE85190C7173EC4AFE7F64ACCF46`, CredentialDelete `A95E68514312E8EB279C9B5595543DFA852765BB773D80321A176361E0EB2844`, rotations `AE3B3258DEFFBB1BE8FA211603AE105F335F29CC1FF578A82D187A288E2B3C55` and `8296784FA04D8DFECED1962DB97614E801F9AB331EA795958A1FF6F229F23918`; superseded regular-key attempt returned `tefBAD_AUTH`.
- **Workaround:** payment enforcement bypasses advisory/stale credential observations and pins domain and credential reads to one fresh validated ledger. Rotation persists the replacement key before signing and retains the master recovery key.
- **Suggested fix:** Starter Kit examples should distinguish display caching from payment authorization and show regular-key signing with an explicit original master address, including stale-key refusal and uncertain-outcome recovery.
- **Severity:** medium integration/documentation friction. **Mainnet impact:** not qualified; only fresh Testnet accounts were used. Existing payer/publisher seed-derived identities need separate regular-key runtime integration before promoting this runbook to live custody.


### 12 Nov 2026 — Compiled sanctions artifact omitted by desktop staging

- **Classification:** observed local build failure; no ledger transaction.
- **Evidence:** full-gate receipt `1794491068550-22819-db19e043-fb2d-4673-ac47-140855381fa7.json`, desktop-build stage; a focused production-transform probe reproduced `ERR_MODULE_NOT_FOUND` for `ofac-xrp.json`.
- **Workaround:** the authenticated build emits JSON plus an identical TypeScript projection; runtime imports the projection and retains schema/hash validation. Tests require artifact parity. No desktop packager change or gate threshold change.
- **Suggested fix:** compilation/staging tooling should enumerate imported non-code assets or report the worker import cause rather than only “Engine boot failed”.
- **Severity:** medium packaging friction. **Mainnet impact:** none observed; this failed before engine startup, with no transaction or real funds.

- 12 Nov 2026 · observed local tooling: pinned XRPL docs acquisition exceeded the 128 MiB child-process stdout buffer (`gh ENOBUFS`, 134,266,880 bytes), before any model call or cloud mutation. Evidence: DEPLOY-9 `corpus-build.log`, source `9bd8c80a`. Workaround/fix: stream authenticated gh output directly to a private archive file, then extract. Suggested upstream tooling practice: stream large pinned archive downloads rather than buffer them. Severity P2; no mainnet payment impact.

## 12 November 2026: signed analytics reports conflict with global key-reveal selection (observed integration)

- **Evidence:** DEPLOY-9 local preset 2 found the prewarmed RLUSD report but skipped all three policy-selected attempts: `Writer escrow unavailable; no paid fallback`. The writer intentionally offers exact x402 payments, while the buyer selected escrow for every writer under key-reveal mode. Two gates correctly remained Not checked; hosted was untouched.
- **Fix:** opted-in ledger-analytics candidates with signed freshness metadata use their existing exact-payment path. Team notes retain key-reveal escrow and unsupported writers still fail closed. Existing budget, idempotency, delivery and freshness checks remain intact.
- **Verification:** the existing ledger purchase suite with key-reveal mode reproduces four failures, then passes unchanged assertions after the fix; the zero-budget cases still skip. Full local qualification and gate follow before promotion.
- **Severity / mainnet impact:** medium opt-in integration blocker; no Mainnet write or real-money payment.

## 12 November 2026: private umask made generated public Docker inputs unreadable

- **Evidence:** DEPLOY-9 permission regression reproduced an output directory lacking group/other traversal under umask 077, with existing output files mode 600. Docker preserves those modes while the hosted runtime runs as a non-root user. This was identified before image deployment.
- **Fix:** set only the generated public-doc directory to 755 and its index/manifest to 644; private archives, credentials and operator files retain private permissions. The regression passes with the same restrictive umask, including pre-existing private output files.
- **Suggested fix / severity / mainnet impact:** public build-artifact producers should set explicit runtime-readable modes rather than depend on operator umask. P2 packaging blocker; no Mainnet operation or real-money payment.

### 2026-11-12 — delegated visitor money path (observed)

A local product purchase uses visitor `rGPU4UK4KzrMyfPtXBwdun9ibgNEGTEKhD`, agent Delegate `r4qQ5cqgPsjUL5pE5paSKYv33KeifpQWWH`, create `4947D76B32F7798EA94D2E220F947F0C1C2141C3DA1997705D1980A1AEC489EA`, writer finish `22BCFDBE83ED5A646568F0BDDB710202293DFA5D372A0631B7DEB0174F66B485`. Revoke `E581EC14CAB91125CD771D545A9BAEAAADC051A54B1495F6C6256E9B245611EC`; the subsequent policy run spends zero and grants zero. Evidence: `docs/evidence/money/DELEGATED.md`, `e-delegated.json`. Severity: informational. Workaround: session-bound public-key proof and validated delegation preflight before every policy signature; do not equate a generic EscrowCreate grant with an on-ledger spending limit. Suggested fix: publish an application example separating wallet identity, permission scope and per-request budget. Mainnet impact: the delegation itself has no per-prompt cap; this is Testnet application evidence, not a mainnet authorization or custody assessment.

### 2026-11-12 — browser wallet delegation (observed)

Chromium 153 runs the actual wallet component through a local Vite development build: fresh browser-only visitor key, real Testnet faucet funding, EscrowCreate-only grant `FFFA63323D85D081A3A5958E3221B9C36BF0C32A9037AE731623F8982ECB0BA6`, and empty-permission revoke `1A4C2DDAD632C8346A05ADB5303F30A61ED8D03084C4887AD45741114CDE89E4`, both validated `tesSUCCESS`. Evidence: `docs/evidence/money/f-browser-wallet.json`; `scripts/spikes/f-browser-wallet.mjs`. The public identity HTTP API is stubbed and verifies the actual signature; this is not a full browser purchase or hosted acceptance. Workaround: none needed for browser SDK signing/faucet access. Suggested fix: publish a browser example that keeps the seed local and separately verifies the active grant and revocation on ledger. Severity: informational. Mainnet impact: none measured; no Mainnet request or signature.

### 2026-11-12 — secret scanner flags public XRPL accounts (observed)

GitGuardian check 131104124812 on PR #525 reports Generic High Entropy Secret incident 39989086 twice: `docs/evidence/money/a.json` lines 26 and 120 at `bc97e162`. Both fields are `Authorize`, and both values validate as public XRPL classic account addresses and equal the recorded Testnet agent. Evidence: the authenticated gh check-run output and those pinned public transaction records. Workaround: inspect the typed field and validate its address; retain the scanner failure as a disclosed false positive, without changing its configuration or the local merge gate. Suggested fix: distinguish public XRPL Account/Authorize/Destination fields from private credentials instead of treating all high-entropy ledger identifiers as secrets. Severity: low integration friction. Mainnet impact: the same public-address false alarm is possible; no Mainnet transaction or credential exposure is involved.

### 2026-11-12 — delegated wallet recovery (application failure modes; synthetic tests)

- **A session binding can outlive a revoked ledger grant (code-derived, synthetic failure coverage).** Evidence: `tests/delegated-wallet.test.ts`, `src/components/DelegatedWallet.test.tsx`, and `docs/evidence/money/DELEGATED.md`. A successful revoke followed by a failed API disconnect could leave the old server binding visible after refresh; this is our application cache behavior, not an XRPL defect or an observed live RPC outage. Workaround: retain the confirmed ledger result in the UI, revalidate the grant on status refresh, and clear inactive bindings. Suggested fix: delegation examples should distinguish cached identity from current ledger permission and show recovery after a lost disconnect response. Severity: low UI correctness; the independent pre-sign check already refused purchases. Mainnet impact: the same stale display is possible in such an application; no Mainnet transaction or loss was tested.
- **Pending delegated creates belong to the owner's sequence queue (observed synthetic regression).** Evidence: `tests/delegated-wallet.test.ts` reproduces `Previous payer sequence unresolved` when recovery restores an unresolved visitor create into the agent queue. Workaround: restore visitor creates to the visitor queue and agent finish/cancel transactions to the agent queue; the regression then passes without relaxing sequence guards. Suggested fix: SDK/Starter Kit recovery examples should route pending transactions by Account rather than by the signing wallet. Severity: medium application availability; not a protocol failure. Mainnet impact: the same cross-account blocking is possible in this recovery design, but no Mainnet write or outage was measured.

### 2026-11-12 — hosted/desktop gate builds share dist (observed local tooling)

The Node 22.23.4 spike admission on clean head `da998380` passed 19/20 steps, then hosted startup failed with `Unexpected end of JSON input` in `initialJsGzip` reading `.vite/manifest.json`. Evidence: git-common-dir `local-gate/runs/1794483428831-366-bcbeff37-893d-40fc-92a3-ade1514c772a.json` and its browser-hosted/desktop-build logs. `makeSteps` starts both builds after browser-perf releases its CPU allocation: hosted depends on browser-perf, while desktop depends only on browser-app, and both run the production build into `dist`. Desktop completed successfully during the failed hosted startup. Workaround: retain the failed receipt and rebase onto content PR #527, which independently fixed this race by making desktop staging depend on browser-hosted. The spike branch now includes that stricter dependency; no gate modification is authored in this lane. Suggested fix: keep that ordering, or isolate independently scheduled build outputs. No check or threshold is removed or loosened. Severity: medium local shipping friction; this is our gate scheduling defect, not XRPL latency or an observed hosted outage. Mainnet impact: none measured; no transaction or cloud operation is involved.

### 2026-11-12 — browser-owned purchase through the real API (observed local Testnet)

Chromium creates the visitor key, obtains faucet XRP, binds public proof through the real API, and completes a 40-minor-unit key-reveal purchase. Final create `FCB5F7BD86E29246E3B19F5974F6215EA364A6501DFD5D6CBBEF1C07AB8DE011`, finish `9D60C0450DECE759CA9CD4DC15592512BDE297FCDAEFF9CA3B6CEFA24F2903F0`; all public hashes and both runs are in `docs/evidence/money/DELEGATED.md`, `g-browser-product*.json`. The identity boundary is real; the development component harness uses HTTP admission rather than the full Ask/modal UI. Models are fixtures and isolated writer roles share a wallet. The initial run exposed our missing-binding HTTP 500 classification after successful revocation. Workaround: return HTTP 409 with a connection instruction before admission; a fresh final live run confirms 409 after revoke. The final purchase takes 15,440 ms in one observation, excluding provisioning. Suggested fix: wallet integration examples should test both public-proof binding and disconnected admission through the actual API, with user-state conflicts distinct from backend failures. Severity: low API correctness; no premium content or spend followed either revoked admission. Mainnet impact: none tested; the original 500 was our API classification, not a ledger failure or a real-funds incident.

### 2026-11-12 — delegated hosted admission after disconnect (observed local fixture)

- Evidence: `tests/delegated-wallet.test.ts`, “reserves no hosted budget or run if the wallet disconnects during readiness”. Before the fix, a disconnect during the awaited readiness check returned HTTP 409 but left an unstarted durable run and hosted budget hold. The regression first reproduced that orphan; afterward it observes no run, no hold and no signed transaction. This is our admission integration bug, not an upstream ledger defect. Workaround / fix: recheck the session binding immediately after readiness, before reserve/admit/bind, with no intervening await. Suggested fix: keep authorization adjacent to durable admission after asynchronous preflight. Severity: low quota/recovery friction. Mainnet impact: analogous quota leakage would be possible; no Mainnet operation or Testnet transaction was involved in this fixture.

### 2026-11-12 — hosted wallet provenance notice (observed local fixture)

- Evidence: `src/components/DelegatedWallet.test.tsx` and `tests/delegated-wallet.test.ts`. Before the fix, the configured visitor-wallet mode still returned the shared-payer rail label and displayed “uses one sponsor wallet” in the environment panel. Workaround / fix: derive the notice from the configured wallet mode, keep one XRPL Testnet chip, and retain shared-mode wording. The server and rendered panel assertions first failed on the old labels, then passed. Suggested fix: test payer provenance alongside environment labels when adding a wallet mode. Severity: low UX accuracy issue. Mainnet impact: no ledger defect or Mainnet operation; this is our Testnet UI integration.

## 2026-11-12 — Escrow-only delegation must refuse Batch before agent fallback (code-derived and local fixture)

- **Evidence:** `tests/delegated-wallet.test.ts` first reproduced a scoped Batch reaching the agent signer through the generic non-create fallback. The fixture uses an empty inner list to isolate that signing decision; no public-ledger validity or settlement is claimed. `server/xrpl.ts` now refuses Batch before fallback and the regression requires zero submitted fixture transactions.
- **Workaround:** use individual delegated EscrowCreate. Do not combine the own-wallet mode with Batch holdback until visitor co-signing is implemented; an EscrowCreate-only permission does not authorize Batch.
- **Suggested fix:** application delegation examples should explicitly separate delegated creates, agent-signed terminal transactions and multi-account Batch signing. Preserve this boundary when composing opt-in features.
- **Severity / mainnet impact:** medium integration boundary, prevented before shipping this mode. No live incident or Mainnet signing; the same signer-selection distinction applies to any integration.

## 2026-11-12 — Concurrent worktree fetch raced a shared remote-tracking ref (observed local tooling)

- **Evidence:** a read-only `git fetch -q origin` in the wallet worktree failed while updating `refs/remotes/origin/guru/r3-holdback`: the ref had advanced from the value expected by that fetch. A subsequent explicit main-only fetch succeeded and read main `de23461d`. No checkout, source file or ledger transaction changed in the failed fetch.
- **Workaround:** fetch the needed main ref explicitly (`git fetch origin refs/heads/main:refs/remotes/origin/main`) rather than retrying unrelated branch updates. Preserve the other lane's ref and commits.
- **Suggested fix:** serialize broad fetches by common Git directory in concurrent worktree shipping helpers, or limit each helper to the refs it needs. This was local shared-ref contention, not an observed GitHub outage.
- **Severity / mainnet impact:** low coordination friction; no signing, spending, credential disclosure or Mainnet impact.

### 2026-11-12 — Delegated Batch recovery signing boundary (local fixture)

- **Evidence:** `tests/delegated-wallet.test.ts`, scoped Batch regression, first failed after integrating holdback recovery because `signReservedBatch` reached the agent signer. The added assertion now requires both normal and reserved Batch signing to refuse before the signing spy is called. This is a local authority-boundary fixture, not a Testnet validation claim for its empty Batch.
- **Workaround:** refuse reserved Batch signing on a visitor-scoped payer, matching the existing early Batch refusal. Own-wallet plus Batch holdback remains unsupported until visitor co-signing transport is implemented.
- **Suggested fix:** document every signing entry point when adding durable Batch recovery, including scoped-account authorization.
- **Severity / mainnet impact:** medium integration boundary; no affected transaction or Mainnet write was observed.

### 2026-11-12 — Browser probe cache entered repository-wide lint (observed tooling)

- **Evidence:** `scripts/spikes/f-browser-wallet.mjs` and `g-browser-product.mjs` originally placed generated Vite dependency caches under `scratch/`. `check:fast` at clean wallet head `ec3d5722` then linted those ignored, generated dependency files and failed with 880 errors. No application source lint error was reported.
- **Workaround:** give each probe an operating-system temporary cache directory owned by the existing verification `ResourceScope` helper and close the scope after Vite. An intermediate raw temp creator was rejected by `checkCreators`; that failed check is retained and the creator inventory is unchanged. Preserve the failed log and previous generated cache outside the checkout; lint configuration and assertions are unchanged.
- **Suggested fix:** standalone browser examples should isolate generated caches from source globs and clean up in their finalizer.
- **Severity / mainnet impact:** low local verification friction; no ledger behavior or Mainnet operation.
