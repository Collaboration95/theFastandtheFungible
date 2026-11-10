# Security policy

ResearchAgent is a hackathon-stage project. **It runs on the XRPL Testnet only.**
Testnet XRP has no value, and nothing here is meant to hold or move real money.

## Report a vulnerability

Use [private vulnerability reporting](https://github.com/Collaboration95/theFastandtheFungible/security/advisories/new)
(Security tab → Report a vulnerability). Please don't open a public issue for a
security problem. We aim to reply within a few days.

In scope: anything that breaks the five hard gates in the
[README](../README.md#hard-guarantees) (premium bytes before a grant, spending the
LLM can trigger, a double charge, a fake citation, unlabelled simulation), or
leaks a key or seed.

## Never post secrets

Don't put a wallet seed, API key or `.env` in an issue, PR, log or screenshot. Seeds
(`XRPL_PAYER_SEED` and the publisher keys) are server-only: they live in the
git-ignored local `.env`, are never copied to `.env.example`, the browser bundle,
logs, traces or persisted run data, and are never sent to a model. Secret scanning
and push protection are on for this repository. If a key leaks, rotate it first,
then tell us.

## How the code protects money and keys

Details are in [docs/contracts/SECURITY.md](../docs/contracts/SECURITY.md): source text
is untrusted evidence, the server alone enforces the budget and signs payments, both
sides restrict ledger access to Testnet, and writer manifests are signed with the
payee key. Local storage is demo-grade SQLite; add authentication, encryption and a
managed database before any production use. What is and isn't compliant, the tamper-evident audit trail and data
retention are in [docs/COMPLIANCE.md](../docs/COMPLIANCE.md).
