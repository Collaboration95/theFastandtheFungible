#!/bin/sh
# DO NOT RUN WITHOUT OWNER APPROVAL (#265 A11).
set -eu
[ "${R3_OWNER_APPROVED:-}" = YES ] || { echo 'Owner approval required; set R3_OWNER_APPROVED=YES only after approval.' >&2; exit 1; }
cd "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
# Creates a fork and an external PR ONLY when the owner runs it after approval.
BUNDLE_DIR=$PWD
DEST=$(mktemp -d "${TMPDIR:-/tmp}/r3-endpoint-history.XXXXXX")
gh repo clone XRPLF/xrpl-dev-portal "$DEST/repo"
cd "$DEST/repo"
git switch -c researchagent/endpoint-history 182f8d20b157aa791433ff399a0f30dbed74a5eb
git am "$BUNDLE_DIR/fix.patch"
# Confirm this pinned patch still applies to the current default branch.
git fetch origin master
git rebase origin/master
# Re-run the commands in TESTS.md if the default branch advanced.
gh repo fork XRPLF/xrpl-dev-portal --remote --remote-name owner-fork
OWNER_LOGIN=$(gh api user --jq .login)
git push -u owner-fork HEAD
gh pr create -R XRPLF/xrpl-dev-portal --base master --head "$OWNER_LOGIN:researchagent/endpoint-history" --title 'docs: preflight public endpoint history and CORS' --body-file "$BUNDLE_DIR/PR.md"
