# T3: the preset that explains itself

12 November 2026. Measurement baseline: QUAL merge `f3f570fb`.

Local `HOSTED=1`; live DeepSeek planner and writer via the private repo `.env`; fixture purchase decisions; keyword search. Real XRPL Testnet key-reveal escrow in XRP, test funds only, no real value. S$ is the application display price (40,000 Testnet drops per S$0.40), not a market exchange rate. The hosted-readiness callback is stubbed healthy locally; deployed readiness is outside this evidence. Ephemeral loopback ports; no public hosted questions. Existing operator Testnet writer wallets; no faucet requests or cloud changes. No signing secrets are retained in this report.

Three fresh plans for the exact proposed question: “How does the writer get paid, and what stops the agent from reading the article and then refusing to pay?” Two fresh plans each for the unchanged x402 and RLUSD questions. Each scoped plan reports `DeepSeek · deepseek-flash`; purchases use `fixture · metadata-fixture`.

Browser verification uses the actual `VerifyInBrowser` component, rendered locally by Vite, and the real `verifyInBrowser` module with read-only public Testnet WebSockets. No ledger replies or verification results are mocked. The two not-checked items are writer credentials and historical origin; they are not counted as passes.

| Ask | Bought | S$ | Browser checks | Scope-through-answer ms |
|---|---|---|---|---|
| T3-1 | product-writer-paid | 0.40 | 26 passed · 2 not checked; 0 failed | 29525 |
| T3-2 | product-writer-paid | 0.40 | 26 passed · 2 not checked; 0 failed | 26540 |
| T3-3 | product-writer-paid | 0.40 | 24 passed · 2 not checked; 0 failed | 32583 |
| XRPL2-1 | product-x402-response | 0.40 | 25 passed · 2 not checked; 0 failed | 25528 |
| XRPL1-1 | team-rlusd | 0.40 | 24 passed · 2 not checked; 0 failed | 24171 |
| XRPL2-2 | product-x402-response | 0.40 | 25 passed · 2 not checked; 0 failed | 23235 |
| XRPL1-2 | team-rlusd | 0.40 | 24 passed · 2 not checked; 0 failed | 28996 |

## Leads

**T3-1:** the writer gets paid by publishing the article's key on the XRP Ledger: the payment waits in an escrow that only that key can open, so an agent cannot read the article unless the writer is paid.

**T3-2:** the writer gets paid by publishing the article's key on the XRP Ledger: the payment waits in an escrow that only that key can open, so an agent cannot read the article unless the writer is paid.

**T3-3:** the writer gets paid by publishing the article's key on the XRP Ledger: the payment waits in an escrow that only that key can open, so an agent cannot read the article unless the writer is paid.

**XRPL2-1:** an HTTP 402 response offers payment requirements in PAYMENT-REQUIRED; the client chooses supported terms, authorizes payment and retries with PAYMENT-SIGNATURE. An agent can pay a 402 in XRP on Testnet, network xrpl:1.

**XRPL1-1:** Not today: an XRPL escrow can hold official RLUSD only after its issuer enables AllowTrustLineLocking, and the RLUSD issuer had not enabled it on Mainnet or Testnet when the team checked on 11 November 2026.

**XRPL2-2:** an HTTP 402 response offers payment requirements in PAYMENT-REQUIRED; the client chooses supported terms, authorizes payment and retries with PAYMENT-SIGNATURE. An agent can pay a 402 in XRP on Testnet, network xrpl:1.

**XRPL1-2:** Not today: an XRPL escrow can hold official RLUSD only after its issuer enables AllowTrustLineLocking, and the RLUSD issuer had not enabled it on Mainnet or Testnet when the team checked on 11 November 2026.

## Public Testnet payment evidence

Each row is one key-reveal purchase: escrow created, writer published the key in EscrowFinish and was paid, then the answer was anchored. The browser independently checks both escrow transactions, the key commitment/decryption and anchor.

