# Builder feedback: six weeks of XRPL integration

A living record for the SFF judges. **35 catalogued items plus dated tooling incidents: 16 implementation findings and 4 live escrow spike findings below,
plus the 15 September research submissions in the appendix.** The original
source and history audit was recorded on **2 Nov 2026**; dated additions below
identify live-network observations separately.
The original log dates are audit dates; the evidence column dates the original work.
The four B17–B20 entries are fresh Testnet observations from 3 Nov 2026.
The eight writers and their content are synthetic. Offline settlement is
**SIMULATED**; historical live receipts are **XRPL TESTNET · no real value**.
Neither is evidence of mainnet readiness.

## Observed verification tooling incident · 3 Nov 2026

The #278 UC3 runner created its first run using Store's default SIMULATED label
while injecting a real Testnet payer; the gate audit refused the inconsistent
snapshot (`missing_rail_label`). Evidence: `docs/evidence/verify-278.md` and
`verify-278/summary.json`. Workaround: pass the explicit Testnet mode labels,
correct the harness metadata and re-export/re-check the same durable run; no
replacement payment. Suggested fix: require explicit rail labels in standalone
Testnet harness constructors. Severity: low (local evidence tooling). Mainnet
impact: none observed; no value funds. This was not a ledger or x402 failure.

## Observed tooling incident · 3 Nov 2026

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

## Observed local evaluation tooling · 3 Nov 2026 · #276

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

## Top five: what we would fix first

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

## Living implementation log

Severity describes the consequence without the workaround: **critical** can
risk money or unauthorized access; **high** blocks correctness or operation;
**medium** complicates integration. A code-derived failure mode is not a claim
that a production incident happened. Repro commands above use local fixtures;
no faucet, live models or Testnet funds are required.

