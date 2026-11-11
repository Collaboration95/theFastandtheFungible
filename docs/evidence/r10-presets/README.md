# P1 preset acceptance, 11 November 2026

Before = main `bd52beff` (v1.1.1). After = QUAL final-sprint implementation.
Local `HOSTED=1`, ephemeral ports, live DeepSeek planning/writing, fixture decisions, keyword search and **SIMULATED settlement**. No public hosted questions, no ledger writes. Two fresh visitor sessions, three presets each. No limits raised. The first attempted six-question session was refused at the sixth scope with HTTP 429; the preserved partial attempt is in QUAL's acceptance notes. Runs and receipts retain their labels.

The local hosted-readiness callback is stubbed healthy. These runs exercise local admission and answer generation; they do not qualify HG or a deployed edge.

The fresh live samples preceded the final anaphora and clause-order safeguards. All six recorded plans pass the final offline engine replay; the live samples are not an exact-final-head run.

| Preset | Before buys / S$ | After buys / S$ | Before first lead | After first lead | After counter |
| --- | --- | --- | --- | --- | --- |
| XRPL2 | 1 / 0.40, 1 / 0.40 | 1 / 0.40, 1 / 0.40 | an HTTP 402 response offers payment requirements in PAYMENT-REQUIRED; the client chooses supported terms, authorizes payment and retries with PAYMENT-SIGNATURE. | an HTTP 402 response offers payment requirements in PAYMENT-REQUIRED; the client chooses supported terms, authorizes payment and retries with PAYMENT-SIGNATURE. | 2/2, 3/3 |
| XRPL1 | 1 / 0.40, 1 / 0.40 | 1 / 0.40, 1 / 0.40 | The team documented official RLUSD as blocked until its issuer enables AllowTrustLineLocking. | Not today: an XRPL escrow can hold official RLUSD only after its issuer enables AllowTrustLineLocking, and the RLUSD issuer had not enabled it on Mainnet or Testnet when the team checked on 11 November 2026. | 3/3, 2/3 |
| XRPL3 | 2 / 0.80, 2 / 0.80 | 1 / 0.40, 1 / 0.40 | An XRPL wallet needs a base reserve plus applicable owner reserves, separately from the money it intends to send. | An XRPL wallet needs a base reserve of 1 XRP plus an owner reserve of 0.2 XRP for each object it owns, such as an escrow, offer or trust line, at current Mainnet settings. | 4/4, 3/3 |

Median end-to-end ask, including scope: **4.259 → 3.827 s** (six per arm; descriptive, not a performance budget). The live planner's facts vary; counters are measured against each recorded plan. Both arms have two writer-guard fallback events, on reserves, labelled in the run; no planner fallback. These are development samples, not held-out quality evidence.

The x402 lead names PAYMENT-REQUIRED and then Testnet; no unbound "Each option" lead. RLUSD opens with "Not today" and AllowTrustLineLocking; TokenEscrow is conclusion sentence 2 and build notes follow the answer. Reserves leads with 1 XRP and 0.2 XRP. Each final preset run buys exactly one article, S$0.40.

The same first preset export verifies offline with the **published v1.1.1** wheel and TS CLI (downloaded using `gh release download`): Python 18 passed, 0 failed, 4 skipped; TS RESULT PASS. The simulated audit anchor is explicitly skipped. This is signed-content/receipt verification, not online ledger acceptance. Logs and the exact export are adjacent.

Reproduce: `npx tsx docs/evidence/qual/hosted-presets.ts out.json` with the local provider environment. The runner keeps keys out of output. `tests/r10-presets.test.ts` replays all six recorded plans offline, and checks the partial-answer, disclaimer, anaphora, long-gap, coverage and channel cases. The existing r8/r9/product suites continue to run; intended new corpus pins and preset snapshots are recorded in the PR's Loosened section.

Read-only ledger observation is in `../qual/ledger-readonly.json`. Protocol references: [reserves](https://xrpl.org/docs/concepts/accounts/reserves), [EscrowFinish](https://xrpl.org/docs/references/protocol/transactions/types/escrowfinish), [EscrowCancel](https://xrpl.org/docs/references/protocol/transactions/types/escrowcancel), [XRPL exact scheme](https://xrpl-x402.t54.ai/docs/xrpl-scheme). Corpus articles carry their own primary-source citations.
