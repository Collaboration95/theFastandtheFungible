# Proof-or-refund escrow: #261 decision for #273

3 Nov 2026 · **GO for a bounded Testnet hybrid; NO-GO for a claim of fair,
trustless article verification.** Native escrow enforces a secret and a deadline;
our buyer's deterministic verifier decides when to reveal the secret. A dishonest
buyer can read and refuse to release. Writers must explicitly opt into that risk.
Ship XRP only for Day 5; keep direct `exact` payments for established writers.
This is a standalone spike, with no product or `src/` changes.

## What was actually run

Historical recipe ([whole-tree pin and recovery](../historical-tools.md), `b0a67ffa` only):
`node --import tsx scripts/spikes/escrow-poc.mjs` uses xrpl.js **4.7.0**, fresh
faucet wallets, the fixed Testnet endpoint and a `server_info.network_id === 1`
check. It never loads `.env` or an existing wallet. The article is **SYNTHETIC**;
the shared `verifyManifestSignature` / `verifyDelivery` functions verify a tiny
signed v1 fixture, then an altered passage fails the root check. This is not
live UC3, semantic truth checking, a v2 fact-menu test or x402 interoperability.

Public observations: [escrow-testnet.json](escrow-testnet.json). Buyer:
`rLtferCArsBUae2b4qabB7wG6WkiYFXsoi`; writer:
`rHBSepXGTVeSUsd5YvNHrxDXGf6d7JSNCN`. Each escrow held **10,000 drops (0.01 XRP)**.
The run consumed **1,752 drops (0.001752 Testnet XRP)** including negative probes;
two releases transferred 0.02 XRP total. The cancelled principal returned in full;
fees do not return. Both fresh accounts received 100 faucet XRP. No real money.

Times below are local submission → observed **validated** lookup, including
1 s polling and RPC latency. Every listed result was validated, including `tec`
failures (which consumed fees). A preliminary `submit` result was never accepted
as final. Testnet history can disappear on reset; these are dated observations.