| ID · recorded | Area | What happened / evidence | Our workaround (path) | Suggested upstream fix | Severity | Mainnet impact |
|---|---|---|---|---|---|---|
| B17 · 2026-11-03 | XRPL escrow | Observed wrong preimage → `tecCRYPTOCONDITION_ERROR`; the ledger did not evaluate article content. Code-derived fairness limit: buyer secret permits withholding payment after reading. Evidence: [spike and tx links](spikes/escrow.md), [raw observations](spikes/escrow-testnet.json). | Keep secret in buyer signing state until the shared proof passes; label buyer-controlled release and publisher opt-in. | Add an article-delivery example distinguishing hashlock enforcement from fair exchange and oracle trust. | high | Native hashlock alone cannot enforce semantic correctness or honest buyers on any network. |
| B18 · 2026-11-03 | XRPL escrow timing | Observed early cancel and expired finish both validated `tecNO_PERMISSION`; neither failure restored principal. Explicit later cancel returned it, 54.871 s after create submission including probes. Evidence: [timings and hashes](spikes/escrow-testnet.json). | Compare validated ledger close time with CancelAfter, leave finish margin, reconcile and submit cancellation explicitly. | Include expiry cleanup, Stop/restart and fee-consuming negative cases in escrow tutorials. | high | Expiry is eligibility, not an automatic refund; abandoned objects retain liquidity/reserve. |
| B19 · 2026-11-03 | XRPL fees and reserve | Observed 12-drop create/cancel, 423-drop conditional finish via xrpl.js 4.7.0; OwnerCount 0→1→0 at 0.2 XRP increment. Base-fee examples alone understate the signing fee/liquidity needed. Evidence: [balances, RPC settings and tx fees](spikes/escrow-testnet.json). | Live reserve-aware balance check plus terminal fee headroom and 2,000-drop per-tx cap. | Show SDK fee cushion/encoded fulfillment size and reserve lifecycle beside minimum-fee formulas. | medium | Micropayment capacity is limited by concurrent object reserve, not just principal or burned fees. |
| B20 · 2026-11-03 | XRPL capability / x402 | Observed feature RPC: TokenEscrow and fixTokenEscrowV1 enabled; retired Escrow false although XRP create/finish/cancel succeeded. Static exact facilitator requires Payment, and EscrowCreate has no InvoiceID. Evidence: [live RPC snapshot](spikes/escrow-testnet.json), `publisher/facilitator.ts:verify`, [protocol references](spikes/escrow.md). | Probe operations, check issuer flags separately; propose a separate escrow-v1 scheme and invoice memo rather than substituting EscrowCreate into exact. | Provide network-specific capability/issuer checks and an explicit locked-versus-settled extension contract. | high | Amendment enabled does not prove RLUSD support; exact compatibility must not be claimed for escrow. |
| B21 · 2026-11-03 | Desktop tooling | Observed: staged Electron app passed, but the first installed DMG exited before a window because utilityProcess received an ASAR virtual cwd. Unpacking the same app restored UC1–UC3; final installed proof in `docs/evidence/macos-app-259.md`, packaging fix in #303. Validation run 41562664758 also exposed automatic draft publishing; unpublished drafts removed via gh and builder publishing explicitly disabled. | `desktop/build.mjs`: package real files and compile the shared worker; second DMG installed and passed. | Add a utilityProcess + SQLite/corpus example using a real cwd and test the installed artifact, not just the dev shell. This is our packaging error, not an XRPL failure. | medium | Prevents app startup on either rail; no ledger defect or live-money incident observed. |
| B16 · 2026-11-03 | XRPL tooling | Observed: #277 Testnet demo settled successfully but the Node process retained sockets after cleanup. Code-derived cause: parallel account/fee/ledger requests could create three clients before any connected, retaining only the last. Evidence: `docs/evidence/publish-site-277.md`, `tests/xrpl-connection.test.ts`. | `shared/xrpl.ts`: share one in-flight connection promise; close waits for it. No second payment was made. | Document sharing a connecting client in concurrent RPC examples; this is our wrapper bug, not an XRPL ledger defect. | medium | Resource lifetime issue on any rail; no payment correctness change. |
| B17 · 2026-11-03 | tooling | Observed restart recovery: #286 WIP `99f8545` remained attached to an abandoned clean worktree, so the requested branch checkout failed as already in use. | Verified the old checkout was clean, detached it at the WIP, then rebased the recovered branch in the active worktree. | Agent restart handoff should retain checkout ownership and give an explicit recovery action. | medium | No ledger incident or Testnet call; production recovery must preserve the durable payment DB, not just Git state. |
| B18 · 2026-11-03 | tooling | Observed #286 CI run `41561017423`: testing Vite's denylist against an absent `.env` returned the SPA fallback (200), while the local operator file returned 403. | `tests/client-admission.test.ts` now creates its own synthetic credential file and asserts 403 plus no canary bytes. | Security test examples should create their fixtures and test response bytes, rather than depend on developer secrets being present. | medium | Test portability failure; no credential disclosure observed, and no mainnet calls. |
| B22 · 2026-11-03 | XRPL Testnet / `tx` lookup | Observed: `npm run audit:verify -- --testnet` re-read five payments made on 7 and 9 Oct (ledgers 21350585–21407660) from the public Testnet endpoint in 3.15 s total; each validated `tesSUCCESS` with the expected destination, `delivered_amount` and InvoiceID. Code-derived, not observed: Testnet is reset periodically and a node may not keep old history, and a `txnNotFound` answer cannot say "pruned" from "never existed", so `shared/xrpl.ts:lookupTx` reports `pending`. Evidence: command output in the #288 PR; `tests/audit.test.ts` (Testnet block, fake ledger). | `audit:verify` reports not-found as its own non-passing status instead of OK; receipts keep their ledger index so a full-history node can be pointed at via `XRPL_RPC_URL`. | Document public-node history retention and give `tx` a way to say "outside this node's history". | medium | A mainnet audit older than a public node's window needs a full-history node or an archive; the audit trail must not depend on a Testnet endpoint. |
| B23 · 2026-11-03 | tooling | Observed: worktrees that symlink the main checkout's `node_modules` (disk was 98% full) lack `@modelcontextprotocol/sdk`, which is in `package.json`, so local `tsc` and `tests/mcp.e2e.test.ts` fail in the worktree while CI is green. Evidence: `npx tsc --noEmit` on the #288 branch; main's `node_modules/.package-lock.json` has no entry for it. | Treat the MCP-only type errors as environment noise locally and rely on CI for those files; no code changed. | Preflight (`make doctor`) should compare installed packages with the lockfile and say which workspace is stale. | low | None: no ledger or payment involvement. |
| B01 · 2026-11-02 | XRPL | A single account must not sign concurrent payments with the same Sequence; integration `36ae0b7`. | `server/xrpl.ts`: hold the payer queue through the facilitator response. | Provide a per-account sequence queue example, including multiple processes. | critical | In-process locking is done; distributed signer coordination is a gap. |
| B02 · 2026-11-02 | XRPL | A restart after signing loses payment identity unless persisted first; `tests/xrpl.test.ts` restart case. | `server/xrpl.ts`, `server/store.ts`: persist signed blob before send. | Include a durable outbox in the quickstart. | critical | Done locally; backup/recovery and durable production storage remain gaps. |
| B03 · 2026-11-02 | XRPL | A missing tx lookup can coexist with an advanced payer sequence; `tests/xrpl.test.ts` reservation case. | `server/xrpl.ts`: validated ledger + LastLedgerSequence + account Sequence proof, otherwise pending. | Specify pending and provable expiry in SDK return types. | critical | Done locally; reconciliation service and alarms are gaps. |
| B04 · 2026-11-02 | x402 | HTTP invoice JSON and ledger InvoiceID have different representations; `433b971`. | `shared/x402.ts`: canonical JSON → SHA-256 uppercase hex. | Publish cross-language binding vectors. | critical | Binding done; ecosystem interoperability still needs external validation. |
| B05 · 2026-11-02 | x402 | Invalid base64, schema and oversized headers need explicit rejection; `tests/x402.test.ts`. | `shared/x402.ts`: schema validation and 8 KiB encoded-header cap. | State header limits and test negative cases at proxy boundaries. | high | Local parsing done; deployed proxy limits untested. |
| B06 · 2026-11-02 | x402 | Duplicate retries must return the same delivery; `tests/facilitator.test.ts` duplicate and parallel cases. | `publisher/facilitator.ts`, `publisher/journal.ts`: inflight deduplication and settlement by hash. | Include concurrent retry and restart conformance tests. | critical | Done locally; multi-instance facilitator correctness needs validation. |
| B07 · 2026-11-02 | XRPL | Preliminary submit success is not validated delivered value; `tests/xrpl.test.ts` wrong ledger amount case. | `shared/xrpl.ts`, `publisher/facilitator.ts`: validated tesSUCCESS and exact payment checks. | Show delivered-amount verification beside submit. | critical | Done for XRP/Testnet; issued-currency checks remain a gap. |
| B08 · 2026-11-02 | Testnet | Reset recovery must retain wallet identities; wallet helper explicitly supports resets. | `scripts/wallets.mjs`: fund existing addresses; write new seeds before faucet calls. | Document idempotent reset recovery and faucet failure handling. | high | Testnet tool only; mainnet funding must never use a faucet. |
| B09 · 2026-11-02 | tooling | ECDSA runtime import prevented Node 22 publisher startup; `8c7e24a` (7 Oct). | `publisher/registry.ts`: type-only ECDSA import. | Test the TypeScript starter against the declared Node runtime. | high | Pin and verify runtime/package compatibility before deployment. |
| B10 · 2026-11-02 | XRPL | Refunds are cooperative; the writer can refuse or time out (FINAL-PUSH D5). | `publisher/challenge.ts`, `server/challenges.ts`: write-once refund and trust penalty independent of repayment. | Document the limitation; offer a separately evaluated dispute design. | high | Enforceable dispute settlement is a gap; #261 is not shipped. |
| B11 · 2026-11-02 | XRPL | S$ display and XRP settlement use a fixed demo conversion; #163 stays open. | `server/purchases.ts`, `shared/contracts/`: integer drops and quote matching. | Add issuer-aware RLUSD or expiring rate quotes with rounding/refund rules. | high | Mainnet price formation is a gap. |
| B12 · 2026-11-02 | Starter Kit | Our Node flow implements the XRPL x402 handshake itself; generic/older header examples cannot be mixed (integration contract). | `docs/x402-xrpl.md`, `shared/contracts/x402.ts`: freeze v2 PAYMENT-* headers and xrpl:1. | Supply one tested XRPL-first TypeScript quickstart and compatibility matrix. | medium | Our implementation is not upstream Starter Kit conformance certification. |
| B13 · 2026-11-02 | Testnet | Offline signed blobs must not masquerade as Testnet; `tests/xrpl.test.ts` rail refusal cases. | `server/xrpl.ts`, `publisher/facilitator.ts`: reject SIMULATED payer on Testnet and label receipts. | Ship an explicitly labelled simulator with rail mismatch tests. | critical | Simulation boundary done; mainnet remains disabled. |
| B14 · 2026-11-02 | tooling | Historical decision run bought too little: F1 0.24, S$1.60 wasted of S$4.05; `eval/REPORT-decisions.md` (9 Oct, `4e3a2a5`). | `server/agents/loop.ts`: requested-fact rounds; report preserves keyword search, fixture writer and simulated payment substitutions. | Pair agent-payment starters with value-of-information evals, not payment counts alone. | medium | Payment correctness does not demonstrate economic utility. |
| B15 · 2026-11-02 | tooling | Writer self-grading called 22/76 supported snapshots partial; `eval/REPORT-coverage.md` (9 Oct). | `server/agents/requirements.ts`: explicit coverage rubric; separate decision-model grading adopted in `a8b60cc`. | Include evidence-coverage and false-complete checks in agent examples. | medium | Historical model evidence only; ongoing quality measurement is still needed. |

