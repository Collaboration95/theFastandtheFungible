# Lane X live key reveal · 2026-11-04

`cold-runs.json` records three cold `make testnet` boots, each with a new private
scratch wallet cache and public Testnet faucet funding. The question is UC3
(Malaysia packaging lead times), sent through the same web proxy as the UI.
`firstHashSeconds` is startup to the first validated EscrowCreate event, including
wallet provisioning. Each row records the original create/finish, cooperative
refund Payment, and replacement create/finish. Fixture providers and fictional
articles; real XRPL Testnet execution, no real value. No account addresses, seeds,
keys, ciphertext or response bodies are retained here.

The ordinary `/v1/ask` hire path is additionally tested with two publisher origins,
fixture providers, production policy/signers and a **SIMULATED ledger** in
`tests/key-reveal-hire.test.ts`. This is distinct from the live cold boot evidence.
Cancellation/no-show is covered by policy tests and real process SIGKILL recovery
against a **SIMULATED ledger**, not a new live no-show capture in this lane.

Validation: `npm run check:fast` (1,216 tests plus 20-run chaos smoke), separate
`npm run hygiene`, browser Playwright (18), demo Playwright (2), ledger Playwright
(5), Python SDK (222), TS receipt conformance (193), `make release-artifacts`
including consumers. Full 200-run chaos and three key-reveal SIGKILL scenarios
passed with zero violations or double charges; summary in `validation.json`.
All 15 cold-boot hashes were independently rechecked against the public ledger,
including transaction types and the refund InvoiceID binding to EscrowFinish. No test, leak threshold or hard
gate was loosened. Schema snapshots add the optional policy check fields.

Reproduce: `node --import tsx scripts/accept-key-reveal.ts`.

After integrating main #370/#371, the fast gate passed 1,220 tests; the three
key-reveal SIGKILL scenarios passed again. The Store conflict preserves statement
reuse and atomic failed-claim recording. Original cold hashes remain unchanged.
