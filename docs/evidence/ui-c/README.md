# UI-C: quiet labels and payment steps

Local Chromium evidence at 1280 × 844 and 390 × 844, based on main `c50199e5`.
These are local fixture renders, not a hosted redeploy, live model run or fresh ledger verification.

Home has **5 → 1** visible environment/provenance messages at both widths. Its single chip reads **XRPL Testnet**. Shared-wallet, no-value, test-fund, provider and rate-limit details remain in its popover. Writer provenance stays in each badge's disclosure. The composer button and Check our work disclosure open one recorded-run verifier; they do not admit a question.

The main run column now shows one payment stepper per key-reveal purchase. Pending payments stay expanded; delivered or refunded payments collapse to one summary line. Steps and links use the existing SSE run snapshots. No server API, receipt/export data or verifier inputs changed. The existing browser key check is available inline. Recorded replay now withholds final escrow/key/refund fields until the matching trace events appear.

## Evidence

`before/` contains the baseline Home and run views. `after/` contains Home, expanded steppers, whole run views and the actual browser replay build. The baseline and after images use the same fixture family; the final no-show screenshot uses the recorded cancellation in `UC-key-reveal.json`. Settled and quality refund data come from `UC3-key-reveal.json`. Pending is a synthetic locked-state cut of its settled purchase. Cropped `stepper-*.png` files show the mechanism at both widths.

| Surface/state | 1280 px | 390 px |
| --- | --- | --- |
| Home markers | 1 | 1 |
| Home + settled + pending + no-show + quality refund | 0 serious/critical axe findings | 0 serious/critical axe findings |
| Recorded UC3 replay, both purchases | 0 serious/critical axe findings | 0 serious/critical axe findings |
| Horizontal overflow | none | none |
| Stepper interactive targets | ≥44 × 44 px | ≥44 × 44 px |

`before/metrics-*.json` and `after/metrics-*.json` retain the marker counts and layout/accessibility observations. Reduced motion was enabled for captures; the stepper's 180 ms state-color transition becomes instant under reduced motion.

## Verification

- `npm run build` with Node 22.23.4: initial JS is **159,105 B gzip**, below 162,000 B (and the existing 160,000 B target).
- `npx vitest run tests/payment-stepper.test.tsx tests/ui-c-markers.test.tsx src/components/KeyRevealLifecycle.test.tsx`: all stepper states, snapshot updates, delayed delivery, multiple purchases, simulated-link suppression, replay event boundaries, one shared checker and existing key-check outcomes.
- `npx playwright test --config tests/playwright/ui-c.config.ts`: desktop/phone states, exact transaction URLs, one Home marker, targets, axe and bundle budget.
- `npm run build:demo` then `npx playwright test --config tests/playwright/ui-c-replay.config.ts`: actual recorded UC3 replay, two steppers, create/finish links and unchanged #512 provenance labels. Build only; no publication.
- Copy assertions updated in `hosted-judges-corner.test.tsx`, `p2-builders-corner.test.tsx`, `ui-a-copy.test.tsx`, `ui-a.spec.ts`, `hosted-ui.spec.ts`, `foundation.spec.ts`, `e2e.spec.ts`, `ux.spec.ts`, `ux2.spec.ts`, `coverage-environment.test.tsx`, `declutter.test.tsx`, `presentation-components.test.tsx`, `web-panels.test.tsx`, and `src/fixtures/{internals,wpui}.test.tsx`.

## Intentional assertion changes

Per the owner's 12 Nov direction, redundant marker assertions now expect a quiet chip and disclosures on demand. The simulated UC3 working-view token count changes from 4 to 3 because “fixture models” moves out of the chip. Builder footer no longer repeats the no-value notice. Writer badges show authorship without repeating the network. No money, leak, verifier, test timeout, accessibility or bundle threshold was loosened. Run-level fallback notices, explorer network labels, receipts and replay provenance remain.

Hosted redeploy is required. The replay build has not been published.
