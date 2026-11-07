# Local merge gate

`npm run gate` verifies local changes before a merge. The pre-commit hook only
checks staged whitespace; full checks run at merge admission rather than on
every intermediate commit. It is offline fixture and
simulated-settlement evidence, separate from full acceptance and native DMG proof.
It never reads an ignored `.env`, installs dependencies, spends funds, creates
cloud resources, commits, pushes, merges or modifies another worktree.

```sh
npm ci
npm run gate -- --plan
npm run gate -- --base origin/main
npm run gate -- --full --no-cache
npm run gate -- --base origin/main --publish
```

`--plan` is read-only, needs only Node/Git, and does not need installed dependencies.
`--base REF` compares the merge base with HEAD, plus staged, unstaged and untracked
unignored changes. Both sides of renames count. An unknown/unrelated base, empty
diff, unknown file, script, workflow or dependency/build configuration selects
the full plan. There is no network fetch to guess a missing base. `--full`
selects every check. `--no-cache` executes each selected check even with a hit.

Only the explicit Markdown allowlist (community documents and `docs/**/*.md`)
can select documentation checks alone: hygiene, and README generation checks
when relevant. A non-Markdown file under docs is unknown and selects full checks.
Every code plan runs lint, typecheck, the **complete unit suite**, seeded 20-run
chaos smoke, key-reveal crash/replay checks and the gate's own regression tests.
None of the five hard guarantees, thresholds or assertions are disabled:
premium bytes require a grant, only policy can spend the authorized budget,
one charge per intent, real citations, and truthful simulation/substitution labels.

Browser app checks follow UI/API/shared/publisher/data changes. Replay build,
demo, judge and ledger browsers follow UI/shared/replay/site changes. Python and
the packed TypeScript SDK follow SDK/shared/engine changes. Desktop/shared/engine
changes execute the real tsx bootstrap in all five affected #395 entry points,
then the production desktop build's compilation/staging prefix and its compiled
fixture engine. This stops before production dependency installation and DMG
packaging; native Electron, signing and Keychain proof remain in acceptance.
Unmapped scripts select all these checks, so a new launcher helper cannot bypass
its browsers. Unknown changes also broaden cache inputs to the complete tree.

The scheduler admits at most ten CPU slots (or available CPUs, if fewer). Vitest
uses at most four workers, Playwright uses one or two, and numerical/native
thread-pool settings are bounded. This is a process admission budget, not an OS
CPU quota. Each command has a deadline; failure/timeout blocks its dependents
and the result. Independent checks finish so their evidence is retained.
Playwright groups have separate output directories. Desktop compilation follows
the browser app build to serialize their shared `dist` writer.

An explicit UI build precedes unit tests, including the packaged-app smoke; a
cached build is materialized whenever an uncached unit consumer needs it.

All checks execute against a `ResourceScope` temporary checkout of the captured
Git tree, using installed `node_modules`. Ignored files and local runtime stores
are absent. Subprocesses, temporary indexes, scratch and checkout directories are
owned and closed through `shared/resource-scope.ts`, including on interruption.
No reserved development port is allocated by the runner; browser/engine tests
use their existing ephemeral allocation paths. Child environments are allowlisted
and force fixture providers, simulated settlement and telemetry off. npm runs in
offline mode; missing dependencies or browsers fail instead of downloading.

## Content cache and receipts

Cache, logs and receipts live in the repository's shared Git administrative
directory under `local-gate/`; `latest.json` points to the latest receipt content.
This keeps evidence outside the source tree and works with linked worktrees.
Each step hashes its relevant Git paths, blob IDs and file modes, runtime and
installed dependency/tool versions, command/deadline/CPU configuration, and runner
configuration. Binary bytes, deletions, additions, executable bits and symlink
targets affect identity. Runtime integration roots include their fixtures and
literal helper dependencies; unit resource-creator counts cover every helper.
Hygiene covers the entire tree. Unrelated helpers do not invalidate unrelated
browser checks. Failed, skipped, corrupt or interrupted steps are never hits.
Successful steps are saved only after source stability and cleanup checks, even
when a different step fails. `--no-cache` bypasses reads, then refreshes successes.

Receipts record actual working tree SHA, source HEAD and HEAD tree, dirty status,
base/changed paths, selected steps, wall durations, CPU budget, logs, cache keys,
cache hits and their original source/duration, final source identity, and status
publication outcomes. A source change or cleanup failure blocks admission.
The cache identity excludes commit SHA, so a squash commit with identical relevant
content can reuse pre-merge successes while receiving its own receipt and status.

## Publishing and the squash merge

`--publish [EXACT_HEAD_SHA]` explicitly authorizes GitHub commit statuses through
the authenticated `gh` CLI, context **local-gate**. The optional SHA must exactly
equal captured HEAD. The origin must identify one github.com repository. Before
each pending, failure or success publication, the runner checks a clean worktree,
unchanged HEAD/tree, and that GitHub's target commit has that exact HEAD/tree.
Dirty worktrees, a changed tree, wrong targets, absent remote commits, malformed
responses and every `gh` error fail closed. No successful status is published from
a plan. A failing check publishes failure when the same clean target remains
valid; a source change prevents any further publication, leaving pending evidence
instead of claiming the old checks apply to new bytes.

After the authorized squash merge, update this checkout to the merged SHA and run:

```sh
npm run gate -- --base HEAD^ --publish
```

This classifies the squash diff (including documentation-only merges), validates
the **merged SHA**, reuses valid content cache entries, and publishes pending then
success on that SHA. The pre-merge status does not transfer across commit IDs.
Without `--base HEAD^`, an empty diff conservatively selects the full plan.
No release or hosted-acceptance claim follows from this local status alone.
