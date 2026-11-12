# docs: add a standalone Testnet key-reveal escrow example

## Change

Add an isolated Node example and an agentic-x402 documentation link. The custom scheme uses xrpl.js for escrow and the pinned x402 codec for headers. The exact facilitator remains outside the scheme.

## Evidence and validation

See the accompanying issue/comment draft for minimal reproduction and explorer-linked hashes. Patch base: `182f8d20b157aa791433ff399a0f30dbed74a5eb` (`master`). `TESTS.md` records upstream commands and their actual results. No Mainnet writes or external filing ran.

## Limits

Offline tests pass; the opt-in Testnet test was skipped in this packaging run. Historical Testnet hashes were independently re-read. The ledger cannot judge article quality, and successful key reveal does not provide a unilateral post-finish refund.
