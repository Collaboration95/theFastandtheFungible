# FairCut — Autonomous Build Goal and Verification Contract

**Hackathon:** SingHacks 2026, Ripple/XRPL track

**Product:** FairCut

**Working pitch:** *An AI editor licenses the exact seconds it uses—and the creator gets paid immediately.*

**Primary user:** Leah, an independent filmmaker in Singapore

**Document role:** This is the authoritative implementation goal for a coding agent working in repeated autonomous loops. It is a product contract, technical specification, UX brief, test plan, demo plan, and definition of done.

**Design direction:** **Black Paper / Trace Desk**, adapted into a film-editing rights-and-waveform workspace

**Qualifying rail:** XRP Ledger Testnet; at least one real, validated XRPL transaction is required

---

## 0. How to use this document

Build FairCut, verify it, and keep iterating until every mandatory criterion in this document has current evidence. Do not stop at a convincing static mock-up, a green unit-test suite, a submitted-but-unvalidated transaction, or a happy path that hides failure states.

This contract uses these requirement terms:

- **MUST**: required for completion.
- **MUST NOT**: prohibited.
- **SHOULD**: expected unless an inspected repository constraint makes it unreasonable; record the reason for any deviation.
- **MAY**: optional enhancement after all MUST requirements pass.

The implementation agent MUST:

1. Inspect the repository, local instructions, active branch, working tree, existing architecture, package manager, environment templates, tests, design assets, and any existing `DESIGN.md` or `UX-CONTRACT.md` before choosing technologies or editing code.
2. Treat existing user changes as authoritative and preserve them. Never reset, discard, rewrite, or overwrite unrelated work.
3. Read every applicable `AGENTS.md` and local instruction file before editing files in its scope.
4. Use `rg`/`rg --files` for discovery and `apply_patch` for hand-authored edits.
5. Prefer extending existing project conventions over replacing the stack.
6. Make the smallest coherent vertical slice work early, then deepen it through repeated verification loops.
7. Run proportional tests after each milestone and perform a complete verification pass before declaring done.
8. Verify the product in a real browser at desktop and mobile widths, not only through source inspection.
9. Exercise the successful, blocked, changed-quote, settlement-failure, fulfilment-failure, replay, and provider-unavailable paths.
10. Keep a compact implementation/evidence log in the repository using the project’s existing documentation convention. If none exists, add a `VERIFICATION.md` beside the app documentation only when repository scope allows it.
11. Never call a mock transaction, fabricated hash, local risk decision, unsigned payload, or explorer-shaped URL “live,” “settled,” “Trustline-approved,” or “verified.”
12. Keep working until the strict definition of done at the end of this file is supported by inspectable evidence.
13. Before substantial UI implementation, invoke the installed `frontend-design` and `frontend-design-premium` skills when available. Create and maintain `DESIGN.md` and `UX-CONTRACT.md` when absent, map durable tokens to one runtime owner, and follow their current verification workflow rather than copying only the visual suggestions in this document.

If a real integration is temporarily unavailable, implement and clearly label a deterministic fallback, retain the live adapter seam, and continue every other part of the build. An unavailable optional sponsor API is not permission to fake it. The qualifying XRPL settlement is not optional.

---

## 1. Mission

Build a polished, explainable prototype in which an AI editing agent helps Leah finish a 20-second commercial travel film by discovering and auditioning multiple independently offered music cues, checking whether each cue’s machine-readable rights satisfy a tightly bounded mandate, blocking an attractive but legally ineligible option before any signature exists, paying a real creator for the best eligible 12-second cue through an x402-style XRP Testnet purchase, inserting the delivered clean stem into the cut, and issuing a public-safe receipt that independently distinguishes:

1. what Leah asked for;
2. what options the agent considered;
3. why a candidate was eligible or blocked;
4. what exact payment the deterministic signer authorized;
5. whether XRPL validated that payment;
6. whether the promised media and licence were delivered and matched the purchased order; and
7. what limitations remain around provenance and legal ownership.

The primary experience MUST be a single, film-editor-shaped workspace—not a wallet dashboard, chatbot, generic marketplace, compliance console, or grid of disconnected cards. The audience should hear the result change after payment.

### Product promise

> FairCut lets an editor delegate a creative search and a tiny rights-clearing purchase without delegating unrestricted wallet authority.

### The one-sentence demo contract

> Leah asks for a tense-but-hopeful 12-second cue licensed for commercial social use in Singapore and Japan for six months under S$1; FairCut blocks the best-sounding personal-use track, pays the verified creator of the best eligible track on XRPL Testnet, swaps the watermarked preview for the clean stem, and produces a rights and settlement receipt.

### Non-negotiable self-explaining demo gate

The first useful deliverable is a **working, resettable explanatory vertical slice**, not a dashboard shell waiting for integrations. A coding agent MUST build this slice before optional integrations or decorative polish and MUST NOT report the goal complete without it.

An unfamiliar viewer opening `/demo` (or `/` when the app uses one primary route) MUST land directly on a populated Leah scenario. There is no login wall, setup wizard, empty project, wallet-connection prerequisite, or presenter-only explanation. Within ten seconds, the initial viewport must make these facts legible in plain language:

1. **Person:** Leah is an independent filmmaker finishing a travel campaign tonight.
2. **Problem:** she needs music that fits the cut and is actually licensed for commercial use in Singapore and Japan.
3. **Agent mandate:** FairCut may compare cues and spend only the exact bounded amount on an eligible licence; it cannot pay a blocked creator or exceed the cap.
4. **Decision:** the agent is balancing creative fit against deterministic rights, provenance, payee, territory, term, and budget checks.
5. **Paid object:** one exact 12-second clean stem plus its narrow machine-readable licence package.
6. **Useful outcome:** the final cut becomes playable with the licensed clean stem and an inspectable creator-payment/rights receipt.

The viewport MUST include a short human headline such as **“Leah needs one usable cue before midnight”**, the product promise, a clearly labelled mode badge (`FIXTURE DEMO` or `LIVE · XRPL TESTNET`), and one dominant **Run guided demo** action. Protocol terms may appear in secondary evidence, but they must not be required to understand the problem.

#### Required guided flow

The primary action drives a real, observable state sequence. Each phase must update the same project domain state used by the normal controls; it must not be a video, timed slideshow, decorative animation, or stack of prewritten cards disconnected from application behavior.

```text
Leah's rough cut and mandate
  -> agent compares three cues inside the cut
  -> best-sounding cue is blocked on commercial rights/payee evidence
  -> agent selects the best eligible cue
  -> exact bounded purchase is authorized and settled
  -> clean stem and licence are delivered and verified
  -> final cut becomes playable
  -> receipt connects decision, payment, delivery, and limitations
```

The UI MUST provide:

- a persistent plain-language phase rail with **Rough cut**, **Compare**, **Blocked**, **License**, **Deliver**, and **Final cut** stages;
- **Next step** and **Back to explanation** controls so a judge can pause and inspect causality;
- **Replay demo** after completion and **Reset demo** from the scenario menu;
- a manual path using the underlying controls, even if an optional guided auto-advance mode exists;
- reduced-motion behavior that changes state without animated travel or forced timing;
- a concise **Why this needs an agent** disclosure: the agent auditions creative alternatives and adapts after an attractive cue fails hard constraints;
- a concise **Why XRPL here** disclosure: XRPL records the approved micro-purchase from an independent provider; it does not determine rights, creative fit, or delivery correctness;
- a receipt/evidence drawer for hashes, drops, policies, and adapter sources so technical detail supports rather than obscures the story.

Every enabled demo control MUST work. If a step cannot run, show an honest inline explanation and recovery action; never leave a clickable false affordance.

#### Fixture rehearsal versus live proof

`FIXTURE DEMO` MUST run end to end from a clean local checkout with no wallet seed, paid account, network, or optional sponsor credential. It exists so the use case is always understandable and recordable. All simulated agent responses, policy decisions, ledger-shaped events, receipts, and explorer fields in this mode MUST be visibly labelled fixture/local and MUST NOT be presented as validated settlement.

`LIVE · XRPL TESTNET` MUST use the same comprehensible flow but obtain actual server state and preserve the qualifying requirement: a real `Payment` independently reconciled to `validated: true` and `tesSUCCESS`. A previously validated transaction may be loaded as **Recorded Testnet evidence** for stable rehearsal, with its real hash and timestamp intact; it is not a fresh live run. Resetting fixtures MUST never delete, rewrite, reuse, or relabel real ledger evidence.

#### Comprehension and recording acceptance test

Before completion, give the running prototype to at least three people who did not build it, or run an equivalent structured unmoderated review. Without verbal coaching, each reviewer must be able to answer:

- Who is Leah and what is urgent?
- What does the agent decide that a fixed checkout would not?
- Why was the most attractive cue blocked, and did money move?
- What exactly was purchased and delivered?
- What does the XRPL transaction prove, and what does it not prove?

Record answers and resulting copy/flow changes in `VERIFICATION.md`. The basic guided fixture flow must be reliably recordable in **60–90 seconds**; the complete live judge story may use the full three-minute script in §23.

---

## 2. The person, the moment, and the real problem

### 2.1 Primary persona: Leah Tan

- Singapore-based independent filmmaker and editor.
- Runs a small studio and frequently delivers short branded films with late-night deadlines.
- Comfortable with a nonlinear editor, timelines, stems, licences, and client territories.
- Not a blockchain specialist and should not need to understand drops, ledgers, CAIP-2, or transaction blobs to use the main flow.
- Currently finishing a 20-second travel campaign at midnight.
- Campaign will run as paid and organic social content in Singapore and Japan.
- Needs a 12-second cue beneath the reveal and closing title.
- Has a maximum licensing budget of S$1 for the prototype scenario.
- Refuses voice replicas and provenance-unknown assets.
- Wants to pay creators, but cannot spend an hour comparing prose licence pages.

### 2.2 Secondary persona: Mika Reyes

- Independent composer and rights-holder who publishes short licensable stems.
- Wants tiny, narrow, machine-readable licences to remain economically worthwhile.
- Receives payment at an XRPL Testnet destination controlled for the demo.
- Provides an original demo asset, a rights offer, an identifier/hash, attribution copy, and provenance assertions.
- Must not be presented as legally verified beyond the actual evidence in the prototype.

### 2.3 Present problem

AI-assisted editing can discover, generate, and assemble content faster than rights can be understood and cleared. Today’s licensing flows usually assume:

- a human browses one large catalogue;
- a subscription or broad licence absorbs transaction costs;
- terms are written for people rather than software;
- rights, asset identity, creator identity, payment destination, and delivery are checked in separate places;
- a payment receipt is treated as if it proved permission and fulfilment.

That breaks down when an editing agent wants one precisely bounded 12-second commercial use from an independent creator. The creative match is subjective, the rights constraints are structured but multi-dimensional, the economic amount is tiny, the seller may be cross-border, and the editor needs an evidence trail that does not expose private project data publicly.

### 2.4 Why the problem matters now

- AI compresses the creative workflow while increasing the number of assets an editor can consider.
- Individual licensing transaction costs can dwarf the price of a tiny use.
- Independent creators need attribution and immediate compensation without joining every centralized library.
- Users need provenance and rights evidence to remain distinct; one does not prove the other.
- Machine-to-machine commerce needs explicit delegated authority, replay resistance, fulfilment checks, and a signer boundary.

### 2.5 Paid object

The successful purchase is one versioned package for one exact order:

- a clean, original 12-second audio stem;
- the corresponding preview-to-master relationship;
- an ISCC identifier if the project can generate/validate one correctly, otherwise a clearly labelled SHA-256 asset digest fallback;
- a machine-readable ODRL 2.2 policy describing the narrow permission and duties;
- a C2PA Content Credentials manifest or fixture when available and valid;
- creator/payee identity evidence appropriate to the prototype;
- required attribution text;
- delivery manifest and hashes;
- a human-readable licence summary derived from, but not substituting for, the structured policy.

Payment is for this exact package. It is not a donation, wallet demonstration, marketplace deposit, subscription, NFT purchase, or payment of the suspicious/blocked candidate.

---

## 3. Product hypotheses and falsifiable irreducibility tests

The implementation and demo MUST make these hypotheses testable.

### H1 — The agent is materially necessary

The agent can select a cue that works in a real edit while satisfying mood, timing, territory, channel, term, provenance, attribution, voice, payee, and budget constraints across multiple providers.

**Evidence required:** at least three candidates with meaningfully different creative and rights properties; a reproducible scoring/explanation artifact; one creatively strong candidate that deterministic rights policy blocks; one eligible candidate the agent chooses based on creative fit among all policy-eligible options.

