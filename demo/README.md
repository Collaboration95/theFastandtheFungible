# Browser replay

The `/demo/` Pages build uses `src/main.tsx` and the real app components, with a build-specific transport entry. It makes no engine, provider or wallet request. The environment label stays visible; receipts and Show work retain the original recorded mode labels. Writer links open the real app's Writers view; source citations open exact captured passages in the existing passage dialog. PDF generation is available in the local app.

`traces/UC1.json` through `UC3.json` are terminal HTTP/SSE snapshots with the engine's persisted event traces, captured by `OFFSET=700 npm run demo:capture`. Each records its source commit and timestamp. Capture forces fixture providers, keyword search, in-memory databases and simulated settlement, without loading `.env`; servers use ephemeral ports. UC2 records the pricing & margins clarification. UC1 needs no purchase. UC3 records the refund and subsequent verified purchase. No corpus file or ungranted paid passage is copied into this demo.

Run `npm run test:demo` to build and run Chromium against Python's static HTTP server on an ephemeral port, under the actual Pages subpath. Unit tests check every replay prefix for grant and citation boundaries. The smoke checks UC3 through refund, receipt, citation and Writers, then UC2 through the command palette; it also enforces the 2 MB JS+data limit and no requests outside the static site.

`npm run site:publish` rebuilds the demo into ignored `site/demo/` and publishes the site with the existing conflict-checked publisher, preserving gh-pages-only files and evolution data. `npm run publish:site` is the separate writer-publishing command.
