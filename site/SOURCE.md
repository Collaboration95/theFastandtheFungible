# Explainers source

Imported from `gh-pages` at `6f700388548282691251c0a7b40bb1c8c8b55153`. This tree contains the complete static pages and their local runtime assets, so identity changes can be reviewed with the app in one main-branch PR. It is not a claim of a Pages deployment.

Edit these sources; `node design/brand/build-brand.mjs` refreshes favicons, page-specific OG cards and metadata. Copy this tree (excluding this note) into the gh-pages publishing tree when publishing. Preserve current evolution data when synchronizing; the historical evolution refresh tools remain on gh-pages. The shared header (#272) is written by `node scripts/site-header.mjs` between `site-header` markers; do not edit it by hand. Slides and notes keep their own presentation chrome.
