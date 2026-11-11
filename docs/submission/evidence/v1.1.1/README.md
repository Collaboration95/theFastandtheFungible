# Judge-pack release checks, 11 Nov 2026

XRPL Testnet only, no real value. Packages downloaded from the published v1.1.1
GitHub release using authenticated `gh release download`. No live hosted question,
cloud change, site publication or hosted screenshot refresh was performed.

- MCP package SHA-256: `218a96b9bfe7c8b788d357bd6939160dadeaa9e5f409b98e8a34e802b292a56e`.
- `try-output.txt`: published package, fresh isolated state, ephemeral ports,
  fixture research and decision models, fictional and team-authored writers,
  faucet-funded wallets. Six validated Testnet transactions: buy, writer-signed
  refund, re-buy, anchor. RESULT PASS in 59.2 s, ledger 12/12; budget S$2.00,
  gross S$0.70, net S$0.40 (labelled demo equivalents). This is a single run;
  the historic cold npm-cache timing and its misses remain unchanged.
- `verify-python.txt`: published v1.1.1 wheel installed with `--no-index` into
  an empty venv; `researchagent verify docs/evidence/hosted-export-nov11/receipts.json
  --ledger`. Read-only public Testnet lookups: 46 passed, 0 failed, 2 skipped,
  anchor ledger 22228575, ledger 11/11, RESULT PASS. The input is the committed
  earlier hosted export, not a new v1.1.1 hosted answer. Skipped is not failed;
  verification does not prove writer identity or source accuracy.
- `node scripts/check-release-urls.mjs`: 22 pinned URLs passed. Public release
  and asset URLs are resolved through authenticated `gh` and HEAD-checked at
  their release, asset or tagged-file endpoints. No release bodies are fetched.
- `npm run site:progress -- --at origin/main` and `node scripts/facts.mjs`:
  snapshot at `bd52beff`, 270 main PRs since 21 Sep, 15 published releases,
  latest v1.1.1; historic measurements keep their own dates and labels.
- Deck export: 14 pages; no missing images, stale markers, placeholders or
  detected frame overflow. All PDF pages rendered for visual inspection.
  Slide 3 shows the full new CLI output with transaction links shortened;
  slide 7 shows the published wheel's actual verification output.

The hosted slide-10 images and README hero retain their existing capture
manifest. The orchestrator must run the final `--refresh-shots` only after
redeploy, within the hosted question allowance, then export and publish the site.
The recorded video's Claude MCP scene still needs the optional v1.1.1 re-record;
voice, upload, team name and submission remain owner items in issue #265.