**Failure condition:** the app simply loads a preset winning track, applies a fixed `if` chain to choose it, or becomes a normal catalogue checkout with AI-generated prose.

### H2 — The deterministic layer is materially necessary

The model does not control signing policy. Exact amount, asset, network, payee, mandate version, rights-policy hash, resource identifier, expiry, invoice, and replay state are checked independently before the transaction can be signed.

**Evidence required:** tests prove that prompt text, model output, changed quote fields, or retrieved provider instructions cannot bypass the guard.

**Failure condition:** the LLM receives a seed/private key, constructs arbitrary transactions, or can persuade the signer to ignore a mismatch.

### H3 — Payment is materially necessary

The clean master and licence package are inaccessible before payment and delivered only after valid payment evidence is reconciled to the one-time invoice.

**Evidence required:** pre-payment playback uses a watermark or muted/limited preview; the clean asset endpoint returns a real payment challenge; after successful settlement, the clean stem is fetched, hash-checked, placed on the timeline, and audibly changes the output.

**Failure condition:** the clean asset is already bundled in publicly reachable client code or the UI merely hides it with CSS.

### H4 — XRPL materially improves the open-market model

Independent providers can quote a tiny payment without a bilateral account, and settlement is low-friction, independently inspectable, and bound to the licence order.

**Evidence required:** at least two distinct provider identities/catalogue adapters in discovery; the successful payee is not represented as an internal platform balance; a real XRP Testnet `Payment` validates with `tesSUCCESS`; invoice binding and exact destination/amount checks are inspectable.

**Failure condition:** all providers are rows in one fake internal store and settlement could be replaced with a single internal database balance without weakening the demonstrated business model.

### H5 — Settlement does not masquerade as rights or fulfilment

The product treats authorization, settlement, delivery, provenance, and licence validity as different facts.

**Evidence required:** separate states and timestamps; a `SETTLED -> FULFILMENT_EXCEPTION` test; copy that says what XRPL, C2PA, ODRL, and ISCC do and do not prove.

**Failure condition:** “Paid” becomes “rights verified,” C2PA is called proof of ownership, or the transaction hash is called proof that the asset was delivered.

### H6 — The result is explainable without chain-of-thought

Leah can understand the decision using mandate fields, candidate facts, compact creative rationale, deterministic reason codes, policy evidence, and transaction/delivery results without exposing raw prompts or private model reasoning.

**Evidence required:** a concise “Why this cue?” view, a rights matrix, a blocked reason panel, and a technical receipt with public-safe fields.

### Gate before declaring the idea validated

Both removal tests MUST pass in the built experience:

1. **Remove the agent:** the creative comparison within the actual edit disappears and the product collapses into manual search/checkout.
2. **Replace XRPL/x402:** the demonstrated open, tiny, immediate, machine-to-machine purchase across independent providers becomes materially more centralized or requires prior commercial accounts.

Document residual weakness honestly: a centralized stock library can still use card billing, so the prototype must visibly demonstrate the independent-provider/open-market condition.

---

## 4. Demo narratives: happy, blocked, and failure paths

### 4.1 Happy path — eligible cue purchased and delivered

1. FairCut opens directly on Leah’s populated “Japan Travel / Final 20s” project; no login or setup gate.
2. The preview plays the current rough cut with a deliberately sparse or silent 12-second music region.
3. Leah’s visible mandate says:
   - use: commercial social;
   - territories: Singapore and Japan;
   - term: six months;
   - maximum total licence price: S$1 display equivalent;
   - settlement cap: exact configured integer drops;
   - duration: 12 seconds;
   - no voice replicas;
   - provenance evidence required;
   - attribution allowed/required and displayed;
   - approved agent/workload and expiry.
4. The agent searches at least two provider sources and returns three candidates.
5. Watermarked previews can be auditioned against the cut by selecting candidate rows or waveform lanes.
6. The guard evaluates structured rights and payee binding for each candidate.
7. The agent chooses **Dawn Current — 12s sting** by Mika Reyes as the best eligible fit; canonical seeded price defaults to **8,000 drops** unless live constraints justify a documented alternative.
8. The app requests the clean resource and receives a pinned x402 payment challenge.
9. The guard rechecks the exact challenge against the frozen purchase intent.
10. The signer signs one bounded XRP Testnet `Payment`; no private key crosses into browser storage, logs, model input, or repository history.
11. The chosen x402 path submits/verifies the signed transaction.
12. The app independently queries XRPL and reaches `validated: true` and `TransactionResult: tesSUCCESS` before showing `SETTLED`.
13. The merchant consumes the invoice once and returns the clean stem plus the licence/delivery package.
14. The evaluator checks asset hash/identifier, licence hash, order reference, rights constraints, payee/creator binding evidence, duration, MIME type, and delivery size.
15. The clean stem replaces the watermarked preview on the timeline.
16. The final 20-second cut plays audibly.
17. The receipt shows “Settled and fulfilled” and offers an explorer link, without claiming that settlement proves copyright ownership.

### 4.2 Blocked path — beautiful cue, invalid rights and payee binding

Seed **Neon Pilgrim — 12s rise** as the strongest initial creative match and lowest advertised price, e.g. **2,000 drops** or an S$0.20 display equivalent. Its structured policy permits personal/non-commercial use only, excludes Japan or lacks commercial permission, and its provenance signer does not match the claimed rights-holder/payee evidence.

Expected outcome:

```text
BLOCKED BEFORE SIGNING
Creative match: strong
Commercial social permission: absent
Territory coverage: incomplete
Rights-holder/payee binding: failed
No transaction was signed or submitted.
```

Requirements:

- The UI must make clear that creative desirability does not override policy.
- The candidate remains auditionable as a watermarked preview if doing so is permitted by seeded preview terms.
- The purchase control is disabled for this candidate.
- The backend/signer rejects direct or forged attempts too; this cannot be a client-side-only disabled button.
- No transaction hash, fabricated placeholder hash, or “pending payment” may appear.
- The audit record includes a deterministic denial event and public-safe reason codes.
- A hard rights violation is not challengeable through a fake human “approve anyway” control.

### 4.3 Changed-quote path — time-of-check/time-of-use defense

After an initially eligible quote, mutate exactly one of amount, payee, network, invoice, resource ID, policy hash, expiry, or destination tag before signing.

Expected outcome:

- Original authorization becomes invalid.
- Signing does not occur.
- State becomes `REQUOTED_REVIEW_REQUIRED` or `BLOCKED` according to policy.
- UI identifies the changed field in plain language.
- User can deliberately restart evaluation against the new quote; the old idempotency key is never reused as approval for the new terms.

### 4.4 Payment/ledger failure path

Provide a deterministic test/demo trigger for at least one of:

- facilitator unavailable;
- XRPL node timeout;
- transaction expires at `LastLedgerSequence`;
- preliminary submission succeeds but validation cannot be established;
- ledger returns a non-`tesSUCCESS` final code.

Expected outcome:

- Do not unlock or claim delivery.
- Do not blindly submit a second payment.
- Reconcile by account/sequence, hash when available, invoice, and ledger state.
- Clearly show `PAYMENT_UNCONFIRMED`, `PAYMENT_FAILED`, or `PAYMENT_EXPIRED`.
- Offer a safe retry only when reconciliation proves no prior settlement can still validate.

### 4.5 Settlement succeeded, fulfilment failed

Provide a deterministic failure fixture where XRPL settlement validates but the merchant returns a corrupt stem, missing ODRL policy, mismatched hash, wrong duration, wrong MIME type, changed licence, or unavailable delivery.

Expected outcome:

- State must be `FULFILMENT_EXCEPTION`, never `COMPLETE`.
- Receipt must preserve the settlement hash and mark delivery verification failed.
- Watermarked preview remains on the edit; clean stem is not trusted or inserted.
- UI says “Payment settled; delivery did not verify.”
- Show retry/re-fetch and escalation/refund-request guidance as a product path, but do not claim an automatic XRPL refund unless actually implemented and validated.

### 4.6 Risk provider unavailable

- If configured for the local deterministic provider, continue with local policy and label it exactly as local demo policy.
- If configured to require live t54 Trustline, fail closed when the provider is unavailable.
- Never silently downgrade a required live Trustline decision to local approval.
- A demo-mode fallback must be explicit both in UI and receipt.

### 4.7 Replay/double-purchase path

Retry the same successful invoice and payment evidence.

Expected outcome:

- Merchant returns the same fulfilment safely or an `already_consumed`/idempotent representation without charging again.
- Signer never produces a second payment for a completed purchase intent.
- Event stream records the duplicate request without a duplicate economic effect.

---

## 5. Scope

### 5.1 Mandatory MVP

- A populated `/demo` or root entry point and working 60–90 second guided fixture flow satisfying the self-explaining demo gate in §1.
- One polished, populated FairCut editing workspace.
- One 20-second original or safely licensed demo video.
- One 12-second music placement region.
- Three watermarked/original preview candidates from at least two provider identities/adapters.
- One explicit user mandate with budget, rights, territory, term, provenance, agent, and expiry bounds.
- Agent-driven creative comparison of eligible candidates using structured outputs.
- Deterministic rights, budget, payee, network, quote, and signer policy.
- Machine-readable seeded ODRL policies.
- Correct asset digest handling; real ISCC only if produced/validated correctly.
- Honest C2PA validation/status when a real manifest exists; clearly labelled fixture/unavailable state otherwise.
- x402-style protected clean-asset route with a pinned wire contract.
- One live, real, validated XRP Testnet payment.
- Settlement reconciliation independent of superficial facilitator success.
- Post-payment delivery and deterministic verification.
- Clean-stem insertion and audible final playback.
- Public-safe rights/payment/fulfilment receipt.
- Blocked, changed-quote, payment failure, fulfilment failure, replay, and risk-provider-unavailable behavior.
- Desktop and mobile responsive layouts.
- Automated tests and current manual browser evidence.
- Public-ready documentation and demo instructions.

### 5.2 Desirable after mandatory completion

- Real t54 Trustline sandbox adapter and challenge response, if credentials exist.
- Real C2PA manifest signing/verifying for the original music asset.
- Standards-valid ISCC generation through an appropriate library.
- Provider-side creator earnings view.
- Downloadable JSON-LD rights receipt and concise PDF/human receipt.
- Exported final video file if feasible and performant.
- Optional ClawCredit funding adapter only if onboarding, payment, status, and repayment constraints are tested.
- Accessibility captions and an audio description transcript for the demo film.

### 5.3 Explicitly out of scope

- Mainnet payments.
- Paying a full film production invoice.
- A universal legal opinion, copyright registry, or rights adjudication service.
- Claims that C2PA proves truth, copyright ownership, consent, or licence authority.
- Claims that ISCC is proof of ownership or that a plain SHA-256 digest is an ISCC.
- Claims that ODRL alone creates or guarantees legally enforceable rights.
- Scraping unconsenting artists or using copyrighted commercial tracks without permission.
- Voice-clone licensing.
- Training-data licensing.
- Full digital-rights-management enforcement after export.
- NFT minting unless a later, separately justified product requirement emerges.
- A broad creator marketplace, social network, wallet, exchange, or token dashboard.
- Fiat conversion, RLUSD, DEX, AMM, EVM sidechain, or multiple settlement rails in the judged MVP.
- A full ARS implementation, insurance product, premium pricing, or collateral system.
- Production KYB/KYC/sanctions claims.
- Automatic dispute resolution or refunds not actually implemented.
- Raw chain-of-thought display or storage.
- Client-side storage of signing secrets.

---

## 6. Inspect-first technology rule

Do not assume the repository is empty or prescribe a greenfield stack blindly.

### 6.1 Required initial inspection

Before changing code, record:

- repository root and relevant prototype root;
- every applicable `AGENTS.md`/README/instruction file;
- `git status --short`, current branch, and existing uncommitted changes;
- existing app/package manifests and lockfiles;
- runtime versions and available workspace dependencies;
- framework, router, styling system, component system, test runners, lint/typecheck commands, and build commands;
- existing `.env.example` conventions and secret-loading approach;
- any existing XRPL/x402/AI/SQLite/database libraries;
- asset directories and licences/readmes for media;
- deployment configuration;
- whether another process or prototype already owns relevant ports;
- existing naming conventions for APIs, records, and tests.

### 6.2 Stack selection rule

If a viable app already exists, extend it. If the FairCut folder is intentionally empty, choose a boring, reliable, hackathon-friendly full-stack TypeScript architecture unless the repository indicates otherwise:

