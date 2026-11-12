#!/bin/sh
# DO NOT RUN WITHOUT OWNER APPROVAL (#265 A11).
set -eu
[ "${R3_OWNER_APPROVED:-}" = YES ] || { echo 'Owner approval required; set R3_OWNER_APPROVED=YES only after approval.' >&2; exit 1; }
cd "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
printf '%s\n' 'Manual step: paste ISSUE.md body into the Ripple support channel described there. No email or form is submitted by this script.'
