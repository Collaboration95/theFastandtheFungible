# Explainers source

Imported from `gh-pages` at `6f700388548282691251c0a7b40bb1c8c8b55153`. This tree contains the complete static pages and their local runtime assets, so identity changes can be reviewed with the app in one main-branch PR. It is not a claim of a Pages deployment.

Edit these sources; `node design/brand/build-brand.mjs` refreshes favicons, page-specific OG cards and metadata. Run `python3 scripts/site-publish.py` to publish this tree. Preserve current evolution data when synchronizing; the historical evolution refresh tools remain on gh-pages. The shared header (#272) is written by `node scripts/site-header.mjs` between `site-header` markers; do not edit it by hand. Every HTML page, including slides and notes, uses the shared header and brand metadata.

## `/progress/` (Since SingHacks)

Generated, never hand-edited. One command rebuilds the facts, images, page and home card:

```sh
npm run site:progress   # needs network and `gh auth`; refuses to build if any number or source is missing
git add site/progress site/index.html && git commit -m "Refresh progress page"
npm run site:publish
```

- `scripts/build-progress-data.mjs` writes `progress/data.json` (with `generated_at` and `source_sha`) from git, `gh` (merged PRs and releases reachable from the counted commit), `CHANGELOG.md`, `docs/SFF-PUSH.md`, eval/evidence JSON and `ledger/transactions.json`, and copies each screenshot into `progress/img/`.
- `scripts/render-progress.mjs` renders `data.json` into `progress/index.html` and the home card between `progress:start` / `progress-card:start` markers; `--check` runs in `npm run hygiene`.
- Words live in `scripts/progress-story.mjs`; numbers never do.
- Re-run after the final release and after any new measurement. When the blind v5 bank is measured, commit its results at `docs/evidence/v5-heldout/{v5,v5-negatives}/results.json`; the page switches from "not run yet" to the measured score. The builder never opens the v5 bank itself.
- `/evolution/` stays as the October archive; its November chapter now points here.
