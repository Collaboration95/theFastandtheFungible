# L12R: routed presentation and one-product guard

Local build evidence only. No deployment, live model request, admission or payment.

The before source is `b247e936c67b1c8eeaa4838884ef87dbecd7d33e` (#501).
After images are refreshed on the integrated implementation before the final
gate; `sourceHead` in the capture JSON pins that source commit. The following
evidence-only commit adds these images without changing the captured UI.
The hosted home uses intercepted hosted status. The one-purchase view is a
filtered copy of committed `UC3-key-reveal.json`, with only its verified purchase.
The key panel shows the recording's checks and explicitly says the browser
check has not run. These screenshots do not certify a fresh ledger lookup.

Both widths use 900 px height, reduced motion and the production Node 22 build.

| Surface | Before 1280 / 390 | After 1280 / 390 |
| --- | --- | --- |
| Hosted home | [1280](before-hosted-home-1280.png) / [390](before-hosted-home-390.png) | [1280](after-hosted-home-1280.png) / [390](after-hosted-home-390.png) |
| One purchase | [1280](before-one-purchase-1280.png) / [390](before-one-purchase-390.png) | [1280](after-one-purchase-1280.png) / [390](after-one-purchase-390.png) |
| Key check panel | [1280](before-key-check-1280.png) / [390](before-key-check-390.png) | [1280](after-key-check-1280.png) / [390](after-key-check-390.png) |

Each set has six checks: **0 serious/critical axe violations and no horizontal
overflow**. `before-checks.json` and `after-checks.json` retain the results.
The standalone browser suite also renders eight current site/proof pages,
checks their loaded Geist faces and every heading's computed weight, and takes
about three seconds for all three tests.

## Guard contract

`tests/one-product.test.ts` is included automatically in check:fast and the local
gate. Site-only changes also schedule the browser guard and invalidate its
cached result. `tests/one-product.spec.ts` is in the normal browser gate and has a
standalone `tests/playwright/one-product.config.ts` entry. It guards:

1. Self-hosted Geist / Geist Mono (including the outline-identical replay subsets),
   with system fonts allowed only as fallback faces. Current site/proof pages
   must actually load a Geist face.
2. Semantic headings and their class selectors use weight **600**; no uppercase
   eyebrow transform. Current page headings are also checked in the browser.
3. Complete environment labels match shared `ENV` strings, including its dated
   replay grammar. Hosted configuration retains truthful rail, buying and state;
   it never infers the source of an individual answer. Fictional writers remain
   disclosed. Simulated dots are amber and Testnet dots green.
4. SGD display amounts have **two decimals**; dynamic currency uses shared `money`.
5. Fingerprints use uppercase **8…8** through shared `shortTx` (account addresses
   retain the distinct 6…4 rule).
6. Calendar date renderers use shared Singapore formatting (`d Mon yyyy`,
   `d Mon yyyy, HH:mm SGT`); ISO stays in machine-readable time attributes.

The source scan covers src/, demo/, server/proof-page.ts and site/ executable
code, CSS and rendered strings. It does not interpret archived trace JSON or
source fixtures as product UI. `site/demo/` is generated and reserved for FIN;
this lane does not ship changes to that generated bundle. The small static-site helper module is compiled
from the exact canonical declarations; the guard checks its bytes against a
fresh compilation instead of allowing a second handwritten formatter.

`tests/one-product-exceptions.json` documents every exact file/rule/text exception
and its reason. These preserve archived October reports, slides and maps,
verbatim historical CLI evidence, relative trace timers, a tested SGT alias,
wire discriminators, archived scorecard timestamp strings and intentionally
offline downloadable proof-card fonts.
New drift, undocumented exceptions and stale exceptions fail.

`planted-drift.log` records an actual temporary src/ CSS file with Arial and
weight 700: the guard exits 1. The file was removed; `guard-green.log` records
the passing result. The same suite plants a negative for every rule, including
a duplicate two-decimal formatter, an alternative hash helper and a raw timestamp.

## Validation

Node **22.23.4** production build: initial JS **158,311 B**, limit **170,000 B**,
using the unchanged deploy calculation in `scripts/bundle-budget.mjs`.
Focused formatting, key-ledger and proof-page tests passed (32 tests before
adding rendered checks). No gate, money cap, leak threshold or test assertion
was loosened. Historical exception scope is explicit above.

Reproduce: `npm run build`; `npx vitest run tests/one-product.test.ts`;
`npx playwright test --config tests/playwright/one-product.config.ts`.
Only `UPDATE_EVIDENCE=1` writes tracked screenshots; ordinary gates use ignored
`test-results/evidence/`. All ports are allocated dynamically.
