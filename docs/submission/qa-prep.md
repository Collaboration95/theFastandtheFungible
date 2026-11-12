# Judge Q&A prep

Each question has a **Say** (about 20 seconds aloud) and a **Behind it** with
the source. Counts are generated into [facts.json](facts.json) (as of
<!--f:as_of-->12 Nov 2026<!--/f-->); read this page rendered on GitHub, where the
markers that keep them in sync are hidden. Check the [tracker](../SFF-PUSH.md)
on 17 Nov for anything newer.

The questions are grouped by three judge personas from our practice panels:
**R**, a Ripple DevRel / XRPL engineer; **P**, a payments or
fintech operator; **Y**, a YC-style partner. Their hardest questions come first.

One hosted run where the browser check shows all five gates held: featured preset 2,
`421bae3d`, 12 Nov. Its numbers below are separate from the earlier preset-3 paid-answer card.

## Numbers card (memorise these)

| Number | What it is | Label | Source |
|---|---|---|---|
| **<!--f:identity_writers-->3<!--/f--> Credentials / <!--f:identity_domains-->1<!--/f--> domain** | accepted operator-issued writer Credentials and retained Testnet Permissioned Domain | identity only, not KYC or quality; snapshot ledger <!--f:identity_ledger-->22244375<!--/f-->, 11 Nov; distinct from two paid team writers and zero independent writers | [identity evidence](../evidence/writer-credentials-nov12/README.md) |
| **RLUSD `tecNO_PERMISSION` / TEST-SGD `tesSUCCESS`** | recorded unsigned create probes: RLUSD on Testnet and Mainnet; matched control on Testnet | no signature, submission or fee charged | [verdicts](../evidence/dry-run-nov12/result.json) |
| **Featured browser/TS 24 passed / 0 failed / 2 not checked; Python 25 passed / 0 failed / 2 skipped; five gates Held** | same preset-2 export; Testnet 6/6 each; separate from the earlier HOSTED-12 answer card | one hosted run, 12 Nov, 09:07 SGT; 31.1 s, 1 article, S$0.40; identity skips retained | [receipts, counts and all three tx links](../evidence/hosted-export-nov12/README.md) |
| **<!--f:try_s-->84.2<!--/f--> s** | `try --testnet`: empty npm cache → six Testnet links → `RESULT PASS` | Testnet, fixture models, one Mac, 7 Nov; <!--f:try_misses-->2 of 4<!--/f--> cold attempts overran 90 s | [#387](https://github.com/Collaboration95/theFastandtheFungible/pull/387), [round4-j2](../evidence/round4-j2/README.md) |
| **<!--f:mcp_mb-->3.4<!--/f--> MB / <!--f:mcp_init_s-->6.3<!--/f--> s** | MCP package size / cold initialize (was 21.4 MB / 56.5 s) | local packed build, fresh npm cache | same |
| **<!--f:app_ready_s-->27.0<!--/f--> s** | zero-clone app ready (was 134 s) | same | same |
| **<!--f:fee_drops-->435<!--/f--> drops** | fees per key-reveal purchase as we sign: <!--f:fee_create-->12<!--/f--> paid by the buyer to create, <!--f:fee_finish-->423<!--/f--> paid by the writer to finish (rippled's own minimum: 360) | Testnet, measured | [cost card](../numbers.md#testnet-cost-and-latency), [round3-a](../evidence/round3-a/README.md) |
| **894 drops** | all six UC3 transactions (two buys, refund, anchor) | Testnet, measured | [judge-path.md](../evidence/round4-l4/judge-path.md) |
| **S$0.00087** | fees per purchase at an assumed S$2.00/XRP | **projection**, not a quote | [cost card](../numbers.md#testnet-cost-and-latency) |
| **US$0.0026** | historical model cost per question | LIVE decisions/coverage; fixture research; simulated payments, 48 fresh synthetic questions, 3 Nov | [scorecard](../numbers.md#synthetic-corpus-scorecard-3-nov) |
| **<!--f:transactions-->61<!--/f-->** | Testnet transactions on `/ledger/`, re-validated live from the browser (61/61 in 1.65 s when measured on 7 Nov) | read-only | [#388](https://github.com/Collaboration95/theFastandtheFungible/pull/388) |
| **12/12** | Testnet checks in `verify --ledger` on the README UC3 receipts | read-only, s.altnet | [#377](https://github.com/Collaboration95/theFastandtheFungible/pull/377) |
| **<!--f:vectors-->224<!--/f-->** | shared conformance vectors; TypeScript and Python agree on all | offline | [#381](https://github.com/Collaboration95/theFastandtheFungible/pull/381) |
| **<!--f:writer_s-->33.9<!--/f--> s** | `init` + `publish`: Markdown folder → writer Credential validated on Testnet | generated starter note, public faucet, one measurement | [#389](https://github.com/Collaboration95/theFastandtheFungible/pull/389) |
| **0** | gate-audit violations: 10 runs, 568 observations | fresh-set eval, simulated payments, 3 Nov | [scorecard](../numbers.md#synthetic-corpus-scorecard-3-nov) |
| **93.15%** | gross article spend that bought a fact in the final answer (CI 81.25–100.00) | LIVE decisions, fixture research, simulated payments | [fresh-results.json](../../eval/scorecard/fresh-results.json) |
| **<!--f:prs-->305<!--/f--> / <!--f:releases-->15<!--/f-->** | PRs merged into `main` since <!--f:since-->21 Sep<!--/f--> / published releases | counted at <!--f:sha-->e37be882<!--/f--> on <!--f:as_of-->12 Nov 2026<!--/f--> | [facts.json](facts.json), [progress page](https://collaboration95.github.io/theFastandtheFungible/progress/) |
| **Held-out <!--f:heldout-->16/20<!--/f-->; <!--f:offtopic-->0/10<!--/f--> off-topic buys** | <!--f:heldout_line-->v5 blind held-out: 16/20 bought and cited, 0/10 off-topic purchases (run once, 11 Nov, on XRPL Testnet: fixture research and decision models with answers written offline, team-authored writers)<!--/f-->; the key fact leads the answer in <!--f:answers_it-->7/20<!--/f-->; 0 gate violations. Dev (not held-out): v1 <!--f:dev_v1-->16/20<!--/f-->, v3 <!--f:dev_v3-->7/20<!--/f--> | as stated | [evidence](../evidence/v5-heldout/README.md) |
| **SingHacks baseline** | <!--f:singhacks_then-->At SingHacks a language model proposed each purchase and a person approved every quote before payment; payment was a fixture by default, with optional Testnet settlement.<!--/f--> | tag `hackathon-baseline` (7 Sep commit) | [prototype README](https://github.com/Collaboration95/theFastandtheFungible/blob/hackathon-baseline/prototypes/ResearchAgent/README.md) |

---

## Y · the YC partner

### 1. Why is the live sandbox only open 13–19 November?

**Say:** "We run a shared Testnet sandbox for judging week so you can click
without installing anything. It pays from one pre-funded Testnet wallet with
small per-visitor caps, and one indicator at the top says it's XRPL Testnet
with no real value. We don't run it as a service: there's no real money and no
accounts, and it closes after the event. The one-line `try --testnet`, the
recorded replay and the ledger page keep working from the release."

**Behind it:** owner direction 10 Nov (Cloud Run front, one VM, existing
SQLite journals; [hosted-web.md](../hosted-web.md)). Admissions close
2026-11-19 16:00 UTC. Owner routes (settings, keys, faucet, fault switches) are
disabled; each answer labels whether its models ran live or as a fixture
fallback. Never call it a "live service" or "production". The replay is
labelled "Recorded on XRPL Testnet · no backend"; the cold `try` path needs
Node ≥ 22.13.

### 2. Are the writers real?

**Say:** "Our paid team writers are Build notes and XRPL explainers. Open Records is our free records source. All three team writers hold accepted XRPL Testnet Credentials from our operator issuer; a Testnet Permissioned Domain lists accepted issuers; identity only, not KYC or quality. Fictional demo writers stay fictional and unverified. No independent writers yet."

**Behind it:** [Writer identity evidence](../evidence/writer-credentials-nov12/README.md); two team-authored writers sell notes, plus the free Open Records source. [Independent writer list](../evidence/real-writers.json) remains empty. Hosted badge rollout requires configuration and observed acceptance.

### 3. I asked my own question. What happens?

**Say:** "It can buy and cite our labelled team notes. With fixture models on
Testnet, <!--f:heldout_n-->sixteen<!--/f--> of <!--f:heldout_N-->twenty<!--/f-->
blind held-out questions were bought and cited, and on
<!--f:offtopic_N-->ten<!--/f--> off-topic questions it bought nothing. The key
fact leads the answer in <!--f:answers_it-->7/20<!--/f-->. If policy declines the available articles, it buys nothing, and
the decline now lists each policy reason in 'Why'. Discovery does not guarantee
a purchase. Development sets, which we tuned on, are separate: v1
<!--f:dev_v1-->16/20<!--/f--> and v3 <!--f:dev_v3-->7/20<!--/f-->."

**Behind it:** [v5 evidence](../evidence/v5-heldout/README.md): <!--f:heldout_line-->v5 blind held-out: 16/20 bought and cited, 0/10 off-topic purchases (run once, 11 Nov, on XRPL Testnet: fixture research and decision models with answers written offline, team-authored writers)<!--/f-->; answers-it <!--f:answers_it-->7/20<!--/f-->, <!--f:heldout_violations-->0<!--/f--> gate violations. Run once on `main` `a9584014`, fixture research and decision models (answers written offline) at threshold 0.20, team-authored writers, Testnet. Some v5 questions resemble v4 ones; leaving out the two closest pairs gives 15/18 (the evidence README lists them). v4 and v5 are now used, so a new held-out claim needs a new blind bank. Dev, not held-out: v1 16/20, v3 7/20 (answers-it 4/20 after #410); v2 is observed dev data. Finished Testnet abstentions queue an anchor (#403); claim anchoring only after validation, and read each verifier result separately. Policy misses remain: the other held-out questions did not end in a cited purchase. This is fixture-model mechanism evidence, not live-model answer quality: the hosted sandbox writes answers live and decides purchases with the rule-based model.

### 4. Who pays for this, and who is writer number one?

**Say:** "Our initial-market hypothesis is XRPL/x402 integrators using coding agents to buy practitioner implementation notes and reproducible failure paths. The buyer is implementing a paid endpoint or diagnosing failed settlement. Today our team-authored writers supply the notes; the expected benefit is a specific cited implementation detail without reconstructing the failure alone. We would test repeat demand here before adding other expert shelves. No independent writers, customers, pilots or revenue."

**Behind it:** [Example team-authored note: how writers get paid](../../data/corpus/v2/articles/team-xrpl-explainers/product-writer-paid.json). This is a hypothesis, not demand validation, TAM, a partner, pilot or customer quote. [Hire evidence](../evidence/hire-274.md): service fee and royalties demonstrated once on Testnet.

### 5. How is this different from other agent-payment projects?

**Say:** "Most show that an agent *can* pay. We focus on whether it *should*,
and on what happens when the seller lies. The model never holds spending
authority. The writer is paid only by publishing the key on the ledger. Every
receipt can be re-checked by two verifiers, written separately in two languages,
and they agree on every test vector."

---

## P · the payments operator

### 6. What are the unit economics?

**Say:** "Use one hosted run on 12 Nov: HOSTED-12 bought one article with four passages for S$0.40, or 40,000 Testnet drops at the fixed demo rate, not FX. No refunds. It took 65.8 seconds from admission/Start to Done, excluding planning and the five-second confirmation modal. Buyer create 12 drops, writer finish 423, buyer anchor another 12. Model cost is unmeasured: usage was not retained. The old US$0.0026 belongs to a different synthetic evaluation, not this question."

**Behind it:** [HOSTED-12 evidence and ledger links](evidence/hosted-answer-nov12/README.md): one hosted DEPLOY-3 run, live DeepSeek plan/final writing, rule-based buying; initial draft fixture, keyword fallback, team-authored writer, real Testnet XRP, no real value. Two initial recorded gaps, none in the final answer; no independent quality score or generalization. Published v1.1.1 wheel: 27 passed / 0 failed / 2 skipped, Testnet 6/6; browser 26/0/2. In this earlier DEPLOY-3 sample, paid-read telemetry is absent: gate 1 Not checked, gates 2–5 Held. The featured preset-2 run has all five Held; its counts are separate. In the recorded unsigned probe rippled autofilled 10 + 350: rippled's own minimum is 360 for those shapes. Signing fees stay 12 + 423 and can vary with load/fulfillment size. [Probe](../evidence/dry-run-nov12/README.md). US$0.0026: 3 Nov live decisions/coverage, fixture research, simulated payments, [numbers](../numbers.md#synthetic-corpus-scorecard-3-nov).

### 7. Why TEST-SGD and not RLUSD?

**Say:** "Official RLUSD payments worked on Testnet. Escrow is different. In recorded unsigned probes, rippled returned tecNO_PERMISSION for RLUSD EscrowCreate on Testnet and Mainnet. The matched TEST-SGD control returned tesSUCCESS on Testnet. Nothing signed or submitted. Token escrow uses our unbacked no-value TEST-SGD IOU; the live sandbox pays in Testnet XRP. An issuer-permission change removes this observed blocker, but funding, trust-line, escrow and verification checks must be repeated before enabling RLUSD escrow."

**Behind it:** [Unsigned verdicts](../evidence/dry-run-nov12/result.json): Testnet ledger 22244249, Mainnet 108262329. Testnet and Mainnet both have TokenEscrow enabled. [Official RLUSD payments](../evidence/rlusd.md); [TEST-SGD evidence](../evidence/m1-iou/README.md). No peg, backing or Mainnet signing claim.

### 8. What's simulated, what's substituted, what's real?

**Say:** "Escrow, refund, anchor and credential transactions we link are recorded Testnet evidence. RLUSD dry runs are unsigned RPC verdicts, including a read-only Mainnet probe, not submitted transactions. The sandbox uses live answers, rule-based buying. The offline evaluation and replay retain their fixture, simulated or fictional labels. TEST-SGD is unbacked. Operator credentials do not make writers independent."

**Behind it:** Hard gate 5. A domain object ID, receipt/content hash or ledger index is not a transaction hash. The hosted HOSTED-12 example labels its initial fixture draft separately from its live final answer.

### 9. Is it ready for mainnet?

**Say:** "No, and mainnet is disabled in code. The money-safety core is done
and tested: persist before submit, a pending state, exact delivered amounts,
one charge per intent, and crash recovery. The gaps are written down: payer
keys in a KMS, RLUSD escrow once the issuer allows it, live FX, KYB and
sanctions screening, and a facilitator SLA. We'd rather show a checklist than
claim readiness."

**Behind it:** [mainnet checklist](../BUILDER-FEEDBACK.md#mainnet-readiness-checklist),
[COMPLIANCE](../COMPLIANCE.md).

### 10. After the key is revealed, who guarantees the refund?

**Say:** "If the key never appears, the principal stays locked until an EscrowCancel validates after CancelAfter; policy submits that recovery transaction. Time alone does not return it. Once a finish reveals the key and pays the writer, a quality refund is a separate payment the writer must sign. Our demo writer cooperates; a real writer could refuse. The buyer retains a checkable fraud proof."

**Behind it:** [Key-reveal mechanism](../key-reveal-escrow.md); [no-show create/cancel](../evidence/round3-e/runs.json). Refund of principal does not erase network fees.

### 11. A payment times out, or the server crashes mid-payment?

**Say:** "We store the signed transaction before sending it, so recovery
reuses the persisted transaction; replacement needs ledger-proven failure or expiry. A missing transaction is
*pending*, not failed, until a validated ledger proves it expired. In chaos
tests with real process kills we had zero double charges."

**Behind it:** [payment-ops-287](../evidence/payment-ops-287.md), 200-run chaos
in #376, #377 and #381, [RUNBOOK](../RUNBOOK.md), feedback B01–B03.

### 12. Compliance: are you a payment service?

**Say:** "It's a Testnet prototype, and no lawyer or regulator has reviewed it.
Research purchases are non-custodial: the buyer pays writers directly into
escrow. We built the plumbing a compliance team asks for: a hash-chained audit
log written with every spend decision, receipt export, read-only re-verification
against the ledger, a fail-closed payee denylist and data pruning."

**Behind it:** [COMPLIANCE](../COMPLIANCE.md). The denylist is an integration
point, not a sanctions provider. Hire mode is receive-and-forward custody, and
we say so.

### 13. Did you file the builder feedback upstream?

**Say (while none are filed):** "Not yet. All
<!--f:drafts-->8<!--/f--> drafts are paste-ready and public in the repo, each
with a script that reproduces it offline in under 30 seconds, and filing them is
this week's first job. We have <!--f:ranked-->7<!--/f--> ranked findings,
<!--f:findings-->35<!--/f--> numbered findings in a dated log, and a mainnet
checklist. The top one now includes rippled’s recorded unsigned RLUSD refusal and a successful TEST-SGD control."

**Behind it:** <!--f:feedback_line-->7 ranked findings with runnable repros · 35 numbered findings (B01–B35) · 15 submissions on 4–5 Sep · 8 upstream drafts, 0 filed<!--/f-->.
[BUILDER-FEEDBACK](../BUILDER-FEEDBACK.md), [upstream drafts](../feedback/upstream/),
[filing kit](../feedback/upstream/FILING-KIT.md). Filing is owner-only (#265 B1).
Once filed, the count above changes by itself; then say "Yes, N, on <date>" and
show the links in BUILDER-FEEDBACK's top-7 table.

---

## R · the XRPL engineer

### 14. Why XRPL?

**Say:** "Native conditional escrow lets a writer collect by revealing the article key. Token-escrow evidence uses TEST-SGD; the live sandbox pays in Testnet XRP. Memos bind the quote and anchor the audit commitment. Three team writers hold accepted XRPL Testnet Credentials from our operator issuer; a Testnet Permissioned Domain lists accepted issuers; identity only, not KYC or quality. These observations do not gate payment. Before signing we use unsigned create simulations and a key-free ledger pre-check for writer finishes."

**Behind it:** [Identity/domain evidence](../evidence/writer-credentials-nov12/README.md), [X1c key-free finish guard](../evidence/dry-run-nov12/README.md). These current source features are later than the published v1.1.1 package.

### 15. Why does EscrowFinish cost 423 drops?

**Say:** "The fulfillment is a 32-byte key in a 36-byte encoded fulfillment. Our signer uses a 12-drop floor and the client formula 33 plus 36 divided by 16, rounded up: 423. In the recorded unsigned dummy probe, rippled autofilled 350 at a 10-drop base. We kept signing fees. The writer pays the finish; the buyer pays the create. The dummy result tecNO_TARGET named no actual escrow, so only fee autofill was measured."

**Behind it:** [Probe and current writer guard](../evidence/dry-run-nov12/README.md), B19. Simulation charged no fee and the dummy finish did not deliver anything.

### 16. How do I know your verifier isn't just agreeing with your agent?

**Say:** "There are two verifiers, written separately: TypeScript, and Python
using only the standard library. They agree on <!--f:vectors-->224<!--/f--> shared vectors, including
tampered amounts, issuers and refunds. For EscrowFinish, which has no
delivered_amount, they check the writer's trust-line balance change. With
`--ledger`, every check is a read-only lookup against s.altnet. Run it on any
receipt the app exports."

**Behind it:** [#377](https://github.com/Collaboration95/theFastandtheFungible/pull/377),
[#381](https://github.com/Collaboration95/theFastandtheFungible/pull/381),
[receipt-spec](../receipt-spec.md). Q21 explains the narrower browser key check; Q24 covers the recorded-run check without admission.

### 17. Why does `try` take 84 seconds? What if the faucet is down?

**Say:** "Most of it is npm install and faucet funding. The purchase itself is
seconds, then verification makes 12 read-only ledger lookups. We measured
<!--f:try_s-->84.2<!--/f--> seconds cold, and <!--f:try_misses-->2 of 4<!--/f--> cold
attempts overran our 90-second target, so we quote the number with that caveat. If the faucet fails, it prints
a labelled SIMULATED run and the reason. It never pretends."

**Behind it:** [round4-j2](../evidence/round4-j2/README.md) keeps the failed
attempts (`try-timeout*.json`) next to the passing ones.

### 18. Can the LLM be prompt-injected into spending?

**Say:** "It can be tricked into *recommending* a purchase, but it can't make
one. The SDKs and MCP tools have no purchase method. Policy code checks the
budget, the S$1 per-source cap, the daily cap and the per-agent allowance.
MCP caps are set by the operator in the environment, default to zero, and the
calling model can't raise them."

**Behind it:** #286 adversarial injection pack, `tests/purchase.test.ts`,
`mcp/policy.ts`. An injected abstract could influence which under-cap article is selected. It cannot increase authority or directly sign a payment. The browser key check proves the reveal, not relevance, truth or full coverage.

### 19. Does it actually buy the right things?

**Say:** "On 48 fresh synthetic questions, 93% of what we spent on articles
bought a fact that made it into the final cited answer. The interval is 81 to
100, so it's wide. That used live decision models on a fixture corpus with
simulated payments. And we can't claim it beat our previous policy: the gain
includes zero."

**Behind it:** exact sentence: "On 48 fresh synthetic questions, 93.15% of gross
article spend bought a requested fact retained in the final cited answer (95% CI
81.25–100.00%)." Waste 6.85% [0.00–18.75]; paired gain +3.08 pts [0.00–9.43].
Same-vendor labels await human review. Don't say "93% of facts" or
"production". 80.05% and 52.9% → 40.7% are historical.

### 20. Isn't that overfit to your own test set?

**Say:** "We worried about that. Our earlier 80% came from a holdout we'd seen
too often, so we dropped it. We audited every rule, removed a domain-specific
veto, then froze 48 new questions and the policy before one run each. It's
still narrow: the same agent wrote both, and the questions follow templates."

**Behind it:** [FRESH-AUDIT](../../eval/FRESH-AUDIT.md), #327.

---


### 21. What exactly does the browser key check prove?

**Say:** "It reads public EscrowCreate and EscrowFinish, requires validated success, checks owner and escrow sequence, extracts the lock and fulfillment key, and hashes the decoded key bytes. A match proves this escrow's key reveal. It does not certify quality, identity, fair price or the answer. Missing or unvalidated data is pending; unavailable is not a pass."

**Behind it:** [Key check](../evidence/key-on-ledger/README.md), `src/verify/key-on-ledger.ts`. It trusts public-node ledger data; the browser is not a full node. No wallet signing key is used. Two receipt verifiers were written separately by this project, not separate teams.

### 22. Does simulate guarantee payment success?

**Say:** "No. It is an unsigned ledger-snapshot check before our signature. Definitive tec, tem or tef refusals prevent buyer signing; unavailable or retry results retain the guarded buyer path. Writer finishes use a key-free pre-check, not simulation with the article key. State can change afterward, so we still require validated settlement."

**Behind it:** [Current X1c guard](../evidence/dry-run-nov12/README.md). Timeout, RPC failure and ter are unavailable, not authoritative refusals. Simulation cannot authorize spending or charge a fee. Writer-reported events are labelled. The old unsigned-finish exposure is fixed on main, with retained negative spy-test evidence.

### 23. What do the operator identity observations enforce?

**Say:** "Three team writers hold accepted XRPL Testnet Credentials from our operator issuer; a Testnet Permissioned Domain lists accepted issuers; identity only, not KYC or quality. These advisory observations do not change discovery, trust weights, budgets or who may be paid. A regulated launch needs a suitable verification issuer and separate compliance work."

**Behind it:** [Identity evidence](../evidence/writer-credentials-nov12/README.md), [current cache bounds](../writer-verification.md#x2b-local-latency-evidence-12-november-2026). Issuer, subject, acceptance, expiry and domain are read at the same validated hash. Five-minute cache; bounded stale reads, no instant-revocation claim. Credentials expire 30 Nov 2026 00:00 UTC. Hosted badges require configured and observed deployment.

### 24. Can I verify after using my questions, or while research is paused?

**Say:** "Yes, use the judges' corner to check a public recorded sandbox bundle without a research admission. It needs the static page, receipt file and reachable public node. Read passed and not-checked items separately. Offline tools can check signed bundle contents, but that is not a fresh ledger lookup."

**Behind it:** [Featured receipts](../evidence/hosted-export-nov12/README.md): one hosted run, 12 Nov, preset 2 at 09:07 SGT; 31.1 s, S$0.40, one article and no refund. Browser/TS 24 passed, 0 failed, 2 not checked/skipped; wheel 25/0/2; public Testnet 6/6 each. All five gates Held, with grant 1953 before reads 1954–1957. The 11 Nov export remains historical, with its original gate-1 gap. A missing transaction is pending, and network failure is unavailable. An HTTP 200 alone does not establish JSON or successful verification.

### 25. Why did you keep rule-based buying?

**Say:** "We measured it under the hosted allowance. In the capped follow-up, fixed rules completed six questions; OpenAI completed four and failed two under the decision-token allowance. Both bought five articles for S$2. There was no reliability case to switch before submission. The sandbox keeps live answers, rule-based buying. That is a choice under our limits, not universal model superiority."

**Behind it:** [LIVE-DEC evidence](../evidence/live-decisions-nov11/RESUMED.md), `second-resume/comparison.md`: local hosted-envelope measurement, simulated settlement, not a deployed Testnet A/B.

## Prepared presets

Use the exact questions from `shared/contracts/examples.ts`: RLUSD escrow, x402 payment,
and **How writers get paid**: “How does the writer get paid, and what stops the agent from
reading the article and then refusing to pay?” Historical reserves measurements keep their
original topic and date. [One paid answer](evidence/hosted-answer-nov12/README.md) has its own links.

## Curveballs

- **"Why S$, not XRP?"** People budget in their own currency. The ledger settles
  in drops, or TEST-SGD at 1:1, at a fixed and labelled demo rate. Real FX is on
  the mainnet list (#163).
- **"Who built it?"** A small team directing AI coding agents in parallel
  lanes. A PR merges only after the full local merge gate passes on its exact
  head. Every PR, release and decision is public.
- **"What's the pixel character?"** Our agent's head is the logo. It appears
  only in loading states, the README and the deck, and it acts out a real state
  (search, pay, key, verified, refund). It never replaces a receipt or a label.
- **"Can a writer cheat the escrow?"** The buyer grants only after a validated successful finish and matching key/proofs. That does not enforce article quality. Current source uses a key-free ledger pre-check; it rejects any unsigned simulate containing Fulfillment. The first key-bearing network request is the persisted signed finish submission. Public signed submission exposes the key before final validation, so later failure remains a risk. The escrow remains claimable with that key by anyone (the writer first) until CancelAfter. No-show recovery requires a validated EscrowCancel; quality refunds need the writer’s signature. [X1c evidence](../evidence/dry-run-nov12/README.md).

- **"Is the Mac app signed?"** Not yet: it's an unsigned DMG until we have a
  Developer ID. The zero-clone app is the path we recommend to judges.

### Key-reveal wording for excerpts

The article's key is the only thing that opens the writer's escrow. The app shows the article only after that escrow finish validates on the ledger, and once the key is public anyone (the writer first) can still claim the payment before the deadline.

A signed submission exposes the key before validation; anyone (the writer first) can still claim the escrow with that key until CancelAfter.
