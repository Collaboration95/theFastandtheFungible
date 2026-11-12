# Add a Testnet key-reveal escrow example beside agentic x402 guidance

Enhancement proposal for XRPLF/xrpl-dev-portal master `182f8d20b157aa791433ff399a0f30dbed74a5eb`. The current portal owns `_code-samples/escrow` and `docs/agents/agentic-payments-x402.md`, so it is a concrete public destination for the formerly unrouted Starter Kit PR draft. This is an example contribution, not a claim that the exact scheme supports escrow.

## Tracker, environment, and reproduction

Searched `repo:XRPLF/xrpl-dev-portal "key-reveal"` and T54 escrow issues; no duplicate found. Node 22.23.4, xrpl 4.7.0, x402-xrpl 0.3.4, Testnet only. Apply `fix.patch` to the pinned master, then:

```sh
npm ci --prefix _code-samples/x402-key-reveal-escrow
npm test --prefix _code-samples/x402-key-reveal-escrow
# Optional new ledger run, faucet wallets only:
OFFSET=1300 XRPL_KEY_REVEAL_TESTNET=1 npm start --prefix _code-samples/x402-key-reveal-escrow
```

Expected: ciphertext stays quarantined until a validated EscrowFinish reveals the matching key; replay uses the same intent; a withheld key permits explicit EscrowCancel after ledger-time expiry. Actual current upstream: the exact-payment guide has no standalone example for this alternative. Proposed patch copies the isolated example into `_code-samples` and adds one paragraph linking it.

## Ledger evidence and validation

The original 10 November run is retained in the example README. Fresh read-only verification on 12 November found all four hashes validated `tesSUCCESS`:

- [25CC953B9B337D8A45499433A8BD55FA928FA81C33E1735BD407699887052124](https://testnet.xrpl.org/transactions/25CC953B9B337D8A45499433A8BD55FA928FA81C33E1735BD407699887052124)
- [C7BCC2963C3FBAAC370AD192E75019A6FDAB62FB2F7922BE5DD7825E89792FB3](https://testnet.xrpl.org/transactions/C7BCC2963C3FBAAC370AD192E75019A6FDAB62FB2F7922BE5DD7825E89792FB3)
- [770580CE68742B35268EEAF82F74B8D19B2863E0CD9A12F3911ED3E5C602AC73](https://testnet.xrpl.org/transactions/770580CE68742B35268EEAF82F74B8D19B2863E0CD9A12F3911ED3E5C602AC73)
- [B901A74FF2A8741816AE2D5660E2FA7F44AB69E963C5D88620AF3644D4AB6D5D](https://testnet.xrpl.org/transactions/B901A74FF2A8741816AE2D5660E2FA7F44AB69E963C5D88620AF3644D4AB6D5D)

Offline tests in the upstream clone: 2 passed; 1 opt-in live test skipped. This lane did not regenerate the historical ledger flow. No hosted, Mainnet or independent-writer acceptance is claimed. The example proves key reveal, not content quality; post-finish refunds remain writer-signed. The exact payer's refusal of the custom scheme is tested and preserved. Severity low, educational enhancement.
