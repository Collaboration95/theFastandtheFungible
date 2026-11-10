# Draft PR: standalone key-reveal escrow example

**Local draft only. Not submitted upstream.**

## Title

Add a minimal x402 key-reveal escrow example on XRPL Testnet

## Motivation

An agent buying content needs a clear explanation of what payment proves.
An exact Payment proves payment; it does not deliver the decryption key.
An XRPL conditional escrow can make payment release publish that key on-ledger.
This example gives Starter Kit builders a small, copyable demonstration and
spells out the limits: the ledger does not verify content quality, and a refund
after a broken promise still needs the writer's signature.

## What it adds

Copy [the standalone directory](../../../examples/x402-key-reveal-escrow/README.md)
as `examples/x402-key-reveal-escrow/`: a minimal Node seller/buyer, pinned npm
dependencies and lockfile, offline tests and an explicitly opted-in live test.
The seller responds 402 with ciphertext and a PREIMAGE-SHA-256 Condition; buyer
creates the escrow, seller finishes and publishes K, buyer checks the actual
ledger Condition and decrypts, and a second escrow proves CancelAfter recovery.
The README includes real Testnet hashes and expected explorer-linked output.

It uses `xrpl.js` for escrow and `x402-xrpl@0.3.4` for header serialization and
the signed-blob envelope. `key-reveal-escrow` is an experimental scheme, not an
addition to the exact facilitator's capabilities. The existing exact payer
correctly refuses it. No existing merchant middleware or payment behavior changes.
There are no ResearchAgent imports, model calls, environment seeds or cloud services.

## How to run

```sh
cd examples/x402-key-reveal-escrow
npm ci
npm test
OFFSET=1400 XRPL_KEY_REVEAL_TESTNET=1 npm start
```

Allow about a minute plus faucet/network delays. It uses two faucet wallets,
two 1,000-drop principals and capped transaction fees; all value is Testnet XRP.
Expected result: four explorer links, verified AES-GCM delivery, one-charge
replay, full withheld principal returned less fees, and `RESULT PASS`.

## Review context for a destination maintainer

Ripple's Phase 1 Starter Kit links multiple repositories; it is not a single
versioned application repository. This draft is ready to adapt to the repository
that maintains Starter Kit payment examples. It deliberately does not guess a
canonical upstream destination or assert maintainer endorsement. The current
copyable artifact and its dated Testnet evidence are linked above.

Production persistence, content-quality disputes, cooperative post-finish refunds,
RLUSD/IOUs and mainnet support are outside this teaching example.
