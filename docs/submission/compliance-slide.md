# Compliance slide (for the deck lane)

Source of truth: [docs/COMPLIANCE.md](../COMPLIANCE.md). Facts as of 10 Nov 2026.
Do not strengthen any claim here without changing the map first.

**Title:** Built for audit. Honest about what a regulated launch still needs.

**Body (about 60 words):** Every spend is authorised by deterministic policy
code, capped, and written to a hash-chained audit log whose head is anchored on
the XRP Ledger, including when the agent refuses to buy. Anyone can verify a
receipt offline. What we do not have: licences, a sanctions provider, writer
KYB or HSM-held keys. It is Testnet only. Each gap has a named next step.

| Need | Built (Testnet) | Not done |
|---|---|---|
| Custody | Keys stay server-side, out of logs, audit rows and the browser | KMS/HSM, rotation; hire flow holds funds in transit |
| Spend limits | S$5 per prompt, S$20 per day, policy-only buying | Maker-checker, velocity limits |
| Audit | Hash-chained log, anchored heads, offline verify | Signed or durable retention; periods unanswered |
| Screening and KYB | Payee denylist hook; XRPL Credentials badge (publish CLI; none in the live sandbox) | No sanctions provider, no KYB, no Permissioned Domains |
| Regulation | Questions for MAS (PSA/DPT), GENIUS Act, Travel Rule | No licence, no legal opinion; mainnet blocked |

**Footer:** Testnet, no real value. Not legal advice. Sources and file:line
citations: docs/COMPLIANCE.md.
