# #273 product-path proof-or-refund escrow · 3 Nov 2026

**XRPL TESTNET · no real value; SYNTHETIC mini-corpus.** Actual buyer signer,
SQLite journal/outbox, payer queue, HTTP publisher, deterministic manifest proof
and live ledger. No model calls, semantic-truth claim, mainnet claim or p95
claim. This is a focused product purchase-path demonstration, not a complete
UC3 research/model scorecard. API/SDK/receipt data only; `src/` is unchanged.
Public raw observations: [escrow-273.json](escrow-273.json).

Buyer `rwi1i3TJfZKmLWoAiNkXUBZmdWVGFxBNRQ` used the configured funded Testnet
wallet. The two escrows locked 60,000 and 30,000 drops. **Net spend: 60,459 drops
(0.060459 Testnet XRP)**, including 459 drops fees. AlphaLeak's full 30,000-drop
principal returned. No new faucet funding or cloud resources were required.

| Outcome | Validated create | Validated terminal | Fees |
|---|---|---|---:|
| Honest fixture, proof passed | [C82B337DC66343C64F653E86627E590434670E48AC4526369338ED1099A25926](https://testnet.xrpl.org/transactions/C82B337DC66343C64F653E86627E590434670E48AC4526369338ED1099A25926) · ledger 22026132 | [7367BA104561692202D04DBC1D15F8FB08FAD7ABA6BA5C76C82BEA1D02BD4846](https://testnet.xrpl.org/transactions/7367BA104561692202D04DBC1D15F8FB08FAD7ABA6BA5C76C82BEA1D02BD4846) · finish, ledger 22026134 | 435 drops |
| AlphaLeak fixture, proof failed | [EAA86976171D6238EF53947AA33D7D2FF8C4B328823F5575720FD72444F60A72](https://testnet.xrpl.org/transactions/EAA86976171D6238EF53947AA33D7D2FF8C4B328823F5575720FD72444F60A72) · ledger 22026136 | [C007A2966C71ADAE1743612E3386BB2F53FB0AF5F4B0B03D6ED67856E78408FA](https://testnet.xrpl.org/transactions/C007A2966C71ADAE1743612E3386BB2F53FB0AF5F4B0B03D6ED67856E78408FA) · cancel, ledger 22026171 | 24 drops |

All four lookups returned **validated `tesSUCCESS`**. Transaction metadata shows
buyer OwnerCount **0 → 1 → 0** for each case. Buyer balance changes were
−60,012 / −423 drops for the honest pair, and −30,012 / +29,988 for the failed
pair. That cancellation delta includes its 12-drop fee. The validated final
account-objects response contained **zero escrows** for this buyer.

| Local timing, one sample each | Honest finish | Failed-proof cancel |
|---|---:|---:|
| Purchase start → observed validated create | 6.242 s | 8.279 s |
| Observed create → observed terminal | 5.865 s | 121.169 s |
| Purchase start → observed terminal | **12.107 s** | **129.448 s** |

Purchase start precedes quote negotiation; these timings include RPC, proof,
polling and (for cancellation) the expiry wait. They are not isolated transaction
submission latencies. CancelAfter was +120 s from the quote's validated ledger
time. Finish spanned two ledger indices after create; cancellation spanned 35,
mostly waiting for expiry. There is no controlled exact-payment timing baseline
or p95 estimate in this sample.

The publisher was shut down before cancellation ticks. The buyer's normal
reconciler advanced CANCEL_DUE → CANCELLED without any writer HTTP request or
signature. Honest content became accessible only after proof plus validated
finish; failed-proof content never entered accessible contents. The cancelled
receipt records zero principal spent, with the cancel hash and parent object.

Reproduce serially with the ignored `.env` and existing configured wallets:
`OFFSET=1600 node --import tsx scripts/evidence/escrow-273.ts`. State is private
under ignored `scratch/escrow-273/`; completed reruns only reconcile/read the
same intents, not buy again. Preserve it until all escrows close. The public
report is an allowlist, without secrets, seeds, signed blobs or article bytes.
The on-chain history may disappear if Testnet resets.

Offline `tests/escrow.test.ts` covers concurrent duplicate calls, restart after
create, an escaped finish after Stop, Stop before finish, expired finish then
same-object cancellation, proof quarantine and the 15 s finish margin, altered
signed quote terms, owner reserve plus fee headroom, cancelled-budget reuse,
unsupported-writer refusal, direct-path preservation, relayed terminal recovery
and missing-history reservations. The gate audit rejects
an escrow finish without its persisted verified proof. No gates were loosened.

After rebasing onto merged #288, `npm run audit:verify -- --db
scratch/escrow-273/buyer.db --testnet --json` independently re-confirmed both
creates, finish and cancel: **4/4 OK**, read-only, no additional spend.
[Verification output](escrow-273-audit.json). These two intents predate the new
audit seam: migration pins them as a baseline and does not invent historical
audit entries (coverage counters are zero). Current hash-chain emission,
receipt/signature coverage, and on-ledger event checks are exercised by the
simulated-ledger integration tests for both outcomes.