## Mainnet readiness checklist

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

## Submitted Sep 2026

Preserved from `docs/DEV-FEEDBACK.md` (introduced in `ff68f38`). These are
**historical research submissions**, not newly reproduced defects. The inventory
records acceptance responses, not confirmation that upstream fixed the issues.

Developer feedback on the XRPL and x402 documentation and integration experience. These research-based observations were submitted on 4–5 September 2026 and describe the materials reviewed at that time.

### Submission inventory

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

### Submitted feedback

#### 1. Facilitator reliability and reconciliation

While preparing an XRPL agentic-payment flow, I found a reliability gap in the x402 quickstart: it requires T54's hosted testnet facilitator, which the XRPL documentation labels best-effort with no committed SLA, but the guide does not provide a local facilitator, deterministic simulator, or clear reconciliation guidance for facilitator outages versus invalid payments. A local test harness plus documented retry, idempotency, and receipt-reconciliation behavior would make hackathon and production integration much easier to debug.

#### 2. Bounded autonomous signing

The XRPL agent documentation has an autonomy ambiguity: the x402 guide describes payment as requiring no human in the loop, while the Agent Wallet skill requires explicit human confirmation for every signature by default. The docs mention auto-signing but do not show one concise, end-to-end example of bounded autonomy with network, destination, amount, and expiry constraints. A single approved-autonomy example, clearly separated from production policy-gated signing, would prevent builders from either blocking unattended x402 flows or weakening authorization controls.