| Step | Testnet tx hash | Ledger | Result | Fee (drops) | Seconds |
|---|---|---|---|---:|---:|
| release.create | [9D4B5D5CD4CD402B1872A533D2E49C150A39F6CE074C8AE4B8D3BC990DD522B4](https://testnet.xrpl.org/transactions/9D4B5D5CD4CD402B1872A533D2E49C150A39F6CE074C8AE4B8D3BC990DD522B4) | 22025412 | tesSUCCESS | 12 | 6.387 |
| release.wrong-preimage | [5F562F9FC85F1D68C7F9C362C9E68B4434E924F286B5F7275FF9CB4B933F46D1](https://testnet.xrpl.org/transactions/5F562F9FC85F1D68C7F9C362C9E68B4434E924F286B5F7275FF9CB4B933F46D1) | 22025414 | tecCRYPTOCONDITION_ERROR | 423 | 6.407 |
| release.finish | [CCA5EFDD067CC3DB12BEA2E69F94EF757985DC985F22371E16ED914974F23A7A](https://testnet.xrpl.org/transactions/CCA5EFDD067CC3DB12BEA2E69F94EF757985DC985F22371E16ED914974F23A7A) | 22025416 | tesSUCCESS | 423 | 6.602 |
| cancel.create | [36B5D2EFDB3A1C68C91303D2ECD19CF219C19E31E1937A30F841DA299AA25704](https://testnet.xrpl.org/transactions/36B5D2EFDB3A1C68C91303D2ECD19CF219C19E31E1937A30F841DA299AA25704) | 22025418 | tesSUCCESS | 12 | 3.777 |
| cancel.early-cancel | [123740C3D8655B35F992D4C010F8F3987A435D7DA648C8A1E76FCD8A1BCB9D6B](https://testnet.xrpl.org/transactions/123740C3D8655B35F992D4C010F8F3987A435D7DA648C8A1E76FCD8A1BCB9D6B) | 22025420 | tecNO_PERMISSION | 12 | 6.375 |
| cancel.expired-finish | [687458933A2DCBEE246B12F8182899C3B831D57196EED93F8D8300C045ED90A8](https://testnet.xrpl.org/transactions/687458933A2DCBEE246B12F8182899C3B831D57196EED93F8D8300C045ED90A8) | 22025431 | tecNO_PERMISSION | 423 | 6.385 |
| cancel.cancel | [43D5E8DD0FB2724C19EE4720CFA9EF381140123A6CEFA1BFF93AD7B1525F3753](https://testnet.xrpl.org/transactions/43D5E8DD0FB2724C19EE4720CFA9EF381140123A6CEFA1BFF93AD7B1525F3753) | 22025433 | tesSUCCESS | 12 | 4.958 |
| release-clean.create | [544B3046A6DE590E1F7C857424C59EF782A24710AD91636BD7D2C58378FCB11E](https://testnet.xrpl.org/transactions/544B3046A6DE590E1F7C857424C59EF782A24710AD91636BD7D2C58378FCB11E) | 22025438 | tesSUCCESS | 12 | 6.628 |
| release-clean.finish | [57626BBAE54051940767E4B69DA79FC55AC66821B4A0B62F0150C724B557D351](https://testnet.xrpl.org/transactions/57626BBAE54051940767E4B69DA79FC55AC66821B4A0B62F0150C724B557D351) | 22025440 | tesSUCCESS | 423 | 6.736 |

The clean create → finish took **14.492 s** end to end: create **6.628 s**,
finish **6.736 s**, with RPC/proof overhead between. The diagnostic release took
21.192 s including its deliberately failed finish. Create → cancel took
**54.871 s**, including a **45 s ledger-time expiry window**, the early-cancel
probe and expired-finish probe; its create took **3.777 s**, successful cancel
**4.958 s**. There is one clean release sample and one cancellation sample:
**no p95 TTFA claim**. Creation and finish each require a validated transaction;
the clean pair spanned ledger 22025438 → 22025440. This adds one transaction
relative to a direct Payment, not a fixed number of seconds or ledger closes.

Normal-path fees observed: **12 + 423 = 435 drops** for release; **12 + 12 =
24 drops** for cancellation (excluding deliberate failures). These are paid fees,
not minimum protocol costs. The [EscrowFinish reference](https://xrpl.org/docs/references/protocol/transactions/types/escrowfinish)
quotes 330 drops plus 10 per 16 preimage bytes at a 10-drop base. xrpl.js autofill
uses the 36-byte encoded fulfillment and its fee cushion: `12 × (33 + 36/16) =
423`. Re-read the live fee and cap each signature at 2,000 drops; never silently
accept autofill's fee without a policy ceiling.

Live `server_info` reported base reserve **1 XRP**, incremental reserve **0.2
XRP**, base fee **10 drops**. Each case observed buyer OwnerCount **0 → 1 → 0**;
all three ended with no escrow objects. The extra 0.2 XRP is unavailable reserve,
not a burned fee; principal is separately deducted into the object. Before create:
`Balance >= base + increment × (OwnerCount + 1) + principal + createFee +
terminalFeeHeadroom`. Also subtract local reservations not yet represented on
ledger; do not subtract escrow principal twice from Balance after creation.
Small purchases therefore consume much more liquidity than their face value.

## Condition, custody and fairness

Use a fresh random **32-byte buyer-server secret per intent**. Put its
PREIMAGE-SHA-256 DER `Condition` on `EscrowCreate`, set `CancelAfter`, omit
`FinishAfter`. Store the secret in private durable signing state, alongside the
intent, **before** signing create; never send it to the writer, LLM, browser,
trace or public report. The prototype's ignored `scratch/escrow-261/private.json`
is mode 0600 in a mode 0700 directory; it is Testnet development custody, not
production custody. Secret loss can be recovered by cancellation, not release.

After the signed manifest's delivery passes the deterministic proof, persist
VERIFIED-for-release, sign/persist `EscrowFinish`, then submit. The fulfillment
becomes public when submitted, potentially before validation. Anyone can relay
it, but destination and amount are fixed by the escrow. Proof failure never
reveals a live fulfillment; our expired-finish diagnostic deliberately reveals
one **after expiry only**. Avoid finish near expiry: proposed policy is 120 s
CancelAfter from validated ledger time, no new finish within the final 15 s;
reconcile already signed transactions before choosing a terminal branch.

The ledger does not run `verifyDelivery`, claim regexes or a truth oracle.
The writer already knows an article's bytes and salts: a condition based on
those lets it claim without delivering them. A public manifest root is no
secret. Hashlocking the article does not achieve fair exchange by itself.
[Native escrow](https://xrpl.org/docs/concepts/payment-types/escrow) only checks
time and PREIMAGE-SHA-256. `FinishAfter` plus `Condition` means **both**, not
"release by proof OR automatically later". It cannot mitigate buyer refusal.

A time-only escrow cannot give an off-ledger arbiter exclusive release power:
**any account** can finish once ready, regardless of the arbiter's verdict. A
real arbiter must hold a hashlock secret (or use a different custody/protocol
model); this adds trust, availability and dispute work. Cut arbitration for SFF.
Honest writers accept buyer refusal risk; buyers gain a refund path independent
of writer cooperation. Describe it as **buyer-verified release, ledger-enforced
cancellation**, not "the ledger checks the article".

## x402: new scheme, shared transport

The existing [XRPL exact specification](https://xrpl-x402.t54.ai/docs/xrpl-scheme)
and `publisher/facilitator.ts:verify` require `TransactionType: Payment`.
`shared/contracts/x402.ts` accepts `exact`; `server/purchases.ts:settleFrom`
requires a payment receipt; `publisher/routes.ts:sellPaid` delivers only after
settlement. EscrowCreate cannot be substituted. An escrow pre-step followed by
an unchanged exact Payment would lock and pay separately, defeating this design.

Advertise **`scheme: "escrow-v1"`, network `xrpl:1`, asset `XRP`**, explicitly a
ResearchAgent extension; leave `exact` available for the ordinary path. The new
extra terms carry the quote/invoice, deadline and condition binding. The buyer
creates the random condition; obtain an escrow-specific signed quote binding it,
payer, payee, amount, article/version/root, intent nonce and deadline before
signing. Fail closed if the publisher does not support escrow; no silent paid
fallback after an ambiguous create.

EscrowCreate has **no InvoiceID**. Use the existing canonical invoice JSON
inside a domain-typed memo (`MemoType=HEX("researchagent/escrow-v1")`,
`MemoData=HEX(UTF8(invoiceId))`); bind escrow-specific fields in that canonical
invoice too. Decode and validate the full memo, not only DestinationTag or a
condition hash. The prototype tests an opaque fixed invoice memo only; the
quote handshake and full invoice validation remain #273 implementation work.

Publisher verify checks signature, network, exact amount/destination/payer,
condition, deadline, fee cap, LastLedgerSequence and invoice against its stored
quote. Settle submits the same stored create blob and confirms the exact escrow
object in a validated ledger. Return **LOCKED**, not an `exact` settlement success.
Issue an escrow-backed grant for that exact version before releasing bytes to
the private proof worker. Keep them quarantined from search, LLMs and citations.
Only a passed proof **and validated finish** enable the accessible grant and
spent receipt. This needs a distinct proof result from today's `checkProof`,
which makes VERIFIED content accessible immediately. A cancellation is a return
of locked principal, not a writer refund Payment. Existing challenge/refund
logic stays for direct payments only.

```mermaid
sequenceDiagram
  participant P as Buyer policy + journal
  participant W as Opted-in writer / facilitator
  participant L as XRPL Testnet
  P->>W: escrow quote (invoice, random condition, deadline)
  W-->>P: bound signed terms
  P->>P: reserve; persist create blob + secret
  P->>L: EscrowCreate
  L-->>W: validated LOCKED object
  W-->>P: exact-version conditional grant + quarantined delivery
  P->>P: verify signed manifest and delivered proof
  alt Proof passes with time to finish
    P->>P: persist proof verdict + finish blob
    P->>L: EscrowFinish (reveal fulfillment)
    L-->>P: validated RELEASED; allow accessible grant
  else Failed proof / missing delivery / stopped before release
    P->>P: retain reservation; wait for ledger CancelAfter
    P->>L: EscrowCancel (no writer signature)
    L-->>P: validated CANCELLED; principal returned
  end
```

## Recovery and Day 5 build contract

| Failure | Required behavior |
|---|---|
| Writer/facilitator offline | No fulfillment; reconciler cancels after expiry, using buyer signer; writer is not needed to refund. Expiry alone does not return funds. |
| Buyer crashes after create | Durable intent stores owner + create Sequence + hash + secret + quote. Reconcile hash/object; resume same delivery/terminal blob, never create another escrow. |
| Buyer lies or disappears | Writer may lose payment after delivering valid bytes. Opt-in Testnet publishers only; public receipts/reputation are mitigation, not enforcement. |
| Stop pressed | If no finish has escaped, mark cancel-due; wait for deadline. A signed/submitted finish may still win; Stop cannot reverse a validated release. |
| Cancel/finish races | Ledger parent-close time, not wall clock; stop new finishes 15 s early. Keep pending until ledger proves the winner; expired object still needs explicit cancel. |
| Timeout / expired signed blob | Retain reservation; hash lookup + validated expiry/Sequence proof before any replacement signature. Terminal replacements reference the same escrow, never a new principal. |
| Reserve exhaustion / concurrent intents | Per-payer sequence queue; atomic wallet-wide reservations and reserve-aware balance check. Bound pending escrows and fee headroom before signing. |
| Duplicate retries | UNIQUE intent→create identity, invoice and (owner, create Sequence); separate UNIQUE (intent, operation) signed outbox rows. Same blob resubmitted. Our replays returned `tefPAST_SEQ`, original ledger unchanged, no new object. |

**One Sol-day target, about 7–8 hours if #286–#288 seams are available:**

1. **2 h:** escrow signer/ledger adapter in `server/xrpl.ts` / `shared/xrpl.ts`;
   separate escrow row plus create/finish/cancel outbox in `server/store.ts`.
   The existing `submissions` table permits only one row per intent: retain it
   for direct payments, do not overload it for three escrow operations.
2. **2 h:** `escrow-v1` schemas/quote/facilitator handling in `shared/x402.ts`,
   `shared/contracts/x402.ts`, `publisher/{routes,facilitator,journal}.ts`;
   payment-mode routing and quarantined proof handling in
   `server/{purchases,proofs}.ts`. Preserve direct challenge behavior.
3. **1 h:** #287 `reconcileOnce()` drives LOCKED→RELEASED/CANCELLED live;
   #288 audit kinds `ESCROW_CREATE`, `ESCROW_FINISH`, `ESCROW_CANCEL` carry hashes,
   parent escrow identity and validated results for `audit:verify`. #286 counts
   LOCKED principal as **reserved**, RELEASED as spent, never double counts;
   cancellation does not grant a new purchase authorization. Budget and 5 s plan
   confirmation remain the only authorization; no new per-purchase modal.
4. **2–3 h:** F1 receipt/budget state only, local gate audit rejects finish
   without verified proof, restart/Stop/timeout/duplicate/cap tests, live UC3
   honest finish + AlphaLeak cancel, and measured scorecard. This spike changes
   no UI. In #273, require both proof and release before citations become visible.

Version policy as `escrow-policy-v1`: for opted-in Testnet writers still eligible
under existing trust policy, use escrow if `passes === 0 || T < 0.8`; otherwise
use direct exact. Keep quarantine/delist exclusion first. Missing escrow support
means skip that writer in escrow mode, not silently weaken the chosen protection.
**Cut** RLUSD, external facilitators, arbiter service, general fair exchange,
buyer reputation service, multi-process signing, new SDK surface, fee sponsorship
and elaborate UX. If the recovery/audit/admission seams are absent, the safe
one-day scope is the labelled standalone demo; do not omit persist/reconcile or
call the product integration finished. #273 must reconcile its older F5/Day 5
scope against this estimate rather than inherit every aspirational checkbox.

**Asset check:** the live `feature` RPC reported `TokenEscrow` and
`fixTokenEscrowV1` enabled (IDs and snapshot in the JSON). The retired `Escrow`
entry reported false despite successful XRP escrows; that legacy flag alone is
not a capability probe. Issued-token escrow is therefore available at amendment
level on this Testnet, but [issuer Allow Trust Line Locking, authorization and
trust-line requirements](https://xrpl.org/docs/references/protocol/transactions/types/escrowcreate)
still apply. No RLUSD issuer flag check or token escrow was performed: **RLUSD
escrow readiness is unproven**. Keep it outside this Sol-day.

## Reproduction and limits

The script persists private wallet/secret/transaction state before submission,
resumes completed cases without new payments, and aborts instead of re-signing
an unresolved expired transaction. Public output is an allowlist with hashes,
fees, ledger indices and account/object snapshots; no seeds or live secrets.
Do not commit or copy its private recovery directory into evidence. Network
errors print only the stage. It is a small research runner, not the production
reconciler: interruption after ledger success but before recording the observation
can inflate observed timing, and simultaneous runner processes are unsupported.
Run it serially; retain state until every escrow is closed. The fresh-wallet
faucet and reserves are setup liquidity, separate from the measured fees.