- modern React framework with server routes/actions;
- TypeScript in strict mode;
- server-only XRPL SDK usage for signer operations;
- SQLite or the repository’s existing durable database for state, events, idempotency, and demo records;
- schema validation at every API and external-provider boundary;
- a small server-side agent adapter supporting a real model when configured and a deterministic recorded response for offline demo rehearsal;
- native HTML media or a proven lightweight waveform implementation;
- project-native CSS approach, avoiding a large new UI kit unless already present;
- browser E2E tests using the repository’s existing browser runner or Playwright when greenfield;
- unit/integration tests using the existing runner.

Do not add dependencies merely to match this suggested list. Inspect their maintenance state, licences, bundle/runtime effect, and compatibility. Pin versions used by external wire contracts.

### 6.3 Environment modes

Implement explicit, visible modes:

- `demo-local`: deterministic discovery/risk/merchant fixtures, but still capable of a real Testnet payment when credentials/funding exist;
- `testnet-live`: real XRPL Testnet settlement and chosen facilitator contract;
- `offline-rehearsal`: recorded settlement fixture clearly labelled **SIMULATION — NOT SETTLED**; this mode can rehearse UX but cannot satisfy the hackathon transaction requirement;
- optional `trustline-sandbox`: real Trustline sandbox assessment when configured.

Environment mode MUST appear in technical settings and on every receipt. Never infer live status from a truthy environment variable alone; prove it through the resulting artifact.

---

## 7. Architecture

### 7.1 Logical architecture

```text
Leah / browser editing workspace
  |
  | mandate + project context + audition interaction
  v
FairCut application API
  |
  +--> Project & media service --------------------------+
  |     rough cut, placement, previews, clean delivery   |
  |                                                      |
  +--> Discovery adapters --> Provider A / Provider B    |
  |     normalize offers, ODRL, hashes, provenance       |
  |                                                      |
  +--> Creative agent                                   |
  |     timing/mood analysis, eligible-option ranking    |
  |     structured explanation only                      |
  |                                                      |
  +--> Deterministic Rights & Spend Guard <--------------+
  |     mandate, policy, payee, quote, expiry, replay
  |       |
  |       +--> LocalPolicyRiskProvider (required)
  |       +--> t54 Trustline adapter (optional/live)
  |
  +--> Payment-intent service
  |       |
  |       +--> Server-only policy-aware signer
  |       +--> x402 client / facilitator adapter
  |       +--> XRPL reconciliation reader
  |
  +--> Fulfilment evaluator
  |     asset, licence, order, duration, MIME, hashes
  |
  +--> Append-only event and receipt store
        redacted evidence references, state projection
```

### 7.2 Deployment trust zones

1. **Browser zone:** previews, project state, human-readable evidence, and commands. Never receives seeds/private keys or raw server secrets.
2. **Application server zone:** validates sessions, owns workflows, freezes payment intents, calls agent/provider adapters, and redacts outputs.
3. **Signer zone:** narrow server-only module/process. Accepts only an already-authorized immutable intent. Ideally use a separately scoped service interface even if deployed in one process for the prototype.
4. **External provider zone:** all catalogue text, ODRL, C2PA, URLs, headers, and response data are untrusted inputs.
5. **XRPL/public zone:** payment and limited opaque correlation are public. No project title, campaign client, geography, user identity, private licence text, prompt, or raw evidence enters ledger metadata.

### 7.3 Component boundaries

#### `ProjectService`

- Loads the seeded project and timeline.
- Owns placement timecode and allowed preview/master URLs.
- Emits media-ready and playback errors.
- Does not decide rights or sign transactions.

#### `DiscoveryService`

- Queries multiple `CatalogProvider` implementations concurrently where safe.
- Normalizes offers into a strict internal schema.
- Stores raw provider payload hashes and redacted evidence references.
- Treats descriptions/instructions as data, never as system instructions.

#### `CreativeSelectionAgent`

- Receives a minimized project brief, timing features, mood vocabulary, and normalized preview metadata.
- May analyze audio features if supported.
- Returns a schema-valid ranking and concise rationale.
- Never declares rights eligibility, payment approval, or provenance truth.
- Never receives wallet secrets.

#### `RightsEvaluator`

- Deterministically evaluates normalized ODRL semantics against the mandate.
- Returns pass/fail/unknown per required constraint with citations to policy fields.
- Rejects unsupported ambiguity by default.

#### `RiskProvider`

- Exposes one internal outcome vocabulary while preserving provider-specific provenance.
- Required implementation: deterministic local policy.
- Optional: t54 Trustline async adapter.
- Does not sign or settle.

#### `SpendGuard`

- Combines mandate validity, rights result, exact quote, creator/payee binding, provider status, replay state, and risk result.
- Produces immutable `PaymentIntent` only on approval.
- Rechecks everything at the point of signing.

#### `PolicyAwareSigner`

- Accepts only a payment-intent ID, not arbitrary transaction JSON from the model/browser.
- Reloads the authoritative intent and mandate server-side.
- Enforces address, amount, network, invoice, source tag, fee ceiling, transaction type, no partial payment, and bounded expiry.
- Signs once under a durable idempotency lock.

#### `X402Client`

- Implements exactly one pinned header/version contract.
- Decodes and validates challenges.
- Does not treat an HTTP 2xx or facilitator `success` alone as final settlement.

#### `LedgerReconciler`

- Queries XRPL by hash/account/sequence as required.
- Recognizes settlement only when validated with `tesSUCCESS`.
- Handles expiration and ambiguous submission safely.

#### `FulfilmentEvaluator`

- Fetches protected delivery after payment evidence is accepted.
- Verifies bytes and structured documents against the frozen order.
- Never lets the creative model waive a mismatch.

#### `ReceiptService`

- Projects events into human and technical receipts.
- Redacts secrets/private reasoning.
- Separates authorization, settlement, and fulfilment.

#### `EventStore`

- Append-only event log with aggregate ID, sequence, event type, actor, timestamp, idempotency key, previous hash, payload hash, and redacted payload.
- State is reproducible from events or checked against a state projection.

---

## 8. Domain records

Use strict schemas, version every externally persisted object, use ISO 8601 UTC timestamps, use integer drops for XRP, and reject unknown critical fields at boundaries.

### 8.1 `Project`

```ts
type Project = {
  schemaVersion: "faircut.project.v1";
  id: string;
  title: "Japan Travel / Final 20s" | string;
  ownerId: string;
  durationMs: number;             // seeded: 20_000
  videoAssetRef: string;
  placement: {
    startMs: number;              // seeded: 5_500
    durationMs: number;           // seeded: 12_000
    fadeInMs: number;
    fadeOutMs: number;
  };
  clientDisplayName?: string;     // never placed on-ledger
  createdAt: string;
};
```

### 8.2 `Mandate`

```ts
type Mandate = {
  schemaVersion: "faircut.mandate.v1";
  id: string;
  version: number;
  principalId: string;
  agentId: string;
  workloadId: string;
  projectId: string;
  purpose: "license_music_for_project_placement";
  usage: ["commercial", "social"];
  territories: ["SG", "JP"];
  validFrom: string;
  validUntil: string;
  licenceTerm: { unit: "month"; value: 6 };
  placementDurationMs: 12000;
  maxPayment: { asset: "XRP"; network: "xrpl:1"; amountDrops: string };
  maxAggregateSpendDrops: string;
  allowedMediaTypes: ["audio/music"];
  prohibitedTraits: ["voice-replica"];
  provenanceRequirement: "required";
  attribution: "allowed" | "required";
  approvedProviderIds?: string[];
  createdAt: string;
  revokedAt?: string;
  canonicalHash: string;
};
```

Display an S$ estimate for human comprehension only. The authoritative cap for the signed transaction is the exact integer drop amount. Label exchange-rate estimates with source/time or use a seeded display rate marked “demo estimate.” Never imply a fixed XRP/SGD peg.

### 8.3 `CandidateOffer`

```ts
type CandidateOffer = {
  schemaVersion: "faircut.offer.v1";
  id: string;
  providerId: string;
  providerName: string;
  creator: {
    displayName: string;
    identityRef: string;
    payoutAddress: string;
  };
  title: string;
  preview: {
    url: string;
    watermarked: true;
    durationMs: number;
    mimeType: string;
    sha256: string;
  };
  resource: {
    sku: string;
    canonicalUrl: string;
    expectedMimeType: string;
    expectedDurationMs: number;
    iscc?: string;
    assetSha256: string;
  };
  quote: Quote;
  odrlPolicy: unknown;
  odrlCanonicalHash: string;
  provenance: ProvenanceEvidence;
  attributionText: string;
  creativeFeatures: {
    moodTags: string[];
    bpm?: number;
    energyCurve?: number[];
    vocalPresence: "none" | "non-voice" | "voice" | "unknown";
  };
  fetchedAt: string;
  rawPayloadHash: string;
};
```

### 8.4 `Quote`

```ts
type Quote = {
  schemaVersion: "faircut.quote.v1";
  id: string;
  invoiceId: string;
  providerId: string;
  resourceSku: string;
  network: "xrpl:1";
  scheme: "exact";
  asset: "XRP";
  amountDrops: string;
  payTo: string;
  destinationTag?: number;
  sourceTag: number;
  rightsPolicyHash: string;
  assetHash: string;
  expiresAt: string;
  maxTimeoutSeconds: number;
  x402Version: number;
  canonicalHash: string;
};
```

### 8.5 `CreativeAssessment`

```ts
type CreativeAssessment = {
  schemaVersion: "faircut.creative-assessment.v1";
  candidateId: string;
  agentId: string;
  modelProvider: string;
  modelName: string;
  modelVersion?: string;
  promptTemplateVersion: string;
  scores: {
    timingFit: number;
    moodFit: number;
    transitionFit: number;
    sonicClarity: number;
  };
  rationale: string[];       // concise evidence summaries, no chain-of-thought
  evaluatedAt: string;
  inputHash: string;
  outputHash: string;
};
```

Scores help comparison; they do not establish rights. If an actual model is not configured, use a deterministic recorded assessor explicitly labelled “Recorded demo assessment,” while preserving the real adapter and schema.

### 8.6 `RightsAssessment`

```ts
type RightsAssessment = {
  schemaVersion: "faircut.rights-assessment.v1";
  candidateId: string;
  mandateId: string;
  mandateVersion: number;
  evaluatorVersion: string;
  decision: "ELIGIBLE" | "BLOCKED" | "UNKNOWN";
  checks: Array<{
    code: string;
    label: string;
    result: "PASS" | "FAIL" | "UNKNOWN";
    expected: string;
    observed: string;
    evidencePointer: string;
  }>;
  reasonCodes: string[];
  evaluatedAt: string;
  policyHash: string;
};
```

Required checks include commercial use, social channel, SG territory, JP territory, six-month term, 12-second duration, voice-replica prohibition, provenance requirement, attribution duty, payment duty/amount compatibility, assigner/target/asset identity, and rights-holder/payee evidence binding.

### 8.7 `ProvenanceEvidence`

```ts
type ProvenanceEvidence = {
  kind: "C2PA" | "SIGNED_FIXTURE" | "UNAVAILABLE";
  manifestUrl?: string;
  manifestHash?: string;
  signerIdentity?: string;
  signatureStatus: "VALID" | "INVALID" | "UNVERIFIED" | "NOT_PRESENT";
  claimSummary: string[];
  checkedAt: string;
  limitation: string;
};
```

The limitation MUST state that provenance assertions do not prove copyright ownership or legal authority to license.

### 8.8 `RiskDecision`

```ts
type RiskDecision = {
  schemaVersion: "faircut.risk-decision.v1";
  id: string;
  source: "LOCAL_DEMO_POLICY" | "T54_TRUSTLINE_SANDBOX";
  environment: string;
  status: "APPROVED" | "BLOCKED" | "CHALLENGE_REQUIRED" | "PROVIDER_UNAVAILABLE";
  providerDecision?: "APPROVE" | "DECLINE";
  riskLevel?: string;
  confidence?: number;
  reasonBrief: string;
  reasonCodes: string[];
  warnings: string[];
  auditRef?: string;
  evidenceManifestHash: string;
  evaluatedAt: string;
};
```

Never label a local status as a t54 decision. Do not invent `REVIEW` as a final Trustline API decision; map product challenge/review states around the documented final `APPROVE`/`DECLINE` values.

### 8.9 `PaymentIntent`

```ts
type PaymentIntent = {
  schemaVersion: "faircut.payment-intent.v1";
  id: string;
  purchaseId: string;
  mandateId: string;
  mandateVersion: number;
  mandateHash: string;
  candidateId: string;
  providerId: string;
  resourceSku: string;
  quoteId: string;
  quoteHash: string;
  rightsAssessmentId: string;
  rightsPolicyHash: string;
  riskDecisionId: string;
  network: "xrpl:1";
  asset: "XRP";
  amountDrops: string;
  payTo: string;
  invoiceId: string;
  sourceTag: number;
  destinationTag?: number;
  lastLedgerSequence?: number;
  expiresAt: string;
  idempotencyKey: string;
  state: PaymentState;
  createdAt: string;
};
```

