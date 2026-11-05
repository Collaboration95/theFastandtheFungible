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
Wallet rH5nJSbPoLZrjtHtwWUn7wXzQRkwbCj9jQ · XRPL TESTNET · key saved privately
Writer live · address rH5nJSbPoLZrjtHtwWUn7wXzQRkwbCj9jQ · CredentialCreate tx https://testnet.xrpl.org/transactions/A8AAD1E42C3877E8A15682BA65E86FB4C7E0DC36BC14685E0DF5EC07AC624023 ↗ · first sale will appear as EscrowFinish
```

| Step | Seconds from start | Hash | Ledger | Result |
|---|---:|---|---:|---|
| Writer live (npx install + faucet + CredentialCreate/Accept) | 43.8 | `A8AAD1E42C3877E8A15682BA65E86FB4C7E0DC36BC14685E0DF5EC07AC624023` | 22058157 | tesSUCCESS |
| Buyer EscrowCreate (key reveal) | | `8F7318AD20B83D75C3CEC22A08CA530BC60027AFE823FE5BA20EA5C83A7C671B` | 22058164 | tesSUCCESS |
| Writer EscrowFinish (key published) | 67.7 | `AC7BC339205878056B70609EC8B243CFB0BB1F2E37EDF3D4BE3E46CA6AD247FF` | 22058166 | tesSUCCESS |

Acceptance: Credential validated in 43.8 s (< 90 s) from a fresh directory and a cold npm cache; intent `VERIFIED` with `escrow.mode = key-reveal`.

Notes
- The Credential issuer is a **local operator** Testnet wallet created on first run (`issuer.private.json`, mode 0600), labelled "Local operator · Testnet identity only". It proves wallet onboarding and the #357 verifier path, not a human identity check. Which issuer is canonical for the demo is an owner decision.
- Raw data: [`onboarding.json`](onboarding.json). Faucet rate limits apply per IP; a failed faucet leaves the key saved and the same command retries.
