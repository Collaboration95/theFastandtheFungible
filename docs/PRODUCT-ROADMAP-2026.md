# ResearchAgent product roadmap

Updated 22 September 2026. This is a post-hackathon roadmap. It prioritizes a
credible October 1 presentation, then product learning and live-integration
quality. It is not a commitment to public deployment or production funds.

## Product thesis

ResearchAgent helps a researcher decide whether additional evidence is worth
paying for. It should answer from accessible evidence when that is sufficient,
identify material gaps when it is not, and put every paid-source decision under
an explicit budget and manual approval boundary.

The differentiator is not “an agent can pay.” It is:

> The system can explain why evidence may change an answer, constrain the spend,
> keep protected content locked, and prove what the purchase changed.

XRPL is an optional settlement and audit rail. It is not the product by itself.

## Product boundaries

### In scope

- Guided question, source-profile, budget, and plan setup.
- Truthful supported-scope handling in deterministic fixture mode.
- Open and premium evidence states with evidence-family lineage.
- Cited answers from accessible open evidence.
- Explainable premium-source proposals and explicit exact-quote approval.
- Server-owned budget, quote, access, citation, and receipt controls.
- Deterministic local fallback plus clearly separated optional Groq and XRPL
  Testnet modes.
- Local evaluation, accessibility, responsive behavior, and demo recovery.

### Not yet in scope

- General live-web research or arbitrary source crawling.
- Mainnet funds, production billing, or autonomous purchasing.
- Real publisher licensing or fulfilment claims.
- Multi-user authentication, teams, subscriptions, or cloud deployment.
- A marketplace, ratings system, credit facility, or generalized shopping
  agent.
- History/library navigation until its persistence and retention contract is
  implemented end to end.

## Canonical proof

Question: can announced AI data-centre buildout become operating capacity by
2028, or are grid constraints underestimated?

The product must make these facts easy to verify:

1. Unsupported questions do not receive unrelated fixture evidence.
2. Plan approval is not purchase approval.
3. Open evidence can produce a cited answer without spending.
4. Premium candidates are compared by gap fit, independence, authority, and
   price—not by an unexplained “truth score.”
5. One useful source can be approved, one duplicate skipped, and one source
   blocked by policy.
6. Fixture settlement, XRPL Testnet settlement, and content fulfilment are
   visibly different states.
7. Final claims cite only accessible, server-validated evidence spans.

## Milestone 1 — October 1 presentation freeze

Goal: a repeatable, truthful five-to-seven-minute local demonstration.

### Work

- Repair and run lint, typecheck, unit, browser, accessibility, and build gates.
- Keep Playwright on the actual client port with an isolated run store.
- Confirm the guided setup, unsupported-scope path, open-only answer, manual
  purchase review, and citation drawer on the presentation machine.
- Freeze a canonical fixture environment and a known-good local run script.
- Keep only current presentation screenshots and the canonical diagrams.
- Align README, spoken claims, mode labels, and fallback behavior.
- Rehearse network-off, provider-failure, stale-quote, and clean-reset recovery.
- Prepare a static screenshot and dossier fallback in case the local process
  cannot be recovered during the presentation.

### Exit gate

- All repository verification commands pass from a clean install.
- The canonical fixture path succeeds three consecutive times after reset.
- Open-only and paid paths both produce validated citations.
- No screen implies a real publisher, live crawl, live FX rate, or mainnet
  payment.
- The presenter can recover from a stopped server or stale run within one
  minute.
- The demo and fallback artifacts are copied to the presentation machine and
  opened once before travel or the meeting.

The operational checklist lives in
[PRESENTATION-READINESS.md](PRESENTATION-READINESS.md).

## Milestone 2 — post-presentation product validation

Goal: determine whether budget-aware evidence acquisition is useful beyond the
canonical scenario before expanding integrations.

### Work

- Run five to eight structured sessions with researchers or analysts.
- Measure whether users understand source authorization, maximum spend,
  proposal versus approval, open versus protected evidence, and why a purchase
  changed the answer.
- Add two or three new deterministic scenarios with independent fixture
  families and expected decisions.
- Build an evaluation scorecard for scope rejection, ranking, duplicate
  avoidance, policy enforcement, access control, citation validity, and
  conclusion impact.
- Canonicalize source metadata and remove any remaining fallback/catalog drift.
- Decide whether saved history and a purchased-source library solve an observed
  user need; implement them only with retention and access semantics.

### Exit gate

- Users can explain the spending boundary without presenter coaching.
- Golden scenarios catch regressions in source choice, protected access, and
  citations.
- Product metrics distinguish answer quality from amount spent.
- The next scenario is chosen from user evidence, not presentation novelty.

## Milestone 3 — bounded live evidence integration

Goal: replace one fixture edge with an authorized, observable integration while
retaining deterministic fallback.

### Work

- Add one public or explicitly licensed source adapter with provenance,
  timeout, rate-limit, and caching rules.
- Keep source text untrusted and exclude it from instruction authority.
- Define versioned resource and evidence-span identities before allowing live
  content into final citations.
- Add reconciliation and failure states for unavailable, changed, or revoked
  content.
- Compare live and fixture results against the same evaluation scorecard.

### Exit gate

- The adapter cannot widen the user-approved source scope.
- Every displayed claim resolves to an accessible source version and span.
- Failure falls back or stops truthfully; it never substitutes unrelated
  fixture content.
- Licensing and retention terms are visible in the stored evidence record.

## Milestone 4 — protected article and XRPL Testnet proof

Goal: demonstrate one real HTTP payment challenge, validated Testnet payment,
and separately verified article fulfilment.

### Work

- Pin one x402 protocol/facilitator version and its headers.
- Bind quote, invoice, resource, amount, network, payee, expiry, and approval.
- Use unique idempotency and reconcile unknown outcomes before retrying.
- Keep signing keys outside the browser and model context.
- Validate `tesSUCCESS`, payer, receiver, exact amount, and ledger finality.
- Verify the delivered artifact identifier, version, and content hash before
  granting access.
- Exercise tampered amount, wrong payee, expired quote, duplicate invoice, and
  fulfilment-failure paths.

### Exit gate

- A Testnet payment can succeed without weakening fixture mode.
- A settled payment cannot unlock the wrong or unverifiable resource.
- Unknown settlement never triggers a blind second payment.
- The receipt separates decision, settlement, fulfilment, and evidence use.
- No documentation or UI describes Testnet proof as production readiness.

## Priority order

1. Presentation reliability and truthful claims.
2. User validation and scenario evaluation.
3. Source/provenance quality.
4. One protected-resource payment and fulfilment proof.
5. Production architecture only after the first four generate evidence.

## Definition of done for future work

A change is done only when:

- its user-visible outcome and owner are explicit;
- server authority and failure recovery are preserved;
- fixture/live language remains truthful;
- automated checks cover the normal and unsafe paths;
- keyboard and responsive behavior are reviewed where UI changes;
- documentation updates an active contract instead of adding another status
  ledger; and
- no protected content, secret, or invalid citation crosses its boundary.
