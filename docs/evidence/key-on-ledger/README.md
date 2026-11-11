# KEY: check the key yourself, why it was bought, ran the plan you confirmed (11 November 2026)

**XRPL Testnet · no real value.** Two touches from the story review (`14-ideas-story.md` §5 T1 and T4), one PR.
Nothing here spends money, creates a cloud resource or asks the hosted demo a question.

## T1 · "Check the key yourself": sha256(key) = lock

The payment card said "Key matches the escrow lock ✓", which is our server's claim (`keyVerified`). A button on the
key-reveal lifecycle now proves it from the public ledger alone, in the visitor's browser:

1. it fetches the **EscrowCreate** and the **EscrowFinish** by hash from the same public Testnet nodes the "Verify on
   XRPL" button uses (`wss://s.altnet.rippletest.net`, then `clio.altnet`), read-only `tx` lookups, nothing signed or sent;
2. it reads the lock, `Condition = A0258020 ‖ sha256(key) ‖ 810120`, from the create and the key,
   `Fulfillment = A0228020 ‖ key`, from the finish, and requires the finish to name the same lock, the same owner and the
   same escrow sequence, and both transactions to be validated and successful;
3. it computes `sha256(key)` with WebCrypto and compares it with the lock.

| State | What the card says | ✓? |
| --- | --- | --- |
| match | "sha256(key) = lock ✓ · Computed in this browser from XRPL Testnet ledger N, read from s.altnet.rippletest.net", the lock and the key as first and last 8 hex characters, explorer links to both transactions | yes |
| tampered key, other lock, other escrow, failed transaction | "Doesn't match: sha256(key) is not the lock" and which of the four it was | never |
| `txnNotFound` on every node | "Not found on this node yet" (pending, a clock icon, no "failed") | never |
| not validated yet | "Not final on the ledger yet" | never |
| no reachable public node, or WebCrypto missing | "Couldn't reach a public XRPL node. Nothing was checked." | never |

- **Code:** `src/verify/key-on-ledger.ts` (new). It imports the browser verifier's public-node helper lazily, on the
  first press, so the verifier chunk is loaded only then; it does not edit `src/verify/browser.ts`. **No server route.**
- **Where it shows:** only for a run settled on XRPL Testnet (a SIMULATED run has nothing on the ledger and shows no
  button), on a key-reveal escrow that has both transaction hashes and is not cancelled. On the `/demo/` replay the note
  says "fictional writer".
- **Accessibility and layout:** a real `<button>` (focusable; Enter and Space both ran the check in Chromium), a polite `role="status"` region for the result, one short motion (the padlock's shackle opens once on a
  match; under `prefers-reduced-motion` Chromium reports `animation: none` and the same open shackle), no horizontal overflow at 390 px
  (`scrollWidth` 390 of 390 on the replay, 1280 of 1280 on desktop). Styles are in `src/components/key-check.css`;
  `src/styles.css` is untouched.
- **Full values:** only the short hex is shown; the key is public on the ledger after the finish, and the explorer link
  is where to read it whole.

### The real check against the public node

`node --import tsx docs/evidence/key-on-ledger/check.mts` (output: [`real-check.jsonl`](real-check.jsonl)), run on 11 Nov
from the Mac, read-only, no keys:

| Pair | Result | Ledger | Node | Time |
| --- | --- | --- | --- | --- |
| committed hosted export ([`hosted-export-nov11`](../hosted-export-nov11/README.md)), create `B6FDBD22…`, finish `4CCB4E56…` | **match** | 22228567 | s.altnet.rippletest.net | 1.4 s |
| `/demo/` replay, AlphaLeak (the refunded one), create `A8DC9B57…`, finish `4D3D0F43…` | **match** | 22224890 | s.altnet.rippletest.net | 1.2 s |
| `/demo/` replay, The Fab Floor, create `29F1B9F6…`, finish `D3B8F480…` | **match** | 22224896 | s.altnet.rippletest.net | 1.3 s |