#### 3. Wrong chain starter examples

The general x402-secure reference examples default to Base Sepolia and generic x402.org facilitator endpoints, while the XRPL path uses the separate x402-xrpl package, XRPL-specific network identifiers, and a different facilitator. For an XRPL hackathon, following the generic starter path can produce a syntactically valid but wrong-chain prototype before the mismatch is obvious. An XRPL-first quickstart, install command, and runtime validation that rejects unsupported network and asset combinations would prevent this expensive integration detour.

#### 4. Package version pinning

The XRPL x402 documentation warns that the x402-xrpl package is early-stage and recommends pinning a specific version, but its quickstart installs x402-xrpl without a version pin and provides no tested lockfile or compatibility matrix. That makes a hackathon demo vulnerable to silent SDK changes and makes bug reports hard to reproduce. Publishing the exact tested package version, a lockfile, and a small protocol-compatibility table would materially improve reliability for builders.

#### 5. Network and asset validation

The XRPL x402 payer quickstart sets network_filter=None, meaning the client accepts any network declared by the server, while the same wallet guidance emphasizes explicit network checks and safe authorization. Because a 402 response supplies the payment terms that the client signs, the example should default to an explicit testnet network and asset allowlist, with a clear warning before accepting mainnet or unexpected terms. A fail-closed network and destination validation example would prevent a misconfigured or malicious paywall from steering an agent into an unintended payment path.

