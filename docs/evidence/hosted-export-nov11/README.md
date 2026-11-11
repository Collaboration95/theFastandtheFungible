# Hosted-demo export and the v1.1.0 verify path (11 Nov 2026)

**XRPL Testnet · no real value.** One live run on the hosted judge demo
(https://ra-front-651013803640.asia-southeast1.run.app, build `0c12748e`): DeepSeek
`deepseek-flash` research, the fixture (rule-based) purchase decisions the demo's chip
names, team-authored writers ("ResearchAgent builders", labelled not independent), the
demo's shared Testnet sponsor wallet within its per-visitor caps. Nothing here uses real money.

## What was run

`node --import tsx docs/submission/deck/hosted-shots.mjs --question XRPL2` (Playwright,
1440 × 1200 CSS px at 2×, light theme, a fresh anonymous visitor): it typed the
"x402 headers" preset, *What HTTP headers does x402 use on XRPL, and how does the server
know the payment actually settled?*, kept the default S$2.00 budget, let the 5 s plan
start, waited for the answer and its anchor, then used **Export → Download receipts.json**
exactly as a judge would. The same run, reopened from its saved visitor session, gave the
deck's slide 10 shots (`--reopen`). Nothing in any image is edited.

- Run `953af12e-c87c-4c83-85f6-e172ad372bfe`: 2 articles bought by key reveal (S$0.40 each,
  net S$0.80 of S$2.00), 0 refunded, answer anchored on ledger 22228575.
- [`receipts.json`](receipts.json): the export as downloaded (SHA-256
  `1f2fe4de4de58fedb68c8e04c9f2106fa0b66004c1839ae93f29bb0662ee13ee`). It carries only the
  passages this run bought, from the team's own explainers.
- Images: [`docs/media/readme-answer.png`](../../media/readme-answer.png) (README hero),
  [`ux-answer.png`](../../submission/deck/assets/ux-answer.png) and
  [`ux-payment.png`](../../submission/deck/assets/ux-payment.png) (slide 10), with
  [`shots.json`](../../submission/deck/assets/shots.json) as the capture manifest.

| Step | Transaction on XRPL Testnet |
|---|---|
| Escrow created, "What does an x402 402 Payment Required response contain?" | [B6FDBD22…100028E5](https://testnet.xrpl.org/transactions/B6FDBD229FEBDFAE041C4A21FE115449E3396AE7E9A422D391C0F7B4100028E5) |
| Key published (EscrowFinish), sha256(K) = Condition | [4CCB4E56…1AC70638](https://testnet.xrpl.org/transactions/4CCB4E56137D738847E853535B068329562AD490DA4D9F5551CEC2EB1AC70638) |
| Escrow created, "What does HTTP 402 and x402 actually standardize?" | [E61FD9D0…244A156A](https://testnet.xrpl.org/transactions/E61FD9D098B200DD99F53DB4C3F024ED44CAF44B7ED2435B4918E224244A156A) |
| Key published (EscrowFinish), sha256(K) = Condition | [78F5BF15…0042C1B6](https://testnet.xrpl.org/transactions/78F5BF157C2B9792A92D865713E80EB8F2827364825D017F178F71810042C1B6) |
| Answer anchor (AccountSet, memo = audit head) | [5CAFF213…C8DE6491](https://testnet.xrpl.org/transactions/5CAFF213CC8ADC0EC8BCA1FE17AB08280A65823BBD3A886DABDCC1CEC8DE6491) |

## Why it is committed (H8-02)

The round-8 review found that the README's v1.0.2 wheel says `RESULT FAIL` on receipts
exported from the hosted demo. Reproduced on this export, read-only against s.altnet:

| Verifier | Result | Output |
|---|---|---|
| v1.0.2 wheel from the GitHub release (clean venv) | **FAIL**: `anchor binding: Anchor head, run and answer commitment agree` | [verify-v1.0.2-wheel.txt](verify-v1.0.2-wheel.txt) |
| Python verifier from this tree (v1.1.0) | **PASS** (46 passed, 2 skipped), audit anchor validated, testnet 11/11 | [verify-python-main.txt](verify-python-main.txt) |
| TypeScript verifier from this tree (`researchagent-mcp verify`) | **PASS**, audit anchor validated, testnet 11/11 | [verify-ts-main.txt](verify-ts-main.txt) |

The answer commitment now includes the answer's `lead` (#429); v1.0.2 drops that field
before hashing, so its recomputed commitment differs. Every verify instruction now pins
v1.1.0, and release acceptance (`scripts/release-consumers.ts`) verifies this file, plus
two fresh offline `HOSTED=1` fixture exports, with the **packed** wheel and the **packed**
TS CLI before a release can be admitted (`validateHostedExports` in
`scripts/release-contract.mjs`).

Limits: one run, one question, one visitor; the hosted demo's own state and models on
11 Nov. The answer quality shown is that run's, not a benchmark. The duration shown in
the images ("Done in 44.1 s") is the app's reopened-run figure; live, the same run said
36.1 s (a known display difference, H8-14).
