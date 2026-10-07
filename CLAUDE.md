@AGENTS.md

Run `make` for the task list (demo, checks, `make doctor` / `make keys` preflight). In a worktree beside a running main demo, use `make run OFFSET=100`.

Several agents work in this repo at once. For a large or multi-file task, create a worktree from `origin/main` (`git worktree add ../tftf-wt/<branch> -b <branch> origin/main`) before the first Write, and first check `gh pr list` for an open PR that touches the same files; if one does, stop and say so. Minor fixes, or changes the user explicitly asked for in this checkout, may be made in place. If `git status` shows changes you did not make, leave them alone and mention them.
