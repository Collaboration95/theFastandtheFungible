# UI-B: replay provenance and phone navigation

WALK-1 fixes 2, 8 and 9, based on main `5e550cf7`. Local browser viewport emulation only: committed fixture recordings, no live questions or model calls, and ledger sockets closed. Before and after screenshots cover answer, payments, receipt and sidebar at 1280×844 and 390×844. Each metrics JSON includes its axe results; all eight after states have **0 serious/critical violations**.

Every replay answer now says “Recorded run · fixture answers · fictional writers and content” followed by its own settlement label. The three Testnet recordings say “XRPL Testnet, no real value”; the other three say “simulated payments, no real value”. The phone header retains the date with its controls collapsed. Titles follow the selected recording through app status changes.

| Recording | First run event (UTC) | Title and header date (Singapore) |
| --- | --- | --- |
| UC3-key-reveal (default) | 2026-11-10T20:37:17.202Z | 11 Nov 2026 |
| UC-key-reveal (writer no-show) | 2026-11-07T04:18:19.495Z | 7 Nov 2026 |
| UC3-testnet | 2026-11-07T04:23:23.720Z | 7 Nov 2026 |
| UC1 | 2026-11-07T04:14:06.912Z | 7 Nov 2026 |
| UC2 | 2026-11-07T04:14:07.610Z | 7 Nov 2026 |
| UC3 | 2026-11-07T04:14:08.084Z | 7 Nov 2026 |

Phone target bounds in CSS pixels (raw values in before/metrics-390.json and after/metrics-390.json):

| Target | Before | After |
| --- | --- | --- |
| History row | 193×28 | 175×44 |
| History options | 26×26 | 44×44 |
| New question | 223×38 | 223×44 |
| Run | 25.875×44 | 44×44 |
| Payment external icon | 16×17 | 44×44 |
| Payment proof tx links (4) | 31.375×18 | 44×44 |
| Receipt tx links (2) | 31.375×18 | 44×44 |
| Receipt transaction/refund links (2) | 218.75×37 | 232×44 |
| Receipt ledger anchor | 322.40625×32 | 340×44 |

The answer's ledger anchor is also checked (358×44 after). Actual boxes reserve space rather than extending over neighbours. Edge hit tests use elementFromPoint. Type and glyph sizes stay the same; New question keeps a 38 px visual border within its 44 px target. History rows reserve 44 px vertically, and text gives 18 px of width to the larger options target. Phone menu actions also reserve 44 px height. Desktop sizing is unchanged.

New question and history selection close the phone drawer and scrim. The replay drawer also starts below its site header and banner, which previously covered New question.

Verification:

- `npm run build:demo`, followed by `npx playwright test --config tests/playwright/demo.config.ts --grep UI-B --workers=1`: **8 passed**. UI-B tests are imported by the existing replay suite, so the ordinary local gate also runs them.
- Screenshots refresh only with `UPDATE_EVIDENCE=1`; ordinary tests write under ignored test-results/evidence/ and preserve a clean gate tree.
- Full check:fast, Node 22 initial JavaScript size, and clean-head local-gate results are recorded in the PR after verification completes.
- No test, threshold or gate loosened. No site publishing or committed site build output. FIN must rebuild the replay for the orchestrator's publication.
