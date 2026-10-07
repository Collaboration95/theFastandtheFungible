---
name: ship-pr
description: Ship a finished worktree branch to main - rebase, check, PR, wait for CI, merge, clean up, note in STATUS.md. Use when asked to "push and open a PR and merge it" or when a lane's work is done.
argument-hint: <worktree path> "<closes #issues>"
---

# Ship a PR

Run from the worktree given in the arguments. Stop and report at the first failing step; never skip one.

1. `git fetch -q origin && git rebase origin/main`. If the branch was cut from `origin/main`, run `git branch --unset-upstream` first so a bare push can never target main.
2. `npm run check:fast`. Fix failures here, not after the PR.
3. `git push -u origin HEAD`, then `gh pr create --base main` with `Closes #…` lines and a short body: what changed, behaviour changes, how it was tested.
4. Review: only inside an overnight/orchestrated run, or if the user asked for one. Then run `scripts/orch/review.sh <worktree> <pr> "<issues>"`, stop on BLOCKERS, and carry anything under LOOSENED into your update. Otherwise skip this step.
5. `gh pr checks <pr> --watch --fail-fast`. Never merge before CI is green and never poll with `sleep`.
6. Merge: `gh pr merge <pr> --squash`, or `--rebase` when the commits are deliberately separate so one can be reverted alone. If GitHub reports mergeability `UNKNOWN`, re-check `gh pr view <pr> --json mergeable` a few times before retrying; on `CONFLICTING`, rebase and go back to step 2. Never hide `gh` errors with `>/dev/null 2>&1`.
7. Clean up from the main checkout: `git worktree remove <worktree>`, `git branch -D <branch>`, `git push origin --delete <branch>`.
8. Add one line to STATUS.md (PR, what merged, anything loosened) in the next PR or the orchestrator's status commit.

Report: PR link, CI result, merge commit (and the review verdict if one ran).
