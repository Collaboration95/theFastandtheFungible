# RLUSD Testnet escrow permission: can the issuer opt in, or publish the policy?

Short support/email draft for Ripple Stablecoin Technical Services / DevRel. No public issuer-configuration tracker was identified. The documented customer route is [Ripple Support](https://docs.ripple.com/products/stablecoin/user-interface/support), via `home.ripple.com` → Get support → Contact support → Support Portal. If the owner has no customer access, the public [developer contributions form](https://docs.ripple.com/products/stablecoin/developer-resources/contribute-to-the-developer-ecosystem) accepts RLUSD support suggestions; paste the body below there. No guessed email recipient is supplied.

---

We are building conditional content delivery on XRPL Testnet. Could you confirm the RLUSD issuer's escrow policy and consider enabling `asfAllowTrustLineLocking` on **Testnet**, or document that it will remain disabled?

On 12 November 2026 spike D read `Flags=2174353408` (`0x819a0000`) on both official issuers: Mainnet `rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De`, ledger 108278852; Testnet `rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV`, ledger 22263716. `Flags & 0x40000000` is zero. Both nodes reported TokenEscrow and fixTokenEscrowV1 enabled. [Spike D evidence](https://github.com/Collaboration95/theFastandtheFungible/blob/ad0ad3294f5b165c71adfe82944a2c94da5622aa/docs/evidence/money/d.json).

Independent reads later that day reproduced the same flags at Testnet ledger 22266872 and Mainnet ledger 108281496. This is an observed issuer setting, not a failed RLUSD transaction: our lane only read both networks. The generic XRPL tutorial already explains issuer opt-in, so this request belongs with the RLUSD issuer rather than another generic token-escrow docs issue.

Minimal reproduction (public reads only):

```sh
curl -s https://s.altnet.rippletest.net:51234/ -H 'Content-Type: application/json' \
  --data '{"method":"account_info","params":[{"account":"rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV","ledger_index":"validated"}]}'
curl -s https://xrplcluster.com/ -H 'Content-Type: application/json' \
  --data '{"method":"account_info","params":[{"account":"rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De","ledger_index":"validated"}]}'
# For each Flags value: (Flags & 0x40000000) !== 0
# Repeat with {"method":"feature","params":[{}]} and inspect TokenEscrow.
```

Expected: a documented per-network escrow policy, with Testnet access for builders if supported. Actual: amendment enablement does not make RLUSD escrowable because issuer locking is off. We do not assume this setting is accidental, or request an unreviewed Mainnet configuration change.

Our successful control uses a labelled TEST-SGD issuer that explicitly opts in: issuer AccountSet [52E26F9692DF6AC85D7336FD6047B1A769BAEE12695FF53173FB002D5E53E776](https://testnet.xrpl.org/transactions/52E26F9692DF6AC85D7336FD6047B1A769BAEE12695FF53173FB002D5E53E776), create [8600167DCF721AA3FB80318D0268DE6754E82116EACA4F51592A5CC1D054B1E6](https://testnet.xrpl.org/transactions/8600167DCF721AA3FB80318D0268DE6754E82116EACA4F51592A5CC1D054B1E6), finish [950451C760C37F21158C423D6D62E1E7C932711A01D8B7B76791D59FC13803EE](https://testnet.xrpl.org/transactions/950451C760C37F21158C423D6D62E1E7C932711A01D8B7B76791D59FC13803EE). These are TEST-SGD transactions, **not RLUSD**. RLUSD flag reads have no transaction hash. Workaround: exact RLUSD Payment with cooperative refunds, or a clearly labelled escrow test token. Severity high for the RLUSD escrow integration; no Mainnet submission or incident.
