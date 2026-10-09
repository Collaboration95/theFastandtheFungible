#!/bin/sh
# Copy the explainer pages from their working copies into this gh-pages tree.
# Run it after editing a page, then commit and push; GitHub Pages redeploys on push.
set -eu
cd "$(dirname "$0")"
SITE=https://collaboration95.github.io/theFastandtheFungible
MAIN=../../tftf

mkdir -p talk slides project-map
cp ../talk-page/talk/index.html talk/index.html
cp ../project-map/docs/project-map/index.html project-map/index.html
# The deck's boxes link to a local map server and its first QR code to the private
# claude.ai artifact; on Pages both point at the copies published here.
sed -e "s|^const MAP_URL = .*|const MAP_URL = '../project-map/index.html';|" \
    -e "s|https://claude.ai/artifact/JtmfZm5R94EL5F9iXYA3Tz|$SITE/talk/|" \
    "$MAIN/final-push/analysis/slides/index.html" > slides/index.html

if grep -nE "(src|href)=\"https?://(localhost|127\.0\.0\.1)|URL = 'https?://(localhost|127\.0\.0\.1)" \
    ./*/index.html; then
  echo "The links above only work on this laptop." >&2
  exit 1
fi
git status --short
