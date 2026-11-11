# L3: proof page in the house style

Baseline: origin/main 0f7a2c25 (JC merged); local server rendering the same frozen snapshot before and after. Fixture research/decision models, fictional writers and a synthetic anchor: these captures are layout evidence, not a real Testnet transaction. No hosted question, live provider, cloud write or real money.

The existing H9-14 label assertion was updated to pin the exact string required by L3; no check was relaxed.

The hosted label is the spec's canonical string. L12's shared helper was not merged at implementation time. The downloaded card stays self-contained, script-free and uses system fonts.

Font assets live under `/assets/proof-fonts/`, rather than the spec's suggested `/fonts/`, because the hosted nginx front caches `/assets/` as public/max-age=31536000/immutable but sends no-store for `/fonts/`. Filenames include the SHA-256 prefix. Vite copies these public assets into dist without a config change; neither nginx nor H7 files changed.

Geist is the unchanged Fontsource Latin variable font. Geist Mono is the same OFL font, subset to printable ASCII for the hashes, addresses and verifier commands it displays, with optional layout features and hinting removed; the 100–900 weight axis remains. Non-ASCII text retains the system monospace fallback. Licence ships alongside. Generated proof-tokens.ts exactly matches src/tokens.css, with a parity test; bundling needs no source-file reads at runtime.

Regenerate fonts with FontTools (installed in a scratch venv):
```
pyftsubset node_modules/@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2 --unicodes=U+0020-007E --layout-features='' --no-hinting --flavor=woff2 --output-file=mono.woff2
```
Copy both fonts to public/assets/proof-fonts using a 12-character SHA-256 suffix; update server/proof-fonts.ts. To regenerate tokens, encode the trimmed src/tokens.css as the PROOF_TOKENS string in server/proof-tokens.ts.

Validation: 29 proof-page/refusal/receipt-regression unit tests; both hosted proof-of-refusal browser tests, including the browser verifier and no public-read cookie; axe serious/critical = 0 at desktop and 390 px. Browser confirms both variable fonts loaded, primary button Geist 13px/600, sentence-case labels and no mobile horizontal overflow. No text removed; only the specified label and displayed hash truncation change.

Lighthouse 13.6.0 default mobile throttling on the local SSR page, cold navigation; performance/accessibility/best-practices: before 100/100/100, after 100/100/100. The lazy verifier is only loaded after the explicit check and is excluded from initial page weight. JSON summaries retained alongside screenshots. All thresholds and checks unchanged.

Initial page: before 16,167 B HTML; after 17,298 B HTML + 41,476 B fonts = 58,774 B (57.40 KiB). Lighthouse total-byte-weight includes favicon and response overhead: 60,117 B (58.71 KiB), below 60 KiB. Cache headers follow the existing hosted nginx configuration; the acceptance fixture front itself serves static files with no-store.

Captures: before/after-1280.png and before/after-390.png; tall mobile preview captures are capped by the browser tool, with after-390-bottom.png covering the remaining controls and footer. Desktop captures show the complete page. A text extraction comparison preserves all body text apart from the specified environment-label correction and 10-to-8 hash prefix.

H7 integration follow-up (code-derived, no live deployment probe): `docker/hosted/front/default.conf.template` adds Cache-Control no-store at the outer proxy, including for upstream cached assets. The VM nginx has immutable caching for these URLs; the outer proxy must preserve that policy for end-to-end browser caching. L3 leaves H7 deployment files unchanged.
