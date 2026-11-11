# L12: shared presentation and replay shell

Local evidence only. No deployment, provider purchase or real-money payment.

Before: main `bd52beff` (v1.1.1). Hosted home uses the local HOSTED=1 HTTPS
stack, fixture models and simulated settlement. App run uses the production
build with the committed simulated UC3 recording supplied through intercepted
read-only API responses. Replay uses the built Pages subpath and committed
recordings (historical Testnet payments, fictional writers). Public ledger
lookups in the replay are read-only; screenshots do not certify live validation.

Both 1280 × 900 and 390 × 900 viewports are captured with reduced motion:

| Surface | Before | After |
| --- | --- | --- |
| App run | `before-app-run-{1280,390}.png` | `after-app-run-{1280,390}.png` |
| Local hosted home | `before-hosted-home-{1280,390}.png` | `after-hosted-home-{1280,390}.png` |
| Replay | `before-replay-{1280,390}.png` | `after-replay-{1280,390}.png` |

Before replay shots capture initial run load; after replay shots capture the
completed recorded run. `after-receipt-*` and `after-writers-*` add accessibility
coverage. `after-hosted-writers-*` also shows the local hosted catalogue (12
cards, including fictional writers in their disclosure), the shared external
icons and solid empty-state border; both widths have no overflow or serious/
critical axe violations. `before-checks.json` and `after-checks.json` record
overflow and serious/critical axe violations for each surface. Chrome is the bottom of the stacked
site header and replay banner (the app controls share the site header).

Hosted-home screenshots include JC’s judges’ corner (`0f7a2c25`); replay and
receipt screenshots also include KEY’s merged work (`d06b13f1`). The replay retains variable Geist Mono in a
smaller character subset with the full-font fallback. A keyboard skip link
focuses the recorded run without adding header height.

The unit regression checks the committed hosted receipt (40,000 drops) renders
S$0.40 and 0.04 XRP (40,000 drops), with no ledger amount for simulated receipts.
`TZ=America/New_York` checks the receipt still reads 11 Nov 2026, 15:06 SGT.
Source AST and HTML checks cover src/ and demo/ renderers, including deliberately broken
money and hash examples; recorded source prose and unit fixtures are excluded.
The guard permits ordinary query-text clipping and KEY’s existing exact
uppercase 8…8 key-material expression; a changed length fails. Its helper
consolidation is routed below. Account addresses retain the separate 6…4 rule. Wire timestamps and owner
wallet balances use the same shared helpers. The 390 px Wire panel has no
overflow or serious/critical axe violations.

## Routed to the owning lanes

- JC: `src/hosted.ts`: re-export `money` as `minorText`; derive environment
  strings from `ENV`, retaining actual rail/provider and paused/offline/ended
  state and ending every full/short label with “no real value”. Keep live
  answers paired with rule-based buying when the decision provider is fixture.
  The `UC-key-reveal` footer link should read “Recorded walkthrough: writer
  never reveals, money back”, matching the picker and its 7 Nov recording.
- JC: `src/components/hosted/HostedEnv.tsx`: use `ENV.hostedWriters` for the live
  writers caption and the canonical ENV values for environment headings.
  The local simulated hosted preview currently inherits the live green dot;
  use amber for simulated payments and green for Testnet, retaining offline states.
- JC: `src/components/Ask.tsx`: local/replay Home h1 “Research with a wallet.”;
  align the subtitle with hosted while retaining the actual simulated/fixture
  mode. No changes to JC-owned files in this PR.
- KEY: `src/components/ShowWork.tsx`: render `receipt.settledAt` through
  `whenSGT` inside `<time dateTime={receipt.settledAt}>` instead of raw ISO.
- KEY: `src/components/PaymentRow.tsx`: put refund hash in a `.mono` span and
  its full value in the link's `title`. Its existing `shortHash` import already
  receives the shared uppercase 8…8 rule without changing this file.
- KEY: `src/components/KeyRevealLifecycle.tsx`: environment paragraph uses
  `ENV.testnet`; keep “key-reveal escrow” as a separate state description.
  Replace the two success glyphs with the shared `Icon name="check"` when
  updating the technical details and the new matched-key result. Preserve all
  real verification conditions. In `KeyCheckResult`, put the fictional-writer
  disclosure outside the environment label so “no real value” stays last.
- KEY: `src/verify/key-on-ledger.ts`: re-export `shortTx` as `shortHex` instead
  of its duplicate formatter (already uppercase 8…8 for key/condition values).
- FIN: do not rebuild `site/demo/` while L12 is open; after merge rebuild it
  from the merged app when publishing. Generated `site/demo/` is ignored.

No L1 change was needed in QUAL, H7, X1 or X2-owned files. `Toasts.tsx` and
`Sidebar.tsx` already used the shared icons on this baseline. No edits to
`src/styles.css` or `src/App.tsx`. No money/hash-format requirement or gate threshold was loosened. The source
guard’s prose and exact key-material exceptions above are explicit and tested.