In Chromium (Playwright, headless) the same check ran from the built `/demo/` replay: the page sent only `tx`
requests, printed `sha256(key) = lock ✓` for The Fab Floor at ledger 22224896, and raised no page errors. Fault
states (tampered key, other lock, other escrow, failed finish, not found, not validated, no node, second node
fallback, a create on one node and a finish on another) are covered against the repository's deterministic ledger
simulation (`tests/fixtures/key-reveal-ledger.ts`, signed `EscrowCreate` and `EscrowFinish` blobs).

## T4 · "Why bought" on each payment, and "Ran the plan you confirmed"

Both lines are built from run data the server already records; **no server change, `DecisionPanel.tsx` and `App.tsx`
untouched** ("Why this article" stays).

- **Why line** (`src/whyBought.ts`, shown in `PaymentRow`): from the decision round that selected the source (its open
  fact or gap, the probe flag) and the run budget, at most 90 characters, for example
  *Bought because it covers "analyst estimates on capacity allocation" · within your S$2.00*. The budget is dropped
  before the reason is cut; a refunded purchase adds *Refunded: writer-signed* last; a long fact is cut at a word and
  never ends on "in" or "of". A test purchase from a new writer says so. A run that bought nothing has no payment rows
  and so shows no line; a purchase that never settled, was cancelled or has no decision record shows no line.
- **Plan check** (`src/planCheck.ts`, shown in Show work → Trace): `PlanSheet` records the plan the visitor confirmed
  (an edited plan counts as the one confirmed), and Show work compares its searches with the `PLAN` event the run
  recorded (R9-A, #473), matching the run to the confirmation made just before it began (up to 60 s before its
  first event; never after it, and never reused for another run; session storage keeps the run binding across a reload of the tab).
  - searches equal (order and case ignored): **Ran the plan you confirmed ✓**;
  - different: one plain sentence, never a ✓: *The run added "…" to the searches you confirmed.* / *left out "…"* /
    *searched for "…" instead of "…", which you confirmed.*, and, when a clarifying answer was given, *Your answer to the
    clarifying question was used to plan again.* (the plan card shows the plan from before the answer, and the server
    plans again with it);
  - an old snapshot without a `PLAN` event, a run this browser did not confirm (an agent run, another device) or a
    replay: nothing is shown.
  - The requested facts are **not** compared: the server derives them again whenever the searches are edited, and the
    visitor never saw them.

## Screenshots (1280 and 390 px, light theme)

| What | 1280 | 390 |
| --- | --- | --- |
| Payment card after the check passes (replay, The Fab Floor, "fictional writer") | [shots/key-check-match-1280.png](shots/key-check-match-1280.png) | [shots/key-check-match-390.png](shots/key-check-match-390.png) |
| Refunded payment: reason, then "Refunded: writer-signed", and the button before it is pressed (replay, AlphaLeak) | [shots/payment-refunded-1280.png](shots/payment-refunded-1280.png) | [shots/payment-refunded-390.png](shots/payment-refunded-390.png) |
| Why line with the budget (local fixture run, SIMULATED, no button) | [shots/payment-why-1280.png](shots/payment-why-1280.png) | [shots/payment-why-390.png](shots/payment-why-390.png) |
| Show work: "Ran the plan you confirmed ✓" (local fixture run) | [shots/showwork-confirmed-1280.png](shots/showwork-confirmed-1280.png) | [shots/showwork-confirmed-390.png](shots/showwork-confirmed-390.png) |
| Show work: a changed plan after a clarifying answer | [shots/showwork-changed-1280.png](shots/showwork-changed-1280.png) | [shots/showwork-changed-390.png](shots/showwork-changed-390.png) |

The local fixture runs are a `make run OFFSET=137` stack (fixture models, SIMULATED payments); the replay is the built
`/demo/` bundle served from a scratch directory. Nothing was asked on the hosted demo.