#### 6. Python version prerequisites

The XRPL agent documentation has conflicting Python prerequisites: the general Getting Started tutorial says Python 3.9+, while the XRPL x402 guide requires Python 3.11+. A builder following the first page can pass the stated prerequisite and still fail when installing or running the x402 path. The docs should declare one supported matrix per workflow and publish a tested requirements or lock file so environment failures are distinguishable from XRPL integration failures.

#### 7. TypeScript quickstart coverage

The XRPL x402 landing page advertises a TypeScript client, but the XRPL-specific implementation guide explicitly says it currently includes Python examples only. This leaves Node.js builders to infer the XRPL header, signing, receipt, and retry flow from a different ecosystem example. A minimal tested TypeScript quickstart using the XRPL package, with the exact network and facilitator configuration, would make the advertised client support real rather than discoverable only through reverse engineering.

#### 8. RLUSD trustlines and issuer onboarding

The XRPL x402 guide says x402-xrpl supports RLUSD for stable pricing, but the runnable quickstart demonstrates XRP only and does not show the required trustline creation, issuer verification, reserve impact, or the failure mode when the recipient cannot hold the issued currency. XRPL trustline tokens cannot be delivered without an appropriate trust line. A complete RLUSD example should provision and validate the trustline before signing, and explain how to surface tecPATH_DRY or issuer mistakes.

#### 9. SourceTag default mismatch

Agent attribution is inconsistent across the XRPL agent materials: the Agent Wallet and Payments skills use SourceTag 20260530, while the XRPL x402 quickstart defaults to 20260601. A builder combining the wallet skill with the x402 middleware can produce valid payments that split across attribution queries, making agent volume and audit trails incomplete. The ecosystem should publish one canonical tag policy or clearly define separate tags and their intended ownership.

#### 10. Payment retry and duplicate settlement

The XRPL x402 quickstart describes payment, facilitator receipt retrieval, and the HTTP retry as one automatic flow, but it does not explain the crash window where the on-ledger Payment succeeds and the client times out before receiving the receipt or final resource. A naive retry could submit a second payment for the same request, while abandoning the request loses a successful settlement. The client and merchant examples should show an invoice or idempotency key, hash-based reconciliation, and a safe retry-after-settlement procedure.

#### 11. Network identifier compatibility

The XRPL x402 guide uses xrpl:1 for Testnet and xrpl:0 for Mainnet, while the OpenWallet Standard reference uses the canonical CAIP-2 identifiers xrpl:testnet and xrpl:mainnet. A builder combining x402 payments with a policy-gated wallet can pass a valid-looking identifier that another layer rejects or interprets differently. Publishing one canonical mapping and a conversion helper would remove a subtle cross-tool integration failure.

#### 12. DestinationTag and X address support

The XRPL x402 quickstart models payTo as a plain classic address, but many hosted accounts require a DestinationTag and XRPL payments can fail when the destination account enforces one. The quickstart should explain whether x402 payment requirements can carry a destination tag or X-address, how the client validates it, and how a merchant advertises the requirement. Without that path, an agent can pay the right institution but still receive a validated failure such as tecDST_TAG_NEEDED.

#### 13. SourceTag ownership and attribution

The XRPL x402 payer example says the on-chain SourceTag is the value declared by the merchant, while the Agent Wallet guidance presents SourceTag as a way to attribute agent-generated activity. Those ownership models conflict: an untrusted paywall can choose the tag that appears in the payer’s transaction and distort agent or merchant analytics. The protocol should define whether the payer, merchant, or facilitator owns each attribution field and provide a tamper-resistant convention for both sides.

#### 14. Testnet reset recovery

