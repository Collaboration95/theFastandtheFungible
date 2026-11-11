# Five gates, checked for this run

Local production build, recorded receipts and synthetic tampering, 12 November 2026.
No hosted questions, provider calls or payments. Published TypeScript and Python
verifier semantics are unchanged. Node tests call P4's merged hosted aggregator
with a labelled synthetic server projection of each exported audit, and compare
the order, policy, gross-budget and unique-intent violations directly. That
server module is never imported by the browser. The projection invents no paid
reads for the original exports. P4's anchoring counter stays in the existing
anchor checks, rather than replacing the fifth hard gate (labels).

The group is collapsed inside Verify this run, inside Spend's Check it yourself.
It is labelled “browser summary of the anchored audit log”. The existing groups
alone retain “Same checks as the command”. Read the summary alongside those
hash-chain and anchor checks; it adds no published verifier checks.

| Fixture | Grant before paid read | Policy and budget | One charge per intent | Citations | Labels |
|---|---|---|---|---|---|
| Committed hosted export | Not checked | Held | Held | Held | Held |
| Recorded UC3 key-reveal receipts | Not checked | Held | Held | Held | Held |
| Either + synthetic read after grant | Held | Held | Held | Held | Held |
| Same read moved before grant | Broken | Held | Held | Held | Held |
| Either + duplicate intent | Not checked | Held | Broken | Held | Held |
| Either + budget below gross spend | Not checked | Broken | Held | Held | Held |

The original hosted and UC3 logs have no READ_PAID event. Final grants alone do
not establish historical read order. Synthetic ordering entries in the unit test
exercise both directions without rewriting the recorded fixture. The citation
row uses the existing verifier's citation checks. Admission labels and the final
bundle label are printed verbatim, with the admission-time scope stated. Refunds
do not replenish the gross budget. Redacted or missing evidence stays unchecked.

`npx vitest run tests/verify-gates.test.ts tests/verify-gates-parity.test.ts tests/hosted-judges-corner.test.tsx`:
41 tests passed, including 12 comparisons with P4's actual aggregator.
`npm run build` on Node 22: initial gzip JS **158,379 B**, unchanged
**170,000 B** deploy ceiling. The gates module is a separate dynamic chunk, loaded
only after Run the checks. A request spy confirms it is absent before that click.

`UPDATE_EVIDENCE=1 npx playwright test --config tests/playwright/gates.config.ts`:
2 passed. Recorded simulated UC2 data drives the production UI; no live services.
Both viewports have **0 axe serious/critical**, **no horizontal overflow**, home
**3 boxes**, run **2 desktop / 1 mobile**. See `run-1280.png`, `run-390.png` and
the adjacent metrics JSON. A T3 shared-browser inspection also confirmed the
collapsed Spend placement and the displayed row statuses.
