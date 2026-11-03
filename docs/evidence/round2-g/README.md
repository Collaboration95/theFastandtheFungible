# What your money bought

Local synthetic extractive evidence, 4 November 2026. Based on merged Lane F
c0450fa6e4ebd83b6e9105ede7d824e9ae2bb1f4. No provider or ledger requests,
Testnet transactions, real money, new royalties or human semantic acceptance.

Three scenarios contain 30 paid claim/passage links: useful 8, redundant 8,
failed/refunded 14 (the verified replacement purchase, never quarantined content).
Each claim quotes one delivered span. The two collision writers have identical
text and local IDs but distinct canonical source identities. Redundant preserves
historical use and removes it from the final answer. This is a structural fixture,
not 30 independently verified facts or evidence of causal improvement.

`contributions.json` records original v1/v2 compatibility and per-purchase links.
`tamper-results.json` records rejection of origin, signer key, manifest, span,
claim, answer version, grant, amount, retention and citation mutations.
`*.verify.json` retain positive verifier transcripts. `useful.png`, `redundant.png`
and `refunded.png` show the actual ReceiptSheet in a fixture wrapper;
`accessibility.json` records zero serious/critical axe findings and Escape closure.
Screenshots use direct-research royalty responses; no royalty is manufactured.
The refunded scenario reuses historical verify-278 signed evidence (original rail
labels retained); this run performs no ledger lookup. Historical and synthetic
answer annotations are distinct from signed passage authenticity.

`metric-equivalence.json` uses declared toy rows: full cost 30 qualifies once
although its gained-fact list repeats `f`; 40 with a later-removed fact does not;
30 refunded does not. Numerator 30 / gross denominator 100 minor units, exactly
30 percent in unchanged qualityMetrics (difference 0 percentage points). No-spend
is null. This is an arithmetic consistency test, not the historical 93.15% benchmark
or a runtime effectiveness score. Runtime receipts omit quality percentages.

Reproduce with Node >=22.13 and installed dependencies:

```sh
node --import tsx scripts/contribution-evidence.ts
node --import tsx scripts/contribution-screenshots.ts
npx vitest run tests/contribution.test.ts tests/numbers-pipeline.test.ts tests/verify-answer.test.ts tests/purchase.test.ts tests/proofs.test.ts tests/gate-audit.test.ts
python3 -m pytest packages/sdk-python
npx playwright test tests/ux2.spec.ts tests/a11y.spec.ts
npm run verify:answer -- docs/evidence/round2-g/useful.receipts.json --json
npm run check:fast
```

The screenshot command uses ephemeral loopback Vite and closes all resources.
The evidence command reuses committed signed leaves; no fixture key or seed exists
in this packet. The corpus/provider/policy/rubric modes are in contributions.json.
Frozen requested facts are exported when present; no correspondence between a
requested fact and a claim is invented when semantic assessment is absent.

Cut under the explicit Stop rule: runtime semantic retained/gained fact assessment,
semantic “none”, and quality percentage. All runtime semantic states remain
“not assessed” / “not independently verified”. Structural “none” means no final
citation, not no value. Royalty UI uses existing payout rows and hire policy names;
missing exports remain not assessed, unconfirmed rows keep their actual status,
and no inbound hire means not applicable. It does not independently check a ledger.

Audit heads in these fixtures are inherited reference heads, not independently
obtained attestations of these new answer annotations. Use a separately retained
head to detect audit-chain rewriting. Even that head does not authenticate answer
text: the existing audit does not commit answer bodies. Structural recomputation
checks consistency against the exported answers; it cannot establish that an
operator did not rewrite both answers and contribution metadata, or certify truth.
No hard gate, threshold, benchmark, price or royalty policy was loosened.

Local validation: 937 TypeScript tests, 80 targeted tests, 18 Python tests,
four requested Playwright tests, all three receipt axe checks and 20 chaos
iterations passed (zero invariant violations, double charges or stuck reservations).
Existing lint warnings were unchanged. The final commit hook reruns check:fast;
hosted CI status and exact PR head are reported in the PR handoff.

Node 22 coverage component ratchets and the clean SDK ESM/declaration package
consumer pass with unchanged floors. Receipt state tests include unconfirmed and
confirmed royalty rows, unavailable exports, recorded refunds and removed claims.