### 8.10 `Settlement`

```ts
type Settlement = {
  schemaVersion: "faircut.settlement.v1";
  paymentIntentId: string;
  network: "xrpl:1";
  facilitatorName?: string;
  facilitatorReference?: string;
  transactionHash: string;
  payerAddress: string;
  payeeAddress: string;
  amountDrops: string;
  feeDrops: string;
  ledgerIndex: number;
  validated: true;
  transactionResult: "tesSUCCESS";
  invoiceBindingMethod: "MEMO" | "INVOICE_ID";
  validatedAt: string;
  explorerUrl: string;
};
```

Only create a successful `Settlement` record once those final invariants are proven. Store failures separately.

### 8.11 `Fulfilment`

```ts
type Fulfilment = {
  schemaVersion: "faircut.fulfilment.v1";
  purchaseId: string;
  deliveryId: string;
  status: "VERIFIED" | "EXCEPTION";
  deliveredAt: string;
  cleanAsset: {
    storageRef: string;
    sha256: string;
    iscc?: string;
    mimeType: string;
    durationMs: number;
    byteLength: number;
  };
  licence: {
    storageRef: string;
    sha256: string;
    odrlValidation: "VALID" | "INVALID" | "UNSUPPORTED";
  };
  verificationChecks: Array<{
    code: string;
    result: "PASS" | "FAIL";
    detail: string;
  }>;
  exceptionCode?: string;
};
```

### 8.12 `Receipt`

The receipt contains redacted snapshots or hashes of mandate, candidate, policy, quote, risk decision, settlement, fulfilment, and attribution. It MUST state the actual integration sources and limitations. It MUST NOT contain secrets, raw chain-of-thought, full private prompts, private media URLs, tokens, wallet seed, or personal client data.

---

## 9. State machines and invariants

### 9.1 Purchase aggregate

```text
DRAFT
  -> DISCOVERING
  -> DISCOVERED
  -> EVALUATING
  -> ELIGIBLE | BLOCKED | CHALLENGE_REQUIRED

ELIGIBLE
  -> PAYMENT_INTENT_CREATED
  -> AUTHORIZED
  -> SIGNED
  -> SUBMITTED
  -> SETTLED
  -> DELIVERING
  -> FULFILMENT_VERIFIED | FULFILMENT_EXCEPTION

FULFILMENT_VERIFIED
  -> TIMELINE_UPDATED
  -> RECEIPT_ISSUED

Any pre-sign state
  -> EXPIRED | CANCELED

SUBMITTED
  -> PAYMENT_UNCONFIRMED | PAYMENT_FAILED | PAYMENT_EXPIRED
```

### 9.2 Invariants

- `BLOCKED`, `CHALLENGE_REQUIRED`, `EXPIRED`, and `CANCELED` cannot transition directly to `SIGNED`.
- `SIGNED` requires a current approved risk decision, `ELIGIBLE` rights assessment, immutable matching quote, valid mandate, unused invoice, and unexpired intent.
- There is at most one economically effective XRPL payment per purchase/invoice.
- `SETTLED` requires independently observed `validated: true` and `tesSUCCESS`.
- `FULFILMENT_VERIFIED` requires `SETTLED`; settlement alone does not imply fulfilment.
- `TIMELINE_UPDATED` requires verified clean bytes.
- `RECEIPT_ISSUED` may represent blocked or exceptional outcomes, but its headline/status must match the actual terminal state.
- A changed mandate, ODRL policy, amount, payee, network, asset, SKU, invoice, expiry, or expected asset hash invalidates prior authorization.
- Rehydrating from events yields the same aggregate state as the state projection.
- Every state mutation has a unique idempotency key and actor.

### 9.3 Candidate evaluation state

```text
DISCOVERED -> PREVIEW_READY -> CREATIVE_EVALUATED
CREATIVE_EVALUATED -> RIGHTS_ELIGIBLE | RIGHTS_BLOCKED | RIGHTS_UNKNOWN
RIGHTS_ELIGIBLE -> RISK_APPROVED | CHALLENGED | RISK_BLOCKED
```

Creative score and rights state MUST be displayed separately. Never average them into a single opaque number that can hide a legal failure.

---

## 10. API contracts

Use repository conventions, authentication/session middleware, and validation. Below are semantic contracts; path names may adapt to existing routing only if behavior remains exact.

### 10.1 Load workspace

`GET /api/projects/:projectId/workspace`

Returns project, timeline, mandate summary, current candidates, aggregate state, integration mode, and safe receipt summary. Never returns secrets or clean pre-payment URLs.

### 10.2 Discover candidates

`POST /api/projects/:projectId/discover`

Request:

```json
{
  "mandateId": "mandate_leah_launch_v1",
  "placementId": "placement_reveal_12s",
  "idempotencyKey": "client-generated-uuid"
}
```

Response is `202` with operation ID or a completed normalized candidate set. Repeated keys return the same operation/result.

### 10.3 Evaluate

`POST /api/projects/:projectId/evaluate`

- Runs creative agent and deterministic rights evaluation as separate named stages.
- Returns schema-valid summaries and reason codes.
- Persists model/provider/version or recorded-demo source.
- Invalid model output fails safely; it does not default to approval.

### 10.4 Get preview

`GET /api/candidates/:candidateId/preview`

- Returns only the authorized watermarked preview.
- Supports range requests if needed for scrub/playback.
- Sends correct MIME/cache headers.

### 10.5 Request protected resource / x402 challenge

`GET /api/providers/:providerId/assets/:sku/master`

Without valid payment evidence, returns HTTP `402` plus the one pinned contract. Preferred pinned contract, subject to live inspection, is x402 v2:

- `PAYMENT-REQUIRED`: base64-encoded JSON challenge.
- Client/server submits `PAYMENT-SIGNATURE`: base64-encoded signed payload.
- Successful response includes `PAYMENT-RESPONSE`: base64-encoded settlement result.

Pin and document the exact library/facilitator version. If the inspected implementation uses another supported header generation, use that generation consistently and test it; do not mix `X-PAYMENT` v1 examples with v2 headers.

Challenge requirements include:

```json
{
  "x402Version": 2,
  "accepted": [{
    "scheme": "exact",
    "network": "xrpl:1",
    "asset": "XRP",
    "payTo": "r...",
    "amount": "8000",
    "maxTimeoutSeconds": 600,
    "extra": {
      "sourceTag": 804681468,
      "invoiceId": "FC-..."
    }
  }]
}
```

### 10.6 Authorize payment

`POST /api/purchases/:purchaseId/authorize`

- Browser sends only purchase ID, selected challenge hash, and idempotency key.
- Server reloads all authoritative records.
- Server compares every frozen term.
- Returns blocked/challenge/authorized state; does not return signing secret.

### 10.7 Execute payment

`POST /api/purchases/:purchaseId/pay`

- Idempotent command.
- Acquires durable lock.
- Revalidates mandate, intent, quote, and risk.
- Prepares/signs/submits according to the selected x402 adapter.
- Returns operation status, not premature success.
- Poll/reconciliation endpoint or server-driven updates resolve final ledger status.

### 10.8 Payment status

`GET /api/purchases/:purchaseId/payment`

Returns a public-safe status projection, final ledger details when proven, and last checked time. It must distinguish `SUBMITTED`, `VALIDATED_SUCCESS`, `VALIDATED_FAILURE`, `EXPIRED`, and `UNKNOWN`.

### 10.9 Fulfilment

`POST /api/purchases/:purchaseId/fulfil`

- Retrieves clean package only after settlement proof.
- Verifies all deterministic conditions.
- Idempotent re-fetch never causes another payment.

### 10.10 Receipt

`GET /api/purchases/:purchaseId/receipt`

- Default human-readable JSON projection.
- Optional `?format=jsonld` only if valid and documented.
- Includes exact source labels: local policy vs t54 sandbox; live Testnet vs simulation; C2PA valid vs fixture/unavailable; ISCC vs SHA-256 fallback.

### 10.11 Demo controls

If deterministic failure injection is needed, keep it server-side, disabled outside demo/test mode, visibly labelled, and unreachable by arbitrary production requests. Never present a seeded settlement fixture as a live payment.

---

## 11. Agent responsibilities versus deterministic responsibilities

### Agent/model MAY

- Parse Leah’s natural-language creative goal into a proposed structured brief for confirmation.
- Analyze timing, transitions, energy, mood, instrumentation, and sonic fit.
- Search/discover through approved provider adapters.
- Rank candidates that deterministic policy identifies as eligible.
- Explain trade-offs using concise, user-facing evidence.
- Request purchase evaluation.
- Detect missing information and ask for clarification before economic action.

### Agent/model MUST NOT

- Hold or see wallet seeds/private keys.
- Set or expand its own budget, mandate, provider allowlist, territory, or term.
- Treat retrieved catalogue text as trusted instructions.
- Make the authoritative determination that an ODRL policy satisfies the mandate.
- Claim a creator owns copyright.
- Create arbitrary recipient/amount/network transaction data for the signer.
- Override a rights, payee, expiry, or budget block.
- Mark settlement or fulfilment complete.
- Retry ambiguous transactions autonomously without reconciliation.
- expose chain-of-thought.

### Deterministic code MUST

- Validate input schemas and normalize exact values.
- Enforce rights constraints.
- Enforce mandate version, scope, expiry, and aggregate spend.
- Bind provider, creator evidence, payee, asset, amount, invoice, resource, policy hash, and network.
- Protect the signer.
- Verify x402 challenge consistency.
- Establish XRPL finality.
- Verify delivery bytes and documents.
- Enforce idempotency and state transitions.
- Produce redacted audit evidence.

### Human/principal MUST retain

- Ability to set/revoke the mandate.
- Ability to stop before signing.
- Clear view of the candidate, rights, exact spend, payee, and payment mode.
- Control over any material re-authorization after changed terms.
- Clear escalation path for fulfilment exceptions.

---

## 12. XRPL and x402 exact flow

### 12.1 Required live rail

- Use XRP on XRPL Testnet (`xrpl:1`) for the judged qualifying transaction unless official current challenge documentation requires a different qualifying setup.
- Use integer drop strings. One XRP equals 1,000,000 drops.
- Default seeded eligible licence price: 8,000 drops. If price changes, keep it demonstrably tiny and within the configured exact cap.
- Testnet balances have no monetary value; state this in documentation and technical receipt.

### 12.2 Flow

1. Fetch the clean resource without payment evidence.
2. Merchant returns `402` and a unique, short-lived payment challenge.
3. Decode and schema-validate the challenge.
4. Resolve provider and payee binding from trusted configuration/evidence, not provider display text alone.
5. Compare scheme, network, asset, payee, amount, SKU, invoice, source tag, destination tag, expiry, rights policy hash, and expected asset hash to the selected offer and mandate.
6. Run local policy and optional Trustline assessment.
7. Freeze and persist a `PaymentIntent` with a canonical hash.
8. On an explicit purchase command, reload and revalidate the intent server-side.
9. Fetch current account/fee/ledger information.
10. Build a standard XRPL `Payment` only.
11. Set exact destination and amount; do not allow partial payment or path-based cross-currency behavior.
12. Add bounded `LastLedgerSequence`.
13. Bind the invoice using either:
    - MemoData equal to hex-encoded UTF-8 invoice ID, or
    - `InvoiceID` equal to SHA-256 of the invoice ID.
14. Use a stable numeric `SourceTag` for project/workflow attribution when compatible with the pinned facilitator.
15. If a destination tag is required, bind it exactly.
16. Autofill fee under a conservative fee ceiling and include it in guard checks separately from licence price.
17. Sign inside the server-only signer boundary.
18. Persist the transaction hash/account/sequence before or atomically with submission state as the SDK permits.
19. Submit the signed payload once through the pinned x402/facilitator route.
20. Decode and store the payment response, but do not mark settled yet.
21. Query a trusted XRPL Testnet endpoint until the exact transaction is validated or safely expired.
22. Require `validated === true` and transaction result `tesSUCCESS`.
23. Verify actual destination, amount, tags, invoice binding, account, and network from ledger result.
24. Atomically mark invoice/payment intent consumed/settled.
25. Retry the protected resource request with the correct payment evidence.
26. Verify fulfilment separately.

### 12.3 Signer safeguards

