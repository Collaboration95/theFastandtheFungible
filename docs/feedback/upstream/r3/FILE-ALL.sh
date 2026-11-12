#!/bin/sh
# DO NOT RUN WITHOUT OWNER APPROVAL (#265 A11).
set -eu
[ "${R3_OWNER_APPROVED:-}" = YES ] || { echo 'Owner approval required; set R3_OWNER_APPROVED=YES only after approval.' >&2; exit 1; }
cd "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
# Files in review order. Does not submit the final manual Ripple support draft.
sh batch-rollback/FILE.sh
sh endpoint-history/FILE.sh
sh delivered-amount/FILE.sh
sh starter-kit-escrow/FILE.sh
sh rlusd-locking/FILE.sh
