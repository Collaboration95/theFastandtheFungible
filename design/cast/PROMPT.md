# Cast v1: art direction and concept prompt

Production art is parametric SVG: 160×160, 4 px Ink outlines, flat fills,
shared proportions, restrained spark strokes. Light theme only. Source of truth:
`build-cast.mjs`; do not edit generated SVGs by hand. Adapted technique from
`Collaboration95/yald`'s Yaldi `docs/brand/yaldi/build-assets.mjs` and concept
prompt, read as reference only. Scout is an original folded-paper field
researcher; no Yaldi artwork is copied. The optional `common-grounds-makeathon`
`server/animate.mjs` / `tools/slice-sheet.mjs` raster-loop pipeline was read;
no frame strip is needed for v1.

## Concept-sheet prompt

Create a concept exploration sheet for ResearchAgent, an expertise search
engine with a wallet. Warm Paper #FBF8F2, Ink #24211E, Editorial Salmon #D9A28F,
Salmon Deep #91503F, Evidence Green #2F6B4F, Ochre #9A6B20, Block Red #9B3E35.
Clean flat illustration, strong silhouettes, dark 4 px outlines, generous
spacing, consistent scale. Scout is a paper-faced field researcher in a salmon
folded paper hat: lantern, scales, coin, magnifier, alarm, report, stop sign.
Purse is a drawstring wallet with visible full, spending, returning-coin, lock,
empty and SIMULATED-tag props. Eight fictional writer busts have signature
props: wafer, kopi cup, bond curve, salmon newspaper, lightning, paper stack,
public-record courthouse, gossip mask. AlphaLeak's mask slips when caught.
Receipt prints and takes VERIFIED / REFUNDED / SIMULATED stamps. Ledger stacks
pages; any tick and hash are illustrative placeholders. Light theme only,
no gradients, no 3D, no stock robot, no real people or real publisher branding.
A concept exploration only, not payment evidence. Never communicate state by
colour alone: use a prop and text label.

The generated `concept.png` is an exploration, not the production asset source.
`sheet.html` is the authoritative contact sheet for all 48 production poses.

## Regenerate and use

- `node design/cast/build-cast.mjs`: all SVGs, manifest and self-contained QA sheet.
- `node design/cast/build-cast.mjs --raster`: also 320×320 transparent PNGs
  under `png/` and `cast-sheet.png` (headless Chromium via Playwright).
- `node design/cards/render.mjs --title 'Meet the cast.' --metric '0 → 48 SVG poses'`:
  1200×630 and 1080×1350 PNGs. `--pose purse-simulated` selects any manifest pose.
- `design/cast/qa.html` through Vite renders every pose using the real React
  `<Cast>`; `tests/a11y.spec.ts` checks axe, reduced motion and narrow reflow.

`<Cast who="scout" pose="paying" />` is a labelled state mark; `motion` opts
into a brief entrance. It never controls policy or settlement. Keep the real
budget, receipt label and transaction link alongside it. Ledger does not infer
finality after four seconds. Locked Purse is reserved for the future #261;
using its artwork does not mean escrow exists. Writer `paid` poses include the
free Open Records character for sheet completeness; never show it as paid in
the product without a real event. The app-wide motion wiring is #262.
