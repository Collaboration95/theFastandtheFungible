# Explainers source

Imported from `gh-pages` at `6f700388548282691251c0a7b40bb1c8c8b55153`. This tree contains the complete static pages and their local runtime assets, so identity changes can be reviewed with the app in one main-branch PR. It is not a claim of a Pages deployment.

Edit these sources; `node design/brand/build-brand.mjs` refreshes favicons, page-specific OG cards and metadata. Run `python3 scripts/site-publish.py` to publish this tree. Preserve current evolution data when synchronizing; the historical evolution refresh tools remain on gh-pages. The shared header (#272) is written by `node scripts/site-header.mjs` between `site-header` markers; do not edit it by hand. Every HTML page, including slides and notes, uses the shared header and brand metadata.

## `/progress/` (Since SingHacks)

Generated, never hand-edited. One command rebuilds the facts, images, page and home card:

```sh
npm run site:progress   # needs network and `gh auth`; refuses to build if any number or source is missing
                        # on a branch, add `-- --at origin/main` so the counted SHA survives the squash merge
git add site/progress site/index.html && git commit -m "Refresh progress page"
npm run site:publish
```

- `scripts/build-progress-data.mjs` writes `progress/data.json` (with `generated_at` and `source_sha`) from git, `gh` (merged PRs and releases reachable from the counted commit), `CHANGELOG.md`, `docs/SFF-PUSH.md`, eval/evidence JSON and `ledger/transactions.json`, and copies each screenshot into `progress/img/`.
- `scripts/render-progress.mjs` renders `data.json` into `progress/index.html` and the home card between `progress:start` / `progress-card:start` markers; `--check` runs in `npm run hygiene`.
- Words live in `scripts/progress-story.mjs`; numbers never do.
- Re-run after the final release and after any new measurement. When the blind v5 bank is measured, commit its results at `docs/evidence/v5-heldout/{v5,v5-negatives}/results.json`; the page switches from "not run yet" to the measured score. The builder never opens the v5 bank itself.
- `/evolution/` stays as the October archive; its November chapter now points here.

## Site configuration and metadata

`HOSTED_APP_URL` in `scripts/site-config.mjs` is the single authored live app
URL. Change it there, then run `node scripts/site-meta.mjs` and
`node scripts/site-header.mjs`. The generated home line shows the 13–19 Nov
window and a Replay fallback. The shared header also covers `demo/index.html`;
its replay transport and recorded bytes are unchanged.

`node scripts/site-meta.mjs` writes one description and distinct OG image per
page, including Replay, Progress, Ledger and the three guide pages. Its offline
`--check` runs through `site-header --check` in hygiene. The site-specific PNG
manifest lives beside the cards. Do not run the older whole-product brand
builder to refresh site content: it rewrites app/desktop artifacts and predates
Progress and these guide pages. Migrating that generator and enabling the
whole-product `brand:verify` in hygiene needs a separate cross-scope change.

The issuer widget sends only `account_info` for the documented RLUSD issuer on
validated Testnet/mainnet ledgers. A failed check is unknown, never off. It does
not load a wallet or submit transactions. Public addresses and the AccountRoot
flag are linked to Ripple/XRPL documentation on the page.

Targeted verification: `OFFSET=2300 node scripts/site-verify.mjs` (wrap the full
site run in the sprint heavy lock). The server uses port 7400 and exits after
verification. Captures and the report go to `docs/evidence/site-nov11/`.
Publisher push retries are capped at three; retries fetch/rebase remote changes
and stop on conflict, without force or deletion of remote-only content.
