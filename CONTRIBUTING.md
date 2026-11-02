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
2. Run `npm run check:fast` (lint, typecheck, unit tests, repo hygiene). It must pass
   and CI must be green before merge.
3. Open a PR with the [template](.github/pull_request_template.md). It starts with the
   [judging criterion](docs/JUDGING-CRITERIA.md) the change serves. Keep PRs few and
   larger rather than many tiny ones.
4. If you ship something notable, add one line to [docs/SFF-PUSH.md](docs/SFF-PUSH.md).
   The lane that ships a feature day's work cuts its release with
   `node scripts/release.mjs`.

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

## Licence

Code and the fictional demo corpus are [MIT](LICENSE). The writers and articles are
synthetic and labelled so.