The XRPL faucet documentation warns that testnet balances and ledger history may be reset, while the agentic-payment quickstart presents a wallet, payment, and explorer flow without a reset-aware test fixture or verification strategy. After a reset, saved addresses, transaction hashes, and trustline state can silently become invalid and make a demo look nondeterministic. A documented disposable-wallet bootstrap, network-health check, and reset-safe integration test would make agent demos much easier to reproduce.

#### 15. Endpoint transport and network identity

The XRPL agent materials use a WebSocket endpoint on port 51233 for the wallet flow and an HTTP JSON-RPC endpoint on port 51234 for the x402 payer, but do not explain why the transports and ports differ or how to health-check that they refer to the same network. A builder can copy the wrong endpoint into an otherwise correct payment flow and get opaque connection or ledger-state errors. The quickstarts should show a network-identity check and a small endpoint matrix for WebSocket, JSON-RPC, Testnet, and Mainnet.

## Observed evaluation tooling incident · 3 Nov 2026 (completion)

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
## 3 Nov 2026 — live recovery and sequencing (#287)

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

## 3 Nov 2026 · Hire x402 retry and fixture isolation (#274)

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

## Observed escrow integration · 3 Nov 2026 (#273)

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

## Issued-currency integration · 3 Nov 2026 (#275 / #310)

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

- 2026-11-03 · Observed local recording startup race (#311): Vite was reachable
  before `/api/health`; proxy logged ECONNREFUSED and the new disabled composer
  correctly refused the early clip submit. Evidence: `scripts/record.mjs`
  readiness fix and `docs/design/UX-1-EVIDENCE.md`; first take failed, later UC3
  take succeeded. Workaround/fix: wait for API health as well as the page before
  driving keyboard input. Suggested tooling fix: one shared engine-ready signal
  for demo and clip drivers. Severity: low, recording only. Mainnet impact: none;
  no payment was initiated by the failed take. This is local tooling friction,
  not an observed XRPL/x402 incident.

- **3 Nov 2026, observed in synthetic integration (#280):** x402 `payAndFetch` reported "PAYMENT-RESPONSE header missing" when the service refused an agent's budget before settlement (HTTP 409). Evidence: `tests/hire.test.ts` agent-key/fee-cap case; submit count unchanged. Workaround shipped: classify non-success HTTP refusals explicitly and retain the original signed intent. Suggested fix: buyer tooling should distinguish unpaid policy refusals from malformed settlement receipts without discarding recovery state. Severity: low (diagnostic); mainnet impact: confusing recovery can encourage new intents, so preserving one signed blob matters. The two-agent live Testnet demo itself had no ledger/tooling failure (`docs/evidence/agents-280.md`).

- 2026-11-03 · Observed local tooling friction (#312): sharing node_modules to save disk makes Vite reject the symlinked Geist font path during `make record OFFSET=2100` (403, clip log). Workaround: allow only the resolved node_modules directory in Vite dev fs; existing .env/corpus/store deny rules remain. Suggested fix: Vite should recognize dependency asset realpaths consistently with bundled imports. Severity: low; mainnet impact: none (development recording only).

- 2026-11-03 · Observed local tooling friction (#312): a Playwright demo startup found its allocated ephemeral port already occupied (evidence: `docs/design/ux2/README.md`, first-take console message). Rerunning with a fresh allocation started successfully. Suggested fix: retain the bound port lease until the child server is ready, rather than closing the allocator first. Severity: low; mainnet impact: none (local test startup only).

## 3 Nov 2026 — historical release tooling (#279)

- **Observed GitHub tooling behavior, not an XRPL incident:** the pre-desktop
  release workflow marked a newly published older tag as Latest. Evidence:
  `docs/evidence/release-day2.json`, release run `41567080081`. Workaround:
  publish the immutable Day 2 commit/tag with explicit historical notes, then
  set v0.3.0 `--latest=false` and restore v0.4.0 as Latest. Suggested fix:
  release automation should compare version tags and set Latest explicitly;
  the updated workflow does this. Severity: low release navigation friction;
  mainnet impact: none; no ledger or wallet operation was involved.

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

## 3 Nov 2026 — local chaos tooling (#279)

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
