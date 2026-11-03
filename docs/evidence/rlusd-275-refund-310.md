# Testnet issued-currency purchase and denylist refund · 3 Nov 2026

Live XRPL Testnet settlement; no real value. Fixture research and SYNTHETIC
articles. The issued asset is **test USD (substitute for RLUSD)**, not Ripple
RLUSD or dollar-backed money. [Public metadata](rlusd-275-refund-310.json).

Ripple's [official documentation](https://docs.ripple.com/products/stablecoin/developer-resources/rlusd-on-the-xrpl)
names Testnet issuer `rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV` and tryrlusd.com.
The issuer existed, but the faucet's mint endpoint returned HTTP **401**, body
`{"error":"Authentication required"}`. We did not bypass authentication.
We created Testnet stand-in issuer **`rMfxn8xXFttYg9FZqGSX7chjpb7JmPd9FG`**,
set DefaultRipple, established trust lines, and minted two test USD to the buyer across the component and full UC2 runs.
Flags and control risks are recorded in COMPLIANCE.md. Currency hex:
`524C555344000000000000000000000000000000`.

`OFFSET=1900 node --import tsx scripts/evidence/rlusd-275.mjs` uses durable,
ignored private journals and ports 10688/10690. Only public allowlisted metadata
is copied here. It runs the real PurchaseManager, signed manifest/proof checks,
facilitator and payer against Testnet. The full API/SDK UC2 run admits the budget, records policy decisions, buys
NotFT for 0.90 issued units, verifies proof and produces cited output. Research
is fixture, not a live-model claim. An earlier mini-corpus Load Factor purchase
is retained as a component demonstration: its standalone gate audit found two
missing admission/label-context records, so it is not the product gate evidence.
The full UC2 run and the hire run each pass with zero violations. Separately,
the fixture UC2 hire run buys NotFT in XRP, cites a free writer, and denies that
writer's royalty to exercise #310. All ledger settlement below is real Testnet.

| Operation | Validated hash | Result |
|---|---|---|
| Component issued article purchase | `997BC7A3F9D2D5CF6039A79131FF9F8F13EA1A2C86A56E95C89D3E001C80FBCF` | tesSUCCESS, ledger 22026712, delivered 0.6 test USD, fee 12 drops; proof VERIFIED |
| Full UC2 issued purchase | `E6AD8E140DB59E49AF6780EB34666DC1AE39A25B808F2AC4D5B2E705A711D01B` | tesSUCCESS, ledger 22026920, delivered 0.9 test USD, fee 12 drops; proof VERIFIED, gate audit 0 |
| Hire caller inbound | `BE40CA55F3DE5E4370DF6055F30902DDB5FFEBF602C25C8E5C4E937437FC6EB4` | 220,000 drops |
| Hire article purchase | `EEDD63E52F5315EFE33B5164E65119E424A13284D335A7E5300978132320E338` | 90,000 drops |
| Unspent research change | `C493B05FE6F6752B86C0BC97B92A13D6A99DF9BBC51BB829DF8D026A818C4759` | 110,000 drops back to caller |
| Allowed cited-writer royalty | `6ED2D1075400E295A9B8D3B66ED1657C157CE09CC54ACC4B0242DB52FE7759FC` | 2,500 drops |
| Refused royalty refunded | `98FFA726D33291F1993A72BEE0FEE361D437FC80B70086D805B849950B2F48E5` | 2,500 drops back to caller; cancelled writer never paid |

Writer `rpD8bd6mBzUx34Lr3rNjHX26TpYUPr8TSh` had 0 test USD before and
0.6 after. The issued policy path took 10,046 ms (one observation, not a
latency benchmark). Both purchase and hire replays reused the same hash/result.
The full UC2 NotFT writer `rDibQptnbQvQTfUCFXdDFLEaKG293UUAU6` held 0
issued units before and 0.9 after. UC2 replay reused the same hash. Hire reserve
ended at zero; hire and full UC2 gate audits zero; all audit chains passed. The hire
money identity is 220,000 = 90,000 purchases + 2,500 royalties + 112,500 change
+ 15,000 retained fee. Network fees are separate: 60 drops for hire movements,
24 for the two issued purchases, 72 for stand-in setup (two mints and three
trust lines plus AccountSet), and 12 for the official-issuer probe (168 drops total). Faucet account funding is excluded; gross
XRP movement including the caller inbound was 0.425 XRP. Issuance was 2 test USD,
of which 1.5 was transferred; reserve remains in the owners' accounts.

Partial-payment safety rejects tfPartialPayment before submit and independently
requires exact decimal delivered_amount, currency and issuer after tesSUCCESS.
Unknown/underpaid/wrong-issuer metadata cannot earn delivery. Unit tests also
cover missing trust lines, insufficient token balance, freeze, insufficient XRP
reserve, issuer denylist, first-blob binding, purchase/royalty refusal, replay
and restart. Signed or ambiguous payouts are never locally cancelled/refunded.
No thresholds or existing assertions were loosened. #279's chaos harness was
not on main at implementation time; refusal fault coverage is in hire.test.ts.

Final read-only verification: `npm run audit:verify -- --db <hire.db> --testnet`
confirmed 5/5 hire transactions, and both issued-purchase databases each confirmed 1/1. The full UC2 database
also passed `gate:audit` with zero violations.
The official-issuer TrustSet probe was
`6F8B89451D8951F923973BE1AB5B45DE89C358C37A9D6CBB67CA0B1C491172C6`.
