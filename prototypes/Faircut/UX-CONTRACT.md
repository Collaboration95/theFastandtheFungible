# FairCut UX contract

## Scope and business sources

This contract governs the single `/demo` editing workspace. The authoritative
business and state requirements are in `GOAL.md`; implementation evidence is in
`src/domain.ts`, `server/index.ts`, and the tests. FairCut is a global product
with a Singapore-based primary persona and Japan territory support. The owned
locale is English (`en-SG` for display estimates and times); Japanese locale
copy and Japanese input are out of scope for this MVP, while mixed SG/JP
territory labels remain readable.

The workflow is high-consequence because it binds an external payment and a
licence. The server is authoritative for rights evaluation, quotes, invoice
consumption, settlement evidence, and fulfilment. The browser may request
commands but never sends arbitrary transaction JSON or receives a signing key.

## Canonical UI map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
| --- | --- | --- | --- | --- |
| Scrollbar | Global application stylesheet | DESIGN.md | standard / drawer surface | computed-style + browser QA |
| Toast | App-owned live-region toast | UX-CONTRACT.md | acknowledgement / persistent exception copy inline | browser status check |
| Drawer | EvidenceDrawer | UX-CONTRACT.md | modal desktop drawer / modal mobile sheet | keyboard + focus E2E |
| Button | `.button` intent/emphasis styles | DESIGN.md | primary / outline / quiet / disabled | keyboard + state matrix |
| Media controls | Native video/audio + transport wrapper | GOAL.md §19.6–19.7 | rough / preview / final | browser playback QA |
| Candidate comparison | CandidateRow + Waveform | GOAL.md §19.8 | blocked / eligible / selected | unit + browser flow |
| Phase rail | phaseLabels + state projection | GOAL.md §1 guided flow | current / complete / future | browser flow |
| Purchase state | server purchase aggregate | GOAL.md §9 | fixture / live / failure fixture | API contract tests |

## Information architecture

The page is one project workspace with four section affordances: Cut, Cues,
Rights, Receipt. These are contextual navigation anchors, not separate routes.
The current phase rail is a process indicator and is not used to skip payment
or rights states. The scenario menu is a non-modal popover for reset and
deterministic failure rehearsal.

## State and flow

`rough-cut → compare → blocked → license → deliver → final-cut` is the visible
phase rail. Underlying purchase states remain separate:

```text
DRAFT → DISCOVERED → EVALUATING → BLOCKED | ELIGIBLE
ELIGIBLE → AUTHORIZED → SIMULATED_SETTLED → FULFILMENT_VERIFIED
AUTHORIZED → PAYMENT_FAILED | PAYMENT_UNCONFIRMED
SIMULATED_SETTLED → FULFILMENT_EXCEPTION
```

The fixture path intentionally uses `SIMULATED_SETTLED` and the copy
`SIMULATION — NOT SETTLED`; it never produces a transaction hash or explorer
URL. A live adapter may only claim `validated · tesSUCCESS` after independently
reading XRPL Testnet state. Recorded Testnet evidence is a separate explicit
mode with its own `RECORDED TESTNET EVIDENCE` label.

Operation ledger:

| Operation | Trigger | Pending | Success feedback | Failure recovery |
| --- | --- | --- | --- | --- |
| Discover | Find cues / Run guided demo | Stable busy button + status | Three offers ready | Inline status; retry the same stage |
| Evaluate | Evaluate 3 cues / Next step | Separate creative + rights status | Block reason and eligible alternatives | Safe failure copy; no approval default |
| Select | Use this cue / Compare next eligible cue | Stable button | Best eligible fit | Blocked cue remains preview-only |
| Purchase | License for 8,000 drops | Pessimistic staged status | Fixture explicitly says not settled | Changed quote/risk/ledger failure stops before delivery |
| Fulfil | Verify delivered stem | Delivery verification stage | Clean stem inserted | `FULFILMENT_EXCEPTION`; retry/re-fetch/escalate |
| Receipt | Open rights receipt | Drawer fetch | Evidence drawer opens | Local redacted fallback receipt |
| Reset | Scenario menu → Reset demo | Stable busy control | Fixture returns to rough cut | Preserve any external ledger evidence |

The primary action changes label by stage: `Run guided demo`, `Next step`,
`Replay demo`. Manual controls remain present in the current decision panel.
Every economic action is pessimistic and idempotency-keyed.

## Interaction ownership

- Buttons and links are native semantics. Disabled purchase actions explain the
  hard rights block and cannot bypass the server guard.
- No forms or authored selects are used in the MVP. There is no date picker;
  expiry is a read-only mandate fact.
- The evidence drawer is a modal drawer variant: backdrop, `role=dialog`,
  `aria-modal`, focus trap, Escape close, and focus restoration by browser focus
  order. It becomes a bottom sheet below 820px and owns its own scroll surface.
- The scenario menu is a non-modal authored popover: it closes by choosing an
  action or clicking elsewhere through the browser's normal focus movement. No
  essential action is hover-only.
- Toasts use one fixed bottom-right live region and are acknowledgements only;
  critical state remains inline in the action panel and receipt.

## Responsive and accessibility behavior

At 390px the header, menu trigger, primary action, monitor, timeline overview,
candidate priority cards, mandate, progression, and receipt remain reachable in
that order. Only the timeline viewport may pan horizontally. Important hashes
wrap. Controls target at least 44px where practicable. The `prefers-reduced-
motion` media query removes playhead/entrance motion and does not change state.

Playback requires an explicit user gesture; there is no autoplay with sound.
The actual `video` and `audio` elements preserve their dimensions while the
selected clean stem swaps in. `aria-live` is limited to material action/status
changes. Keyboard users can reach all rail links, candidate audition buttons,
selection controls, action buttons, the media scrubber, menu, and drawer.

## Copy and limitations

Copy is calm, exact, and English-first. The product says `Blocked before
signing`, `No transaction was signed or submitted`, `Simulation — not settled`,
and `Payment settled; delivery did not verify`. It never says `Copyright
verified`, `Trustline approved` for local policy, or `Paid` before validation.
ODRL, provenance, SHA-256, x402, and XRPL explanations are progressive detail
inside the receipt.

## Verification contract

Required commands are declared in `premium-ui.json`. Browser evidence is stored
under `verification/` when captured. Manual review notes, current environment
mode, and any live Testnet hash belong in `VERIFICATION.md`. A missing live
credential must remain an explicit release risk, never be filled with fixture
data.