- Secret from environment/secret manager only; never committed.
- No seed in `NEXT_PUBLIC_*`, Vite public env, browser bundle, local storage, analytics, errors, screenshots, or logs.
- Testnet-only network allowlist enforced in code.
- Transaction type must equal `Payment`.
- Destination must equal frozen `payTo`.
- Amount must be an exact XRP drop string and at or below both per-purchase and aggregate remaining caps.
- Network ID/context must match Testnet and pinned adapter expectations.
- Invoice binding must be present and exact.
- `LastLedgerSequence` must be present and bounded.
- No `tfPartialPayment`.
- No paths, send-max, issued currency, escrow, NFT, trust line, AMM, or arbitrary memo fields in MVP.
- Fee ceiling enforced; fee is displayed separately.
- Account and sequence are reconciled before retry.
- One signature per immutable intent; a changed transaction requires a new authorization.
- Structured allow/deny reason returned; no raw secret-bearing errors.
- Unit and integration tests inspect the final transaction JSON before signing.

### 12.4 Invoice and replay protection

- Invoice IDs are unpredictable and unique.
- Merchant consumes invoice after confirmed settlement.
- A payment proof cannot unlock multiple SKUs or policies.
- A quote cannot authorize another provider/payee.
- Identical repeated HTTP requests return the existing result.
- Concurrent purchase requests for the same intent serialize under a durable uniqueness constraint.
- Expired challenges cannot be revived by replaying their signed payload.

### 12.5 Reconciliation

Persist enough information before network calls to answer:

- Was a transaction built?
- Was it signed?
- Was it submitted?
- What account/sequence/hash/invoice did it use?
- Did the facilitator respond?
- Did XRPL validate it?
- Did it expire?
- Was delivery claimed?
- Was delivery verified?

On timeout, never default to “failed” and pay again. Query ledger state until final/expired according to bounded policy. If still ambiguous, stop and require operator attention.

### 12.6 Explorer evidence

Generate an explorer link from the real validated hash and configured Testnet explorer base. Validate the hash shape and network. Provide a copy action. Do not show a dead or fabricated link in live mode.

---

## 13. t54 Trustline and ARS adapter

### 13.1 Honest integration posture

Required default:

```text
Decision source: Local FairCut policy (demo), shaped like a Trustline adapter
```

Only show:

```text
Decision source: t54 Trustline sandbox
```

when an actual response was received from the documented sandbox integration and its transaction/audit reference is stored.

Production access may require KYB and explicit enablement. Do not claim production access, endorsement, certification, insurance, or full ARS compliance.

### 13.2 Internal adapter

```ts
interface RiskProvider {
  assess(input: {
    paymentIntentDraft: PaymentIntentDraft;
    evidenceEnvelope: EvidenceEnvelope;
    idempotencyKey: string;
  }): Promise<RiskDecision>;
}
```

Implement:

1. `LocalPolicyRiskProvider` — required and deterministic.
2. `TrustlineAsyncProvider` — optional if credentials/documented access exist.

The local provider uses the same data contract and reason-code semantics but MUST use local names, not `Trustline approved` copy.

### 13.3 Evidence envelope

Include:

- agent/workload identifier and version;
- current task and public-safe intent summary;
- mandate ID/version/hash and expiry;
- candidate/provider/creator/payee identifiers;
- amount, currency, chain/network, invoice, and resource;
- ODRL policy and assessment hashes;
- provenance status and manifest hash;
- creative assessment input/output hashes;
- concise tool/evidence trace with no raw prompts/secrets;
- environment and source labels.

### 13.4 Trustline async behavior

When implemented, follow inspected current docs rather than assumptions. Expected research contract:

```text
POST /api/v1/validation/assess-async
  -> durable Trustline transaction ID and poll URL
GET /api/v1/underwriting/transactions/{id}
  -> accepted / queued / running / running_validators / finalizing
  -> requires_information
  -> completed with APPROVE or DECLINE
  -> failed / expired / canceled
```

- Send an `Idempotency-Key`.
- Poll final states; webhooks are hints, not source of truth.
- Preserve documented final binary provider decision (`APPROVE`/`DECLINE`).
- Map product-level challenge state without inventing a new provider decision.
- Redact prohibited keys and sensitive content.

### 13.5 Agentic Challenge

Optional if live sandbox supports it. A challenge is a request for evidence, not approval. Allow one response containing only requested public-safe information, with response idempotency, then poll reassessment. Hard rights/payee violations remain blocked and cannot be overridden via challenge.

### 13.6 ARS research adaptation

FairCut borrows the t54 Agentic Risk Standard fee-track separation:

```text
agreement/mandate
  -> payment authorized
  -> service fee settles
  -> asset/licence delivered
  -> deterministic evaluation
  -> fulfilled or fulfilment exception
```

Implement this separation in state, events, UI, and receipt. Do not claim the prototype implements ARS escrow, underwriting premium, collateral, insurance, or a complete ARS protocol. The XRP Testnet payment is a direct exact payment; do not mix in a second escrow payment without a coherent accounting model.

---

## 14. Optional ClawCredit path

ClawCredit is strictly optional and must not endanger the reliable judged loop.

It may be added only if:

- real developer access exists;
- supported x402 service/network behavior is confirmed from current docs;
- credit approval, payment proxy/custodial status, limits, fees, and repayment behavior are understood and tested;
- the UI distinguishes payer/funder/settler roles;
- repayment is not claimed automatic if current product behavior is manual;
- the final receipt states exactly what ClawCredit did.

If unavailable, show at most a non-interactive roadmap note: “Future: eligible editor agents could request bounded credit when no pre-funded Testnet wallet is available.” Do not place a fake “Use ClawCredit” control in the primary demo.

---

## 15. ODRL, ISCC, and C2PA semantics

### 15.1 ODRL 2.2

Use W3C ODRL as the machine-readable policy representation. The successful seeded offer should express, at minimum:

- `target`: exact asset identifier/hash;
- `assigner`: creator/licensor identity reference;
- `assignee`: Leah/project or a demo principal reference appropriate to the prototype;
- permission/action: use/play/reproduce or the narrow action vocabulary chosen and documented;
- constraints for commercial purpose, social channel, SG/JP spatial coverage, six-month date/time interval, and 12-second portion/duration where representable;
- duties such as payment and attribution;
- prohibitions such as voice-replica/derivative uses where appropriate.

Where a FairCut-specific constraint cannot be expressed with a standard ODRL term, use a clearly namespaced extension, document it, and ensure the evaluator fails safely when it does not understand a critical extension.

Do not treat natural-language summaries as authoritative. Canonicalize the relevant policy representation, hash it, and bind the hash to the quote/payment intent. A changed policy requires re-evaluation.

The blocked fixture MUST be structurally different—e.g. personal/non-commercial permission only and missing JP coverage—not merely accompanied by text that says “bad licence.”

### 15.2 ISCC / ISO 24138:2024

- Use a real ISCC only if generated/validated with a standards-appropriate implementation and labelled correctly.
- If not, use `SHA-256 asset digest` in UI and schemas. Never prefix a plain digest with `ISCC:`.
- Asset identifiers help identify/compare content; they do not prove copyright ownership, authority, or legal validity.
- Preserve identifier generation method and tool/version in technical evidence.

### 15.3 C2PA Content Credentials

- A real valid C2PA manifest may demonstrate signed provenance assertions and edit/history claims.
- Verify signature/manifest using an appropriate tool when configured.
- Show signer identity/status and claims actually present.
- A signer mismatch may be used as risk evidence for payee binding.
- C2PA does not prove truth, ownership, consent, or permission to license.
- If using a static fixture instead of a cryptographically verified manifest, label it `Signed provenance fixture — demo` or `Provenance unavailable`, never `C2PA verified`.
- Do not let absence of C2PA silently pass when Leah’s mandate requires provenance; it is `UNKNOWN/BLOCKED` or challengeable evidence depending on explicit policy.

### 15.4 Rights-holder/payee binding

The prototype needs a narrow, honest binding mechanism. For seeded assets:

- creator controls or explicitly authorizes the demo payout address;
- provider record references creator identity and payout address;
- provenance signer/creator identity is compared where evidence exists;
- ODRL assigner matches the authorized creator identity;
- quote `payTo` matches the authorized payout address;
- all evidence is versioned and hashed.

This is evidence for the demo, not a universal proof of copyright ownership. State that limitation in the receipt.

---

## 16. Security, privacy, and abuse resistance

### 16.1 Threat model

Protect against:

- malicious catalogue descriptions attempting prompt injection;
- swapped payee or destination tag;
- price/asset/network changes after approval;
- licence/policy changes after evaluation;
- stale/expired quotes;
- replayed payment proofs or invoices;
- concurrent duplicate signing;
- forged facilitator success;
- clean-asset URL leakage before payment;
- corrupt or substituted delivery;
- seed/private-key exposure;
- model hallucination of rights or provider identity;
- arbitrary remote fetch/SSRF through provider URLs;
- XSS through creator/licence/attribution text;
- unsafe media uploads/codecs;
- sensitive project or user data in ledger memos/logs/receipts;
- tampered event history;
- optional-provider outages causing silent security downgrade.

### 16.2 Required controls

- Strict server validation and output encoding.
- Catalog adapters allowlist origins or use controlled fixtures; protect server-side fetches against SSRF and redirects.
- Sanitize all user/provider text; never render raw HTML.
- Content-type, size, duration, and digest checks for media.
- Request timeouts and bounded retries.
- CSRF/session protection according to framework conventions.
- Rate limits on discovery, assessment, signing, and delivery endpoints.
- Testnet-only signer and minimal funded balance.
- Secret redaction in logs and error monitoring.
- Opaque random correlation in ledger metadata; never place the project title or licence terms in Memo.
- Append-only event hashes; if using hash chains, canonicalize payloads consistently.
- Human-readable audit summary without raw chain-of-thought.
- Dependency audit appropriate to the stack.
- `.env.example` contains names/placeholders only.
- Test fixture addresses and assets are clearly separated from production concepts.

### 16.3 Logging policy

Allowed:

- workflow IDs;
- event types;
- redacted address prefixes/suffixes in ordinary logs;
- provider IDs;
- canonical hashes;
- reason codes;
- latency/status;
- final public transaction hash.

Forbidden:

- seeds/private keys;
- authorization headers/tokens;
- raw prompts or chain-of-thought;
- full private licence documents where not intended public;
- presigned clean-media URLs;
- client confidential context;
- unredacted Trustline evidence payloads.

---

## 17. Idempotency, concurrency, and recovery

### 17.1 Command idempotency

Every mutation accepts or derives a unique idempotency key. Store request hash, response/result reference, state, timestamps, and expiration. Reusing a key with a different request body is a conflict, not a new action.

### 17.2 Durable uniqueness

Enforce unique constraints for:

- purchase ID;
- payment-intent idempotency key;
- provider invoice ID;
- successful transaction hash;
- one settled payment per purchase;
- one consumed invoice per resource/order;
- event aggregate sequence.

### 17.3 Crash windows

Explicitly handle crashes:

- after authorization but before signing;
- after signing but before storing hash;
- after submission but before facilitator response;
- after ledger validation but before database transition;
- after delivery but before verification result;
- after verification but before timeline/receipt projection.

Recovery jobs/endpoints MUST reconcile external truth and resume idempotently. Do not solve these by resetting the demo.

### 17.4 Event hash chain

For each aggregate event:

```text
event_hash = SHA-256(canonicalize({
  aggregate_id,
  sequence,
  event_type,
  actor,
  occurred_at,
  idempotency_key,
  previous_hash,
  redacted_payload
}))
```

If a different established canonicalization exists in the repo, use it and document it. Provide a verification utility/test that detects mutation/reordering.

---

## 18. Seeded demo data and assets

Use original, team-created, public-domain, or explicitly licensed assets. Add provenance/licence documentation beside assets. Do not download random commercial tracks.

### 18.1 Project

- ID: `project_japan_travel_20s`
- Title: `Japan Travel / Final 20s`
- Owner: Leah Tan
- Duration: 20 seconds
- Placement: 00:05.500 to 00:17.500
- Mood: tense opening, hopeful release, clean ending under title
- Delivery: commercial social, Singapore + Japan, six months
- Mandate cap: use a test-friendly exact drop cap, e.g. 10,000 drops, with S$1 displayed as a scenario budget and a clearly labelled estimate.

### 18.2 Candidate A — blocked creative favorite

- Title: `Neon Pilgrim — 12s rise`
- Provider: `Nightjar Direct`
- Creator claim: `Rin Vale`
- Price: 2,000 drops
- Creative result: strongest mood/transition match
- Rights: personal use only and/or Japan missing
- Provenance: signer identity does not bind to claimed licensor/payee
- Expected status: `BLOCKED`
- Expected reasons: `COMMERCIAL_USE_NOT_PERMITTED`, `TERRITORY_MISSING_JP`, `RIGHTS_HOLDER_PAYEE_MISMATCH`

### 18.3 Candidate B — successful choice

