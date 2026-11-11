# DECLUTTER layout evidence — 12 November 2026

Local Chromium production bundles at 1280×800 and 390×844. No hosted questions, model calls, purchases, public proof creation or cloud changes. All external browser connections are blocked by the harness. Ledger reads are deliberately unavailable; no verification result or live Testnet success is claimed.

## Measurements

A box is an enclosing content surface with a complete border/background boundary. Internal dividers, plain examples, buttons, header/sidebar, focus rings and environment/budget chips do not count. Closed dialogs and children of closed disclosures do not count. Count the entire default page, including below the fold.

| Surface | Desktop before → after | Mobile before → after |
|---|---:|---:|
| Home | 7 → 3 | 5 → 3 |
| One successful purchase | 3 → 2 | 2 → 1 |
| Ledger-topic run | 4 → 2 | 3 → 1 |

Home is below the report's four-box target because the orchestrator explicitly grouped judges and builders inside **one** closed area. The three remaining boundaries are the step band, composer and shared disclosure. There is no fourth decorative boundary. Run boundaries are Sources and Spend on desktop; mobile retains Sources and its existing Net cost sheet.

Before source: `b43fcef486631b7cd3cd4a83a5b3f7f5d6ab9cf9`, independently archived and built using Vite in a temporary directory. The same harness remeasured all six baseline counts and captured `before-*.png`; see `before-measurements.json`. After screenshots and measurements are in this directory.

The one-purchase fixture is a **synthetic layout projection** of committed `demo/traces/UC3-key-reveal.json`: keep the VERIFIED Fab Floor intent/receipt, remove the refunded intent and its events, adjust spending totals. Other answer/checkpoint/anchor material is recorded from the original two-purchase run. Its anchor does **not** prove this projected run. The ledger-topic variant changes the question only; the old answer is deliberately irrelevant and is not answer-quality evidence. The simulated scenario uses the unmodified recorded `demo/traces/UC2.json`. Refund uses the unmodified key-reveal recording. Pending and decryption-failure variants are explicitly synthetic UI states.

Home composer bottom: 539 px desktop / 681 px mobile. First example starts: 589 / 739 px, inside both first folds. Successful desktop spending surface: under 650 px (asserted). Five successful promise rows and their repeated captions are absent from the default page; still reachable inside Check it yourself. Refund, unresolved escrow and decryption-failure details stay open.

The 14 after-layout tests cover default and expanded views at both widths, genuine Tab/Enter reachability of the grouped home area, builder controls and spending proof, all five promise rows, key-check availability, separate run verification/public fact scopes, Escape and focus return from the existing mobile sheet. All audited states have **0 serious/critical axe violations** and **no horizontal overflow**. `measurements.json` holds per-scene results. No browser recomputation is claimed merely because a recorded key check passed; the action says the browser key check has not run.

## Reproduce

```
npm run build
UPDATE_EVIDENCE=1 npx playwright test --config tests/playwright/declutter.config.ts
npx vitest run tests/declutter.test.tsx tests/hosted-judges-corner.test.tsx src/components/KeyRevealLifecycle.test.tsx tests/first-touch-ui.test.tsx tests/why-bought.test.tsx tests/u1-ux.test.tsx src/fixtures/wpui.test.tsx
```

For baseline, archive the pinned frontend and its imports to a temporary directory, symlink the installed dependencies, build there, then set `DECLUTTER_BASELINE=1 DECLUTTER_DIST=<temporary-dist>` and run the same Playwright config with `-g 'baseline counts'`.

Existing browser tests updated only for the intended disclosure navigation: `hosted-ui.spec.ts`, `judges-corner.spec.ts`, `ui-nov11.spec.ts`. Existing component assertion updated: judges' corner now follows examples. **Snapshot/golden updates: none. Thresholds and gates loosened: none.**

Initial JS uses the deploy/performance gate calculation: follow `dist/.vite/manifest.json` imports recursively from `index.html`, gzip each unique JS file with Node's `gzipSync`, sum the byte counts. Final integrated bundle measurement and clean-head gate evidence follow below.

After rebasing onto DEPLOY-FIX #496 (`fdec2adc`), the real production build on Node **22.23.4** measures **158,463 B** initial JS gzip using `scripts/bundle-budget.mjs`, below this lane's **160,000 B** target and the unchanged deploy gate's 170,000 B ceiling. See `bundle.json`. A separate acceptance assertion pins the stricter 160,000 B lane target. No optional chunk sizes are counted as initial imports.
