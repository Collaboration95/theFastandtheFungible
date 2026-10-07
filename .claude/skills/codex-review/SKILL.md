---
name: codex-review
description: One blockers-only Codex review of a PR, posted as a PR comment. Only when the user types /codex-review.
disable-model-invocation: true
argument-hint: <pr number> [model]
---

# Codex review

1. Find the PR's branch and its worktree (`git worktree list`); if there is none, create one with `git worktree add ../tftf-wt/<branch> <branch>`.
2. Run `scripts/orch/review.sh <worktree> <pr> "<issues the PR closes>"`. If the user gave a model, prefix `REVIEW_MODEL=<model>`; otherwise it uses gpt-6-luna, high effort, fast tier.
3. Report the verdict: BLOCKERS (with a one-line fix each), anything under LOOSENED, and the NITS in one line. Fix blockers only if the user asks.
