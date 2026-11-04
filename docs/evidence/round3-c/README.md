# Round 3 · Lane C · writer cold start

Public Testnet faucet, no real value, no seeds in this directory. The writer is
the synthetic `examples/writer-starter` folder, not a consenting real person
(`docs/evidence/real-writers.json` stays empty).

Reproduce (opt-in, needs the faucet):

```sh
make release-artifacts
node --import tsx scripts/writer-testnet-proof.ts --testnet "$PWD/dist/release/researchagent-mcp-1.0.0-rc.1.tgz"
```

The script starts `npx -y file://…tgz publish ./writer-starter --testnet` in a fresh
directory with a **cold npm cache** and a private writer root, waits for readiness,
checks the Credential on Testnet, then a second faucet wallet (the buyer) buys the
paid article from that writer by key reveal. Output is addresses, timings and hashes only.

What the writer sees:

```
Wallet rDUT9Z2wnCXsbVBCh5cjMf4DsUMSe5dJSn · XRPL TESTNET · key saved privately
Writer live · address rDUT9Z2wnCXsbVBCh5cjMf4DsUMSe5dJSn · CredentialCreate tx https://testnet.xrpl.org/transactions/278CF28FF1FE8DE3B331C57883A010BFA41BE4D4EA7DEF24547A1291DED7EEEF ↗ · first sale will appear as EscrowFinish
```

| Step | Seconds from start | Hash | Ledger | Result |
|---|---:|---|---:|---|
| Writer live (npx install + faucet + CredentialCreate/Accept) | 48.8 | `278CF28FF1FE8DE3B331C57883A010BFA41BE4D4EA7DEF24547A1291DED7EEEF` | 22057989 | tesSUCCESS |
| Buyer EscrowCreate (key reveal) | | `590A9A753A7050B3B75547F96EB92915DBC2541571868B1183A7FE62ED23C4E3` | 22057996 | tesSUCCESS |
| Writer EscrowFinish (key published) | 74.0 | `D73E5090655B426A85283409C5601201B342873ABF62D527361452220D43A592` | 22057998 | tesSUCCESS |

Acceptance: Credential validated in 48.8 s (< 90 s) from a fresh directory and a cold npm cache; intent `VERIFIED` with `escrow.mode = key-reveal`.

Notes
- The Credential issuer is a **local operator** Testnet wallet created on first run (`issuer.private.json`, mode 0600), labelled "Local operator · Testnet identity only". It proves wallet onboarding and the #357 verifier path, not a human identity check. Which issuer is canonical for the demo is an owner decision.
- Raw data: [`onboarding.json`](onboarding.json). Faucet rate limits apply per IP; a failed faucet leaves the key saved and the same command retries.
