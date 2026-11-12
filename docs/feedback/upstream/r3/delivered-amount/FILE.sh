#!/bin/sh
# DO NOT RUN WITHOUT OWNER APPROVAL (#265 A11).
set -eu
[ "${R3_OWNER_APPROVED:-}" = YES ] || { echo 'Owner approval required; set R3_OWNER_APPROVED=YES only after approval.' >&2; exit 1; }
cd "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
gh issue create -R t54-labs/rlusd-cli --title 'Publish negative issued-asset settlement vectors for x402 integrations' --body-file ISSUE.md