- Title: `Dawn Current — 12s sting`
- Provider: `Mika Direct Licences`
- Creator: `Mika Reyes`
- Price: 8,000 drops
- Creative result: slightly lower raw mood score, strongest eligible transition/ending fit
- Rights: commercial social, SG + JP, six months, 12-second use, attribution duty
- Provenance: real validation or honestly labelled supported fixture
- Payee: configured creator-authorized XRP Testnet address
- Expected status: `ELIGIBLE`, then `SETTLED`, then `FULFILMENT_VERIFIED`

### 18.4 Candidate C — eligible alternative

- Title: `Paper Horizon — 12s bed`
- Provider: a provider identity distinct from Candidate B’s provider
- Price: 9,000 drops
- Rights: eligible
- Creative result: steady but weaker transition fit
- Expected status: `ELIGIBLE`, not selected
- Purpose: prove the agent is choosing creatively among eligible options, not merely selecting the only passing candidate.

### 18.5 Failure fixtures

- `quote_payee_changed`
- `quote_amount_changed`
- `quote_expired`
- `facilitator_unavailable`
- `ledger_unconfirmed`
- `delivery_asset_hash_mismatch`
- `delivery_policy_hash_mismatch`
- `delivery_missing_licence`
- `risk_provider_unavailable`
- `replay_consumed_invoice`

Each fixture must be deterministic and addressable in automated tests. Demo-mode controls may select them, but they must not leak into normal live presentation accidentally.

---

## 19. UI and interaction design — Black Paper / Rights Trace Desk

### 19.1 Experience thesis

The app should feel like **a film editor’s cutting room crossed with a quiet investigative rights desk**: authored, cinematic, precise, and calm enough to trust with a deadline. It should not resemble a crypto trading screen, neon cyberpunk terminal, generic SaaS dashboard, or card-heavy AI chatbot.

Adapt the Black Paper / Trace Desk direction:

- deep charcoal application shell;
- warm ivory editorial work surfaces;
- hairline rules and near-square, low-radius panels;
- restrained serif for the film insight and decisive narrative copy;
- highly legible sans for interface language;
- mono for timecode, hashes, amounts, states, and evidence;
- almost no shadow; hierarchy comes from tone, rhythm, rules, and scale;
- semantic green, amber, and red only for labelled states;
- one controlled accent inspired by film leader/copper tape for active playhead and selected evidence;
- texture may suggest paper grain/film grain at very low contrast, never compromise text or performance.

### 19.2 Signature visual: the Rights Trace Desk

Create a horizontal, linked evidence ribbon aligned to the 20-second film timeline. It must visually connect:

```text
film timecode / 12-second music placement
  -> candidate audition lanes and waveform
  -> creative-fit markers
  -> ODRL rights gates
  -> risk/authorization gate
  -> XRPL settlement marker
  -> delivered clean-stem and receipt marker
```

Selecting a candidate highlights its waveform lane, rights checks, quote, and evidence drawer. Selecting a rights failure scrolls/focuses the exact ODRL constraint. Selecting settlement opens the technical receipt. The visual must communicate through labels and shapes as well as color.

Use inline SVG, canvas, Web Audio visualization, or carefully composed CSS according to the inspected stack. Deterministic seeded data is acceptable. The actual media controls must work; the waveform cannot be meaningless decoration.

### 19.3 Desktop information architecture

Target primary verification width: 1440 × 900. Support down to 1024 without broken layout.

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ FAIR CUT / Japan Travel / Final 20s     TESTNET · fresh 12s ago   ?   ⚙︎ │
├──────────┬──────────────────────────────────────────────────────┬──────────┤
│ Project  │  Film monitor / current cut                         │ Evidence │
│ rail     │  transport + timecode                               │ drawer   │
│          ├──────────────────────────────────────────────────────┤ optional │
│ Cut      │  RIGHTS TRACE DESK                                  │          │
│ Cues     │  playhead · video lane · music placement            │          │
│ Rights   │  candidate waveform lanes · decision gates          │          │
│ Receipt  ├──────────────────────────────┬───────────────────────┤          │
│          │ Candidate comparison         │ Mandate / next action │          │
└──────────┴──────────────────────────────┴───────────────────────┴──────────┘
```

The first viewport must answer:

1. What is Leah trying to finish?
2. Where does the cue go and how does it sound?
3. Which cue is selected or blocked, and why?
4. What can the agent spend and under what rights?
5. What happens next?

### 19.4 Application header

Include:

- FairCut wordmark, typographically treated rather than a generic sparkle logo;
- project breadcrumb;
- environment badge: `XRPL TESTNET`, `OFFLINE SIMULATION`, or appropriate actual mode;
- freshness/last reconciled time;
- compact help/limitations control;
- preferences/settings control;
- no wallet balance as the primary headline.

### 19.5 Left rail

Compact navigation: `Cut`, `Cues`, `Rights`, `Receipt`. Current section has a strong text/line state. At desktop it is persistent and narrow; at mobile it becomes an actual menu/dialog with focus management, Escape/backdrop close, and no off-screen ghost content.

### 19.6 Film monitor

- 16:9 frame with the 20-second cut.
- Obvious play/pause, scrubber, current timecode, duration, volume/mute, captions if relevant, and replay-final action.
- State label: `Rough cut`, `Auditioning watermarked preview`, or `Final licensed cut`.
- Avoid autoplay with sound.
- Loading/error states preserve dimensions.
- When fulfilment verifies, transition from preview to clean stem without a jarring layout shift.

### 19.7 Timeline and waveform

- Time ruler from `00:00.000` to `00:20.000`.
- Placement region visibly spans 12 seconds.
- Playhead synchronizes with media playback.
- Candidate lanes show compact, distinct waveform shapes and preview status.
- The watermarked state is visible in label and optionally audible, but avoid an obnoxious demo watermark.
- Keyboard controls: Space toggles play unless focus is in a form control; left/right seek with clear help; candidate selection is keyboard reachable.
- Reduced-motion mode removes animated scanning/pulse while preserving current playhead through discrete updates.

### 19.8 Candidate comparison

Do not build three generic marketing cards. Use a compact editorial comparison table/stack with aligned fields:

- title and creator/provider;
- audition control;
- creative assessment summary;
- rights status with text/icon;
- territory;
- use/channel;
- provenance state;
- price in drops and secondary scenario estimate;
- agent ranking among eligible candidates;
- selection/action.

Blocked Candidate A remains visually compelling but unmistakably blocked. Candidate B is selected as `Best eligible fit`. Candidate C proves a genuine eligible alternative. Expand a row into evidence without moving essential controls unpredictably.

### 19.9 Mandate panel

Show one readable sentence first:

> 12 seconds for commercial social use in Singapore and Japan, valid six months, up to 10,000 drops. No voice replicas; provenance required.

Then show structured chips/rows and:

- principal, agent/workload, version, and expiry;
- spent/remaining exact cap;
- `Edit mandate` before authorization;
- once payment intent is frozen, changes create a new mandate version and invalidate authorization.

Do not reduce the mandate to a wallet allowance.

### 19.10 Decision/action panel

State-driven actions:

- `Find cues`
- `Evaluate 3 cues`
- `Audition in cut`
- `Review eligible licence`
- `License for 8,000 drops`
- `Checking exact payment terms…`
- `Confirming on XRPL Testnet…`
- `Verifying delivered stem…`
- `Play final cut`
- `Open rights receipt`

Purchase confirmation must show exact resource, creator/payee display identity, exact drops, network, licence summary, and remaining budget. Do not use a generic “Confirm” label.

### 19.11 Blocked state

Use an editorial red rule/label, not a full red page. Required copy:

```text
Blocked before signing

This cue fits the cut, but its licence does not permit the requested
commercial use and its payee could not be bound to the claimed rights-holder.

No transaction was signed or submitted.
```

Show check rows with `PASS`, `FAIL`, and `UNKNOWN`; color is secondary to text/icon. Provide `Compare next eligible cue`, not `Approve anyway`.

### 19.12 Payment progress

Use a stable ordered sequence:

1. `Mandate matched`
2. `Rights policy matched`
3. `Payee and quote bound`
4. `Transaction signed`
5. `Submitted to XRP Ledger Testnet`
6. `Validated with tesSUCCESS`
7. `Asset and licence delivered`
8. `Delivery verified`

Past, current, failed, and pending states need labels/icons. Never animate a fake ledger progression independent of server state. Use skeletons/spinners sparingly and announce status changes politely to assistive technology.

### 19.13 Receipt/evidence drawer

An app-owned right drawer on desktop; full-height sheet/dialog on mobile. Tabs or sections:

- `Decision`: mandate, selected cue, concise creative rationale, deterministic rights checks.
- `Licence`: ODRL summary, policy hash, attribution, territory/term, standard limitations.
- `Payment`: actual decision source, x402 version, network, exact amount/fee, payee, invoice reference, source tag, hash, ledger index, validated result, explorer link.
- `Delivery`: expected/delivered asset digest/ISCC, MIME, duration, licence digest, fulfilment checks.
- `Audit`: ordered public-safe events and head hash.

The drawer must trap focus when modal, restore focus on close, close with Escape, and have an accessible name.

### 19.14 Visual tokens

Implement tokens centrally. Suggested values may adapt to an existing design system while preserving direction:

```css
--ink-950: #171714;       /* shell */
--ink-900: #211f1b;       /* raised dark surface */
--paper-50: #f4f0e7;      /* primary ivory */
--paper-100: #ebe4d8;     /* secondary paper */
--paper-200: #d8cfbf;     /* rules on paper */
--charcoal-800: #302d28;  /* primary text on paper */
--charcoal-600: #625d54;  /* secondary text */
--copper-500: #c97945;    /* playhead/selection only */
--green-600: #39725a;     /* eligible/verified */
--amber-600: #a66b1f;     /* pending/challenge */
--red-650: #a43d35;       /* blocked/failed */
--focus: #2f6fd6;         /* visible focus, chosen for contrast */

