# Browser replay

The `/demo/` Pages build uses `src/main.tsx` and the real app components, with a build-specific transport entry. It makes no engine, provider or wallet request. The environment label stays visible; receipts and Show work retain the original recorded mode labels. Writer links open the real app's Writers view; source citations open exact captured passages in the existing passage dialog. PDF generation is available in the local app.

`traces/UC1.json` through `UC3.json` are terminal HTTP/SSE snapshots with the engine's persisted event traces, captured by `OFFSET=700 npm run demo:capture`. Each records its source commit and timestamp. Capture forces fixture providers, keyword search, in-memory databases and simulated settlement, without loading `.env`; servers use ephemeral ports. UC2 records the pricing & margins clarification. UC1 needs no purchase. UC3 records the refund and subsequent verified purchase. No corpus file or ungranted paid passage is copied into this demo.

Run `npm run test:demo` to build and run Chromium against Python's static HTTP server on an ephemeral port, under the actual Pages subpath. Unit tests check every replay prefix for grant and citation boundaries. The smoke checks UC3 through refund, receipt, citation and Writers, then UC2 through the command palette; it also enforces the 2 MB JS+data limit and no requests outside the static site.

`npm run site:publish` rebuilds the demo into ignored `site/demo/` and publishes the site with the existing conflict-checked publisher, preserving gh-pages-only files and evolution data. `npm run publish:site` is the separate writer-publishing command.

Raw snapshots are audited as well as every staged prefix: paid bodies require a
VERIFIED intent, delivered grant and GRANT trace; nested body fields must match
delivered content. The historical capture SHA/date remain in each JSON. Normal
app pace is real; only explicit replay/recording uses staged financial history.

All scenario links open their recorded run: `/demo/` and `?scenario=UC3-key-reveal`
select “Key reveal + refund (start here)” (11 Nov); `?scenario=UC-key-reveal`
selects “Writer never reveals: money back” (7 Nov). `?scenario=UC3-testnet`
selects “Plain payment”. Simulated recordings retain their explicit labels.
The canonical replay label includes the recording date, fictional writers and
“no real value”. At phone widths, expand “Replay · Testnet demo” to see the
full label, scenario picker, Pause and installation instructions. The banner
carries the disclosure because the shared app intentionally hides its local
environment pill in browser-demo mode. Reduced-motion pacing is unchanged.

L12 owns `site/demo/` rebuilds until its PR merges; FIN should rebuild after
that merge when publishing. Build output is ignored and ships via site publishing.

The entry indexes the six recordings by scenario, run ID and question. It downloads
and validates only the selected recording; other recordings load when selected or
opened from the app. There is no idle prefetch. Live hash checks use only that
recording's transaction list. When in-app navigation changes runs, the old live
ledger sockets close and its proof panel is removed; only the newly displayed
Testnet run starts a check. The header reuses the app's preloaded Geist font
with `font-display: swap`, avoiding a second font request.
Replay money, hashes and commands use a 14 KiB subset of the same variable
Geist Mono (all weights retained); other characters fall back to the app's
complete font. The font's SIL OFL is in `fonts/LICENSE`. To reproduce it with
FontTools and Brotli installed:

```sh
pyftsubset node_modules/@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2 --output-file=demo/fonts/geist-mono-replay.woff2 --flavor=woff2 --unicodes=U+0020-007E,U+00A0,U+00B7,U+2026,U+FEFF,U+FFFD --layout-features='*' --no-recalc-timestamp
```

The build stores repeated JSON subtrees once before gzip; the decoder restores
independent copies with exactly the original field values. Unit tests round-trip
all six recordings before any runtime schema or grant checks are applied.
