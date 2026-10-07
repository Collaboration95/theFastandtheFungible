#!/bin/zsh
# One blockers-only Codex review of a PR branch, posted as a PR comment.
# usage: scripts/orch/review.sh <worktree> <pr> "<issues>"
# Default: gpt-6-luna, high effort, fast tier. REVIEW_MODEL=<model> [REVIEW_EFFORT=<effort>] overrides it.
set -e
cd "$1" && git fetch -q origin main
out=$(mktemp -t review-$2)
if [ -n "$REVIEW_MODEL" ]; then
  flags=(-m "$REVIEW_MODEL" -c "model_reasoning_effort=\"${REVIEW_EFFORT:-high}\"")
else
  flags=(-m gpt-6-luna -c 'model_reasoning_effort="high"' -c 'service_tier="fast"' -c features.fast_mode=true)
fi
# stdin carries the prompt; without it codex waits on the terminal.
codex exec "${flags[@]}" -s read-only --ephemeral -C "$PWD" -o "$out" - >/dev/null <<EOP
Review the changes on this branch versus origin/main (run \`git diff origin/main...HEAD\` and read touched files as needed) for PR #$2, which closes issues $3. Read AGENTS.md and FINAL-PUSH.md §12 first.
This is a demo shipping in days. Report at most 5 BLOCKERS, each with file:line and a one-line fix. A blocker is only:
(a) a violation of a hard gate in prompt.md §2 (premium bytes before a grant; any spend path not gated by policy code and the budget; more than one charge per intent; a citation that doesn't resolve to an accessible exact span; an unlabelled simulation or fallback);
(b) something that breaks build, typecheck, tests or app startup;
(c) an Acceptance item in the closed issues that is not met or has no test;
(d) a leaked secret or a seed or key in logs.
Under LOOSENED, list any gate check, leak threshold, budget/charge assertion or test this diff weakens (one line each, or "none"); this is reported, not a blocker.
Everything else goes under NITS (at most 5, one line each). If there are no blockers, start with exactly "NO BLOCKERS". Do not ask for refactors, docs or style changes.
EOP
gh pr comment $2 --body-file "$out" >/dev/null
cat "$out"