--radius-xs: 2px;
--radius-sm: 5px;
--rule: 1px;
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 24px;
--space-6: 32px;
--space-7: 48px;
--space-8: 64px;
```

- Serif display: **Newsreader** at 500/600 for short insight lines, cue titles, and decisive outcome copy. Do not use it for dense controls or long evidence text.
- Sans UI: **IBM Plex Sans** at 400/500/600 for navigation, forms, comparison rows, buttons, and explanatory prose.
- Mono evidence: **IBM Plex Mono** at 400/500 for timecode, hashes, exact amounts, status codes, and transaction fields.
- If the inspected project already owns a strong type system, preserve it only when it can maintain the editorial/editorial-utility contrast above; record the mapping in `DESIGN.md`.
- Use licensed self-hosted files or pinned `@fontsource` packages. Do not make first paint or the live demo depend on a third-party font CDN.
- Body minimum 16px on mobile; utility labels never below a readable 12px with adequate contrast.
- Headline scale should be restrained; no giant landing-page typography in the workspace.
- No gradient-drenched surfaces, glassmorphism, heavy shadows, excessive pills, or decorative crypto motifs.

### 19.15 Responsive/mobile at 390px

Required order:

1. compact header and menu;
2. project status and primary next action;
3. film monitor;
4. scrollable but non-clipping time ruler/placement overview;
5. candidate priority cards, selected/blocked first;
6. mandate summary;
7. payment/delivery progression;
8. receipt/evidence sheet.

Rules:

- No page-level horizontal scrolling.
- Do not squeeze the desktop three-column layout.
- Candidate table becomes vertically readable priority cards.
- Waveform may horizontally pan inside a clearly bounded, labelled timeline viewport if necessary; the overall page must not clip.
- Touch targets at least 44×44 CSS px where practicable.
- Sticky action bar must not cover media controls or receipt content.
- Dialogs/sheets fit the visual viewport and account for safe-area insets.
- Hashes and addresses wrap or truncate with a copy control and accessible full value.

### 19.16 Accessibility

Meet WCAG 2.2 AA intent:

- semantic landmarks/headings;
- visible `:focus-visible` with strong contrast;
- full keyboard path through discovery, audition, evidence, purchase, and receipt;
- no color-only states;
- accessible names for icon buttons and media controls;
- caption/transcript text for the demo film where speech exists;
- textual waveform/candidate summaries for nonvisual users;
- `aria-live` for material asynchronous status, without chatter on every polling tick;
- focus management for menu/drawer/dialog;
- errors associated with fields and explained in plain language;
- reduced motion honored;
- sufficient contrast in both dark shell and ivory surfaces;
- zoom to 200% without loss of essential content;
- screen-reader-friendly exact amount and hash labels.

### 19.17 Motion

- 120–180ms restrained state transitions.
- Playhead motion follows actual media time, not decorative looping.
- Candidate selection may crossfade highlight and waveform emphasis.
- On verified fulfilment, use one subtle splice/leader transition, then reveal `Final licensed cut`.
- Avoid confetti, coin animations, bouncing crypto icons, continuous shimmer, or celebratory payment spectacle.
- In `prefers-reduced-motion: reduce`, remove crossfades/transforms and use immediate state changes.

### 19.18 Copy voice

Calm, exact, editorial, and non-legalistic. Lead with the filmmaking outcome, not protocol acronyms.

Preferred:

- `Best eligible fit`
- `Blocked before signing`
- `Commercial use is not permitted by this policy`
- `Creator payment validated on XRP Ledger Testnet`
- `Payment settled; delivery did not verify`
- `Provenance assertion verified; ownership is not established`
- `Decision source: Local FairCut policy (demo)`

Avoid:

- `AI says this is safe`
- `Copyright verified`
- `C2PA proves ownership`
- `Blockchain-secured rights`
- `Trustline approved` for local decisions
- `Paid` before ledger validation
- `Complete` before fulfilment verification
- `Gas fee` when referring to XRPL fee
- unexplained `drops`, `tesSUCCESS`, `MemoData`, or `CAIP-2` in the primary flow.

### 19.19 Required UI states

Every major surface must handle:

- populated initial demo;
- loading;
- empty/no candidates;
- partial provider results;
- preview unavailable;
- model adapter unavailable/recorded assessment;
- eligible;
- blocked;
- challenge/information required;
- quote expired;
- quote changed;
- signing in progress;
- submitted/unconfirmed;
- validated success;
- validated failure/expired;
- fulfilment verifying;
- fulfilment exception;
- complete receipt;
- offline simulation label;
- Trustline unavailable;
- copy-to-clipboard success/failure;
- reduced motion;
- narrow mobile viewport.

No raw stack trace or JSON dump appears in the user-facing experience. Technical JSON may be available behind an explicit developer control.

---

## 20. Testing strategy

### 20.1 Unit tests

At minimum:

- mandate schema and expiry;
- exact drop parsing; reject decimals/negative/overflow/noncanonical strings;
- aggregate and per-purchase cap;
- ODRL commercial/social/territory/term/duration/duty checks;
- unknown critical ODRL constraint fails safely;
- provenance state mapping and limitation text;
- rights-holder/payee binding;
- quote canonicalization/hash;
- changed-field invalidation for every critical quote field;
- invoice binding encoding/hash;
- transaction-construction guard;
- fee ceiling and `LastLedgerSequence`;
- partial-payment/path rejection;
- state transition validity;
- event hash chain and mutation detection;
- receipt redaction;
- creative-assessment schema validation;
- replay/idempotency semantics;
- fulfilment digest/duration/MIME/policy verification.

### 20.2 Integration/contract tests

- Provider adapters normalize two different payload shapes.
- Malicious provider text cannot alter system/policy behavior.
- Protected asset returns a real `402` contract pre-payment.
- One exact pinned x402 version/header flow works end to end.
- Wrong version/header fails clearly.
- Wrong amount/payee/network/source tag/invoice/expiry fails before signing or at facilitator verification.
- Signer route cannot accept arbitrary transaction JSON.
- Simultaneous pay requests create at most one signed/economic action.
- Ambiguous submission reconciles without duplicate pay.
- Merchant consumes invoice once.
- Settlement success does not bypass corrupted-delivery detection.
- Local risk provider and Trustline adapter map to identical internal schema without source-label confusion.
- Database/event recovery resumes from crash windows.

Record or fixture external API contracts safely for reliable tests; no secrets in fixtures.

### 20.3 Live XRPL Testnet test

Run at least once with:

- funded Testnet payer;
- known Testnet payee;
- exact small amount;
- invoice binding;
- source tag;
- bounded last ledger sequence;
- chosen facilitator/client version;
- independent ledger verification;
- archived transaction hash and explorer link;
- delivered asset hash and receipt.

Tests must not drain accounts or repeatedly pay on every general test run. Gate live tests behind explicit environment flags and reuse a separately documented demo execution procedure.

### 20.4 Browser/E2E tests

At desktop and 390px mobile:

- opens populated without login;
- plays rough cut;
- auditions all previews;
- blocked candidate displays exact failures and cannot be paid through UI or direct request;
- eligible alternatives remain distinguishable;
- mandate is understandable;
- purchase flow displays exact terms;
- live/fixture mode labels are correct;
- settlement progress reflects backend state;
- final clean stem plays;
- receipt drawer opens/closes and restores focus;
- hashes/addresses copy correctly;
- changed quote and fulfilment failure are recoverable;
- navigation/menu works;
- no horizontal page clipping;
- console has no uncaught errors/hydration warnings;
- important layout remains stable during async updates.

### 20.5 Accessibility tests

- automated axe or equivalent on main, blocked, payment, exception, and receipt states;
- keyboard-only walkthrough;
- focus order and dialog containment;
- screen-reader spot check of player controls, candidate status, progress, and receipt;
- contrast check for all tokens/states;
- 200% zoom;
- reduced-motion test.

### 20.6 Visual QA

Capture and inspect screenshots at minimum:

- 1440×900 initial workspace;
- desktop blocked state;
- desktop settlement/fulfilment receipt;
- 390×844 initial workspace;
- mobile blocked state;
- mobile receipt sheet;
- fulfilment exception;
- offline-simulation label.

Check typography, overflow, focus visibility, waveform clarity, state labels, empty/error balance, and whether the first viewport tells the story without narration.

### 20.7 Reliability rehearsal

Run the exact three-minute script multiple times. Confirm:

- media cached/local enough for venue reliability;
- real Testnet transaction path has funding and endpoint health;
- invoice is new each live run;
- previous transaction can be shown as backup evidence without being represented as the current run;
- optional sponsor outages do not destroy the core demo;
- offline rehearsal remains unmistakably simulated;
- final audio is audible on presentation equipment.

---

## 21. Acceptance criteria

### Product and story

- [ ] A fresh visit opens a populated self-explaining demo, not a login, setup screen, blank dashboard, or protocol console.
- [ ] Within ten seconds, the first viewport identifies Leah, her deadline/problem, the agent's bounded authority, the exact paid object, and the intended final-cut outcome.
- [ ] `Run guided demo`, manual step controls, pause/inspection, replay, and safe reset all work through real application state.
- [ ] The guided fixture path shows comparison, a no-payment block, eligible selection, purchase, delivery verification, audible final cut, and receipt in 60–90 seconds.
- [ ] Fixture, recorded-Testnet, and live-Testnet evidence are visually and semantically distinct in the UI, API, receipt, and documentation.
- [ ] At least three unfamiliar-viewer comprehension checks are recorded, and every reviewer can explain the use case and XRPL's limited role without presenter coaching.
- [ ] A first-time viewer can name Leah, her deadline, requested cue, rights constraints, and budget after one minute.
- [ ] The film visibly/audibly improves after the paid delivery.
- [ ] Three candidates and two providers make the discovery/decision nontrivial.
- [ ] The agent makes a creative selection among at least two deterministically eligible options.
- [ ] The strongest creative candidate is blocked for objective rights/payee reasons.
- [ ] The UI says no transaction was signed or submitted for the blocked candidate.

### Trust and explanation

- [ ] Mandate, evidence, policy, decision, payment, and fulfilment are inspectable.
- [ ] Creative reasoning is concise and separate from rights eligibility.
- [ ] No chain-of-thought is stored/displayed.
- [ ] ODRL, identifier/digest, and provenance each have correct, limited claims.
- [ ] Local and live sponsor integrations are labelled exactly.
- [ ] Settlement and fulfilment cannot be confused.

### Payment and ledger

- [ ] One exact x402 contract is pinned and integration-tested.
- [ ] A real XRP Testnet transaction validates with `tesSUCCESS`.
- [ ] Transaction hash, ledger index, network, payer/payee, exact amount, fee, and explorer link are recorded.
- [ ] Invoice binding, source tag, destination, amount, expiry, and no-partial-payment constraints are verified.
- [ ] The signer never accepts arbitrary LLM/browser transaction data.
- [ ] No secret reaches client, logs, repository, or receipt.
- [ ] Replay and ambiguous retry are safe.

### Delivery

- [ ] Clean asset cannot be retrieved merely by inspecting the client bundle.
- [ ] Clean asset and licence arrive only after payment evidence.
- [ ] Asset and policy hashes match the frozen order.
- [ ] Duration, MIME, identifier, attribution, and rights checks pass.
- [ ] Corrupt/mismatched delivery yields a visible exception and no clean timeline insertion.

### UX

- [ ] Black Paper / Rights Trace Desk direction is coherent and distinctive.
- [ ] Main surface is an editing workspace, not a dashboard/card soup.
- [ ] Timeline, waveform, audition, blocked decision, payment state, and receipt interactions work.
- [ ] Desktop and 390px layouts are verified with no page-level clipping.
- [ ] Keyboard, focus, reduced motion, semantic names, contrast, and status announcements are verified.
- [ ] All required loading, empty, blocked, failure, and recovery states have deliberate UI.

### Engineering and documentation

- [ ] Lint, typecheck, unit, integration, and E2E suites pass using documented commands.
- [ ] Build succeeds from a clean dependency install according to the existing package manager.
- [ ] Environment variables are documented with no real secrets.
- [ ] Setup, architecture, state model, integration modes, demo, and limitations are documented.
- [ ] Public source contains asset licences/permissions.
- [ ] Current screenshots and live transaction evidence exist.
- [ ] Developer feedback about XRPL SDK/facilitator friction is recorded for the hackathon feedback requirement.

---

## 22. Milestone order for autonomous loops

Do not start with visual polish or optional sponsors. Complete milestones in this order unless repository evidence requires a narrowly documented adjustment.

### Milestone 0 — Inspect and baseline

- Read instructions and map the project.
- Preserve working changes.
- Run existing tests/build.
- Record commands and failures that predate work.
- Decide extension points and data ownership.

**Exit evidence:** inspection notes and a passing/current baseline or clear pre-existing-failure record.

### Milestone 1 — Domain model and fixtures

- Implement schemas, state machines, canonical hashing, event model, seeded personas/assets/offers/ODRL, and failure fixtures.
- Add asset ownership/licence documentation.

**Exit evidence:** unit tests cover all state/rights fixtures and reveal the intended winner/blocker.

### Milestone 2 — Deterministic guard

- Implement rights evaluator, payee binding, mandate enforcement, quote binding, local risk provider, and denial reason codes.

**Exit evidence:** direct backend attempts cannot pay blocked/changed/expired offers.

### Milestone 3 — Vertical UI without payment

- Build the populated `/demo` entry, person/problem thesis, persistent phase rail, working guided controls, monitor, timeline/waveforms, candidate comparison, mandate, evidence drawer, and blocked path.
- Implement real preview audition behavior.
- Wire the fixture flow through rough cut → comparison → block → eligible selection → clearly labelled simulated purchase/delivery → playable final cut → receipt, using real application state and no false controls.
- Add reset/replay behavior that preserves real transaction evidence and visibly separates `FIXTURE DEMO`, `Recorded Testnet evidence`, and `LIVE · XRPL TESTNET`.
- Run the no-presenter comprehension review and correct any step where viewers cannot identify the person, problem, agent decision, paid object, blocked reason, or outcome.

**Hard gate / exit evidence:** browser/E2E at desktop/mobile demonstrates the complete 60–90 second fixture story, including discovery, evaluation, audition, block, simulated purchase/delivery, final cut, receipt, replay, and reset. Reviewer notes show that the use case is understandable without narration. Do not begin optional integrations or treat the product as demoable until this gate passes.

### Milestone 4 — Protected merchant and x402 contract

- Implement protected clean-resource delivery, unique quotes/invoices, pinned `402` contract, and client adapter.
- Confirm clean asset is not exposed pre-payment.

**Exit evidence:** contract tests for valid/invalid challenges and pre-payment denial.

### Milestone 5 — Testnet signer and settlement

- Implement policy-aware signer, transaction safeguards, facilitator submission, XRPL reconciliation, receipt fields, and one real funded Testnet execution.

**Exit evidence:** validated `tesSUCCESS`, real hash/explorer link, no exposed secrets, replay tests.

### Milestone 6 — Fulfilment verification and audible finish

- Fetch protected package, verify asset/licence/provenance facts, update timeline, play final cut, and implement fulfilment exception.

**Exit evidence:** happy path and corrupt-delivery path in integration/E2E tests.

### Milestone 7 — Full states, accessibility, responsive polish

- Implement remaining required states, keyboard/focus behavior, reduced motion, responsive transformations, clear copy, and visual QA.

**Exit evidence:** screenshot matrix, accessibility results, mobile/desktop E2E.

### Milestone 8 — Optional sponsor depth

- Add Trustline sandbox/Agentic Challenge only if real credentials exist and core remains stable.
- Add ClawCredit only if real path is proven.
- Improve C2PA/ISCC from fixture/fallback to real standards validation where feasible.

**Exit evidence:** actual provider references and exact source labels; otherwise omit from live claim.

### Milestone 9 — Submission and rehearsal

- Finalize README, architecture, transaction evidence, demo reset/seed procedure, limitations, builder feedback, and pitch assets.
- Rehearse three-minute script under venue-like conditions.

**Exit evidence:** clean setup run, all test gates, current screenshots, current live receipt, timed demo under three minutes.

At the end of every loop:

1. Re-read the next unmet acceptance criteria.
2. Inspect current authoritative evidence.
3. Fix the highest-risk missing vertical behavior.
4. Test it proportionally.
5. Update verification evidence truthfully.
6. Continue; do not declare completion while a MUST remains unproven.

---

## 23. Exact three-minute demo script

### 0:00–0:20 — Person and pain

Play the rough 20-second travel cut for a few seconds.

> “Leah is an independent filmmaker delivering this Singapore–Japan campaign tonight. Her AI editor can finish the cut in minutes, but clearing one 12-second music cue still means interpreting licences and trusting a payment destination.”

### 0:20–0:40 — Delegated authority

Open the mandate summary.

> “She delegates exactly this: commercial social use in Singapore and Japan for six months, no voice replicas, provenance required, and no more than 10,000 drops. The agent can choose creatively; it cannot change these rights or sign arbitrary payments.”

### 0:40–1:10 — Discovery and audition

Show three candidates from at least two providers. Audition the strongest and selected eligible cues in the film.

> “The agent compares timing, mood, transition, rights, provenance, and price inside the actual cut—not on a checkout page.”

### 1:10–1:35 — Hard block

Select Neon Pilgrim and open its rights trace.

> “This is the best creative match and cheapest track, but it permits personal use only, misses Japan, and the payee does not bind to the claimed rights-holder. FairCut blocks it before signing. There is no transaction hash because no transaction exists.”

### 1:35–1:55 — Eligible decision

Select Dawn Current.

> “Dawn Current is the best eligible fit. Its structured policy covers the use, territories, term, and attribution. The payment quote is frozen to this asset, policy hash, creator payee, price, expiry, and one-time invoice.”

### 1:55–2:25 — Live XRPL payment

Trigger the purchase and show honest progress.

> “The clean stem is behind an x402 payment challenge. The model never sees the wallet key. A deterministic signer rechecks every term, signs one small XRP Testnet payment, and waits for ledger validation.”

Show `validated · tesSUCCESS`, exact amount, and shortened hash/explorer link.

### 2:25–2:45 — Delivery and audible outcome

Show asset/licence verification and play the final cut.

> “Settlement alone is not delivery. FairCut verifies the clean stem and licence against the frozen order, replaces the watermark, and now Leah can hear the final film.”

### 2:45–3:00 — Receipt and why it wins

Open the compact receipt.

> “One receipt connects her mandate, the rights decision, the creator payment, and the delivered bytes. ODRL expresses permission, C2PA records provenance assertions, and XRPL proves the tiny cross-border settlement—each doing one honest job.”

Do not spend stage time navigating a wallet or reading raw JSON. Keep the explorer and standards detail one click away for judges.

---

## 24. Judge questions the build must answer

### “Why not use a card?”

FairCut’s long-term market is independent machine-addressable licensors, not one platform catalogue. A tiny direct XRPL payment can settle across borders without every agent and creator holding a bilateral account. A centralized library could use cards, so the demo deliberately includes multiple provider identities and immediate creator settlement.

### “Why does this need an agent?”

The agent evaluates uncertain creative fit inside the actual edit and chooses among eligible options. Deterministic software handles rights and payment policy. Remove the agent and the experience returns to manual audition/search/checkout.

### “Does the blockchain prove the licence?”

No. XRPL proves the exact payment validated. ODRL represents the asserted policy; provenance evidence records signed assertions; deterministic fulfilment checks compare the delivered package. None alone proves copyright ownership.

### “What is t54 doing?”

Answer according to actual mode. If local: “Our live guard is a local deterministic policy shaped behind a Trustline-compatible adapter; ARS informed our separation of authorization, settlement, and fulfilment.” If sandbox is real: state exactly which assessment and challenge path ran and show its reference.

### “What stops the model stealing the wallet?”

The model has no signing secret and cannot submit transaction JSON. The signer accepts only a stored, approved intent and independently reconstructs/checks the exact Testnet payment under amount, payee, network, invoice, fee, and expiry constraints.

### “What if payment succeeds but the file is bad?”

The state becomes `FULFILMENT_EXCEPTION`; the receipt preserves settlement but does not call the job complete, the clean stem is not inserted, and the user receives a retry/escalation path.

### “Is C2PA proof the creator owns it?”

No. It verifies signed provenance assertions when a valid manifest is available. Rights-holder/payee binding is additional evidence, and the prototype is deliberately limited to original, consenting demo assets.

---

## 25. Submission evidence and documentation

The finished public repository MUST include, in established project locations:

- concise problem/product overview;
- persona and customer journey;
- architecture diagram showing trust zones and sponsor adapters;
- setup instructions from a fresh clone;
- exact runtime/package-manager versions or files that establish them;
- `.env.example` without secrets;
- local demo and live Testnet modes;
- funding and reset steps that do not encourage mainnet use;
- pinned x402 version and observed header contract;
- XRPL transaction construction and signer safeguards;
- real successful Testnet transaction hash/explorer URL;
- actual receipt/evidence for one successful fulfilled purchase;
- ODRL policy fixtures and validation approach;
- C2PA and identifier/digest status with limitations;
- media asset provenance/licence/consent;
- t54/ARS/Trustline wording and actual integration status;
- optional ClawCredit status, if any;
- threat model and privacy statement;
- state machine and idempotency/reconciliation notes;
- test commands and latest verification results;
- desktop/mobile screenshots;
- three-minute demo script and demo reset procedure;
- known limitations and production next steps;
- XRPL developer/facilitator feedback gathered during implementation.

Recommended evidence bundle fields:

```text
build commit
demo timestamp (UTC and Singapore time)
environment/mode
mandate ID + hash
selected candidate + provider
ODRL policy hash
risk decision source
x402 version
invoice ID or redacted reference
XRPL network
transaction hash
validated ledger index + tesSUCCESS
asset digest / actual ISCC if valid
licence digest
fulfilment status
event chain head hash
screenshot paths
test command summaries
```

Never commit seeds, API keys, private licence URLs, or sensitive evidence to create a stronger-looking submission.

---

## 26. Production-path notes

These are roadmap notes, not MVP claims:

- Creator onboarding would need identity, authority, catalogue quality, disputes, revocation, tax, and regulatory operating processes.
- Rights vocabularies would need legal review per jurisdiction and media type.
- Broader music use may involve master, composition, performance, and mechanical rights beyond one original stem.
- Payment asset choice may move toward stable-value instruments if current network support, issuer/trust-line setup, compliance, and user experience justify it.
- High-value or complex work could use escrow/evaluation structures; do not conflate this with the direct tiny-licence MVP.
- Privacy-preserving credentials and selective disclosure could improve creator/payee binding.
- A provider reputation model should use repeated, attributable delivery evidence rather than one successful action or a model confidence score.
- Revocation and downstream export tracking require product/legal design beyond an immutable receipt.

---

## 27. Strict definition of done

FairCut is done only when all of the following are true and evidenced in the current worktree or deployed demo:

1. The application runs from documented setup commands and opens on a polished, populated film-editing workspace with a working `/demo` or equivalent root entry.
2. Leah’s real, narrow problem, the agent's bounded decision, the exact licence purchase, and the final-cut outcome are immediately understandable without presenter narration.
3. At least three candidates from at least two provider identities can be auditioned inside the actual cut.
4. An agent or honestly labelled recorded-agent adapter produces structured creative comparison; deterministic code—not the agent—evaluates rights and signing eligibility.
5. The strongest creative candidate is hard-blocked for structured rights/payee failures, with no signature or transaction.
6. At least two candidates are rights-eligible so the selected cue reflects a genuine creative choice, not merely the only passing row.
7. The successful clean asset is genuinely protected before payment.
8. One pinned x402 flow returns and validates exact payment requirements.
9. The server-only signer independently enforces every required invariant and contains no client-exposed secret.
10. One real XRP Testnet `Payment` is independently confirmed `validated: true` with `tesSUCCESS` and a working explorer reference.
11. The transaction binds a unique invoice and exact provider, payee, asset, amount, network, expiry, and source tag.
12. The merchant/delivery path is idempotent and replay-safe.
13. The clean stem and licence package are delivered after settlement and verified against the frozen asset/policy hashes, duration, MIME, and rights requirements.
14. The clean stem replaces the watermarked preview and the final cut is audibly playable.
15. A fulfilment mismatch remains an exception even after successful settlement.
16. The receipt separates mandate, creative choice, deterministic policy, actual risk source, settlement, provenance, licence, and fulfilment, with correct limitations.
17. ODRL, C2PA, ISCC/SHA-256, t54 Trustline/ARS, ClawCredit, x402, and XRPL are described honestly and only to the extent actually implemented.
18. Changed quote, provider outage, ledger ambiguity/failure, delivery mismatch, and replay paths behave safely and are tested.
19. Desktop and 390px mobile experiences have been inspected in a real browser across happy and failure states with no blocking visual defects or horizontal page clipping.
20. Keyboard navigation, focus, accessible names, state announcements, contrast, 200% zoom, and reduced motion have been checked.
21. Lint, typecheck, build, unit, integration, E2E, and applicable accessibility tests pass, with any environment-specific live test clearly documented.
22. Assets are original/permitted and their evidence is included.
23. Public documentation contains architecture, setup, modes, transaction proof, security boundaries, demo script, limitations, and builder feedback; `DESIGN.md` and `UX-CONTRACT.md` preserve the chosen visual and behavioral contracts when those files are required by the implemented application scope.
24. No user changes were discarded, no unrelated files were rewritten, and no secrets or unsupported legal/production claims exist.
25. A fresh viewer can complete the resettable guided fixture story in 60–90 seconds; all actions are real application state transitions, the blocked step proves no money moved, the final cut is audibly playable, and fixture/recorded/live evidence cannot be confused.
26. The three-person or equivalent unmoderated comprehension check is recorded and passes the questions in §1; failures produced concrete copy or interaction changes before retest.
27. The entire live story can be demonstrated reliably in under three minutes.

A pretty screen without a working self-explaining flow is not done. A guided slideshow disconnected from domain state is not done. A transaction without protected delivery is not done. Delivery without deterministic rights and signer safeguards is not done. Passing tests that do not cover the real browser and Testnet path are not done. A simulated sponsor response or ledger artifact represented as live is disqualifying.

When every item above is proven, produce a final completion report that links to the implementation, test results, screenshots, transaction/explorer evidence, receipt, and any remaining explicitly optional roadmap items. Until then, continue iterating.

---

## 28. Authoritative source map for the implementation agent

Recheck live technical behavior before implementation because APIs, testnet availability, fees, and SDK contracts may change.

- Local challenge context: `context.md`
- Sponsor/protocol research: `company-research-context.md`
- Idea research: `hackathon-idea-chronicle.md`
- Selected visual source: `archive/website-template/observability-design-prompts.md`, Prompt 1 — Black Paper / Trace Desk
- Ripple challenge repository: <https://github.com/Singhacks-2026/ripple>
- XRPL developer portal: <https://xrpl.org/>
- XRPL AI Starter Kit: <https://ripple.com/insights/xrpl-ai-starter-kit/>
- t54 Agentic Risk Standard: <https://docs.t54.ai/docs/research/agentic-risk-standard>
- t54 Trustline overview: <https://www.t54.ai/docs/trustline/overview>
- t54 Agentic Challenge: <https://www.t54.ai/docs/trustline/agentic-challenge>
- t54 XRPL x402 facilitator: <https://xrpl-x402.t54.ai/docs/overview>
- W3C ODRL Information Model 2.2: <https://www.w3.org/TR/odrl-model/>
- ISO 24138:2024 ISCC overview: <https://committee.iso.org/standard/77899.html>
- C2PA specifications: <https://spec.c2pa.org/specifications/>
- ClawCredit overview: <https://www.claw.credit/docs/overview>

Use primary/current sources for technical implementation decisions. When current docs conflict with this research snapshot, update implementation assumptions, tests, and documentation together—never silently mix versions.
