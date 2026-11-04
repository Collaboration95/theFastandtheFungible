# researchagent

Typed Python 3.10+ client for ResearchAgent, with no runtime dependencies.
Install with `pip install ./packages/sdk-python` from the repository root.
See `docs/sdk-python.md` in the repository for examples, server clamping,
event iteration, typed errors, and the independent offline receipt verifier. Run `researchagent verify
receipts.json` (or `python -m researchagent verify receipts.json --json`) without Node or a checkout. Ed25519 and secp256k1 curve
verification uses vendored MIT-licensed pure-Python code; no dependency install
or network access is needed. Add `--ledger` to also check the anchor, payments, refunds and
escrow events read-only on XRPL Testnet (`s.altnet`, Clio fallback).

This package has not been published to PyPI. Tests use synthetic providers
and simulated settlement, never real money.
