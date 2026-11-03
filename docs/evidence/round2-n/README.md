# Lane N — verified writer identity via XRPL Credentials

LIVE TESTNET, no real value. Executed 4 Nov 2026 Singapore (3 Nov UTC).
Existing `.env` payer issuer and three existing publisher wallets were reused;
no faucet funding, wallet creation, live LLMs or real money. Credential fees total
48 drops (four transactions at 12 drops). These are issuer operations, not engine
purchases. Fixture writer names are synthetic and make no claim about real authors.

| Operation | Transaction hash | Validated ledger |
| --- | --- | --- |
| Writer 1 CredentialCreate | `225F19ED4BF1C206AE140D5286BE352F2F6E7A7A05A317D949DAEE876E98DAC6` | 22045976 |
| Writer 1 CredentialAccept | `4C0584A8E8A8FB59534D3A55A0D5CC42571891805085640F940673CB0FBBAAB7` | 22045978 |
| Writer 2 CredentialCreate | `837A67A953660428F667319B10247CD4ED371428CA8AC806670CFEB49721FFEC` | 22045980 |
| Writer 2 CredentialAccept | `13D4316818FEF951179DF0ED64DE80A60BAE559C0215DFEAA63EA14E4B8C9180` | 22045982 |

`transactions.json` retains issuer, subjects, type, validated indexes and fees.
`observations.json` shows two verified wallets and the third unverified.
`engine.json` demonstrates the actual PublisherClient public search path with a
synthetic corpus on an ephemeral loopback port, signed by those existing wallets:
two verified writer labels and one unverified. Wallets were assigned to fixture
names solely for this demonstration. No article was purchased. `availability.json`
records the initial third-wallet admission failure, subsequently corrected with
a bounded queue and read-only retry; Testnet Credentials were available.
The ledger page includes all four rows labelled “Testnet, credential”.

Reproduce provisioning once with:

```sh
node --import tsx scripts/credentials-testnet.ts --testnet
```

Offline checks validate stored evidence without loading wallets or contacting Testnet:

```sh
node --import tsx scripts/credentials-testnet.ts --check-only
```

The same-wallet, two-origin regression uses actual signed fixture publishers,
with a stubbed ledger; their routing identities differ but their cached wallet
verification is identical. The ledger matrix covers accepted valid, absent,
unaccepted, expired, wrong issuer/type/subject/network, timeout, malformed,
oversized and untrusted issuer label impersonation. Only valid verifies.
A concurrency test proves maximum two RPC requests. No engine sign/submit API
exists in the verifier.

`policy-comparison.json` compares UC2 fixture budgets, spend, reservations,
intents and decision verdicts with the pinned main baseline. Both default Lane N
and Lane N with synthetic verified identities are identical: budget 200, spend 90,
reservation 0, one verified NotFT purchase. These are SIMULATED fixture results.
Reproduce the Lane N projections with:

```sh
node --import tsx scripts/credentials-policy-proof.ts
node --import tsx scripts/credentials-policy-proof.ts --observed-fixture
```

For baseline, run the first script from an archive of the recorded main SHA with
that script copied in. `--observed-fixture` injects identity through an isolated
scenario API module; it does not claim on-ledger verification. Prices, trust,
spending authority and signed receipt semantics remain unchanged. Receipt bundles
omit observations; offline verifiers flag identity as requiring an online check.
All 177 shared receipt cases pass unchanged in both SDKs (the TypeScript suite
also checks the Python wire-schema snapshot). No gate or threshold was loosened;
legacy-label assertions now expect typed unverified status, and ledger row count
increased from nine to thirteen with credential transaction binding checks.
