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

After captures include the integrated judges’ corner, key checks, writer
credentials, FIN header and accessibility work. Each `sourceHead` in
`after-checks.json` pins its exact source. The replay uses subsets of the same
variable Geist UI and Mono fonts, retaining all weights, outlines and metrics
with full-font fallback. A keyboard skip link focuses the recorded run without
adding header height.

The unit regression checks the committed hosted receipt (40,000 drops) renders
S$0.40 and 0.04 XRP (40,000 drops), with no ledger amount for simulated receipts.
`TZ=America/New_York` checks the receipt still reads 11 Nov 2026, 15:06 SGT.
Source AST and HTML checks cover src/ and demo/ renderers, including deliberately broken
money and hash examples; recorded source prose and unit fixtures are excluded.
The guard permits ordinary query-text clipping and KEY’s existing exact
uppercase 8…8 key-material expression; a changed length fails. Its helper
consolidation is routed below. Account addresses retain the separate 6…4 rule. Wire timestamps and owner
wallet balances use the same shared helpers. Accessibility and overflow claims
refer to the twelve refreshed surface/viewport checks in `after-checks.json`.

The merged ledger card and reserve-release summary also use the exact-drop XRP
helper. Reserves retain up to six decimals, including a one-drop reserve and
amounts beyond floating-point precision; fees stay in drops. Ledger validation,
provenance and signed receipt fields are unchanged.

<!-- l12-performance:start -->
## Replay performance

Measured local Pages builds with Lighthouse 12.8.2 at 390 × 844, DPR 3,
simulated slow 4G (150 ms RTT, 1,638.4 Kbps) and 4× CPU slowdown. Both use the
same gzip-6 static server. The final build and gates use Node 22.23.4. Before is `e5541665` (L1/L2 already applied, eager
recordings); after is `937e8233689340c6785da9bb803fcb0a7ce8b902`, on integrated main, including the merged JC, KEY, writer-credential and FIN work.

| Metric | Before | After | Target |
| --- | ---: | ---: | ---: |
| Initial transfer | 650.4 KiB | 271.6 KiB | <300 KiB |
| Lighthouse performance | 76 | 99 | ≥90 |
| LCP | 4.77 s | 1.56 s | ≤2.50 s |
| Entry gzip | 368.6 KiB | 3.4 KiB | ≤80 KB |
| Question visible, real CDP throttling | 3.69 s | 0.37 s | ≤2.00 s |
| Lighthouse accessibility | 100 | 100 | — |

The required after screenshots and receipt shots are refreshed on the same source;
`sourceHead` in `after-checks.json` pins each refreshed surface. Receipt shots show the verified S$0.40 purchase
and its matching 0.04 XRP ledger amount in the actual viewport.

These are single cold-load measurements, not deployed or release claims.
`performance.json` records exact bytes, timings, resource names and entry
SHA-256s; `lighthouse-{before,after}.json.gz` preserves the raw reports. The
network browser test confirms one trace initially, another only on demand, and
a selected-trace preload and one inlined stylesheet, with no CSS requests or initial app preload. Earlier attempts retained misses rather than changing budgets: lazy loading scored 94 but missed at 2.93 s LCP; the integrated build reached 95 but missed at 300.7 KiB and 2.70 s; the UI-font subset passed transfer at 290.1 KiB but missed at 2.71 s. A loading-shell attempt still missed at 2.91 s, and waiting for its question font reached 2.56 s. The final build emits and inlines one combined stylesheet, including verifier styles, with no duplicate CSS requests. Only the selected trace preloads from HTML; the shared app loads after the public question paint, leaving bandwidth for the question and its font. A held-recording browser test proves that the shell contains only that public question and loading status, with stable heading geometry across seven viewport/sidebar/storage/font cases. The existing variable Geist UI font is subset from 29,400 to 19,824 bytes and Geist Mono from 23,128 to 13,972 bytes; all weights, glyph outlines and line metrics are retained, with full-font fallback for other characters. No metric threshold or live check was loosened.
<!-- l12-performance:end -->

## Routed to the owning lanes

- JC: `src/hosted.ts`: re-export `money` as `minorText`; derive environment
  strings from `ENV`, retaining actual rail/provider and paused/offline/ended
  state and ending every full/short label with “no real value”. Use
  `ENV.hostedConfigured(testnet, buying)` for ready status, preserving #495:
  configured buying alone does not establish an answer’s provenance. The
  recorded judges’ corner retains its audited live-answer disclosure.
  The new judges’ corner caption changes “Recorded on this sandbox, 11 Nov”
  to “Recorded on this demo, 11 Nov 2026”, retaining its truthful disclosures.
  The `UC-key-reveal` footer link should read “Recorded walkthrough: writer
  never reveals, money back”, matching the picker and its 7 Nov recording.
- JC: `src/components/hosted/HostedEnv.tsx`: use `ENV.hostedWriters` for the live
  writers caption and the canonical ENV values for environment headings.
  Retain the fictional-writer disclosure wherever the catalogue includes them.
  The local simulated hosted preview currently inherits the live green dot;
  use amber for simulated payments and green for Testnet, retaining offline states.
- JC: `src/components/hosted/HostedHome.tsx`: judges’ corner title uses
  “Verify a real run from this demo in your browser”.
- JC: `src/components/Ask.tsx`: local/replay Home h1 “Research with a wallet.”;
  align the subtitle with hosted while retaining the actual simulated/fixture
  mode. No changes to JC-owned files in this PR.
- KEY: `src/components/ShowWork.tsx`: render `receipt.settledAt` through
  `whenSGT` inside `<time dateTime={receipt.settledAt}>` instead of raw ISO.
  In its confirmed-plan line, replace the trailing check glyph with the shared
  check Icon under the existing successful-plan condition.
- KEY: `src/components/PaymentRow.tsx`: put refund hash in a `.mono` span and
  its full value in the link's `title`. Its existing `shortHash` import already
  receives the shared uppercase 8…8 rule without changing this file.
- KEY: `src/components/KeyRevealLifecycle.tsx`: environment paragraph uses
  `ENV.testnet`; keep “key-reveal escrow” as a separate state description.
  Replace the two technical-detail success glyphs and the matched-key result
  glyph with the shared `Icon name="check"`. Preserve all
  real verification conditions. In `KeyCheckResult`, put the fictional-writer
  disclosure outside the environment label so “no real value” stays last.
- KEY: `src/verify/key-on-ledger.ts`: re-export `shortTx` as `shortHex` instead
  of its duplicate formatter (already uppercase 8…8 for key/condition values).
- X2: `src/components/WriterVerification.tsx`: replace the domain link’s
  trailing external-arrow glyph with `Icon name="external" size={16}`. Keep
  “Testnet, identity only, not KYC” and both destinations unchanged.
- FIN: do not rebuild `site/demo/` while L12 is open; after merge rebuild it
  from the merged app when publishing. Generated `site/demo/` is ignored.

No L1 change was needed in QUAL, H7 or X1-owned files. `Toasts.tsx` and
`Sidebar.tsx` already used the shared icons on this baseline. No edits to
`src/styles.css` or `src/App.tsx`. No money/hash-format requirement or gate threshold was loosened. The source
guard’s prose and exact key-material exceptions above are explicit and tested.
