# Delegated own-wallet mode — 12 November 2026

**One real delegated product purchase; one post-revocation run with zero spend and zero grants.**

Opt in with `WALLET_MODE=delegated`. Default is `shared` (also when unset). Requires an existing Testnet agent signer and `SETTLEMENT_RAIL=xrpl-testnet`; `ESCROW_MODE=key-reveal` selects encrypted key reveal. The browser faucet funds XRP. An IOU wallet still needs separate trust-line and balance provisioning; no automatic RLUSD support is claimed. No hosted setting was changed or deployed.

The browser creates/imports a key into localStorage `researchagent.Testnet.wallet.v1`, marked `network: Testnet`. Its seed is never posted. It signs DelegateSet for EscrowCreate only and signs a one-use, two-minute, server challenge to bind its public address to the session. The server freezes that address on the admitted run. A client body cannot pick another wallet. Hosted origin/CSRF/session checks also apply to these endpoints. Wallet/xrpl code lives behind the lazy DelegatedWallet import.

Policy reserves the prompt budget before signing, as before. The scoped payer uses the visitor Account/sequence and agent Delegate/signature; validated delegation and agent fee reserve are checked before signing. The agent's original hosted spending guard remains on its signing object. Direct Payment is refused for a scoped payer. Writer finish/cancellation use their own authorized signers. Revocation signs an empty DelegateSet in the browser, and disconnect clears the session binding. The ledger independently rejects creates after revocation, including a race after the pre-sign check. The permission itself has no on-ledger prompt budget: the deterministic application policy enforces that budget.

## Evidence

`node --import tsx scripts/spikes/e-delegated-product.mjs` uses the actual local API and writer on OFFSET=800 (9588/9590), fresh accounts, fixture models, XRP key-reveal settlement. Visitor seed never enters the server environment. This is HTTP product evidence plus a jsdom wallet test, not a hosted or real-browser signing acceptance claim. `e-delegated.json` and `e-delegated-receipt.json` retain hashes and receipt export. Initial JS size will be checked by the unchanged Node 22 build gate.

Visitor `rGPU4UK4KzrMyfPtXBwdun9ibgNEGTEKhD`; agent `r4qQ5cqgPsjUL5pE5paSKYv33KeifpQWWH`. One purchase: 40 minor units, 16064 ms (provisioning excluded). After revocation: 0 minor units, 0 grants.

| Step | Result | Hash |
|---|---|---|
| fund fresh account | tesSUCCESS | [9C215307CDA1B62336D0F853AE3560CD374A36D6152D021DE1C2217B1166281B](https://testnet.xrpl.org/transactions/9C215307CDA1B62336D0F853AE3560CD374A36D6152D021DE1C2217B1166281B) |
| fund fresh account | tesSUCCESS | [8D4FD9B20189FEBCD3DA9BAA951832361FD81CAA1526C3DBE0E7DBFA7E0E82AA](https://testnet.xrpl.org/transactions/8D4FD9B20189FEBCD3DA9BAA951832361FD81CAA1526C3DBE0E7DBFA7E0E82AA) |
| visitor grant | tesSUCCESS | [D1D83A743D706EDA5733C18DFED3F1CF972E8D99C014DDB2F867C82E2018F0B9](https://testnet.xrpl.org/transactions/D1D83A743D706EDA5733C18DFED3F1CF972E8D99C014DDB2F867C82E2018F0B9) |
| product create | tesSUCCESS | [4947D76B32F7798EA94D2E220F947F0C1C2141C3DA1997705D1980A1AEC489EA](https://testnet.xrpl.org/transactions/4947D76B32F7798EA94D2E220F947F0C1C2141C3DA1997705D1980A1AEC489EA) |
| product writer finish | tesSUCCESS | [22BCFDBE83ED5A646568F0BDDB710202293DFA5D372A0631B7DEB0174F66B485](https://testnet.xrpl.org/transactions/22BCFDBE83ED5A646568F0BDDB710202293DFA5D372A0631B7DEB0174F66B485) |
| visitor revoke | tesSUCCESS | [E581EC14CAB91125CD771D545A9BAEAAADC051A54B1495F6C6256E9B245611EC](https://testnet.xrpl.org/transactions/E581EC14CAB91125CD771D545A9BAEAAADC051A54B1495F6C6256E9B245611EC) |

## Local checks

- `npx vitest run tests/delegated-wallet.test.ts tests/escrow.test.ts tests/wallets.test.ts`: 24 tests after the session test addition; targeted runs passed (the original three-file run had 23 before that addition).
- `npx vitest run src/components/DelegatedWallet.test.tsx src/fixtures/chat.test.tsx src/fixtures/wpui.test.tsx tests/delegated-wallet.test.ts`: 38 passed. Browser-side test proves the saved seed is absent from HTTP proof payloads and checks the empty revoke permissions. A subsequent targeted pass also covers confirmed revocation followed by API disconnect failure: the UI retains the confirmed ledger result. The Node crypto/jsdom byte-array constructors are aligned only inside that test; production code is unchanged.
- Typecheck and focused lint pass. Full local admission remains required before merge. Nothing loosened.
