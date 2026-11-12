# Money spikes — 12 November 2026

A: **works** — delegated creation, writer finish, permission isolation and revocation observed on Testnet.
B: **works with SDK workaround** — two creates are atomic; buyer create + writer finish validate together.
C: **works** — one real product key-reveal IOU purchase, credit verified.
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

## B — Batch

B1 creates two escrows in one ALLORNOTHING batch. A second batch has a valid first create and an unaffordable second create: escrow count remains two, proving rollback. The **outer Batch returns tesSUCCESS even when inner work rolls back**. Product must check inner results and ledger objects, not treat outer success as purchase success.

| Step | Engine | Hash |
|---|---|---|
| B1 two escrow creates | tesSUCCESS | [68818DDC70F455E41C1677494EDE9E4573BF0511F642EA1EF472864C3841155B](https://testnet.xrpl.org/transactions/68818DDC70F455E41C1677494EDE9E4573BF0511F642EA1EF472864C3841155B) |
| B1 failing second create | tesSUCCESS | [3C7E2C363AE54D3BAE9AA834B3AFAEA032D4F28165023D0C7A8A46B5B0F76DC8](https://testnet.xrpl.org/transactions/3C7E2C363AE54D3BAE9AA834B3AFAEA032D4F28165023D0C7A8A46B5B0F76DC8) |

B2 initially stops before network submission: pinned xrpl.js 4.7.0 `signMultiBatch` supplies old signing fields to the resolved codec, which requires `account` and `sequence` (Batch V1_1). Error: `No field account`. The explicit Batch V1_1 signing payload via xrpl exports works: outer Account/Sequence/Flags, inner transaction hashes, and writer batchAccount. Freeze all sequences and OfferSequence before signing. Buyer inner create Sequence is outer Sequence + 1; writer inner uses its own account Sequence. Escrow identity is owner + inner create Sequence, not outer Sequence or outer hash. Both inner transactions validate tesSUCCESS in ledger 22263740, linked to the same parent Batch. Product would need writer co-signing transport, durable sequence reservations and inner-result reconciliation. The fulfillment becomes public at signed submission, so this primitive does not alone prove safe delivery or holdback dispute release. Original B1 run retained in b-initial.json.

Final run (b.json):

| Step | Result | Hash |
|---|---|---|
| B1 two escrow creates | tesSUCCESS | [AD28CC333F7B353E2D7932B3CCE19DD127BDF56226E3D893631A27586FF4FAB0](https://testnet.xrpl.org/transactions/AD28CC333F7B353E2D7932B3CCE19DD127BDF56226E3D893631A27586FF4FAB0) |
| inner EscrowCreate | tesSUCCESS | [82658938EE2BE58DDA6BD1B22362A0004B037958D956DFE5EB1503B4982F6556](https://testnet.xrpl.org/transactions/82658938EE2BE58DDA6BD1B22362A0004B037958D956DFE5EB1503B4982F6556) |
| inner EscrowCreate | tesSUCCESS | [8037AAAEE6B212630C3B396EF90936002E5D369C71A3FE58E366C3E3AA4B7664](https://testnet.xrpl.org/transactions/8037AAAEE6B212630C3B396EF90936002E5D369C71A3FE58E366C3E3AA4B7664) |
| B1 failing second create | tesSUCCESS | [7C162D61DE09381ED8B36E6DD25898D0E19AD728D75A894564D7F323B2955857](https://testnet.xrpl.org/transactions/7C162D61DE09381ED8B36E6DD25898D0E19AD728D75A894564D7F323B2955857) |
| inner rolled back | txnNotFound | [231A278721E7FCC4FFC27A64CCB6CCACBF584CF5B78919D2FE84586DEB540F92](https://testnet.xrpl.org/transactions/231A278721E7FCC4FFC27A64CCB6CCACBF584CF5B78919D2FE84586DEB540F92) |
| inner rolled back | txnNotFound | [156E2759E3E390019BF5EF18F06E088224A8CB00DED4E90057428264F7AC6798](https://testnet.xrpl.org/transactions/156E2759E3E390019BF5EF18F06E088224A8CB00DED4E90057428264F7AC6798) |
| B2 create + writer finish | tesSUCCESS | [91650D3BC2F04BFC18C2F9429D29FF81E3781FAA6FA8707CDE335D1F8B6EBAF7](https://testnet.xrpl.org/transactions/91650D3BC2F04BFC18C2F9429D29FF81E3781FAA6FA8707CDE335D1F8B6EBAF7) |
| inner EscrowCreate | tesSUCCESS | [91F0B5660AAD9E4B4600C4C1FB79A450FF98D11C62C95C036C2F58610B00CBDF](https://testnet.xrpl.org/transactions/91F0B5660AAD9E4B4600C4C1FB79A450FF98D11C62C95C036C2F58610B00CBDF) |
| inner EscrowFinish | tesSUCCESS | [A2839CF6B29A8E4BF77D52350BE3B45294B00BA621490217C91F2CED9C585277](https://testnet.xrpl.org/transactions/A2839CF6B29A8E4BF77D52350BE3B45294B00BA621490217C91F2CED9C585277) |
| B3 normal create | tesSUCCESS | [6DF75C612AA9E12632D39A24BADD32C29619EA53638BE54CDD2479390A54B68A](https://testnet.xrpl.org/transactions/6DF75C612AA9E12632D39A24BADD32C29619EA53638BE54CDD2479390A54B68A) |
| B3 normal finish | tesSUCCESS | [6628BDC02B29DDB492555D37A0B120464BE60AA13310A75ED57AA6FD5C2D2DC1](https://testnet.xrpl.org/transactions/6628BDC02B29DDB492555D37A0B120464BE60AA13310A75ED57AA6FD5C2D2DC1) |

B3 single observation: normal create/finish **14,202 ms / 4 validated-ledger advances**; successful create+finish Batch **6,242 ms / 2 advances**. Polling/client round trips and ledger alignment are included, no throughput or percentile claim. Both Batch inner transactions occupy one ledger; normal transactions occupy two. Rolled-back inner hashes are not present on ledger; no inner failure code is published for this ALLORNOTHING rollback. Outer Fee 459 drops for create+finish, 48 for two creates.

## C — product TEST-SGD purchase

Fresh faucet-funded buyer, fresh issuer and writer funded from it; issuer sets `asfAllowTrustLineLocking` (17), observed Flags=1073741824. OFFSET=800: API 9588 / publisher 9590, fixture planner/research/decision, real XRPL Testnet settlement, `ESCROW_MODE=key-reveal ESCROW_ASSET=test-iou`. One writer wallet is intentionally shared by the isolated fixture writer roles for this single purchase, not evidence of independent writers. The question is the established RLUSD escrow preset. **40 minor units / one verified purchase / 16626 ms** for the run (provisioning excluded). Article `c5-xrpl-token-escrow-xls85` is team-authored; SGT is a labelled stand-in, not RLUSD. `c-receipt.json` preserves the product export.

`verifyEscrowCredit` passes on the real code path: `server/escrow.ts:82` checks recipient RippleState delta before persisting the reveal and releasing the encrypted article. The resulting intent is VERIFIED/RELEASED. This is a local HTTP stack, not hosted acceptance. All processes stopped and private temporary databases deleted by the script. Seed values only exist in process environment/memory, never public evidence.

| Step | Engine / validated result | Hash |
|---|---|---|
| fund fresh account | tesSUCCESS | [8B7F05C6C171ABF088855C557E01CC08E67D82B56F2C88A9ACC880A0871808EF](https://testnet.xrpl.org/transactions/8B7F05C6C171ABF088855C557E01CC08E67D82B56F2C88A9ACC880A0871808EF) |
| fund fresh account | tesSUCCESS | [A708ACA11CF75F51C0697442E4520B7CC5442314BE70DFA167708AD201FA89D9](https://testnet.xrpl.org/transactions/A708ACA11CF75F51C0697442E4520B7CC5442314BE70DFA167708AD201FA89D9) |
| enable AllowTrustLineLocking | tesSUCCESS | [52E26F9692DF6AC85D7336FD6047B1A769BAEE12695FF53173FB002D5E53E776](https://testnet.xrpl.org/transactions/52E26F9692DF6AC85D7336FD6047B1A769BAEE12695FF53173FB002D5E53E776) |
| SGT trust line | tesSUCCESS | [0B34A1C944548EF3FB36B63AEFC7F6DA4760317196674AC8DEC88B5AC3DC759B](https://testnet.xrpl.org/transactions/0B34A1C944548EF3FB36B63AEFC7F6DA4760317196674AC8DEC88B5AC3DC759B) |
| SGT trust line | tesSUCCESS | [E7AB516D8113060A2DC695682B4C72A2BD67DA5CB218CE0E73D3C23B0E97163D](https://testnet.xrpl.org/transactions/E7AB516D8113060A2DC695682B4C72A2BD67DA5CB218CE0E73D3C23B0E97163D) |
| issue SGT | tesSUCCESS | [D4A91C7A8DE5D733EC4A0D2A6F5F07E4BF437D6D6C83DF1ADB97F21D1D94A961](https://testnet.xrpl.org/transactions/D4A91C7A8DE5D733EC4A0D2A6F5F07E4BF437D6D6C83DF1ADB97F21D1D94A961) |
| product create | tesSUCCESS | [8600167DCF721AA3FB80318D0268DE6754E82116EACA4F51592A5CC1D054B1E6](https://testnet.xrpl.org/transactions/8600167DCF721AA3FB80318D0268DE6754E82116EACA4F51592A5CC1D054B1E6) |
| product writer finish | tesSUCCESS | [950451C760C37F21158C423D6D62E1E7C932711A01D8B7B76791D59FC13803EE](https://testnet.xrpl.org/transactions/950451C760C37F21158C423D6D62E1E7C932711A01D8B7B76791D59FC13803EE) |

Friction: use the named SDK flag (locking=17, clawback=16); the script asserts the resulting bit. Wait for publisher readiness before API startup. A fictional-corpus question has no candidates on the Testnet team corpus, and a covered question buys nothing; use the documented RLUSD preset for this repro. Product needs no settlement change for TEST-SGD, but provisioning remains separate from a visitor wallet faucet. No official RLUSD purchase is claimed.


## D — official RLUSD flags (read-only)

[Ripple published issuer addresses](https://docs.ripple.com/products/stablecoin/developer-resources/rlusd-on-the-xrpl). `account_info` plus `feature` on 12 Nov; d.json holds exact responses. Mainnet issuer `rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De`, ledger 108278852; Testnet issuer `rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV`, ledger 22263716. Both Flags=2174353408 (`0x819a0000`); bit `lsfAllowTrustLineLocking=0x40000000` is **off**. Both nodes report TokenEscrow and fixTokenEscrowV1 enabled. Official RLUSD cannot be escrowed under this issuer setting. No Mainnet signature, simulation or submission. Product must retain a labelled SGT stand-in or use exact RLUSD Payment until Ripple opts the issuer in.