| Ask | EscrowCreate | EscrowFinish | Answer anchor / ledger |
|---|---|---|---|
| T3-1 | [039FFE63…](https://testnet.xrpl.org/transactions/039FFE638582EF411E042F7237B96B29A15442F8AD0070A76D8CE19B18B6A25D) | [BC2B4BAD…](https://testnet.xrpl.org/transactions/BC2B4BAD2D7E7615E3A3B6A74888899F433615EE99D4E0ACD75F5CC9C2BA9F01) | [711C5958…](https://testnet.xrpl.org/transactions/711C59581B0FD2623FE53A4316CA62BE99BABC9AC1EA8D228BC481C4D94959E7) / 22251122 |
| T3-2 | [F88DE466…](https://testnet.xrpl.org/transactions/F88DE4661F690AEA0A5DEC0547A1510DBF22B9A28E3CCAEC2BE760A37DBAF7ED) | [3A55417F…](https://testnet.xrpl.org/transactions/3A55417F5B31F8923DE4588BE2C660277B6898B37F3F2766D8FDD6A1D180983D) | [455EBA70…](https://testnet.xrpl.org/transactions/455EBA7025ADD0E8B1FAAA8C82A855E20D26A7268A7FE795A2B0F66E8A02011E) / 22251137 |
| T3-3 | [5C3CCD88…](https://testnet.xrpl.org/transactions/5C3CCD88B2372355A48EB25DD4D5AFF6CC2A52FA1445F79C742931D0C517AB7D) | [ABE5E054…](https://testnet.xrpl.org/transactions/ABE5E054DCDF924933E2FD6016B29B394F623455001678538B26F055EB47E7AC) | [026E69B0…](https://testnet.xrpl.org/transactions/026E69B066BF9DD2461612756759EFB11DA22C395BC5EDBC3999AA2DED887B5D) / 22251152 |
| XRPL2-1 | [44636930…](https://testnet.xrpl.org/transactions/446369308F2EA5749BA1378A2EAB861F809058CCC8444F93B6CF61838613B689) | [F29F4769…](https://testnet.xrpl.org/transactions/F29F476947A8D0F743ADC48564FD64E178F48F53A635EE84DDE066909144287E) | [F255AE0C…](https://testnet.xrpl.org/transactions/F255AE0C5FBFE679C4A8BD51F94E1160BD0E29161708B3CC87031540BF771D03) / 22251167 |
| XRPL1-1 | [CF275FB2…](https://testnet.xrpl.org/transactions/CF275FB2228A1119DAC3C45C48220064D51E8D28612C0512E50E58EAE60C1D2E) | [108E7614…](https://testnet.xrpl.org/transactions/108E7614E564FA7D9151E1454BECFB911EBA0B93B144FB7B7FC2364E62E4C10B) | [E51C0B65…](https://testnet.xrpl.org/transactions/E51C0B6571FCD0828AA549F42FD21835D03FD805FFC49381072522D5E4A67C94) / 22251181 |
| XRPL2-2 | [038A3A76…](https://testnet.xrpl.org/transactions/038A3A76C2D8E97AC3A4C13EB7BC47FF1A20AD7D68093DA5C684B0148FE0EEFA) | [FB5153F0…](https://testnet.xrpl.org/transactions/FB5153F0E6ABF2DA1E6285C5998E34C2B52D9B19CD2EA1B1EA9AC96EEE1B9A78) | [3A3E6C84…](https://testnet.xrpl.org/transactions/3A3E6C84196965C24ECF013E0A668A24141939D37EF9911F0F1E1401ED599CEB) / 22251195 |
| XRPL1-2 | [7F8A15CD…](https://testnet.xrpl.org/transactions/7F8A15CD0E07952EE5A4F851B64A51A04E45D123A22F5CC56888C562585C87CC) | [7BFFA7A5…](https://testnet.xrpl.org/transactions/7BFFA7A5F156331A028B1DE133F05D9257CF27006C50F384490AFC880E1DBE40) | [56988E6A…](https://testnet.xrpl.org/transactions/56988E6AC176826705740A17908E7E8830F72DC4E8409BF7A8AD8ABB140FB45F) / 22251210 |

## Evidence integrity

SHA-256 hashes of the exact local receipt exports used in browser checks. Raw exports and the temporary harness are retained locally in the main checkout’s ignored `scratch/t3-presets-nov12/` directory after shipping; they contain no wallet seeds or API keys.

```text
27eca88e549cd9690ad68e586e56f465e697649573d5e6b6809d0f8e7bbabbd9  runs-T3-1.receipts.json
029ae374603a44d6822def2e3a95e09e987a11bb69c03eaae2a44916ce6134b3  runs-T3-2.receipts.json
b69a0783cb3e4d51d875a48ec2c7e193f85b7bc18dd89f1348cc2abe614fec49  runs-T3-3.receipts.json
7664b69e32b462c4e9db7dddc6eb55447a25660179d96dbfcff38ad9a1eada00  runs-XRPL2-1.receipts.json
93b9ef3d8dfde99ad203e9b4215fb75668d342e28f5e1121f67cf5a6450262f1  runs-XRPL1-1.receipts.json
6692d1fd2b3789bf3ea228b9d5f654b3eb996bf23acd171073529543aad23c9f  runs-XRPL2-2.receipts.json
bef77792104dfade3e8cf8f7aa4c358fe8260dea44ad1c3eeccac01ce8c74bb9  runs-XRPL1-2.receipts.json
```

## Submission and video handoff (not edited)

- FIN: `docs/submission/pitch-2min.md` (live demo paragraph) and `docs/submission/qa-prep.md`: optionally use the exact third question / “How writers get paid” label for a prepared run; say one S$0.40 purchase only for a run that actually shows it. The existing shortened x402 question is not the exact first-preset text; the first preset remains the two-part x402/Testnet question.
- VID-3: `docs/submission/demo-video-script.md` shot 2 and `docs/submission/video/README.md`: if the new third preset is filmed, replace the question, lead and displayed cost with this run’s observed values, then follow its own EscrowFinish. Refresh any new home/preset screenshots after redeploy. Preserve historical footage labels and dates; the current x402 recording remains a valid recording.
- FIN: `docs/submission/deck/hosted-shots.mjs --question XRPL3` automatically imports the new preset after this change; refresh deck imagery only after redeploy. No text asserts that historical XRPL3 evidence was about writer payment.
- No root `video/` directory exists at the measured baseline; video material is under `docs/submission/video/`. No files in either protected scope were edited.

## Decision and regression checks

**PASS 3/3: ship the third preset.** All seven fresh asks bought one article for S$0.40, used key-reveal escrow and had zero browser-verification failures. The new preset’s three leads explicitly say the key is published on the XRP Ledger and opens escrow payment. No model fallbacks occurred. x402 and RLUSD retain their exact question strings, purchases and leads in both fresh runs.

178 targeted tests passed across `k4-presets`, `r8-judge-questions`, `r9-judge-questions` and `r10-presets`. The latter retains reserves’ historical XRPL3 plans and its 1 XRP / 0.2 XRP assertions. Only the intended third-preset snapshot changes. `HostedHome.tsx` has no pinned preset names, so it needs no edit. The stage sheet changes only its prepared preset name. The LIVE-DEC harness gold now expects writer payment for current XRPL3; its summarizer uses the recorded question to preserve historical reserves scores. Re-summarizing the November 11 comparison produces identical per-question results; the three fresh third-preset rows all score right-first and lead-answers.

Full used-bank and shipping verification will be recorded in the PR’s validation section and the exact-head `local-gate` status. No gate, policy, spending cap, numeric threshold or leak budget was loosened.
