# UI-A: hosted-walk fixes 3, 4, 5, 6, 7 and 10

12 Nov 2026. Local production build on Node 22.23.4; baseline `5e550cf7`.
These are browser viewport checks, not physical-device evidence or a deployed release.

- No-show replay: 2 receipt records → 1 paid article/payment and 1 cancelled attempt, funds returned. A refund after an actual payment still counts as a payment, with its refund shown separately.
- Empty free evidence: the read/draft steps say “No free evidence found; checking paid previews”. An empty extractive draft without a fallback event no longer invents a model outage. Recorded provider errors retain their outage notice.
- Writers: demo-wide “Sales on this demo since 11 Nov” and personal “Your purchases”; an empty personal card says “You haven’t bought from this writer yet”, even alongside 24 demo sales.
- Home: the composer has “Verify a recorded run, no question used”. It opens the existing lazy judges’ corner. The three home boxes remain three. The completed gate summary is expanded.
- Provenance: one short badge expands to the complete unmodified publisher string in Passage, Activity and Payments. Long text wraps at 390 px.
- Verify: plain-language checks, Passed/Failed/Not checked, “View key-release transaction”; audit references and every recorded raw label remain under Technical details.

## Browser evidence

`tests/ui-a.spec.ts`, through `tests/playwright/ui-a.config.ts`, checks Home, Verify, expanded technical details, Activity, Passage, Payments and Writers at 1280×800 and 390×844. Every after screen has **0 serious/critical axe violations and no horizontal overflow**; **0 question/admission calls**. The five baseline screens at each size also have zero serious/critical violations. See `before-metrics-*.json` and `after-metrics-*.json` and the corresponding PNGs.

The repeatable tests use the committed no-show replay, a synthetic writers response with 24 demo sales, and a layout-only long publisher label. The label is applied to a candidate in memory solely to reproduce the clipping case; signed content and receipts are unchanged. The home Verify response is replaced with a committed simulated UC2 receipt bundle for offline layout checks. These screenshots do not establish a new Testnet payment or new paid-read telemetry.

After rebasing onto the new featured proof from PR #511, the shared preview opened the actual committed `public/judge/hosted-run-nov12.receipts.json` and checked it against the public Testnet node: **24 passed · 2 not checked**, all five gates Passed and expanded by default. `after-live-recorded-verify-*.png` show the result; `live-recorded-verify.json` retains the exact headlines and technical text. The earlier Nov 11 recording had 45 passed and 2 not checked, with gate 1 Not checked. `before-hosted-verify-390.png` is the supplied WALK-1 screenshot (historical hosted deployment, not the local baseline). No new question, payment, provider call or ledger write was made for that check.

## Layout-shift regression

The first locked gate found UC2 replay CLS **0.052649** against the unchanged **0.02** limit. A local layout-shift trace reproduced the same value and identified the stacked Activity badge. Activity now keeps its short disclosure inline, and a plain writer name already shown in a heading does not get a redundant disclosure. The diagnostic after the fix measured **0.019370**; the clean-head gate repeats the original performance check under the shared lock. No timing assertion or threshold changed.

## Bundle

Node 22.23.4 manifest traversal, including static imports: **158,315 → 158,904 bytes gzip**, below the task’s **160,000 B** limit. Optional verifier/gates stay lazy. The repository’s existing 170,000-byte gate was not changed; the UI-A browser test separately enforces the stricter 160,000-byte requirement.

## Reproduce

```sh
npm run build
UPDATE_EVIDENCE=1 npx playwright test --config tests/playwright/ui-a.config.ts
npx vitest run tests/ui-a-copy.test.tsx tests/ui-a-verify.test.tsx tests/hosted-judges-corner.test.tsx tests/hosted-writers-view.test.tsx tests/r9c-writers-zero-state.test.tsx tests/fix-a-nov11.test.tsx tests/r9b-answer-copy.test.tsx
```

All servers use allocated ephemeral ports. Baseline capture used a production build of `5e550cf7` at `/tmp/ui-a-before-dist`, with `UI_A_BEFORE=1 DECLUTTER_DIST=/tmp/ui-a-before-dist`.
No test, gate, leak or budget threshold was loosened.