## Tests

- `tests/key-on-ledger.test.ts` (15): match, both answer shapes, tampered key, other lock, other escrow, failed finish,
  swapped transactions, malformed hash, not found, not validated, node fallback, a create and a finish on different
  nodes, no node, closing every lookup, short hex.
- `src/components/KeyRevealLifecycle.test.tsx` (7, two existing): when the button is offered, every result state (no ✓
  outside a match, no "failed" in a pending state, the full values never printed), the button flow with a pending
  retry, and a check that throws.
- `tests/why-bought.test.tsx` (17): the one-purchase line, no line for a 0-buy run, a refunded purchase, the round that
  picked the source, the 90-character bound over 48 combinations, plain English, test purchases and unsettled
  purchases, word-boundary cuts, the plan check for match, mismatch, clarify and old snapshots, `PlanSheet` recording
  a confirmed and an edited plan, the matching window and a reload.

## Not done, and why

- The verifier chunk (`browser-*.js`, 163 kB gzip, shared with "Verify on XRPL") is fetched on the first press. A
  standalone socket for one lookup would avoid that but would duplicate the node list the CSP and the verifier share.
- A confirmation made on another device is not known here, so Show work shows no plan check for it.

## Resumed acceptance review (11 Nov, 17:30–17:40 SGT)

Reviewed predecessor `d0e3ade1` against every T1/T4 acceptance item, rebased on current main, then tightened four cases:

- Missing transaction result metadata, ledger index, owner, sequence or finish Condition now gives **unreadable**, never a match. Both validated transactions must explicitly report `tesSUCCESS`.
- A key check belongs only to its two transaction hashes. Changing the payment remounts the check; an old in-flight result cannot appear under new explorer links.
- A payment's legacy reason fallback skips rounds that explicitly selected a different source.
- A confirmation must precede the run, binds once to its run ID, and cannot be overwritten by a later confirmation or reused for another run. Repeated search terms count; malformed session storage is ignored.

Fresh evidence (the earlier evidence above remains the predecessor's):

| Acceptance | Result |
| --- | --- |
| Tampered key / different lock / other escrow / failed transaction | Mismatch; result region has no tick |
| `txnNotFound` / not yet validated | Pending, never failed |
| No node | “Couldn’t reach a public XRPL node” |
| Why ≤90 characters; refund suffix; zero buys | Pass, including 48 fact/budget/refund combinations |
| Matching / changed / old plan | Tick / plain sentence without tick / no line |
| Regression suite | 45 passed: 16 ledger, 8 lifecycle, 21 why/plan tests |
| Required hosted pair, read-only s.altnet | Match, ledger 22228567, 1401 ms |
| Replay AlphaLeak / Fab Floor, read-only s.altnet | Both match, ledgers 22224890 / 22224896, 1287 / 1254 ms |
| Keyboard in shared browser | Enter (desktop) and Space (mobile) each ran the real ledger check |
| Horizontal width | Desktop 1280/1280; mobile 390/390; mobile spend dialog 388/388 |
| Rendered why lengths | 82 (refunded), 80 (kept), below 90 |

Fresh real-node output: `real-check-resume.jsonl`. New light-theme screenshots:
`shots/resume-key-match-1280.png`, `shots/resume-key-match-390.png`, `shots/resume-refunded-390.png`.
The screenshots were inspected in the shared browser; the Testnet/no-real-value and replay fictional-writer labels remain.
The single lock transition and its reduced-motion override are unchanged from the predecessor.
Only public `tx` reads were needed; no hosted question, money transfer or live model call.

The plan confirmation association is local browser bookkeeping, not a server-signed proof. It uses the first event's
server timestamp and a 60 s preceding window; a browser/server clock skew or a longer queue may hide the line.
A confirmation on another device remains unknown. Nothing here changes spending authorization.
