# Contributing

Thanks for looking. Humans and coding agents both work here; the rules are the same.

## Run it

```bash
make setup   # npm ci and a .env from .env.example
make run     # offline fixture demo, no keys needed
make         # list every task (live demo, preflight, checks)
```

Node 22.13 or newer. Testnet only: never use real money, create cloud resources, or
log API keys and wallet seeds.

## Make a change

1. Branch from `origin/main`. Agents use a git worktree
   (`git worktree add ../tftf-wt/<branch> -b <branch> origin/main`) and check
   `gh pr list` first so two people don't edit the same files.
2. Run `npm run check:fast`, commit, then `make ship-check`. Push, then
   `make ship-check PUBLISH=1`. The clean
   PR head must have a successful `local-gate` commit status before merge. See
   [local gate](docs/contracts/local-gate.md) for change routing and cache rules.
3. Open a PR with the [template](.github/pull_request_template.md). It starts with the
   [judging criterion](docs/JUDGING-CRITERIA.md) the change serves. Keep PRs few and
   larger rather than many tiny ones.
4. If you ship something notable, add one line to [docs/SFF-PUSH.md](docs/SFF-PUSH.md).
   The lane that ships a feature day's work cuts its release with
   `make release TAG=vX.Y.Z` after merging; see [local releases](docs/local-releases.md).

## The five hard gates

No change may break these ([README](README.md#hard-guarantees)):

- no premium bytes before a grant;
- the budget is the only spending authorization, and only policy code can start a
  purchase, never the LLM;
- one charge per intent;
- real citations;
- everything simulated or substituted is labelled.

If you loosen a gate check, leak threshold or test because the real fix lives
elsewhere, say what and why in the PR. Never loosen one silently.

## Builder feedback

Friction with XRPL, x402 or the Starter Kit is useful to the ecosystem. Open a
"Builder feedback" issue the day it happens, with the repro.

## Tests and ports

Tests use ephemeral ports. Don't bind 5100, 8788 or 8790; the demo owns them.

The pre-commit hook checks staged whitespace only; commits do not repeat the
full test suite. The change-aware local gate owns merge admission. All product code changes run
unit tests, including the five hard-gate contracts, plus lint, typecheck and
seeded chaos smoke. Affected browser, desktop, Python and consumer paths add
their checks; unknown paths run everything. Docs-only edits use hygiene and
applicable generated README checks. `npm run check:fast` remains available as
the uncached full legacy check.

All automatic hosted test/release triggers are disabled. CI and Testnet boot
remain manual diagnostics; desktop's optional owner-dispatched signing inputs
retain the future Apple Developer ID capability. No workflow publishes releases.
`npm run site:publish` still builds locally and pushes gh-pages; GitHub Pages
continues serving the judge site.

`make ship-check` wraps the existing gate with base `origin/main` (`SHIP_BASE`
overrides). `SHIP_MODE=release` or `breaking` runs `gate --full` then full final
acceptance with `--all-arch`. `PUBLISH=1` posts `local-gate` only after all stages
pass on an unchanged clean commit/tree, using the existing gate publisher.
Policy/payment/refund, persistence/recovery, public SDK/wire contracts and
packaging/toolchain/gate changes warrant the full tier. No narrower unit routing
is introduced: code changes still run every unit test; full release acceptance
runs at releases or real breaking changes.

Coverage floors (including payments branches ≥85%), 200-episode chaos and the
2,000-ask isolated soak remain unchanged. Native arm64 recovery and both DMG
builds are local release responsibilities; cross-building x64 does not prove
native Intel execution. Python's supported-version matrix and Linux/container
boot are separate portability checks. Testnet network probes require explicit
opt-in and are distinct from offline fixture evidence. See [local releases](docs/local-releases.md)
and [acceptance scheduling](docs/contracts/acceptance-scheduling.md).

## Licence

Code and the fictional demo corpus are [MIT](LICENSE). The writers and articles are
synthetic and labelled so.
