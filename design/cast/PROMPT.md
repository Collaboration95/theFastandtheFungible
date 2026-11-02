# Cast v1: art direction and concept prompt

Production art is a restrained geometric icon and illustration system: one
24-unit grid, 1.5-unit Ink strokes, flat Paper surfaces and sparse semantic
accents. No faces, mascots, sparks, bobbing or generic entrance animation.
Legible at 16–24 px and large. Each state has a small mark and a labelled
160×160 illustration. The technique, not the tone, comes from Yald's
`docs/brand/yaldi/build-assets.mjs`. The reference clones were read only.
The optional common-grounds raster-loop pipeline is not needed here.

## Concept-sheet prompt / production direction

Design a professional state illustration system for ResearchAgent. Think the
restraint of Linear, Vercel or Stripe: simple geometry, consistent grid and
stroke, warm light palette, generous space. Scout uses wayfinding, question,
lantern, scales, transfer, magnifier, alert, report and stop symbols. Purse is
an abstract wallet with explicit full/spending/refunded/locked/empty/simulated
states. Writer marks combine a neutral geometric profile with a signature
wafer, kopi cup, bond chart, paper, energy, stack, record or split-seal prop. Receipt
and Ledger use document geometry. No anthropomorphic faces or cartoon tone.
Colour never carries state alone. Motion only for short, meaningful money or
refund movement, respecting reduced motion; full choreography is #262.

`concept.png` is the deterministic code-rendered contact sheet. It supersedes
the discarded playful image-model exploration; the production SVG generator is
the source of truth. `sheet.html` shows every state at large, 24 px and 16 px.

## Regenerate and use

- `node design/cast/build-cast.mjs`: all SVGs, manifest and self-contained QA sheet.
- `node design/cast/build-cast.mjs --raster`: also 320×320 transparent PNGs
  under `png/` and `cast-sheet.png` (headless Chromium via Playwright).
- `node design/cards/render.mjs --title 'Meet the cast.' --metric '0 → 48 SVG poses'`:
  1200×630 and 1080×1350 PNGs. `--pose purse-simulated` selects any manifest pose.
- `design/cast/qa.html` through Vite renders every pose using the real React
  `<Cast>`; `tests/a11y.spec.ts` checks axe, reduced motion and narrow reflow.

`<Cast who="scout" pose="paying" />` is a labelled, static state mark.
It never controls policy or settlement. Keep the real
budget, receipt label and transaction link alongside it. Ledger does not infer
finality after four seconds. Locked Purse is reserved for the future #261;
using its artwork does not mean escrow exists. Writer `paid` poses include the
free Open Records character for sheet completeness; never show it as paid in
the product without a real event. The app-wide motion wiring is #262.
