#!/bin/sh
# DO NOT RUN WITHOUT OWNER APPROVAL (#265 A11).
set -eu
[ "${R3_OWNER_APPROVED:-}" = YES ] || { echo 'Owner approval required; set R3_OWNER_APPROVED=YES only after approval.' >&2; exit 1; }
cd "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
gh issue comment 3366 -R XRPLF/xrpl-dev-portal --body-file ISSUE.md
# Optional alternative fix PR, rather than another issue: sh PR-FILE.sh
