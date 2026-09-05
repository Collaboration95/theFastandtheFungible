# FairCut verification log

Updated: 2026-09-05 (Asia/Singapore)

## Current evidence

| Area | Evidence | Status |
| --- | --- | --- |
| Repository baseline | Greenfield `tftf/prototypes/Faircut`; existing user changes preserved | recorded |
| Fixture story | `/demo` populated, resettable, guided + manual path | browser-passed at 1440×900 and 390×844 |
| Creative comparison | 3 candidates, 2+ provider identities, recorded structured assessment | implemented |
| Rights guard | deterministic commercial/territory/term/duration/provenance/payee checks | implemented; unit + API smoke covered |
| Protected delivery | 402-style `PAYMENT-REQUIRED` route; clean master outside `public/` | implemented; API smoke covered |
| Live XRPL Testnet | server-only adapter + independently queried `validated: true` / `tesSUCCESS` | proven in `evidence/live-testnet-2026-09-04.json` |
| Fulfilment | manifest-backed byte/policy/MIME/timing/order verification + corrupt hash exception fixture | implemented; API + browser smoke covered; receipt in `evidence/fixture-fulfilled-receipt-2026-09-05.json` |
| Responsive/accessibility | desktop/mobile CSS, keyboard semantics, drawer focus trap, reduced motion | browser-passed; 390px scroll width = 390px |
| Comprehension review | structured five-question review protocol | reviewers not yet run |

## Commands

The intended commands are `npm install`, `npm run generate:media`, `npm run
lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:contract`, `npm
run build`, `npm run verify:premium`, `npm run test:e2e`, and `npm run
test:a11y`. Results are appended here after each verification loop.

Latest verification loop:

- `npm run lint` — pass.
- `npm run typecheck` — pass.
- `npm run test:unit` — 7 tests pass, including event-chain mutation/reordering detection.
- `npm run test:contract` — repeatable API smoke passes for pre-payment 402,
  pinned x402 v2 fields, blocked rights, changed quote, risk outage, payment
  failure/unconfirmed, replay, malformed evidence, verified fulfilment, and
  exception withholding.
- `npm run build` — pass; Vite production bundle generated.
- `npm run verify:premium` — strict audit pass; 0 findings.
- `npm run test:e2e` — 6 tests pass (3 functional + 3 accessibility); screenshots captured under `verification/`.
- `npm run test:a11y` — 3 tests pass; zero axe violations across initial,
  blocked, payment, final, receipt, mobile-navigation, and zoom-equivalent
  states.
- `npm run generate:media` — pass; team-created MP4/MP3 fixtures generated.
- Production smoke: `FAIRCUT_PORT=8789 npm run serve`; `GET /` and `GET /demo` — 200.
- Direct contract smoke: clean master pre-payment — 402 with `PAYMENT-REQUIRED`;
  blocked authorize — 403 with three deterministic reason codes; changed quote
  — 409 `REQUOTED_REVIEW_REQUIRED`; facilitator fixture — 503
  `PAYMENT_FAILED` with safe retry; replay — same `SIMULATED_SETTLED` state and
  no second transaction hash; payment-evidence unlock — 200; happy fulfilment —
  `FULFILMENT_VERIFIED`; clean master after fulfilment — 200.
- Recorded mode smoke: `RECORDED TESTNET EVIDENCE` UI label; receipt reports
  `validated: true` / `tesSUCCESS` from the archived Testnet hash while the
  protected master still returns 402 until a purchase-state evidence header is
  presented.
- Live configuration safety: explicitly selecting `testnet-live` without a
  server-only signer returns `503 LIVE_CONFIGURATION_REQUIRED`; it does not
  fall through to fixture settlement.
- Browser CUA: initial story, discovery, blocked state, eligible selection,
  fixture settlement, fulfilment, final playback, receipt drawer, Escape/focus
  restoration, mobile navigation focus/Escape, 390px no-clipping, and delivery
  mismatch receipt were inspected. Reduced-motion CSS is present and the state
  transitions do not depend on timers.

## Comprehension check protocol

Before claiming the story is validated, give the running `/demo` to three people
who did not build it, without narration. Ask them to answer:

1. Who is Leah and what is urgent?
2. What does the agent decide that a fixed checkout would not?
3. Why was the most attractive cue blocked, and did money move?
4. What exactly was purchased and delivered?
5. What does the XRPL transaction prove, and what does it not prove?

Record anonymized answers, any copy/interaction change, and the retest result
under this heading. The prototype currently has no reviewer responses; this is
an explicit remaining acceptance item rather than implied evidence.

## Open risks

- The recorded XRPL Testnet transaction is intentionally not replayed on every
  fixture reset; a new live run still requires a funded disposable wallet.
- A native Japanese reviewer is not required for the English-first MVP, but any
  future Japanese UI/critical copy must pass the Japanese content review gate.
- Three-person comprehension results must be collected before the product claim
  can be marked complete.

## Browser evidence notes

The rendered desktop initial/blocked/receipt states were inspected at
`1440×900`; the mobile initial/exception/navigation states were inspected at
`390×844`. The initial viewport showed Leah, the deadline, the bounded mandate,
the 12-second placement, fixture mode, and the primary guided action. The
blocked state showed the objective failures and no-transaction copy. The final
fixture receipt showed local policy, x402 v2, `SIMULATION — NOT SETTLED`, asset
and licence digests, an eight-event hash-chain projection, and limitations.
The mobile document reported `scrollWidth === clientWidth === 390`; the
timeline is the only intentionally scrollable inner viewport. Durable captures
are `verification/desktop-initial.png`, `verification/desktop-blocked.png`,
`verification/desktop-receipt.png`, `verification/mobile-initial.png`,
`verification/mobile-blocked.png`, `verification/mobile-receipt.png`,
`verification/mobile-exception.png`, and `verification/offline-simulation.png`.
Drawer close returned focus to `Open rights receipt`; mobile navigation close
via Escape returned focus to `Open project navigation`.

## Recorded Testnet run

The live run at `2026-09-04T20:17:10Z` used a newly funded disposable payer and
activated payee. XRPL independently returned `validated: true`,
`TransactionResult: tesSUCCESS`, ledger `20486702`, exact `8,000` drops, fee
`12` drops, source tag `804681468`, and a MemoData binding for invoice
`FC-MTNEADYB-BEE833`. Explorer:
<https://testnet.xrpl.org/transactions/2932C274EB1867C3694470B0512E54102563004A9FD5CB65616B0D753FD35280>.

This is **Recorded Testnet evidence**, not a fresh live run each time the local
fixture resets. The raw evidence record is in
`evidence/live-testnet-2026-09-04.json`; it contains no seed or authorization
header. The earlier attempted run also validated with `tecNO_DST_INSUF_XRP`, which
is retained as a genuine failure-path observation and led to activating the
payee account before the successful run.
