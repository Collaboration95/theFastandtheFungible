# UX-1 evidence (#311)

Local Chromium, offline research, simulated payments. No live providers or
Testnet funds were used. Screenshots in `after/` use 1440×900 and mobile
390×844; names match the original screen set. The running/pay/verify/refund
closeups replay committed event prefixes, labelled by the persistent Demo
indicator. Home, clarify, plan, completed UC1/2/3, receipts, palette and mobile
are driven in the production browser. No image or motion implies settlement.

## Labelling map (UX-DIRECTION §3.2 / hard gate 5)

| Clause / surface | Location |
| --- | --- |
| Persistent environment, including record mode | EnvIndicator in the shell |
| First visit, fictional writers, settlement, search and named models | What's real here, once; suppressed for recordings |
| Receipt and transaction | ReceiptSheet footer and Transaction/Refund tx rows; demo hashes absent |
| Refunds | PaymentRow quiet `· simulated` / `· XRPL Testnet` |
| Model, search, planner and decision substitution | Neutral Notice above the answer, only on substitution |
| Fictional writers and articles | One Writers sentence |
| Actual decision provider | Each round caption, including when folded |
| Engine labels | Verbatim ModelLabels and other Show work tabs |
| API / MCP / SDK labels | Unchanged contracts and payloads |
| PDF, exports, social cards and public entry points | Existing labels retained; redesign remains #312 |
| Notifications | `(demo)` / `(Testnet)` suffix |

The specification's literal word-count target conflicts with its required
refund and receipt text. A completed UC3 has one **persistent indicator**, plus
the required quiet refund rail: **2** literal environment-word occurrences,
from 8. The refunded receipt adds `None (simulated)` twice and its footer:
**5** literal occurrences, from 10. There are **2 environment disclosure
surfaces** with the receipt open, plus the mandatory refund rail behind it.
No required label was removed or hidden to meet the conflicting count.
The machine measurement is `.playwright/evidence/ux-labels.json`.

## Recovery finding

Confirmed missing server handoff, filed as #314: reconciliation in
`server/purchases.ts` can verify a paid intent; `server/routes.ts` runs it
without re-entering `loop.retryDelivery`, and excludes FAILED runs at boot.
The stale checkpoint can leave a failed run above a verified payment. The UI
now says Recovering and offers Resume answer using the existing idempotent
retry endpoint. Unit and injected-browser regression checks cover the stale
state. Automatic server recovery remains #314, separate from the UX lane.

## Deliberate interaction detail

Activity stays expanded through a run's completion to preserve reading
position and the existing CLS threshold. Reopened saved runs start collapsed;
the user can collapse Activity at any time. No test threshold was relaxed.

## Next lane (#312)

Answer/claims/citations and Export menu; Sources and decisions table markup;
Writers table, palette and settings/budget picker; final mobile Spend sheet;
PDF length/layout and site/README. Shared tokens, Notice, SpendPanel and
ReceiptSheet are ready for reuse. The first-extract headline remains the
separate research-quality observation H2.

## Validation

`npm run check:fast`: 660 tests; existing policy/leak checks retained.
Production Chromium: 13 checks including the two UX evidence cases.
Performance: initial JS about 126 KB gzip, palette under 1 KB gzip,
UC2 CLS 0.0139 (limit 0.02 unchanged). `node desktop/build.mjs` stages the
shared UI successfully; no local DMG rebuilt. `make record OFFSET=1800` was
opened in Chromium, and both UC2/UC3 clips completed. The committed MP4 is
about 0.52 MB; the larger raw take remains ignored. Run `UX_CAPTURE=1 npx
playwright test tests/ux.spec.ts` to deliberately replace the evidence images;
normal browser tests write only under `.playwright/evidence/ux1`.
