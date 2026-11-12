# docs: preflight public endpoint history and CORS

## Change

Add public-server preflight guidance for historical receipt verification and origin-specific HTTP CORS. Preserve the existing endpoint table and its CORS annotations.

## Evidence and validation

See the accompanying issue/comment draft for minimal reproduction and explorer-linked hashes. Patch base: `182f8d20b157aa791433ff399a0f30dbed74a5eb` (`master`). `TESTS.md` records upstream commands and their actual results. No Mainnet writes or external filing ran.

## Limits

Dated Testnet observations do not establish a permanent public-node policy. No consensus or payment behavior changes.
