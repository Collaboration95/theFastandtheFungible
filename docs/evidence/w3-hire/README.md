# W3 — one-command hire chain

XRPL Testnet · fixture models and fictional writers · no real value.
The final packed-consumer timings and hashes are recorded below.

Final result: **two packed runs passed**, 66.8 s and 75.8 s
(CLI timings include wallet preparation, answer and ledger verification; exclude
npm installation). Wallet preparation took 3.41 s and 3.18 s respectively.
Run 1 used Node 26.3.1; run 2 used the repository's Node 22.23.4.
Both print exactly one `RESULT PASS` and seven explorer links. The inbound hashes
and all seven timeline hashes differ across the two explicitly new questions.
Each chain reconciles 220,000 inbound = 90,000 article + 5,000 royalties +
110,000 change + 15,000 retained drops; network fees and provisioning are separate.
The public exports include the answer, receipts and the read-only verifier checks.

- Artifact: SHA-256 `e54dcfc2d2c4ee772512f3e5b77e7c6f04b0c9a3495dae401f6743103a0bac15` (3,261,673 bytes).
- Packing source: local pre-integration commit `13aece268d3dbc932ebb6d7ae79f18943d9fc599`.
  These ledger runs qualify that pinned artifact. The subsequent integration
  rebase includes HM wallet signing and C3 corpus changes from main; the combined
  tree passed all 21 targeted hire/CLI tests again. The shipping local-gate
  receipt separately identifies the final clean PR head.
- Commands and environment: [manifest.json](manifest.json).
- Full timelines: [run1.txt](run1.txt), [run2.txt](run2.txt).
- Receipts and verifier checks: [run1.json](run1.json), [run2.json](run2.json).
- Real unattended recovery: [live-recovery.json](live-recovery.json).

Scope: locally built and packed MCP tgz, `npx -y file:///…tgz try --testnet --hire`
from two initially empty folders, OFFSET 1900 (engine listeners are ephemeral).
The two folders have no clone, `.env` or installed dependencies. They share a
private faucet wallet cache and use separate engine databases and npm caches.
This is a Testnet payment demonstration with substituted fixture research, not
live-model or mainnet evidence. Private seeds and signed-payment journals are
retained outside the repository. No cloud resources or real money were used.

Development observations (retained, not counted as final PASS runs):

- A bare absolute tgz path was treated as an executable by npm 11.16.0 and failed
  with permission denied. The documented `file:///` package URL works.
- One development build supplied `xrp` rather than the escrow asset's exact
  `XRP` spelling. It returned change without buying and failed the CLI's required
  key-reveal/anchor assertion. The required-purchase check was retained.
- A preliminary full chain passed in 80.6 seconds, but printed too much of the
  fictional answer. The CLI now prints a 240-character excerpt.
- Two subsequent attempts stopped after inbound, escrow, change and one royalty
  because answer anchoring temporarily held the shared payer sequence. The
  second royalty was unsigned. The payer's ambiguity protection was retained;
  the CLI now retries delivery using the same idempotency key and saved inbound
  blob. `live-recovery.json` records their completion on server restart with no
  caller replay. Original raw failures and private journals remain outside Git.

Automated checks include caller replay/concurrency, signed and unsigned payout
recovery, a validated payout with a lost response, ambiguous versus proven
expired attempts, inbound settled before research, and unpaid pending/expired
inbound attempts that must never be submitted by the worker. No gate or budget
was loosened.
