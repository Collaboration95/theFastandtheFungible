# ResearchAgent identity

The open index: a route to evidence, framed by two source boundaries. Ink on
Paper, a sparse Editorial Salmon layout accent, no gradients. The one character
is the pixel agent in `design/character/` (its antenna and satchel carry this mark);
see its README for where it may move.
The mark shares the cast's 24-unit grid and 1.5-unit stroke. Geist Regular is
outlined into paths so exports do not depend on fonts installed on a machine.
Geist is bundled under the SIL Open Font License; see `FONT-LICENSE.txt`.

## Rebuild

```
npm ci
npx playwright install chromium
node design/brand/build-brand.mjs
node design/brand/verify.mjs
```

No API keys, network requests during generation, image model, OS fonts or paid
services. `fontkit` is a build-only dependency for shaping bundled WOFF2 into
SVG outlines. Chromium comes from the lockfile. On macOS, `iconutil` packages
the generated iconset; other platforms write modern PNG ICNS chunks. Byte
identity is required across repeated runs with the same locked toolchain and
platform; different platform ICNS encoders are not asserted to match.
`manifest.json` records SHA-256 for generated outputs except platform ICNS;
the verification command compares ICNS across both local rebuilds too.

## Outputs

- `mark.svg`, `wordmark.svg`, `lockup.svg`, `lockup-stacked.svg`: ink artwork,
  with `-on-dark` variants, plus transparent PNG companions (1024 px marks,
  4× wordmarks and lockups).
- `sheet.html`, `brand-sheet.png`: responsive QA sheet, including actual 16/24 px
  marks, icon family and the revised cast alongside the logo.
- `app-icon.svg`, `app-icon.png`, `ResearchAgent.iconset/`: padded macOS master
  and 1×/2× PNGs. Packaging entry points: `desktop/build/icon.icns`, `icon.png`.
- `social-preview.svg`, `social-preview.png`: 1280×640 repository preview.
- `og/*.svg`: eight page-specific 1200×630 cards; PNGs in `site/brand/og/`.
- `public/`: SVG/ICO favicons, Apple touch, maskable 192/512 icons and manifest.
  Runtime favicon state strings and mark path are generated in
  `src/assets/brand/identity.ts`; `src/format.tsx` consumes them.
- `site/`: complete imported explainers source with favicon and OG/Twitter
  integration, including notes and both report pages. See `site/SOURCE.md`
  for the source revision and publishing boundary.

## Cast critique, 3 Nov 2026

Inspected all 48 poses at large, 24 px and 16 px against the owner's restrained
startup bar. Most pass: simple wallet/document/ledger silhouettes, consistent
stroke, sparse semantic accents and visible simulated/Testnet labels.
Two changes were warranted: Scout's search pose resembled a shopping bag, so
it is now a search lens with a crosshair. AlphaLeak's eye-like mask details
read as cartoon expression, so its prop is now a split seal. Writer silhouettes
and props remain useful state diagrams, distinct from the logo. No generic
entrance motion was introduced. All 14 affected SVGs (large/small), seven PNGs
and both cast-sheet captures were regenerated; the other poses were retained.

The existing evolution image is a historical snapshot of cast v1 and stays
historical. The current sheet shows the revised cast; no historical run data or
PR titles were rewritten by the naming audit. No tagged releases existed at
the audit date. Lowercase package identifiers stay compatible; `productName`
is ResearchAgent. No claim of a spending-quality or latency improvement.

Product UI amendment (UX-2, 3 Nov): Geist Sans carries prices and metadata with tabular numbers. Geist Mono is reserved for hashes, ids, code and Show work. Use the seven-size scale in docs/design/UX-DIRECTION.md.
