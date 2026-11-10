# One agent hires another

Run it from release v1.1.0 or later (Node ≥22.13), from any directory, with no clone:

```sh
npx -y https://github.com/Collaboration95/theFastandtheFungible/releases/download/v1.1.0/researchagent-mcp-1.1.0.tgz try --testnet --hire
```

Or from a clone: `make try-hire OFFSET=1900`. The CLI uses ephemeral ports.
Releases up to v1.0.2 predate it.

One timeline follows three roles: **client agent → ResearchAgent → writer**.
The client accepts a fixed x402 invoice: S$2.00 research cap plus S$0.20 service
fee, represented by 220,000 Testnet XRP drops. ResearchAgent's policy buys the
missing fictional Kestrel–TSMC pricing/margins article via key-reveal escrow,
pays a fixed 5,000-drop royalty pool equally across distinct cited writers
(including free sources), returns unused research funds, and retains 15,000
drops. Network fees are separate. This is a custody flow: ResearchAgent receives
and forwards the client's funds. Models cannot initiate purchases.

The CLI prints explorer links for the inbound payment, each escrow create and
finish/key reveal, every royalty and change payment, and the answer anchor.
It independently checks the answer receipts, key-reveal binding, transfers,
senders, payout memos and money reconciliation read-only against the ledger
before printing `RESULT PASS`.

**XRPL Testnet · fixture models and fictional writers · no real value.** Faucet
or provisioning failure prints a reason class and a **SIMULATED** research
fallback. Its `RESULT PASS` means simulated research receipts verified; it
explicitly says the hire chain was not exercised and prints no explorer links.
It does not simulate a successful on-ledger hire.

Each command invocation is a new paid demonstration. Wallet seeds and the
client's signed-payment journal stay in the private Testnet state directory
(`$XDG_STATE_HOME/researchagent/testnet`, or `~/.local/state/researchagent/testnet`).
Operator wallet caps still apply. The public, signer-free latest evidence is
`try-hire.latest.json` in the engine state directory (`RA_DATA_DIR` when set).
Never delete the private journals to retry an ambiguous payment. The CLI funds
free-source accounts as well as paid writers, so small citation royalties can
be received without failing the XRPL account reserve requirement.

The server's existing reconciliation sweep also selects admitted hires with a
saved signature and no result. A ledger-proven original inbound payment unlocks
research and pending royalties/change without caller replay. Missing/unvalidated
inbounds are never submitted by the worker. An original inbound proven expired
or failed closes its reservation without charging. Signed payouts reuse their
original hash while ambiguous; only ledger-proven expired/failed attempts can be
retired and replaced, with their hashes retained in the audit. Changed receiving
wallets, paused/capped principals and unresolved writer identities remain blocked.

See [W3 evidence](evidence/w3-hire/README.md) and the original
[3 November hire chain](evidence/hire-274.md).
