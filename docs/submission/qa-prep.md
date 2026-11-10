# Judge Q&A prep

Each question has a **Say** (about 20 seconds aloud) and a **Behind it** with
the source. Counts are generated into [facts.json](facts.json) (as of
<!--f:as_of-->11 Nov 2026<!--/f-->); read this page rendered on GitHub, where the
markers that keep them in sync are hidden. Check the [tracker](../SFF-PUSH.md)
on 17 Nov for anything newer.

The questions are grouped by the three judges in our mock panels (round 4
scored 87.6 / 105): **R**, a Ripple DevRel / XRPL engineer; **P**, a payments or
fintech operator; **Y**, a YC-style partner. Their hardest questions come first.

## Numbers card (memorise these)

| Number | What it is | Label | Source |
|---|---|---|---|
| **<!--f:try_s-->84.2<!--/f--> s** | `try --testnet`: empty npm cache → six Testnet links → `RESULT PASS` | Testnet, fixture models, one Mac, 7 Nov; <!--f:try_misses-->2 of 4<!--/f--> cold attempts overran 90 s | [#387](https://github.com/Collaboration95/theFastandtheFungible/pull/387), [round4-j2](../evidence/round4-j2/README.md) |
| **<!--f:mcp_mb-->3.4<!--/f--> MB / <!--f:mcp_init_s-->6.3<!--/f--> s** | MCP package size / cold initialize (was 21.4 MB / 56.5 s) | local packed build, fresh npm cache | same |
| **<!--f:app_ready_s-->27.0<!--/f--> s** | zero-clone app ready (was 134 s) | same | same |
| **<!--f:fee_drops-->435<!--/f--> drops** | fees per key-reveal purchase (<!--f:fee_create-->12<!--/f--> create + <!--f:fee_finish-->423<!--/f--> finish) | Testnet, measured | [cost card](../numbers.md#testnet-cost-and-latency), [round3-a](../evidence/round3-a/README.md) |
| **894 drops** | all six UC3 transactions (two buys, refund, anchor) | Testnet, measured | [judge-path.md](../evidence/round4-l4/judge-path.md) |
| **S$0.00087** | fees per purchase at an assumed S$2.00/XRP | **projection**, not a quote | [cost card](../numbers.md#testnet-cost-and-latency) |
| **US$0.0026** | model cost per question | LIVE models, 48 fresh questions, 3 Nov | [scorecard](../numbers.md#synthetic-corpus-scorecard-3-nov) |
| **<!--f:transactions-->61<!--/f-->** | Testnet transactions on `/ledger/`, re-validated live from the browser (61/61 in 1.65 s when measured on 7 Nov) | read-only | [#388](https://github.com/Collaboration95/theFastandtheFungible/pull/388) |
| **12/12** | Testnet checks in `verify --ledger` on the README UC3 receipts | read-only, s.altnet | [#377](https://github.com/Collaboration95/theFastandtheFungible/pull/377) |
| **<!--f:vectors-->224<!--/f-->** | shared conformance vectors; TypeScript and Python agree on all | offline | [#381](https://github.com/Collaboration95/theFastandtheFungible/pull/381) |
| **<!--f:writer_s-->33.9<!--/f--> s** | `init` + `publish`: Markdown folder → writer Credential validated on Testnet | generated starter note, public faucet, one measurement | [#389](https://github.com/Collaboration95/theFastandtheFungible/pull/389) |
| **0** | gate-audit violations: 10 runs, 568 observations | fresh-set eval, simulated payments, 3 Nov | [scorecard](../numbers.md#synthetic-corpus-scorecard-3-nov) |
| **93.15%** | gross article spend that bought a fact in the final answer (CI 81.25–100.00) | LIVE decisions, fixture research, simulated payments | [fresh-results.json](../../eval/scorecard/fresh-results.json) |
| **<!--f:prs-->236<!--/f--> / <!--f:releases-->13<!--/f-->** | PRs merged into `main` since <!--f:since-->21 Sep<!--/f--> / published releases | counted at <!--f:sha-->1e2958ce<!--/f--> on <!--f:as_of-->11 Nov 2026<!--/f--> | [facts.json](facts.json), [progress page](https://collaboration95.github.io/theFastandtheFungible/progress/) |
| **Held-out <!--f:heldout-->16/20<!--/f-->; <!--f:offtopic-->0/10<!--/f--> off-topic buys** | <!--f:heldout_line-->v5 blind held-out: 16/20 bought and cited, 0/10 off-topic purchases (run once, 11 Nov; fixture decision model, team-authored writers, XRPL Testnet)<!--/f-->; the key fact leads the answer in <!--f:answers_it-->7/20<!--/f-->; 0 gate violations. Dev (not held-out): v1 <!--f:dev_v1-->16/20<!--/f-->, v3 <!--f:dev_v3-->7/20<!--/f--> | as stated | [evidence](../evidence/v4-heldout/README.md) |
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

**Say:** "Three kinds, and we label each one. The research writers in the demo,
like Kestrel and AlphaLeak, are fictional. A team-authored writer is our own
real build notes about XRPL and x402, labelled as ours and not independent.
Independent writers: none yet. That list is empty until a real person consents.
What we can show is that a Markdown folder becomes a Testnet writer with an XRPL
Credential in about <!--f:writer_s-->33.9<!--/f--> seconds."

**Behind it:** `docs/evidence/real-writers.json` is empty by design. The
team-authored label is "team-authored · real content · not an independent writer
· Testnet" (J1, #390). Writer onboarding: [round3-c](../evidence/round3-c/README.md);
first-try `init` + `publish` is <!--f:writer_s-->33.9<!--/f--> s (J3, #389).

### 3. I asked my own question. What happens?

**Say:** "It can buy and cite our labelled team notes. With fixture models on
Testnet, <!--f:heldout_n-->sixteen<!--/f--> of <!--f:heldout_N-->twenty<!--/f-->
blind held-out questions were bought and cited, and on
<!--f:offtopic_N-->ten<!--/f--> off-topic questions it bought nothing. The key
fact leads the answer in <!--f:answers_it-->7/20<!--/f-->. If policy declines the available articles, it buys nothing, and
the decline now lists each policy reason in 'Why'. Discovery does not guarantee
a purchase. Development sets, which we tuned on, are separate: v1
<!--f:dev_v1-->16/20<!--/f--> and v3 <!--f:dev_v3-->7/20<!--/f-->."

**Behind it:** [v4 evidence](../evidence/v4-heldout/README.md): <!--f:heldout_line-->v5 blind held-out: 16/20 bought and cited, 0/10 off-topic purchases (run once, 11 Nov; fixture decision model, team-authored writers, XRPL Testnet)<!--/f-->; answers-it <!--f:answers_it-->7/20<!--/f-->, <!--f:heldout_violations-->0<!--/f--> gate violations. Run once on `main` `bdc30f97`, fixture decision model at threshold 0.20, team-authored writers, Testnet. v4 is now used; a new held-out claim needs a new blind bank (v5). Dev, not held-out: v1 16/20, v3 7/20 (answers-it 4/20 after #410); v2 is observed dev data. DONE Testnet abstentions are anchored (#403), so every DONE run verifies. Policy misses remain: 13 of 20 held-out questions did not end in a cited purchase. This is fixture-model mechanism evidence, not live-model answer quality.

### 4. Who pays for this, and who is writer number one?

**Say:** "Demand: anyone running an agent that needs facts behind paywalls,
through Claude Code, any MCP client, our SDKs, or other agents hiring ours over
x402. Supply: any expert with a Markdown folder. They keep a free version and
sell the deep one per read, with no Stripe account, just an XRPL address. We
have no customers or pilots yet. Writer number one is us, labelled, and the
next are people who consent."

**Behind it:** no traction claims. [mcp.md](../mcp.md), [sdk.md](../sdk.md),
[hire-274](../evidence/hire-274.md).

### 5. How is this different from other agent-payment projects?

**Say:** "Most show that an agent *can* pay. We focus on whether it *should*,
and on what happens when the seller lies. The model never holds spending
authority. The writer is paid only by publishing the key on the ledger. Every
receipt can be re-checked by a verifier that isn't ours, in a language that
isn't ours."

---

## P · the payments operator

### 6. What are the unit economics?

**Say:** "Network fees are <!--f:fee_drops-->435<!--/f--> drops per key-reveal
purchase, <!--f:fee_create-->12<!--/f--> to create and <!--f:fee_finish-->423<!--/f--> to finish, because the finish carries the key. That is about S$0.0009 at an
assumed two dollars per XRP. The answer anchor is 12 drops, and a Testnet run that
buys nothing is anchored too. Models cost about a quarter of a US cent per question.
Writers set article prices, S$0.10 to S$0.90 in our corpus, capped at S$1 per
source. So the real cost is buying the wrong article, and that's what we
measure."

**Behind it:** README cost card (Testnet, measured; the S$ row is a projection).
The full UC3 run is 894 drops for six transactions. Hire mode: the caller pays
the budget plus a 20-cent service fee, a quarter of which goes to cited writers
as royalties ([hire-274](../evidence/hire-274.md)). S$ to drops is a fixed,
labelled demo rate, not FX (B11).

### 7. Why TEST-SGD and not RLUSD?

**Say:** "Official RLUSD payments do work on Testnet: on 3 November a writer was
paid 0.90 RLUSD and a broken promise was refunded. But RLUSD can't go into a
token escrow yet. The network has TokenEscrow enabled, but the RLUSD issuer
account doesn't have the AllowTrustLineLocking flag. So we issued our own
Testnet token, TEST-SGD, to prove the key-reveal escrow end to end, and we
label it as a stand-in everywhere. When Ripple sets that one flag, it's a config
change."

**Behind it:** [rlusd.md](../evidence/rlusd.md) (official RLUSD, faucet 401
worked around by bounded Testnet DEX provisioning).
[BUILDER-FEEDBACK §1](../BUILDER-FEEDBACK.md#1-issuer-permission-blocks-rlusd-escrow):
flags 2174353408 at ledger 22058675; the refusal is predicted, never submitted.
TEST-SGD evidence: [#381](https://github.com/Collaboration95/theFastandtheFungible/pull/381),
[m1-iou](../evidence/m1-iou/README.md). No peg or backing claim.

### 8. What's simulated, what's substituted, what's real?

**Say:** "Real: every hash in the deck and the video is a validated XRPL
Testnet transaction you can click. That covers escrows, refunds, anchors,
TEST-SGD, writer credentials and the hire chain. Simulated: the offline app and
Mac app use a labelled simulated rail, and our quality evaluation simulated its
payments. Fixture: the decision and research models in the Testnet demos.
Fictional: the research writers. Substituted: TEST-SGD for RLUSD. The app shows
one environment indicator, and every receipt carries its label."

**Behind it:** hard gate 5; `scripts/gate-audit.ts` rule `missing_rail_label`.

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

**Say:** "Nobody on the ledger, and we say so. Key reveal makes *delivery*
atomic: no key, no payment, and if the writer never reveals, the escrow cancels
and the principal comes back. But if the article breaks its promise after the
key is out, the refund is a payment the writer signs. Our test writer
cooperates; a real one could refuse. Then the buyer has a fraud proof anyone can
verify, and the writer's trust score drops."

**Behind it:** [#379](https://github.com/Collaboration95/theFastandtheFungible/pull/379);
the refund row reads "Refund · writer-signed · fixture writer cooperates (a real
writer could refuse)". Hashlock is not fair exchange (B17).

### 11. A payment times out, or the server crashes mid-payment?

**Say:** "We store the signed transaction before sending it, so a restart
reconciles the same hash and never signs twice. A missing transaction is
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
checklist. The top one is the RLUSD issuer flag."

**Behind it:** <!--f:feedback_line-->7 ranked findings with runnable repros · 35 numbered findings (B01–B35) · 15 September submissions (4–5 Sep) · 8 upstream drafts, 0 filed<!--/f-->.
[BUILDER-FEEDBACK](../BUILDER-FEEDBACK.md), [upstream drafts](../feedback/upstream/),
[filing kit](../feedback/upstream/FILING-KIT.md). Filing is owner-only (#265 B1).
Once filed, the count above changes by itself; then say "Yes, N, on <date>" and
show the links in BUILDER-FEEDBACK's top-7 table.

---

## R · the XRPL engineer

### 14. Why XRPL?

**Say:** "Four native features we'd otherwise need contracts for. Escrow with a
crypto-condition carries the article key. Token escrow lets that work in a
stablecoin. InvoiceID and memos bind each payment to its quote. Credentials
identify writers. Fees are drops and ledgers close in seconds, which is what
makes paying per article viable. There's no contract to deploy or audit."

### 15. Why does EscrowFinish cost 423 drops?

**Say:** "Because the fee scales with the fulfilment size, and our fulfilment
is the 32-byte article key wrapped as a preimage condition. Create and cancel
are 12 drops. It's the same for XRP and for the token escrow. We logged it as
builder feedback, because base-fee examples understate it."

**Behind it:** B19; [round3-e/xrp-fee.json](../evidence/round3-e/xrp-fee.json).

### 16. How do I know your verifier isn't just agreeing with your agent?

**Say:** "There are two verifiers, written separately: TypeScript, and Python
using only the standard library. They agree on <!--f:vectors-->224<!--/f--> shared vectors, including
tampered amounts, issuers and refunds. For EscrowFinish, which has no
delivered_amount, they check the writer's trust-line balance change. With
`--ledger`, every check is a read-only lookup against s.altnet. Run it on any
receipt the app exports."

**Behind it:** [#377](https://github.com/Collaboration95/theFastandtheFungible/pull/377),
[#381](https://github.com/Collaboration95/theFastandtheFungible/pull/381),
[receipt-spec](../receipt-spec.md).

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
`mcp/policy.ts`.

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
- **"Can a writer cheat the escrow?"** Not on delivery: no key, no payment, and
  a no-show escrow cancels back to the buyer. On quality, see question 10.
- **"Is the Mac app signed?"** Not yet: it's an unsigned DMG until we have a
  Developer ID. The zero-clone app is the path we recommend to judges.
