# Delegated own-wallet mode — 12 November 2026

**One real delegated product purchase; one post-revocation run with zero spend and zero grants.**

Opt in with `WALLET_MODE=delegated`. Default is `shared` (also when unset). Requires an existing Testnet agent signer and `SETTLEMENT_RAIL=xrpl-testnet`; `ESCROW_MODE=key-reveal` selects encrypted key reveal. The browser faucet funds XRP. An IOU wallet still needs separate trust-line and balance provisioning; no automatic RLUSD support is claimed. No hosted setting was changed or deployed.

The browser creates/imports a key into localStorage `researchagent.Testnet.wallet.v1`, marked `network: Testnet`. Its seed is never posted. It signs DelegateSet for EscrowCreate only and signs a one-use, two-minute, server challenge to bind its public address to the session. The server freezes that address on the admitted run. A client body cannot pick another wallet. Status refresh verifies the ledger grant and clears a revoked binding, including recovery from a lost disconnect response. Hosted origin/CSRF/session checks also apply to these endpoints. Wallet/xrpl code lives behind the lazy DelegatedWallet import.

Policy reserves the prompt budget before signing, as before. The scoped payer uses the visitor Account/sequence and agent Delegate/signature; validated delegation and agent fee reserve are checked before signing. The agent's original hosted spending guard remains on its signing object. Direct Payment is refused for a scoped payer. Writer finish/cancellation use their own authorized signers. Revocation signs an empty DelegateSet in the browser, and disconnect clears the session binding. The ledger independently rejects creates after revocation, including a race after the pre-sign check. The permission itself has no on-ledger prompt budget: the deterministic application policy enforces that budget.

## Evidence

`node --import tsx scripts/spikes/e-delegated-product.mjs` uses the actual local API and writer on OFFSET=800 (9588/9590), fresh accounts, fixture models, XRP key-reveal settlement. Visitor seed never enters the server environment. This is HTTP product evidence; the separate Chromium component probe below tests browser signing with a stubbed identity API. No hosted acceptance is claimed. `e-delegated.json` and `e-delegated-receipt.json` retain hashes and receipt export. Initial JS size will be checked by the unchanged Node 22 build gate.

Visitor `rGPU4UK4KzrMyfPtXBwdun9ibgNEGTEKhD`; agent `r4qQ5cqgPsjUL5pE5paSKYv33KeifpQWWH`. One purchase: 40 minor units, 16064 ms (provisioning excluded). After revocation: 0 minor units, 0 grants.

| Step | Result | Hash |
|---|---|---|
| fund fresh account | tesSUCCESS | [9C215307CDA1B62336D0F853AE3560CD374A36D6152D021DE1C2217B1166281B](https://testnet.xrpl.org/transactions/9C215307CDA1B62336D0F853AE3560CD374A36D6152D021DE1C2217B1166281B) |
| fund fresh account | tesSUCCESS | [8D4FD9B20189FEBCD3DA9BAA951832361FD81CAA1526C3DBE0E7DBFA7E0E82AA](https://testnet.xrpl.org/transactions/8D4FD9B20189FEBCD3DA9BAA951832361FD81CAA1526C3DBE0E7DBFA7E0E82AA) |
| visitor grant | tesSUCCESS | [D1D83A743D706EDA5733C18DFED3F1CF972E8D99C014DDB2F867C82E2018F0B9](https://testnet.xrpl.org/transactions/D1D83A743D706EDA5733C18DFED3F1CF972E8D99C014DDB2F867C82E2018F0B9) |
| product create | tesSUCCESS | [4947D76B32F7798EA94D2E220F947F0C1C2141C3DA1997705D1980A1AEC489EA](https://testnet.xrpl.org/transactions/4947D76B32F7798EA94D2E220F947F0C1C2141C3DA1997705D1980A1AEC489EA) |
| product writer finish | tesSUCCESS | [22BCFDBE83ED5A646568F0BDDB710202293DFA5D372A0631B7DEB0174F66B485](https://testnet.xrpl.org/transactions/22BCFDBE83ED5A646568F0BDDB710202293DFA5D372A0631B7DEB0174F66B485) |
| visitor revoke | tesSUCCESS | [E581EC14CAB91125CD771D545A9BAEAAADC051A54B1495F6C6256E9B245611EC](https://testnet.xrpl.org/transactions/E581EC14CAB91125CD771D545A9BAEAAADC051A54B1495F6C6256E9B245611EC) |

## Browser wallet probe

`node scripts/spikes/f-browser-wallet.mjs` starts the actual wallet component through Vite on an ephemeral port in Chromium 153.0.8010.12. It creates a fresh visitor wallet in the browser, obtains real faucet XRP, signs and validates an EscrowCreate-only DelegateSet, and revokes it with empty Permissions. Connection took 17,623 ms; connection plus revocation took 27,887 ms in this one observation. The browser and Vite server close at completion.

This is a development browser build with a stubbed public identity HTTP boundary, not a full browser purchase or hosted acceptance. The stub verifies the real signature and permits only address/publicKey/signature fields. Node checks only the saved network and a seed-present boolean; it never retrieves the visitor seed. Ledger objects prove the grant exists after connect and is removed after revoke. `f-browser-wallet.json` preserves public transactions and metadata.

| Step | Validated result | Hash |
|---|---|---|
| browser faucet funding | tesSUCCESS | [4E9AFEE523F1A4DC649E9D96F24DF276E28279AEB4E4B4F989CC84FB05C9352C](https://testnet.xrpl.org/transactions/4E9AFEE523F1A4DC649E9D96F24DF276E28279AEB4E4B4F989CC84FB05C9352C) |
| browser grant | tesSUCCESS | [FFFA63323D85D081A3A5958E3221B9C36BF0C32A9037AE731623F8982ECB0BA6](https://testnet.xrpl.org/transactions/FFFA63323D85D081A3A5958E3221B9C36BF0C32A9037AE731623F8982ECB0BA6) |
| browser revoke | tesSUCCESS | [1A4C2DDAD632C8346A05ADB5303F30A61ED8D03084C4887AD45741114CDE89E4](https://testnet.xrpl.org/transactions/1A4C2DDAD632C8346A05ADB5303F30A61ED8D03084C4887AD45741114CDE89E4) |

## Local checks

- Node 22.23.4 after integrating the merged settlement timing/stream changes: `npx vitest run tests/delegated-wallet.test.ts tests/escrow.test.ts tests/wallets.test.ts` — 25 passed. The focused wallet/component pair also passes five tests, including status refresh clearing a revoked session binding after a lost disconnect response.
- `npx vitest run src/components/DelegatedWallet.test.tsx src/fixtures/chat.test.tsx src/fixtures/wpui.test.tsx tests/delegated-wallet.test.ts`: 38 passed. Browser-side test proves the saved seed is absent from HTTP proof payloads and checks the empty revoke permissions. A subsequent targeted pass also covers confirmed revocation followed by API disconnect failure: the UI retains the confirmed ledger result. The Node crypto/jsdom byte-array constructors are aligned only inside that test; production code is unchanged.
- Typecheck and focused lint pass. Full local admission remains required before merge. Nothing loosened.
