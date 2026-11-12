# Money spikes — 12 November 2026

A: **works** — delegated creation, writer finish, permission isolation and revocation observed on Testnet.
B: **partial (interim)** — B1 atomicity passes; B2 SDK signing workaround and B3 timing in progress.
C: **pending** — fresh issuer and full product purchase next.
D: **fails** — official RLUSD issuers have locking disabled on both networks; TokenEscrow is enabled.

## Reproduce

Use Node 22.23.4 and `npm ci`. Run `node --import tsx scripts/spikes/a-delegate-escrow.mjs`, then `b-batch.mjs` and `c-iou-escrow.mjs` with the same prefix. D: `node scripts/spikes/d-rlusd-flags.mjs`. Scripts make Testnet transactions only; D only reads. No seed is printed. Raw evidence is adjacent JSON. Failed submission hashes are local signed transaction IDs, **not validated ledger transactions**; explorer pages may not exist for those IDs.

## A — delegation

Exact permission name is `EscrowCreate` ([XRPL permission values](https://xrpl.org/docs/references/protocol/data-types/permission-values)); no Payment permission granted. Visitor balance delta −100,000 drops; delegate balance delta −12 drops, matching Fee=12. The delegate pays fees, visitor supplies principal and reserve. Writer finishes with the condition fulfillment. Empty Permissions revokes. Product needs session-bound visitor identity and browser-only signing of DelegateSet, with policy still authorizing every escrow.

| Step | Engine | Validated | Hash |
|---|---|---|---|
| grant EscrowCreate only | tesSUCCESS | True | [A6A660C924A0ACB3666F65F2E0809BA74FDFBA4C089A5E851EA9B6DDBDE75732](https://testnet.xrpl.org/transactions/A6A660C924A0ACB3666F65F2E0809BA74FDFBA4C089A5E851EA9B6DDBDE75732) |
| delegated create | tesSUCCESS | True | [3CA31F98B5137ED91ADAE2E4AD01DDE0841FC4911430B74042359492E0504015](https://testnet.xrpl.org/transactions/3CA31F98B5137ED91ADAE2E4AD01DDE0841FC4911430B74042359492E0504015) |
| writer finish | tesSUCCESS | True | [13C5A0CEA37C1D1C9BA9380F0E732BE64D829B6997E99D0CCAF662DFE56F551B](https://testnet.xrpl.org/transactions/13C5A0CEA37C1D1C9BA9380F0E732BE64D829B6997E99D0CCAF662DFE56F551B) |
| unauthorized Payment | terNO_DELEGATE_PERMISSION | False | [EDAE5B93538F92E08C7E9739EF787C013F0C728553F5515FA7356A563991159C](https://testnet.xrpl.org/transactions/EDAE5B93538F92E08C7E9739EF787C013F0C728553F5515FA7356A563991159C) |
| revoke | tesSUCCESS | True | [B376A2CBBD7BEED9004195B954A7D56D2300D7C07961381A2F18B96F96FB9E60](https://testnet.xrpl.org/transactions/B376A2CBBD7BEED9004195B954A7D56D2300D7C07961381A2F18B96F96FB9E60) |
| create after revocation | terNO_DELEGATE_PERMISSION | False | [AF1963BC9BC895CD009F2DCCB667DEDFCF77F5127ECD4969CFB6CBC0291D0686](https://testnet.xrpl.org/transactions/AF1963BC9BC895CD009F2DCCB667DEDFCF77F5127ECD4969CFB6CBC0291D0686) |

## B — Batch (interim)

B1 creates two escrows in one ALLORNOTHING batch. A second batch has a valid first create and an unaffordable second create: escrow count remains two, proving rollback. The **outer Batch returns tesSUCCESS even when inner work rolls back**. Product must check inner results and ledger objects, not treat outer success as purchase success.

| Step | Engine | Hash |
|---|---|---|
| B1 two escrow creates | tesSUCCESS | [68818DDC70F455E41C1677494EDE9E4573BF0511F642EA1EF472864C3841155B](https://testnet.xrpl.org/transactions/68818DDC70F455E41C1677494EDE9E4573BF0511F642EA1EF472864C3841155B) |
| B1 failing second create | tesSUCCESS | [3C7E2C363AE54D3BAE9AA834B3AFAEA032D4F28165023D0C7A8A46B5B0F76DC8](https://testnet.xrpl.org/transactions/3C7E2C363AE54D3BAE9AA834B3AFAEA032D4F28165023D0C7A8A46B5B0F76DC8) |

B2 initially stops before network submission: pinned xrpl.js 4.7.0 `signMultiBatch` supplies old signing fields to the resolved codec, which requires `account` and `sequence` (Batch V1_1). Error: `No field account`. Testing explicit signing payload with the codec exported by xrpl.js. Original B1 run retained in b-initial.json.

## C — product TEST-SGD purchase

Pending. Fixture model output will be labelled; settlement will use actual Testnet SGT IOU escrow, not official RLUSD.

## D — official RLUSD flags (read-only)

[Ripple published issuer addresses](https://docs.ripple.com/products/stablecoin/developer-resources/rlusd-on-the-xrpl). `account_info` plus `feature` on 12 Nov; d.json holds exact responses. Mainnet issuer `rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De`, ledger 108278852; Testnet issuer `rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV`, ledger 22263716. Both Flags=2174353408 (`0x819a0000`); bit `lsfAllowTrustLineLocking=0x40000000` is **off**. Both nodes report TokenEscrow and fixTokenEscrowV1 enabled. Official RLUSD cannot be escrowed under this issuer setting. No Mainnet signature, simulation or submission. Product must retain a labelled SGT stand-in or use exact RLUSD Payment until Ripple opts the issuer in.
