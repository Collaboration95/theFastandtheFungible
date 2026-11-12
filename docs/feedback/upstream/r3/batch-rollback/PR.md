# docs: explain missing ALLORNOTHING inner results

## Change

Qualify the Batch result guidance for uncommitted inner transactions, and explain complete-ledger reconciliation before interpreting missing hashes. Extends #3366 with Testnet evidence and preserves the warning added in #3968.

## Evidence and validation

See the accompanying issue/comment draft for minimal reproduction and explorer-linked hashes. Patch base: `182f8d20b157aa791433ff399a0f30dbed74a5eb` (`master`). `TESTS.md` records upstream commands and their actual results. No Mainnet writes or external filing ran.

## Limits

Dated Testnet observations do not establish a permanent public-node policy. No consensus or payment behavior changes.
