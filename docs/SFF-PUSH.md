# SFF push: tracker and changelog

The single running record for the SingHacks finals push: submit **Fri 13 Nov morning**
(official deadline 13 Nov, 23:59 SGT), pitch at SFF on **Wed 18 Nov, 11:30 SGT**.
How we're scored: [JUDGING-CRITERIA.md](JUDGING-CRITERIA.md). The October design
record stays in [FINAL-PUSH.md](FINAL-PUSH.md).

**Agents:** read this first if you need a starting point. Update it when you ship
something significant: a feature, a metric move, a finished deliverable. Don't
add an entry for every small fix. One line per item, newest day first; link the
PR or issue.

- 12 Nov: UI-A fixes cancelled-payment counts, empty-free-evidence copy, personal/demo sales scope, the composer’s recorded-run Verify entry, wrapping provenance disclosures and plain-language Verify results; 1280/390 px axe checks have no serious/critical violations and initial JS is 158,782 B gzip. [Evidence](evidence/ui-a/README.md).
- 12 Nov: UI-B labels every recorded answer with fixture/fictional provenance and its own payment rail, aligns title/header dates to the run timestamp, reserves separate 44 px phone targets, and closes the drawer after New question/history navigation; 8 replay tests and zero serious/critical axe issues at 1280/390. [Evidence](evidence/ui-b/README.md).
- 12 Nov: SB-FIX separates empty stopped runs from missing answer/payment anchors in the sandbox scoreboard and gives its anonymous stats route one 60-second public cache policy through both proxies; sessions and other API routes retain no-store.
- 12 Nov: DEPLOY-4 deploys G1-TEL and features one hosted preset-2 run with all five browser gates Held (grant 1953 before reads 1954–1957): 31.1 s, S$0.40, one article; published v1.1.1 wheel 25/0/2 and TS/browser 24/0/2, Testnet 6/6. Retains the 11 Nov export and adds a five-gate regression; no site publication. [Evidence](evidence/hosted-export-nov12/README.md).
- 12 Nov: G1-TEL records one hash-only paid-read event per released passage after its verified grant in the anchored audit chain; fresh receipt exports show gate 1 Held, both published v1.1.1 verifiers pass, and historical exports stay unchanged. [Evidence](evidence/g1-tel/README.md).
- 12 Nov: P5 adds five computed gate rows inside Spend’s collapsed run checks, with audit sequence references and verbatim labels; historical exports honestly leave paid-read order unchecked. Hosted/UC3 tamper isolation, lazy loading, 1280/390 px layout and axe checks pass. [Evidence](evidence/p5-gates/README.md).
- 12 Nov: P4 adds a public, cookieless sandbox scoreboard with 60-second aggregate caching, recorded gate-violation counters, honest missing-trace/pending-anchor counts, latency and unit-cost medians; opens from the judges’ corner without spending a question. [Local synthetic acceptance evidence](evidence/p4-scoreboard/README.md).
- 12 Nov: FIN-FINAL refreshes the judge pack around browser key checks, recorded unsigned RLUSD verdicts, accepted Testnet identity, an explicit integrator-market hypothesis and HOSTED-12’s same-run answer/cost card; model cost is unmeasured, final hosted screenshots/PDF follow redeploy ([#506](https://github.com/Collaboration95/theFastandtheFungible/pull/506)).
- 12 Nov: LABELS9 makes Show work use one plain-language trace map: guard and allowance substitutions stay explicit and neutral, real failures stay warnings, keyword search no longer reads like an outage, and policy verdicts use words. All team promise labels checked; 1280/390 px screenshots and zero serious/critical axe violations in [fixture evidence](evidence/labels9/README.md).
- 12 Nov: L12R applies the routed hosted/key/credential presentation edits and adds a cross-surface drift guard for fonts, heading weights, environment labels, money, hashes and Singapore dates; local screenshots and axe evidence in `docs/evidence/l12r/`.
- 12 Nov: VID-3 pins the video kit to published v1.1.1, adds local browser key/corner/credential proof and recorded unsigned ledger verdicts, and supplies the final owner voice text; media stays in video-out, hosted-URL footage is record after redeploy.
- 12 Nov: T3 replaces the reserves preset with “How writers get paid”: three fresh local HOSTED=1 live-DeepSeek asks each buy one S$0.40 explainer through real Testnet key-reveal escrow and pass browser verification with zero failures; x402 and RLUSD each retain one purchase in two fresh runs. Reserves remains answerable. [Measurements](evidence/t3-presets/README.md).
- 12 Nov: M1 makes proof pages and downloaded cards label recorded buying and answer provenance; old snapshots make no answer-source claim, and receipts stay compatible with v1.1.1.
- 12 Nov: HOSTED-FIX shows all three team writers to a fresh visitor, checks their signed catalogue wallets against the cached XRPL Credential domain independently of run history, and redirects hosted `/demo` and `/demo/` to the published replay. Open Records keeps its synthetic-content label.
- 12 Nov: DEPLOY-FIX defers receipt, Show work, passage, Writers and conversation code; Node 22 initial JS gzip falls 170,326 → 159,261 bytes. Production builds and deploy now share the unchanged <170,000-byte check; startup accepts only a 64-hex writer credential domain. [Evidence](evidence/deploy-fix/README.md).
- 12 Nov: RUNBOOK adds the [owner's judge-week checklist](judge-week-runbook.md), incident commands and rollbacks, S$40 cap recovery, editable links, pitch fallbacks and owner-decided teardown; a regression test checks every Node script and Make target reference.
- 12 Nov: DECLUTTER puts examples before one grouped judges/builders disclosure, keeps successful payment proof and run checks inside Spend, and restores the paired delivery/ledger promise with a simulated variant. Whole-page boxes (desktop/mobile): home 7/5 → 3/3, one-purchase 3/2 → 2/1, ledger-topic 4/3 → 2/1; proof retained, failure/refund details open. [Evidence](evidence/declutter/README.md).
- 11 Nov: The hosted judge demo has a hard spending cap: a S$40 (about US$30) project budget with email alerts at 25–100%. When actual spend reaches it, a Pub/Sub-triggered function stops the VM. The VM also stops itself at 00:30 SGT on 20 Nov. Expected spend for 10–20 Nov is about US$22–24. [Spending cap](hosted-web.md#spending-cap-owner-request-11-nov).
- 12 Nov: MJ10-FIX makes why-bought say “Bought to fill” unless saved coverage cites the purchased article, requires the prepared key transaction for live stage tiers, and rejects empty, unreadable or wrong-signature deck/video files; no playback claim. Follow-up to [KEY #480](https://github.com/Collaboration95/theFastandtheFungible/pull/480); [stage requirements](stage.md).
- 12 Nov: X2b prewarms writer identity and refreshes in the background; cold reads show “check pending” after 300 ms, stale reads stop after ten minutes beyond TTL. Local HOSTED=1 preset search p95 across synthetic forced expiry: 3022/3015/3010 → 9/11/10 ms; [bounds and evidence](writer-verification.md#x2b-local-latency-evidence-12-november-2026).
- 12 Nov: X1c keeps the article key private until signed EscrowFinish submission: a read-only ledger pre-check replaces finish simulation, the RPC wrapper rejects simulate with Fulfillment, and spy tests cover refusal and recovery. Buyer simulations and gate-audit remain unchanged. [Evidence](evidence/dry-run-nov12/README.md).
- 12 Nov: LEDGER adds a separate read-only ledger card for RLUSD escrow, reserves and fees, a public-node fee/timing/reserve-release line per key-reveal purchase, and shared-payer counts in the judges’ corner. Both recorded XRP and TEST-SGD pairs match real s.altnet reads; 390 px has no overflow or serious/critical axe violations. [Evidence](evidence/ledger-check/README.md). [PR #490](https://github.com/Collaboration95/theFastandtheFungible/pull/490).
- 12 Nov: L12 unifies money (2 dp), hashes (8…8), SGT dates and environment copy; receipts bridge SGD to XRP. Every replay link opens its run under 100 px chrome; only the selected recording loads, with shared fonts and lossless packing. Local screenshots, accessibility and mobile performance: [L12](evidence/l12/README.md).
- 12 Nov: L3 brings the shared proof page into the house style: self-hosted Geist, sentence-case captions, app tokens and control borders, a valid button font, 8…8 hashes and the canonical hosted label; downloaded cards stay offline. [Evidence](evidence/l3-proof-style/README.md)
- 12 Nov: A11Y: slow status keeps the hosted connecting screen; keyboard focus follows Ask, the plan and receipt checks; reconnect clears stale offline notices, verifier errors distinguish offline from an unreachable XRPL node, DONE warms the checker, and app phone controls have 44 px hit areas (local hosted fixtures; no hosted questions). ([PR #487](https://github.com/Collaboration95/theFastandtheFungible/pull/487))
- 12 Nov: X2 gives Build notes, XRPL explainers and Open Records accepted operator-issued Testnet Credentials; a pinned Permissioned Domain supplies the identity allowlist with a five-minute cache, explicit identity-only labels and credential/domain links. Local hosted evidence only; VM env/redeploy stays with the orchestrator. [Evidence](evidence/writer-credentials-nov12/README.md).
- 12 Nov: QUAL/P1 makes the presets answer first: sourced RLUSD status and reserve figures, x402 Testnet terms, two DevRel explainers, capitalised conclusions, clearer partial leads, fewer redundant purchases and one evidence-based coverage judgment across the checklist, gaps and trace (MJ10 H10-01/02/03/04/05/07). Local live-planner acceptance: each preset twice, one S$0.40 article per ask; fixture decisions and simulated settlement. [Evidence](evidence/qual/README.md).
- 11 Nov: X1b adds unsigned rippled dry runs before policy signatures, strict writer reveal timing and a five-ledger finish window; the live Testnet try passes with five Show work events and published v1.1.1 verifiers, median added signing time −225 ms per purchase (two purchases); [evidence](evidence/dry-run-nov12/runtime.md), following [X1a #479](https://github.com/Collaboration95/theFastandtheFungible/pull/479).
- 11 Nov: KEY: a payment card can now **prove its own key, with no help from our server**. "Check the key yourself" fetches the writer's EscrowFinish and the EscrowCreate from a public XRPL Testnet node, reads the lock (Condition) and the key (Fulfillment), and computes sha256(key) = lock with WebCrypto in the visitor's browser ("computed in this browser from XRPL Testnet ledger N"). A tampered key says "doesn't match" with no ✓, a node that has not got the transaction yet says "Not found on this node yet" (pending, never failed), and no reachable node says so; it needs no new route and works on the hosted demo, the local app and the /demo/ replay. Each payment also says in one line (≤ 90 characters) why policy bought it, adding "Refunded: writer-signed" after a refund, and Show work says "Ran the plan you confirmed ✓" only when the run's recorded searches equal the plan confirmed in the 5 s card, otherwise what changed. Real check: the committed hosted export's pair (create `B6FDBD22…`, finish `4CCB4E56…`) and both replay escrows match on s.altnet. [Evidence](evidence/key-on-ledger/README.md) ([PR #480](https://github.com/Collaboration95/theFastandtheFungible/pull/480))
- 11 Nov: JC adds the judges' corner: re-check a committed hosted run without using a question, open its EscrowFinish and optionally a proof of refusal, even while paused. Builder commands pin published v1.1.1; decline, writer and retention copy is explicit. The stage kit checks the fallback tier without asking a question and serves an offline replay on an ephemeral port. [Evidence](evidence/judges-corner/README.md), [stage run sheet](stage.md).

- 11 Nov: X1a records unsigned rippled RLUSD refusals on Testnet and Mainnet, a matched TEST-SGD success, and the 350-drop minimum versus our unchanged 423-drop writer fee; [evidence](evidence/dry-run-nov12/README.md).
- 11 Nov: LIVE-DEC: **DON'T SWITCH** the hosted demo to live OpenAI Decisions yet. Fixes the hosted meter adding an unsupported output-token parameter. Completed capped comparison: fixture 19/19 DONE vs live 6/19 (8/9 live presets fail on the input allowance); right article first 18/18 vs 17/18, complete leads 7/18 vs 6/18; 0/10 off-topic purchases per arm, plus historical direct-planner negatives 0/20. Fresh paired recheck confirms failures and the receipt decision-label omission. Conservative whole-lane OpenAI bound below US$1.71; raw JSON under 2 MB and secret-scanned. [Evidence](evidence/live-decisions-nov11/RESUMED.md) · [PR #481](https://github.com/Collaboration95/theFastandtheFungible/pull/481)

- 11 Nov: FIN-prep refreshed the judge pack for v1.1.1: README, submission copy, video words, deck HTML/PDF and site agree on rule-based sandbox buying, two team-authored writers, writer-signed refunds and the v5 scope (fixture research and decision models, answers written offline, Testnet). Facts and /progress/ now count 270 merged PRs and 15 releases at `bd52beff`. The published v1.1.1 CLI passed a fresh Testnet buy/refund/re-buy/anchor run (59.2 s, 12/12 ledger checks); its Python wheel passed the committed hosted export (46 passed, 0 failed, 2 skipped, ledger 11/11). All 22 pinned release URLs resolve through authenticated `gh`, now checked before site publication. The 14-page PDF was regenerated; hosted screenshots remain the earlier recorded run, awaiting the orchestrator's redeploy and final refresh. The explainer site now uses local Geist/Geist Mono, 600-weight headings, canonical green Testnet labels, working replay links and one October Archive link; before/after home captures at 1280 and 390 are committed. One swap-enabled font source removes duplicate Geist loading; footer links have 44 px tap areas. No site publication. Evidence: [v1.1.1 judge pack](submission/evidence/v1.1.1/README.md).
- 12 Nov: H7 bounds cookieless session floods, refreshes hosted readiness in the background, treats full queues as healthy busy states, permits planning while runs wait, and adds state-disk links, a branded paused page and a 30 XRP payer alert; adds per-frame SSE gzip/1 s hosted snapshots, immutable front assets and a separate 15-plan allowance so cancelled plans preserve the five questions; local fixture/simulated proof only, no deployment. [Evidence](evidence/h7/README.md).
- 11 Nov: **v1.1.1** (REL2): the round-9 fixes ship as a release (R9-A first click and confirmed plan, R9-B receipts always verify, R9-C product questions, H6 no false "paused"). Every install and verify line pins v1.1.1; the zero-clone MCP's writers line names team-authored sources as team-authored instead of always saying "fictional writers"; the CHANGELOG v1.1.0 purchase claims now say they were measured with the fixture planner. Publication requires the full gate, chaos, the isolated soak and five clean consumers on unchanged budgets ([release](https://github.com/Collaboration95/theFastandtheFungible/releases/tag/v1.1.1)). The first dry run was refused on soak memory (slope 6.81, median growth 132 MiB); v1.1.0's own code failed the same budget on a rerun. The cause was the soak harness re-serialising its growing report inside the measured process; it now appends one line per ask, and three runs sit at slope 1.25–1.57 and 23–38 MiB on the same budgets ([evidence](evidence/soak-nov11b/README.md)).
- 11 Nov: R9-C: it answers questions about itself. Three team-written product explainers (how it decides what to buy, how the writer gets paid through key reveal, what a writer earns per sale) mean the judges' B5, C1 and C4 each buy one article (S$0.40) and lead with the answer; C1 had bought 2–3 articles (S$0.80–1.20) with no answer, because the topic check counted "pay", "paid" and "payment" as different words. Off-topic chat (a recipe, the Sun, a haiku) gets one fixed redirect line; Writers says "None yet" and how a sale appears when a visitor has bought nothing, plus a demo-wide sales count on hosted. Development banks (fixture models, used data, not held out): no lost result, 0 negative purchases, v5 buy-and-cite 19 → 20, UC1–UC3 and presets identical. [Evidence](evidence/r9-c/README.md)
- 11 Nov: H6 fixes the hosted demo showing **"paused" while nothing was paused**. The packaged guard checked HG before every request, with a 1.5 s timeout. When HG's readiness refresh (two Testnet round trips from Singapore) ran slow, visitors and the `/ready` uptime check got the paused page: 11 live visitor 503s on 11 Nov, and the check failed about once a minute. Each cookieless probe also minted a session, 3,530 of HG's 5,000 by 13:00 SGT. The guard now qualifies HG once per Host and re-checks in the background, still failing closed on any non-hosted, broken or silent API. Its probes use its own session, and a deploy restores the 60 s uptime check. Local load at the live cadence (6 visitors, 180 s): 18 → 0 paused answers, 42 → 12 sessions minted. The operator pause still pauses. Same PR: free-only Open Records gets its own signing seed in the deploy plan, so R9-B does not drop its free sources. [Evidence](evidence/h6/README.md)
- 11 Nov: R9-A makes the first click right on the hosted demo's live-planner path.
  - **RLUSD preset:** 1 article (S$0.40, was 3 for S$1.20), leading with AllowTrustLineLocking.
  - **Other judge questions:** the fee question buys the drops note first and leads with "423 drops"; "Which XRPL validators are run by Singapore banks?" buys nothing; "writer never reveals the key" buys only the no-show article and leads with EscrowCancel.
  - **Confirmed plan runs:** the hosted run now uses the plan the visitor confirmed in the 5 s modal and records it as a PLAN event (it re-planned in 8/8 round-9 runs).
  - **Presets:** the x402 402 question is now the first preset.
  - **Measurement:** the round-9 judges' recorded live plans replayed offline, plus a local hosted stack with the live planner. Development banks (fixture models, used data, not held out): no lost result, lead answers v3-dev 8 → 9, 0 negative purchases, UC1–UC3 unchanged. [Evidence](evidence/r9-a/README.md)
- 11 Nov: R9-B: exported receipts always verify, and a paid run with no answer says so. Judge B's "writer never reveals the key" question had shown "6 of 34 checks failed" in Verify on XRPL (and `RESULT FAIL` in the v1.1.0 wheel): the hosted Open Records writer has no signing key, so its free articles arrived without a signed proof and were still read and exported. A free source without its writer-signed proof is now dropped like a failed read, so it is never cited or exported; no verifier check changed. The same run shape now passes the **published** v1.1.0 wheel and TS CLI (pre-fix export: 19 failures), and release admission requires a new hosted export that reads unsigned fictional free sources (`fixture-unsigned-free`). Judge V's C1 (paid S$0.80, no answer) now reads "Bought 2 articles; neither gave a citable answer to this question." under "Why there’s no answer", with a labelled notice and its reason (`MODEL_FALLBACK` carries `guard/timeout/http/cap/invalid`; C1's was the topic guard, not a model outage). "Still unanswered" no longer repeats what the lead answers, and the proof page chip says "rule-based buying" instead of "fixture models".
- 11 Nov: VID-2 re-records the whole **demo video** on v1.1.0 (`3157fe41`): live-model hosted footage with no fallback notices on the x402 question (one purchase, anchor resolves, verify "26 passed · 2 not checked"), shot 3b (proof of refusal) back on with an off-topic decline now that "Publish proof page" works (#462), Claude Code + MCP, `try --testnet`, the Python verifier and the ledger all re-captured from the v1.1.0 release; the cut is 2:55 with 3b. Recorder fixes (verify wording, anchor wait, no npm notice) and the owner's "before you record the voice" list are in the [video kit README](submission/video/README.md#state-second-pass-11-nov).
- 11 Nov: SOAK unblocks the v1.1.0 release soak without touching a budget or the baseline. It found the miss was not "heap warm-up" or host load: (1) the soak harness rewrote its whole 5–7 MiB report after every ask, growing native memory in the measured process for 4,000 asks without a plateau; it now checkpoints every 5 s; (2) K4–R8 relevance checks re-scanned the glossary for the same question once per candidate, passage and sentence, and re-verified the same writer signatures on every free read, doubling the engine's loop p99. Caching per exact text (3.3 M old-vs-new checks, 0 differences) brings a 4,000-ask soak to slope 1.88/5, median growth 52/100 MiB, loop p99 42/50 ms (before 4.60, 145, 71.4). The zero-clone app answers an oversize upload with 413 instead of an EPIPE. [Evidence](evidence/soak-nov11/README.md)
- 11 Nov: R8-A3 closes R8-A2's three follow-ups. "Which XRPL amendment lets escrows hold issued tokens?" now buys the TokenEscrow (XLS-85) article first: keyword search did not fold plurals, so "escrows" never matched "escrow" (the article ranked 8th in its writer's hits, now 1st). "EscrowFinish vs EscrowCancel" now leads with a cited sentence answering one side, not an empty slot. A plural "which transactions" question buys the named transaction references, not the generic explainer. Development banks (fixture models, used data, not held out): no lost result, lead answers v5 16 → 17, 0 negative purchases, unchanged spend, UC1–UC3 and presets identical. [Evidence](evidence/r8-a3/README.md)
- 11 Nov: R8-A2 closes R8-A's leftovers. "Which XRPL amendment and issuer flag does token escrow need?" now buys the TokenEscrow (XLS-85) article instead of the generic escrow explainer: a sibling transaction name the question never says (EscrowCreate, CredentialDelete) no longer adds ranking weight. A further purchase must add part of the requested fact, so the escrow-condition question buys 1 article instead of 3 and the Credentials question buys 2 instead of 3, never CredentialDelete. Development banks (fixture models, used data, not held out): buy-and-cite unchanged, lead answers v3 17 → 18 (others unchanged), 0 negative purchases, articles per purchase run v5 1.68 → 1.26 and v3 1.65 → 1.45, UC1–UC3 and presets identical. [Evidence](evidence/r8-a2/README.md)
- 11 Nov: **v1.1.0** (REL): receipts exported from the live sandbox verify with the published tools again (v1.0.2 said `FAIL anchor binding`); every verify line pins v1.1.0, the release tgz gains `researchagent-mcp verify`, and release admission now requires the packed wheel and TS CLI to verify fresh `HOSTED=1` exports and a committed real hosted export. README hero and deck slide 10 are a live hosted XRPL key-reveal run; verifier output says "Skipped" in plain words; MCP claims drop `[1]` markers. [Evidence](evidence/hosted-export-nov11/README.md).
- 11 Nov: R8-B fixes the round-8 answer-view misses: the lead slot never shows an apology, a cut-off "U.S." sentence or a lowercase fragment (and says so plainly when the sources give no one-sentence lead), notices give the server's true reason, a waiting visitor is told how many questions are ahead and for how long, Writers puts the team first and folds the fictional writers, proof of refusal is offered only for a real refusal and says why when it can't be shared, and the proof page counts "N passed · K not checked" in SGT. Evidence in [evidence/r8b/](evidence/r8b/).
- 11 Nov: HA adds a guarded **automatic resume after an unplanned VM restart** of the hosted judge demo: an operator's whole-service `resume` records the qualified release on the state disk, and a restart of that same release that was running (or only boot-paused) comes back by itself once `/startupz` and `/readyz` have been healthy for 60 s, through the same `hosted-control resume --local`. A new commit, any operator or money pause, an expired control or an unhealthy API stays paused with one plain journal line saying why; a redeploy still ends paused until the manual resume after its smoke. Unit and runner tests cover every case; the VM drill is with the orchestrator. [Runbook](hosted-web.md#if-the-vm-restarts-by-itself).
- 11 Nov: R8-A fixes the round-8 judges' top miss: "What does an x402 402 response contain…?" now buys the article titled with that question (it had bought a Testnet server list instead), a trailing "on Testnet" no longer outranks the subject, and the fee question finds its fee article. The spending guard rejects purchase instructions, not the user's own payment words (it had discarded every live plan for a question saying buy/pay/purchase), and the plan label names the true reason. Product questions route to research, and "What are you?" gets one fixed, reviewed statement. Development banks (fixture models, used data, not held out): buy-and-cite and lead answers unchanged, 0 negative purchases, articles per purchase run v3 1.90 → 1.65, UC1–UC3 identical. [Evidence](evidence/r8-a/README.md)
- 11 Nov: VID builds the **demo video kit** (`docs/submission/video/`, `scripts/video/`): a one-command recorder (Playwright at 1920×1080 for the hosted app, the replay, `/ledger/` and GitHub; real `claude` + MCP, Python verifier and `try --testnet` sessions captured in tmux and drawn to video), captions with an on-screen label for every Testnet/replay/local source, a synthetic-voice draft cut and a no-voice cut with timing marks (about 2:39, 8 shots); the owner only records the voice (#265 A4). Hosted footage shows the planner/model fallback notices and the hosted "Publish proof page" failed twice, so the refusal shot is off until fixed. Re-record: `make video-record`, `make video-assemble`.
- 11 Nov: H5 audits the **live hosted demo** (11 live questions, 1440/390) and fixes what it found: every paid answer had fallen back to offline extracts (streamed DeepSeek calls were metered at their worst case, so the third call hit the per-question cap); the chip now says purchases are rule-based (fixture decision model) instead of "live models"; leaked event streams no longer 429 a visitor; a chat reply or cancelled plan no longer blocks the next question; cancelled escrows aren't counted as bought; no proof of refusal on a Free question. Evidence in `evidence/h5-hosted/`; live after the next redeploy
- 11 Nov: FIX-C refreshes the judge pack: the default replay is re-recorded on XRPL Testnet from current main (11 Nov, six validated transactions, Python verifier 61/0/2 with ledger; evidence in `evidence/replay-nov11/`), its header is one row with a scenario picker, and the README hero and deck slide 10 are re-shot from that replay in the current app. The site nav is six pages plus GitHub and "Try it live" (a menu below 940 px, secondary pages in one generated footer), "How it works" opens on key reveal with the October run under its own heading, environment pills read "Testnet · test funds" on the site and deck, and the README badge row and try line no longer clip. The "we went from 26 weeks" lead and S27's corpus sentence stay: fixing them means re-embedding two fictional articles, and every Cloudflare token returned 401 on 11 Nov.
- 11 Nov: FIX-A clears the judge-visible rough edges the 11 Nov sweep found in the web app: one counting rule ("Paid for 2 articles, 1 refunded" and "2 bought · 1 refunded" agree), citations numbered 1…n with a full stop before them, a decline that explains itself (chevron, count, open for six rows or fewer, the proof page's words), writers titled by publication with one badge, a plainer receipt and plan modal, a hosted shell that collapses its composer when it cannot take a question, a phone drawer with a scrim, and no 404 in the console. Evidence: [docs/evidence/fix-a-nov11](evidence/fix-a-nov11/).
- 11 Nov: **Hosted judge demo is live** at https://ra-front-651013803640.asia-southeast1.run.app (GCP `researchagent-sff`, Singapore VM + Cloud Run front, release `f77ae141`). Eleven cloud failures were fixed and retried on the same manifest, among them the Host-dropping status probe, the loopback publisher relay, `ESCROW_WRITERS`, the read-only nginx temp paths and the budget in SGD. Both the paused smoke and the live acceptance smoke pass: two cookie jars with every foreign read 404, and a real Testnet purchase with SDK-verified receipts, anchor and explorer links. The alert email was delivered, and the rollback and teardown dry-runs passed. Decisions use the labelled fixture until the OpenAI key is rotated. [Evidence](evidence/hosted-deploy-nov11/README.md).
- 11 Nov: C5 adds 18 sourced explainers (OfferCreate flags, the RLUSD hexadecimal currency code, validation quorum, Ticket limit, crypto-condition type, payment channels, AMM, x402 facilitator steps, AP2, GENIUS Act, MAS stablecoin framework and licence, FATF Recommendation 16 and more) through the disclosed team writer, a small glossary and plan fix for candidate recall, and makes `RA_DEV_BANKS_ONLY=1` treat v1–v5 as used. Local fixture **development** banks (v5 is used, not held-out; the articles are informed by its misses): bought and cited v3-dev 16→18, v5 16→19; key fact leads v3 15→17, v3-dev 4→7, v5 9→16; candidate recall v3 16/18→20/20, v3-dev 9/14→17/20, v5 12/15→19/19; negative purchases 0→0; UC1–UC3 and preset purchases unchanged. [Evidence](evidence/c5-coverage/README.md).
- 11 Nov: K5 makes the lead name the thing the question asks for: a "which flag / transaction / header" or "what share" question now prefers the sentence that names one, ranks by how rare each question term is, and withholds an unrelated sentence instead of showing it. Local fixture development banks (v5 is now used/dev, not held-out): v3 key-fact leads 13→15/20, v5 used/dev 7→9/20, v3-dev flat at 4/20, 0 negative purchases, 109 of 109 runs with identical policy decisions, pinned preset leads unchanged. Most remaining misses are retrieval or corpus coverage, not ranking. [Development evidence](evidence/k5-dev/README.md).
- 11 Nov: FIX-B repairs proof of refusal inside the Mac app: the page's script and the Testnet check now run (the shell was stacking its own policy on the page's and blocking every socket), "Open proof page" opens its own window, the app shows no useless `app://` link, and the proof page states one check count ("15 of 17 checks passed", skipped checks named) and keeps its environment chip on a phone. New desktop-smoke proof step; the shell allows exactly the two public Testnet nodes. [Evidence](evidence/fix-b-nov11/README.md).
- 11 Nov: **Paid vs free on v5** (same artifact, zero budget, run once): 0/20 answered vs 16/20 bought and cited with S$2; the key fact leads 0/20 vs 7/20. Fixture corpus is paid writers only, so this shows the facts sit in the purchased passages, not a comparison with free web search. [Evidence](evidence/v5-heldout/README.md#paid-versus-free-arm-b-run-once).
- 11 Nov: Corrected the SingHacks baseline everywhere it is generated (deck, pitch, Q&A, /progress/): in the 19–20 Sep event build (`e16435a3`, `MANUAL_APPROVAL_REQUIRED`) a language model proposed each purchase and a person approved every quote; today policy code buys within the budget after one plan confirmation. The earlier "never say a person approved" rule came from the 7 Sep prototype tag.
- 11 Nov: **v5 blind held-out, run once** on main `a9584014` (fixture models, Testnet): 16/20 bought and cited (v4: 7/20), key fact leads the answer 7/20 (v4: 2/20), 0/10 off-topic purchases, 0 gate violations, 20/20 receipts verify. Without the two v4-overlapping questions: 15/18 and 6/18. [Evidence](evidence/v5-heldout/README.md).
- 11 Nov: DK rebuilds the finals [deck](submission/ResearchAgent-SFF-deck.pdf) (14 slides): no placeholders, every number a fact from facts.json, slides 1 and 8 lead with the live sandbox, the replay and `try --testnet`, slide 3 is the committed `try` output, slide 10 is one large shot of the current app captured by `export.mjs --refresh-shots`, and new market, compliance and team slides; the export refuses a stale fact or any `{{` in the HTML or PDF text.
- 11 Nov: W1 adds **proof of refusal**: a declined, XRPL-anchored run can be shared as an immutable, sanitized snapshot at `/proof/<id>` (question, paid articles found and why none was bought, S$0.00 spent, the anchor transaction and a one-click "Verify on XRPL in your browser"), with a link-preview card and a self-contained download; hosted proofs are public, read-only, rate-limited and kept through 20 Nov, and a session can share only its own runs. [Contract](contracts/REFUSAL-PROOF.md); [evidence](evidence/w1-proof/README.md), including one real Testnet-anchored refusal verified from the browser.
- 11 Nov: UI-2 ships the design system (tokens, one icon set, ≥3:1 control borders, real spinner and typing motion, reduced-motion plan that never starts silently), one verdict, refund and budget vocabulary, plain-English escrow and receipt wording with a "Technical details" layer, and axe-clean local, hosted and replay screens at 1440 and 390 (focusable citation passage, one-role command palette). The recorded replay is one dated bar ("Start here" → key reveal, "Ask your own question" → hosted app), and "Verify on XRPL in your browser" now also runs on local runs. [UI evidence](evidence/ui-nov11/README.md).
- 11 Nov: K4 adds protocol glossary retrieval, requested-fact lead ranking, deterministic topic guards, complete signed free-proof checks and clearer decline/citation states; C3+C4-based local fixture measurements lift v3 lead answers 5→13/20 and v3-dev 2→4/20, with negative purchases 2→0/10 and UC1–UC3 policy decisions unchanged. [Development evidence](evidence/k4-dev/README.md).
- 11 Nov: ROOT shortens the GitHub front page from 52 root entries to 42: five Playwright configs move to `tests/playwright/`, the community files to `.github/` (GitHub still detects them) and the publisher Dockerfile to `docker/`; the replay Vite config moves into `demo/`. The default `playwright.config.ts` stays so bare `npx playwright test` keeps working.
- 11 Nov: README rewritten as a product page (live-sandbox link, `try` line, a fresh Testnet screenshot, key-reveal figure, dated numbers); install, capabilities, numbers and engineering moved to docs/. Every judge-facing number now comes from one generated [facts.json](submission/facts.json) (`npm run facts`, checked in hygiene). Submission texts flipped to the hosted sandbox; the false "a person approved every purchase" line is gone. [README](../README.md) · [numbers](numbers.md).
- 11 Nov: SITE clarifies cooperative refunds and gross spending allowance, adds the hosted Try it live / Replay path, consistent accessible navigation and distinct page previews, plus a read-only RLUSD escrow-permission check. [Evidence](evidence/site-nov11/README.md).
- 11 Nov: HF/W4 adds server-authoritative hosted question caps, bounded read-only writer pages and a writer catalogue with prices, caller-scoped confirmed Testnet sales/refunds, credential links and observed trust history. Fictional and team-authored labels remain distinct; local fixture browser evidence in `docs/evidence/writers-nov11/`.
- 11 Nov: HU renders the judge-facing hosted shell from `/api/demo/status`. It opens with an orientation, then the visitor's own question (S$2.00 cap, questions left). One environment indicator, and separate states for paused (exact copy), ended, allowance, on hold, offline and busy, with Cancel. Stop gives one true line for each payment. Owner controls are hidden, and visitors see only their own runs, with Clear my history. **Verify on XRPL in your browser** runs `sdk/verify.ts` client-side, read-only, and matches Node on recorded Testnet UC3 (58 checks). Locally, the first-visit note sits inline instead of in a floating popover. New `browser-hosted` gate step; local hosted stack only, no deployment. [Evidence](evidence/hosted-ui/README.md).
- 11 Nov: Lane R replaces automatic hosted CI/CD with local shipping tiers and an exact-tag release publisher (full gate, isolated full acceptance, both unsigned DMGs, consumers and hash admission); gh-pages and dormant owner signing retained. [#433](https://github.com/Collaboration95/theFastandtheFungible/pull/433).
- 11 Nov: C4 adds 14 answer-first agent-payment/product explainers through the existing disclosed Testnet writer (161 total): x402, finality, injection controls, budgets, escrow/refunds, receipts/anchors, Credentials, assets, MCP, Starter Kit and fees; [dev-only before/after evidence](evidence/c4-product-explainers/README.md).
- 11 Nov: Copyable [x402 key-reveal escrow example](../examples/x402-key-reveal-escrow/README.md): standalone seller/buyer with pinned t54 codecs, Testnet delivery, replay and CancelAfter principal recovery; opt-in live test and unsubmitted [Starter Kit PR draft](feedback/upstream/starter-kit-key-reveal-escrow-pr.md). [#435](https://github.com/Collaboration95/theFastandtheFungible/pull/435).
- 11 Nov: HG adds opt-in hosted visitor sessions, own-run authorization, durable sponsor/model limits, queue/pause controls and health/status contracts; local synthetic isolation evidence only, deployed acceptance remains with ops. [#432](https://github.com/Collaboration95/theFastandtheFungible/pull/432).
- 10 Nov: W3 adds `try --testnet --hire` / `make try-hire`: client x402 hire → key-reveal article purchase → citation royalties → change → answer anchor, one ledger-verified timeline; unattended hire/payout recovery preserves original intents. [Evidence](evidence/w3-hire/README.md).
- 10 Nov: HM hardens wallet-wide signing, crash-safe trust and fair refund recovery; fixes TEST-SGD settings/TS+Python refund checks, search cancellation/deadlines, private writer journals, MCP HTTP dispatch, parser errors and configuration typos; AJV pinned to 8.20.0. Synthetic regression evidence, no live-money or hosted acceptance claim.
- 10 Nov: C3 adds 125 public-index XRPL/compliance explainers through the existing team-authored Testnet writer (147 total), cleans engineering text from ten paid notes, and adds paid-body lint; dev-only before/after Testnet evidence in `docs/evidence/c3-index-corpus/` ([#425](https://github.com/Collaboration95/theFastandtheFungible/pull/425)).
- 10 Nov: `/progress/` "Since SingHacks" on the explainers site: before/after hero, release rail of all 13 tags plus early milestones (each with shipped items, a screenshot or terminal excerpt and a proof link), then → now ladder, six honest small-multiple charts (v4 held-out 7/20 with v5 pending), misses we kept and a builder-feedback counter; every number generated by `npm run site:progress` from git, gh and evidence with a dated source SHA. `/ledger/` restyled on the shared header with mobile cards; home "39 days" copy replaced by a generated Progress card.
- 10 Nov: K3 puts a cited answer first (40-word lead, 120-word conclusion), collapses supporting work, filters unrelated clusters, prefers matching entities and adds the labelled S$0.30 new-writer probe; scoped UC1–UC3 decisions stay unchanged, and report/Contact provenance follows each source. [Development evidence](evidence/k3-dev/README.md).
- 10 Nov: DX repairs empty-folder SDK/writer onboarding, per-client Testnet timeouts and platform prerequisites; adds route-checked OpenAPI 3.1 with plain fetch, clearer CLI verification and preserved evidence labels. [Quickstart](sdk.md) · [verification](evidence/nov10-dx/README.md).
- 10 Nov: HO adds persistent-disk VM images/compose, stateless Cloud Run front, dry-run operator deploy/teardown, private Testnet provisioning and hosted smoke; native paused-shell proof only while HG is pending, no cloud deployment. [Runbook](hosted-web.md).
- 10 Nov: First-visit environment note no longer covers the Ask button or a deep-linked result: it follows the Ask button every frame while open (the one-shot placement went stale when fonts swapped) and opens only over an empty Home; the local-gate `browser-app` flake at `tests/ux2.spec.ts` "Lane K popover clears Ask" is fixed at the product, with a deep-link regression test
- 10 Nov: Builder feedback restructured for judges (10% of the score): a one-page summary opens [BUILDER-FEEDBACK](BUILDER-FEEDBACK.md) with one canonical top-7 ranking (severity, mainnet impact, evidence, workaround, fix, upstream status) and a compact mainnet checklist; the log keeps stable IDs B01–B35 and separates observed incidents, code-derived failure modes and historical research; new upstream draft and offline repro for the 1 KiB Memo overflow (`scripts/repro/08-memo-size.mjs`); all 8 drafts are paste-ready with a filing table; 10 Nov entry on the 96 s cold IOU start vs the 60 s MCP tool timeout. Nothing filed yet (owner, #265 B1).
- 10 Nov: Compliance map: [COMPLIANCE.md](COMPLIANCE.md) now opens with a one-page table mapping the five gates and the audit chain to custody, limits, retention, sanctions, KYB, disputes, data, MAS PSA/DPT, GENIUS Act, Travel Rule and mainnet, each row cited to code or a regulator page with a plain "not done" column; corrects the Travel Rule thresholds and anchored-head wording; deck slide text in [compliance-slide.md](submission/compliance-slide.md).
- 10 Nov: Blind held-out v5 frozen before the coverage and answer-quality lanes: 20 positives with frozen gold phrases plus 10 no-purchase negatives (finance, crypto, AI near-misses), SHA-256 pinned by test, never run or opened by implementers; v4 is now used and historical. [Banks](eval-judge-banks.md).
- 8 Nov: Prepare v1.0.2: versions bumped from 1.0.1 across packages, MCPB, registry metadata, live docs and the deck (install lines regenerated, deck PDF re-exported); CHANGELOG v1.0.2 carries the #418 anchor-pending fix and honesty sweep plus the #417 dev-loop gate. Tag follows orchestrator acceptance.
- 8 Nov: Round-6 judge fixes in one PR: anchor pending no longer reads as failure (v1.0.1 regression), anchored no-purchase runs show proof and Export, plan modal and subtitle state the true buy rule (one per round, up to 3 rounds, budget) tied to `MAX_ROUNDS` by test, team-authored label sweep, SFF deck link, 61/61 ledger counts, v4 split in the pitch notes, XRPL Testnet example questions.
- 7 Nov: Local merge gate replaces repeated hosted waits: synthetic server PR 324.6 → 97.8 s, Markdown 103.6 → 2.4 s; release acceptance 998 → 554.5 s cold / 301.2 s prepared same SHA with a fresh full soak; failed concurrency experiments and all demotions retained. [Evidence](evidence/ci-speed/README.md) · [#417](https://github.com/Collaboration95/theFastandtheFungible/pull/417).
- 7 Nov: Prepare v1.0.1: versions bumped from 1.0.0 across packages, MCPB, registry metadata, live docs and the deck (install lines regenerated); the v4 held-out measurement is committed (7/20 bought and cited, answers-it 2/20, v4-negatives 0/10 purchases, fixture decision model, Testnet) and replaces the v2 8/20 headline everywhere; dev is labelled v1 16/20, v3 7/20; v4 is used, so a new held-out claim needs a v5 bank. Tag follows orchestrator acceptance. [Evidence](evidence/v4-heldout/README.md).
- 7 Nov: Lane B consolidates packed-consumer lifecycle and bank execution, retires the historical r5-k runner/scorer with pinned recipes, and retains live wallet state before startup; ≥100 net source lines removed, frozen results unchanged.
- 7 Nov: Lane A retires twelve frozen proof generators atomically; evidence bytes retained and historical recipes pinned to the complete `b0a67ffa` tree ([recovery index](historical-tools.md), [#412](https://github.com/Collaboration95/theFastandtheFungible/pull/412)).
- 7 Nov: U2 removes duplicate lead/claim rows with stance retained, uses ISO UTC receipt dates, removes the unsourced Articles column, and hides purchase rationale until a receipt exists.
- 7 Nov: Lane R corrects dev/held-out claims, README first screen, dated CI/cold timings, v1.0.0 release copy and duplicate DMGs; refreshes ledger and builder filing kits. No version bump; release acceptance remains with the orchestrator. Evidence: `docs/evidence/r5-r/`.
- 7 Nov: P0 adds arbitrary-size frozen-bank measurement, purchased-passage answers-it scoring, negative-buy failures, bank hashes and recorded decision-value distributions; fixture policy unchanged, v3 held-out reserved. [#405](https://github.com/Collaboration95/theFastandtheFungible/pull/405) · [Usage](eval-judge-banks.md).
- 7 Nov: Pixel agent v2: a chunkier 32 × 40 researcher (blinking visor face, blush, an expression per state, antenna as the mark's route, satchel with the mark, weighted walk); README hero 672 × 92 (was 120 tall), LinkedIn square/banner/portrait exports in `design/character/social/`, v1-vs-v2 comparisons in [evidence](evidence/character/README.md#v1--v2).
- 7 Nov: J5 freezes v2 before two team-authored notes; v2 held-out 8/20; v1 dev 16/20 buy-and-cite, zero blanks/gate violations in both banks; online verification 16/20 dev and 8/20 held-out (missing anchors retained as failures). Policy unchanged; dev gains one question, held-out remains 8/20. [Evidence](evidence/j5-coverage/README.md).
- 7 Nov: Lane D projects sidebar history without snapshot hydration, shares pure presentation selectors and deletes 9 dead UI lines (Cast retained for built/tested QA page); local synthetic 2,000-row p95 602.18 → 81.15 ms, CPU −86.92%; deletion targets missed. [Evidence](evidence/refactor-d/README.md).
- 7 Nov: Prepare v1.0.0: versions bumped from rc.2 across the packages, MCPB, registry metadata and live docs; install lines regenerated for v1.0.0 (including `try --testnet`); changelog folds rc.1/rc.2 with #384–#391; submission placeholders filled (tag, versions, 33.9 s first-try writer) and the deck re-exported. No tag or release yet; the orchestrator tags after acceptance.
- 7 Nov: Submission pack refreshed for judges' pre-assessment: 12-slide deck and PDF (since SingHacks, the one-line `try --testnet` proof, key-reveal and TEST-SGD escrow, verify-don't-trust, fees, builder feedback; pixel agent on slides 1 and 12), 50/150/300-word descriptions, a 9-shot 2:50 video script led by `try`, a 2:00 pitch and 20 R/P/Y judge answers. J5 (v2 held-out 8/20; v1 dev 16/20 buy-and-cite) and S1b filled; `{{…}}` placeholders for J3, the release, registry, upstream filing and video are listed in [submission/README](submission/README.md#placeholders).
- 7 Nov: Pixel-art agent: head is the open-index mark; generated sprite sheet (8 poses incl. pay, key reveal, refund), README hero GIF (89 KB, transparent, dark/light evidence), site loop and app loading sprite; drift check in `check:fast`. AGENTS.md mascot rule narrowed to this one character.
- 7 Nov: L4 multiplexes 16 read-only ledger lookups (45/45 live in 1.97 s versus 27.5 s), collapses demo proofs, makes feedback IDs unique (B24–B29), prepares the filing kit and refreshes fixture metrics. Evidence: `docs/evidence/round4-l4/`.
- 5 Nov: Reuse decisions-harness scenarios without changing assertions. [#383](https://github.com/Collaboration95/theFastandtheFungible/pull/383).
- 5 Nov: Prepare rc.2 installs, completed anchors and 45-row ledger evidence. [#382](https://github.com/Collaboration95/theFastandtheFungible/pull/382).
- 4 Nov: Verify TEST-SGD key-reveal token escrow on Testnet. [#381](https://github.com/Collaboration95/theFastandtheFungible/pull/381).
- 4 Nov: Add zero-clone Testnet web app. [#380](https://github.com/Collaboration95/theFastandtheFungible/pull/380).
- 4 Nov: Default replay to key-reveal UC3 with honest refund semantics. [#379](https://github.com/Collaboration95/theFastandtheFungible/pull/379).
- 5 Nov: Add writer cold start, real-writers list and first-touch judge path. [#378](https://github.com/Collaboration95/theFastandtheFungible/pull/378).
- 4 Nov: Verify own key-reveal receipts, Python ledger checks and anchors. [#377](https://github.com/Collaboration95/theFastandtheFungible/pull/377).
- 4 Nov: Add zero-clone Testnet MCP, devcontainer CI and cost card. [#376](https://github.com/Collaboration95/theFastandtheFungible/pull/376).
- 5 Nov: Lane R2 prepares v1.0.0-rc.2 artifacts and concrete installs, displays completed answer anchors without reload, and expands the read-only Testnet ledger to 45/45 verified hashes, including TEST-SGD IOU (stand-in for RLUSD); all local consumers/browser suites pass. Tagging remains with the orchestrator. [Evidence](evidence/round3-r2/README.md).
- 4 Nov: Lane R1 prepares v1.0.0-rc.1 versions, PEP 440 wheel names and prerelease/Latest policy; five fixture consumers pass. Final version bump follows 9 Nov acceptance.
- 4 Nov: Zero-clone release consumers clean up npm/npx process groups with escalation and assert no surviving processes; fixture-only regression covers a SIGTERM-resistant grandchild. [#364](https://github.com/Collaboration95/theFastandtheFungible/pull/364).
- 4 Nov: Lane S full 2,000-ask soaks reject sustained memory growth (RSS slopes −1.899 / −0.644 MiB/100 asks); quiet-host full soak now passes all five gates (worst-interval p99 25.8 ms), while the heavily loaded shared-host run failed ([evidence](evidence/soak-nov4-ab/README.md)). Quick slope is diagnostic only; no full threshold changed. [Evidence](evidence/round2-s/README.md).
- 4 Nov: Lane H2 REHEARSAL completes exact artifact consumers/verifiers, unsigned arm64 recovery, x64 build, browser/Python/coverage and 200-run chaos; historical full loop 64.389 ms and quick RSS misses remain recorded; quiet-host full soak now passes all five gates at 25.8 ms, while the heavily loaded shared-host run failed ([evidence](evidence/soak-nov4-ab/README.md)). No threshold changed. [#360](https://github.com/Collaboration95/theFastandtheFungible/pull/360).
- 4 Nov: Lane H2 full rehearsal records 2,000 asks, burst peak four and 20 clean restarts; four performance gates pass but loop p99 misses at 64.389 ms (<50 ms required). That historical artifact acceptance stopped; quiet-host full soak now passes all five gates at 25.8 ms ([evidence](evidence/soak-nov4-ab/README.md)); no threshold changed. [Blocked evidence and runner](evidence/round2-h2/README.md).
- 4 Nov: Lane H1 shared-host baseline: 2,000 asks after 200 warmups on 10,000 × 60 history; 20 clean restart cycles, zero audit violations; memory gates pass, loop-delay/latency gates miss honestly. [Measurements and SVG](evidence/round2-h/README.md); C1 repair and final H2 acceptance remain pending.
- 4 Nov: Lane G explains exact paid claim/passage use in receipt v3, preserves v1/v2 offline verification and rejects ten tamper classes; 30 fixture links, semantic assessment explicitly unavailable, unchanged scorecard arithmetic and accessible receipt screenshots. [Evidence](evidence/round2-g/README.md).
- 4 Nov: Lane C1 adds guarded one-key compatible research/UNCALIBRATED advisory decisions, local bearer connection testing, cooperative Stop and default-four active work (100 asks: 4 admitted/96 overloaded); HTTP/TS/Python/MCP synthetic citation matrix passes. [Engine evidence](evidence/round2-c1/README.md).
- 4 Nov: Lane C2 keeps Mac Settings/recovery available before credentials and engine boot, preserves durable wallet pause, adds presence-only BYOK controls and explicit unsigned builds; 13 native fixture recovery cases and arm64 artifact hash in [C2 evidence](evidence/round2-c2/README.md).
- 4 Nov: Lane A projects retained history (3,000 × 60: 34.4 s → 313 ms hydration, 5.3–10.8 ms selection/reconcile), bounds streams, adds safe client errors and durable late-refund recovery; engine-wide cap and cooperative Stop remain deferred. [Local synthetic evidence](evidence/round2-a/README.md).
- 4 Nov: Fixture soak hardening: clamshell-sleep root cause, bounded provider waits, lower audit retention and watchdog diagnostics; 30-minute fixture soak has 615 successes and zero violations. [Evidence](evidence/soak-nov4.md).
- 3 Nov: Python SDK adds typed budgeted asks, durable event iteration, receipt verification and a framework-independent tool wrapper; synthetic engine tests run only on package changes. Publication remains #265.
- 3 Nov: One-click MCPB extension, release asset, registry metadata and five-client install reference; fixture archive smoke validates caps. Publication remains #265.
- 3 Nov: Official RLUSD (Testnet) pays writers end to end: supplied-payer UC2 0.90, UC3 0.30 fully refunded, both receipt verifiers pass; faucet 401 bypassed with bounded Testnet DEX provisioning. [Evidence](evidence/rlusd.md).

- 3 Nov: Mac wallet Streamable HTTP MCP, per-agent Keychain connections and allowance controls, receipt verifier and inbound hire tools; one policy-selected Testnet purchase (90,000 drops + 12 fee), [evidence](evidence/app-mcp-http.md).
3 Nov: SDK v1 adds typed streaming asks, offline verification, explicit journaled Testnet pay/hire, ESM declarations and three CI fixture examples. npm publication remains #265.

- 3 Nov: Starter Kit/t54 native XRP interop in both directions, pinned SDK boundary tests and Testnet proof; [evidence](evidence/starter-kit-interop.md).

- 3 Nov: Packaged Mac hardening: crash recovery through the x402 journal, isolated Keychain Testnet acceptance, notify-only releases and separate Intel/Apple Silicon builds; [evidence](evidence/app-acceptance.md).

## Deliverables

| Track | Deliverable | Issue | Status |
|---|---|---|---|
| Product | Cleanup: security deps, test safety, dead code, docs truth | #248–#250 | done ([#254](https://github.com/Collaboration95/theFastandtheFungible/pull/254)) |
| Product | Cheaper CI: docs-only changes skip tests, no duplicate runs | #252 | done |
| Product | Nightly scorecard + hard-gate audit | #256 | local-only · live pre/post-menu and fixture scores, 3 Nov |
| Product | MCP server: any agent searches and buys within a human-set cap | #255 | done · fixture proof + Claude Code transcript |
| Product | Feature-a-day run: 9 notable features, one release each, Thu 5 → Fri 13 ([calendar](#feature-a-day-5-13-nov)) | #270, #260, #259, #262, #273–#277; slack #278–#281 | historical plan · implementation moved ahead; see completed milestones and release history |
| Product | Day 1: the local app done properly (keyboard-first, state model, record mode) | #270 | done · keyboard-first app, unified state and record mode (Lane A) |
| Product | macOS app (Electron DMG): Keychain seed, signing pipeline ready for the Developer ID | #259 | done · unsigned Apple Silicon DMG; offline installed proof |
| Product | Hill-climb: fact menu, then value-of-information buying + nightly refit | #260, #276 | done · both shipped and both waste targets missed (held-out waste 39.39% → 35.48% against a 25% target); the misses are kept in the scorecard below and on /progress/ |
| Product | Surprise bet 1: proof-or-refund escrow on XRPL | #261 spike, #273 build | done · #273 shipped a buyer-held hashlock on 3 Nov; the writer-paid-by-key-reveal escrow replaced it in v1.0.0-rc.1 (4 Nov) |
| Product | Pay writers in RLUSD on Testnet | #275 | done · official RLUSD paid writers on 3 Nov; RLUSD escrow waits on the issuer's AllowTrustLineLocking flag, so token escrow settles in TEST-SGD ([#381](https://github.com/Collaboration95/theFastandtheFungible/pull/381)) |
| Product | Surprise bet 2: hire the agent (agent-to-agent x402 with citation royalties) | #274 | done · hire-v1 on 3 Nov; `try --testnet --hire` runs the whole chain in one line since 10 Nov (W3) |
| Product | Publish in one command: a Markdown folder becomes a paid writer | #277 | implemented · 18.90 s Testnet paid read, 3 Nov |
| UI/UX | The cast (restrained, on one grid with the brand) + motion: the money visibly moves | #258, #262 | done · cast v1 (#258); #262 closed narrower: the money flight was not built (3 Nov) and motion is limited to budget-bar and status transitions |
| Repo | Front door: settings, topics, community files, hygiene check, a release per feature day | #269 | done · social preview upload on #265 |
| Repo | Brand kit: wordmark, mark, favicon, app icon, social preview, naming audit | #271 | done · reproducible exports + app/site source integration |
| Repo | README overhaul + one header across the explainers site | #272 | done · the hero is a live hosted XRPL run and every number comes from facts.json (11 Nov) |
| Submission | Short description · demo video · pitch deck · public repo | [pack](submission/README.md) | done except the voice · description, 14-slide deck PDF, pitch and Q&A refreshed for v1.1.1 on 11 Nov; video footage recorded on v1.1.0 (VID-2); the owner records the voice-over and uploads (A4 on #265) |
| Builder feedback | [Living log from building + mainnet-readiness checklist](BUILDER-FEEDBACK.md) | #257 | done (15 implementation findings + 15 historical submissions) |
| Story | Daily posts (two on weekends, [post calendar](#post-calendar)) + SFF chapter on the [evolution page](https://collaboration95.github.io/theFastandtheFungible/evolution/) | #257 | done · daily log ready; the SFF chapter is the [progress page](https://collaboration95.github.io/theFastandtheFungible/progress/) and the evolution page stays the October chapter |
| Presentation | 2-minute pitch, rehearsed | plan only | planned · 14–18 Nov |

<!-- fresh-scorecard:start -->
Fresh-set recommendation (3 Nov): **On 48 fresh synthetic questions, 93.15% of gross article spend bought a requested fact retained in the final cited answer (95% CI 81.25–100.00%).**

LIVE decisions/coverage; fixture research, keyword search and SIMULATED payments. Same-vendor labels await human review; structured templates and fixed model draws limit generalisation.

| Metric (%, uplift in pts); 95% CI | #324 reused heldout (92) | Fresh main (48) | Fresh generalised (48) |
|---|---:|---:|---:|
| Final-used gross spend | 80.05 [63.16, 92.00] | 90.07 [79.31, 100.00] | 93.15 [81.25, 100.00] |
| Wasted gross spend | 19.95 [8.00, 36.84] | 9.93 [0.00, 20.69] | 6.85 [0.00, 18.75] |
| Wasted net spend | 19.95 [8.00, 36.84] | 9.93 [0.00, 20.69] | 6.85 [0.00, 18.75] |
| Supported-fact uplift | 38.04 [24.00, 51.14] | 66.67 [45.83, 83.33] | 66.67 [45.83, 83.33] |

No pooling with the reused holdout. Different-set comparison is descriptive; fresh main/generalised runs use the same frozen set, one run per policy. Evidence: [rule audit](../eval/FRESH-AUDIT.md), [full report](../eval/REPORT-decisions.md).
<!-- fresh-scorecard:end -->

## Hill-climb scorecard

Baselines are from the 9 Oct live runs (see `eval/REPORT-decisions.md`,
`eval/REPORT-coverage.md`). From #256, `make scorecard` writes
`eval/scorecard/history.jsonl`; paste "before → after" here when a number moves.


Historical #324 result (superseded for the current pitch by the fresh-set table above) · **80.05% of gross spend bought a requested fact retained in
the final cited answer [95% CI 63.16–92.00%]**. LIVE decisions/coverage;
fixture planner/writer, synthetic corpus, keyword search, SIMULATED payments.
Reused frozen question holdout: 92 questions / 20 source clusters, 3 Nov.

| Metric | Historical #320 after (95% CI) | Single V7 final (95% CI) |
|---|---:|---:|
| **Pitch: gross spend buying a final-used fact** | **59.32% [31.60, 88.82]** | **80.05% [63.16, 92.00]** |
| Wasted gross spend | 40.68% [11.18, 68.40] | 19.95% [8.00, 36.84] |
| Wasted net spend (no refunds in either benchmark) | 40.68% [11.18, 68.40] | 19.95% [8.00, 36.84] |
| First-purchase F1 (flow) | 0.526 [0.349, 0.667] | 0.545 [0.361, 0.689] |
| Selection F1 (sweep) | 0.660 [0.484, 0.800] | 0.688 [0.507, 0.812] |
| Supported-fact uplift | 35.87 pts [22.11, 49.50] | 38.04 pts [24.00, 51.14] |

Definition: S$16.25 gross cost of verified, non-refunded purchases adding a
bank-supported requested fact surviving in the final answer / S$20.30 all gross
purchase cost. A cost share, not the percentage of facts answered. Source-cluster
bootstrap, 2,000 draws, seed 700, conditional on fixed synthetic sources and
observed model draws. Historical errors were inspected; no unseen-test claim.
Dev/synthetic iteration only, then freeze and one final held-out run.

Waste change **−20.73 pts [−47.51, 0.00]**. Point estimate meets <25%, but its CI
crosses 25% and paired change includes zero. No strict improvement or below-target
population claim. Full definitions, secondary metrics and reproducible historical
comparison: `eval/REPORT-decisions.md` §9 and `eval/scorecard/numbers-v7-results.json`.

Separate [live Testnet UC2/UC3 sanity runs](evidence/numbers-v7-testnet.md): live
DeepSeek planner/writer and Luna decisions; actual three purchases and one
confirmed refund, all validated, gross 0.16 XRP, net 0.13 XRP, 48 drops fees.
UC2 3/3 supported; UC3 2/3, one fact still missing. These runs support the
settlement path, not the benchmark percentage. Benchmark audit 0/10 runs/646
observations; Testnet audit 0/2/64 search observations. Total models US$0.3389854
at dated harness rates, not an invoice. Nothing loosened; no `src/` changes.

Historical Numbers v6 result (preserved):

Numbers v6 headline · LIVE, frozen 92 heldout questions / 20 source clusters, 3 Nov:

| Metric | Before (95% CI) | After (95% CI) |
|---|---:|---:|
| Wasted gross spend | 52.87% [28.30, 73.31] | 40.68% [11.18, 68.40] |
| Wasted net spend (confirmed simulated refunds) | 52.87% [28.30, 73.31] | 40.68% [11.18, 68.40] |
| Gross spend buying a final-used fact | 47.13% [26.69, 71.70] | 59.32% [31.60, 88.82] |
| First-purchase F1 (flow) | 0.530 [0.347, 0.673] | 0.526 [0.349, 0.667] |
| Selection F1 (sweep) | 0.660 [0.479, 0.796] | 0.660 [0.484, 0.800] |
| Supported-fact uplift | 32.61 pts [20.99, 44.87] | 35.87 pts [22.11, 49.50] |

**Gross waste target still missed (40.68% ≥25%).** Gross/net waste decreased
12.19 pts (paired 95% CI −28.57 to −1.23); used-spend share increased 12.19 pts
[1.23, 28.57]. No refunds occurred in either heldout run, so gross and net
coincide. Flow F1 slipped 0.00360 [−0.03368, 0.02052]; sweep slipped 0.00019
[−0.03376, 0.03105]. Uplift increased 3.26 pts [0.00, 8.18]. Free-supported
facts rose 6 → 13; final-supported facts 36 → 46 of 92. This is primarily better
fact use, not an established selection-F1 improvement.

Source-cluster bootstrap: 20 sources, 2,000 replicates, seed 700; conditional on
fixed synthetic documents and observed model draws. Wide intervals remain;
source documents and the prior aggregate results were already visible. No
heldout retuning. LIVE decision/coverage, fixture writer/planner, keyword search,
**SIMULATED payments, zero XRP**; no live DeepSeek or chain-refund claim. Both
raw API audits: **0 violations / 10 runs / 728 observations** each.
Model cost **US$0.4412058 / US$4** (usage-derived at dated harness rates, not an
invoice). `eval/scorecard/spend-extraction-results.json` retains exact scoring
inputs and CIs; `spend-extraction-spend.json` accounts for all 946 requests.

Historical #318 headline · LIVE, 92 new heldout questions / 20 source clusters, 3 Nov:

| Metric | Before (95% CI) | After (95% CI) |
|---|---:|---:|
| Wasted gross spend | 52.87% [28.30, 73.31] | 52.87% [28.30, 73.31] |
| Wasted net spend (confirmed simulated refunds) | 52.87% [28.30, 73.31] | 52.87% [28.30, 73.31] |
| Gross spend buying a final-used fact | 47.13% [26.69, 71.70] | 47.13% [26.69, 71.70] |
| First-purchase F1 (flow) | 0.530 [0.347, 0.673] | 0.530 [0.347, 0.673] |
| Selection F1 (sweep) | 0.660 [0.479, 0.796] | 0.660 [0.479, 0.796] |
| Supported-fact uplift | 32.61 pts [20.99, 44.87] | 32.61 pts [20.99, 44.87] |

**No measured improvement; gross waste target missed.** No refunds occurred in this heldout sample, so gross and net coincide. Paired delta CIs are [0, 0]
conditional on these model draws. The bank is now 140 questions: 48 historical
dev + 92 prospective heldout. All earlier work saw the old full bank; source
documents were visible previously. CIs resample sources, not question paraphrases,
and remain wide. The policy only vetoes explicit wrong-country substitutions;
no heldout tuning. LIVE decision/coverage, synthetic corpus, fixture research,
SIMULATED payments, zero XRP. Final gate audit: 0 / 10 runs / 728 observations.
Total model spend US$0.8681326 of US$5. Full limitations and root-cause inventory:
`eval/REPORT-decisions.md` §7 and `docs/evidence/waste-analysis-2026-11-03.md`.

Historical #276 headline · LIVE, prospectively held-out rates/power (24 questions), 3 Nov:

| Metric | Held-out LIVE before → after (headline) | Dev LIVE before → after |
|---|---:|---:|
| Wasted gross spend | 39.39% → **35.48%** | 51.79% → 44.19% |
| Wasted net spend (confirmed simulated refunds) | 39.39% → **35.48%** | 42.55% → 35.14% |
| Gross spend buying a final-used fact | 60.61% → **64.52%** | 48.21% → 55.81% |
| First-purchase F1 (flow) | 0.588 → **0.625** | 0.308 → 0.296 |
| Selection F1 (sweep) | 0.714 → **0.667** | 0.400 → 0.320 |
| Supported-fact uplift | +15.38 pts → **+15.38 pts** | +18.52 pts → +25.93 pts |
| False-complete | 5.26% → **5.26%** | 0.00% → 0.00% |

**Waste target missed (35.48% ≥25%).** Held-out flow F1 and +15-point uplift pass;
sweep regresses, and dev flow F1 misses. Full-bank secondary waste is 41.36%
(previous 47.19%), flow F1 0.419 unchanged, uplift +20.75 pts. These subsets must
not be compared directly with the historical whole-bank columns below. Coverage
false-complete on holdout is 1/19 (5.26%); whole-bank remains 1/53 (1.89%).
Live decision/coverage only; synthetic corpus, fixture research, SIMULATED payments,
zero XRP. Final API gate audit: 0 violations / 10 runs / 464 observations. Receipt
fit retains identity probabilities (Platt/isotonic lost); dev-selected threshold
0.5 expected facts/S$. Model spend US$0.5753331 of US$4, including all
trials. `eval/REPORT-decisions.md` §6 and `receipt-value-results.json` carry exact
provenance, limitations and trial failures. README publishes the held-out row.

Historical whole-bank #260 table (retained; net refunds and final-use shares were not measured in these rows):

| Metric | Live baseline (9 Oct) | live, pre-fact-menu · 3 Nov SGT | live, post-fact-menu + #301 · 3 Nov SGT | Target 12 Nov |
|---|---|---|---|---|
| Wasted gross spend | 39.5% | 36.19% | 47.19% (target missed; +11.00 pts) | ≤ 20% |
| Purchase-selection F1 | 0.24 flow / 0.41 sweep | 0.235 flow / 0.400 sweep | 0.419 flow / 0.513 sweep (0.45 lane target missed) | ≥ 0.5 flow |
| Supported-fact uplift from paying | +9.5 pts | +11.32 pts | +16.98 pts | ≥ +20 pts |
| False-complete rate | 1.9% | 1.89% | 1.89% | ≤ 2% |
| p95 time to first answer | not measured | 132.7 ms (p50 77.9) | 131.2 ms (p50 73.1; final p95 3709.2) | set after baseline |
| Cost per timed query (model US$ + XRP spent) | not measured | US$0.00236 + 0 XRP drops | US$0.00254 + 0 XRP drops | set after baseline |
| Cold start (launch → ready; app and engine) | not measured | 761.5 ms (booted demo) | 533.7 ms (booted demo; engine/app unmeasured) | < 5 s |
| MCP e2e pass (fixture stdio) | 0 | 1 | 1 (separate fixture evidence) | 1 nightly locally |
| MCP: question → paid, cited answer from Claude Code | not possible | PASS · fixture, 23.3 s including retry | unchanged separate fixture evidence | passes nightly locally |
| Hard-gate violations (six rules) | 0 expected, not re-verified | 0 / 10 runs | 0 / 10 runs | 0, audited locally |

Desktop app (separate fixture measurement): installed launch to interactive 2070 ms; DMG 130.27 MiB. This is not part of the live engine benchmark.

The valid pre-menu run at `2026-11-02T16:30:12.474Z` was recovered, not repeated.
Historical #260 after: `2026-11-03T01:49:48.288Z`, prompt v3, after integrating #300 and #301.
**Both #260 targets are missed:** F1 ≥ 0.45 and waste ≤ 25%. Waste regressed
**11.00 percentage points** from the fresh baseline. No threshold or test was
relaxed. The explicit lane request says to ship and report missed targets;
this does not meet the issue's original no-regression acceptance condition.
These are live decision/coverage models, synthetic articles, fixture planner/writer,
keyword search and **SIMULATED payments** (zero XRP transferred). Flow fact support
uses scripted bank needles; false-complete uses live coverage-model judgments.
Timing is Mac wall clock, not full-product/XRPL latency. #301 changed the public
input context too, so this is an integrated before/after, not an isolated menu effect.

Fixture before → after: F1 **0.310 / 0.222 → 0.310 / 0.222**, waste
**67.93% → 67.93%**, uplift **+28.30 → +28.30 pts**, false-complete
**37.74% → 37.74%** (overlap fixture), **0 → 0 gate violations**.
Same-input `--check --compare 2026-11-03` passed with zero quality deltas.
Bank, prose and coverage snapshots are unchanged; treatment hashes differ.

Total task model cost **US$1.2739735**, including every recovered failure/probe
and completion attempt; latest **US$0.1180476**, 260 calls. Usage-derived estimates
at dated harness rates, not invoices: `eval/scorecard/lane-b-spend.json`.
The final calibration fit was rejected by its own rule; calibration stays off.
See the dated section in `eval/REPORT-decisions.md`. Next: #276 marginal-fact value
buying, precise measure/period menus, and held-out evaluation of the hardened prompts.

## Plan

### Feature-a-day: 5-13 Nov

Historical plan written 3 Nov. Implementation and milestone releases moved ahead
of this prospective calendar; dates below are the original plan, not claims of
daily release delivery. Current merged/released status is recorded above and in
README completed milestones. Historical release names and tags are preserved.

**Design bar (owner, 3 Nov):** a YC-style startup product: clean, fast, it
works (Linear, Vercel, Stripe docs). No childish or hyper-interactive gimmicks.
Motion only where it carries meaning (money moving, a state changing). This
applies to the app, README, logo, site and the cast (#258).

| Day | Date | Feature | Criterion | Post angle (feature · visual · number · takeaway) | Issue | Release |
|---|---|---|---|---|---|---|
| 0 | Wed 4 | MCP server + first scorecard | Reachability · Feasibility | Claude Code bought an article on XRPL inside a cap I set · terminal clip · `claude mcp add` → paid answer in 23 s · the calling LLM never authorizes spend; the cap lives in env | #255, #256 | `v0.1.0` |
| **1** | **Thu 5** | **The local app done properly:** keyboard-first (⌘1…, ⌘K), one state model, empty/loading states, record mode, stage-review bugs | UX & design (base for every clip) | ⌘K → ask → paid, cited answer, no mouse · 15 s clip · view switch p95 ms, 0 layout shift · design the state model before the motion | #270 | `v0.2.0` |
| 2 | Fri 6 | **Fact menu:** writers sign what each article answers | Technical depth · Creativity | our agent stopped buying teasers · before → after chart · selection F1 0.24 → N, wasted spend 39.5% → N · signed metadata beat prompt tweaks | #260 | `v0.3.0` |
| 3 | Sat 7 | **Mac app** (DMG, Keychain seed, signing pipeline) on Day 1's UI | Reachability · Feasibility | install → first paid answer · 20 s clip from DMG to receipt · cold start N s · Electron's `utilityProcess` ran our Node engine unchanged | #259 | `v0.4.0` |
| 4 | Sun 8 | **Watch the money move:** coin flight, ledger close, refund | UX & design | animate the money, nothing else · UC3 clip · ledger close → receipt in N s · motion should carry state, not decoration | #262 | `v0.5.0` |
| 5 | Mon 9 | **Proof-or-refund escrow** on XRPL | Technical depth · Creativity | the ledger, not the writer, enforces refunds · explorer EscrowCreate → EscrowCancel · +N s, N drops per purchase · a native ledger primitive beat deploying a contract | #273 (spike #261) | `v0.6.0` |
| 6 | Tue 10 | **Hire the agent:** x402 answers for other agents, citation royalties | Creativity · Reachability | one question, three+ wallets · money-chain diagram with tx hashes · split of one S$2 question · the citation list is a payment instruction | #274 | `v0.7.0` |
| 7 | Wed 11 | **Pay in RLUSD** on Testnet | Reachability · Technical depth · Feasibility | agents pay writers in a stablecoin · receipt + explorer · settle time and fee · check `delivered_amount`, never `Amount` | #275 | `v0.8.0` |
| 8 | Thu 12 | **Learns from its receipts:** value-of-information buying + nightly refit | Feasibility · Technical depth | it got better at spending by itself · wasted spend by night, 9 Oct → 12 Nov · 39.5% → N% · your purchase log is free ground truth | #276 | `v0.9.0` |
| 9 | Fri 13 | **Publish in one command:** Markdown folder → paid writer | Reachability (supply side) | any expert, one command · 20 s terminal clip · folder → paid by an agent in N s · agent commerce supply side = static site + signed manifest + wallet | #277 | `v0.10.0` |

**Slack (fills a slipped day, or extends the streak into Sat 14 / Sun 15):**

| # | Feature | Criterion | Post angle | Issue |
|---|---|---|---|---|
| F10 | **Verify any answer:** receipt bundle + `npm run verify:answer` (API/CLI/SDK; UI separate) | Technical depth | don't trust our agent, verify it · all-green table, then one red after a byte flips | #278 |
| F11 | **Chaos test + 12 h soak** | Feasibility | 500 injected failures, 0 double charges | #279 |
| F12 | **One wallet, many agents:** per-agent keys and allowances | Reachability · Technical depth | give each AI agent its own allowance; revoke in a click | #280 |
| F13 | **Answers in seconds:** stream the free draft, upgrade with paid evidence | Feasibility | p95 time to first answer N s → N s | #281 |

**Ranked by judging impact** (weights in [JUDGING-CRITERIA.md](JUDGING-CRITERIA.md)):
1 hire the agent (#274) · 2 Mac app (#259) · 3 escrow (#273) · 4 RLUSD (#275) ·
5 fact menu (#260) · 6 publish (#277) · 7 many agents (#280) · 8 verify (#278) ·
9 learns from receipts (#276) · 10 chaos (#279) · 11 streaming (#281) ·
12 app foundation (#270) · 13 motion (#262). The app foundation ranks low on
weight but goes first: every later clip, the Mac app and the video are recorded
on it.

**Dependencies:** #270 → #259, #262, #273, #274, #275 (state model and rail
label) and every clip. #258 → #271 (brand) → #259 (icon), #272 (README).
#261 spike → #273 (no-go: F10 takes Day 5). #163 price units → #275.
#255 → #274, #277, #280. #256 → #260, #276, #279, #281 (before → after).
#260 → #276, #277 (fact menu). #273 → #275 only for RLUSD escrow.

**Why Electron for the app:** the engine is Node (`node:sqlite`, `xrpl`, Orama,
Express). Electron runs it unchanged in a `utilityProcess`; Tauri needs a
bundled Node sidecar and a Rust shell. ~120 MB download, zero rewrite (#259).

### Repo identity (the timeline will get traffic; make it look funded)

| Issue | What | When | Who |
|---|---|---|---|
| #269 | **Repo front door:** description, topics, homepage (`gh repo edit`); LICENSE, CONTRIBUTING, SECURITY, CoC, issue templates; hygiene check in `check:fast`; **one tagged release per feature day** | Wed 4 – Thu 5 | Sonnet + small Sol pass |
| #271 | **Brand kit:** wordmark and mark generated in SVG on #258's grid, favicon set, app icon (`.icns` for #259), social preview, OG images, naming audit ("ResearchAgent" everywhere) | Thu 5 – Fri 6 | Opus directs, Sol builds |
| #272 | **README overhaul + one site header:** hero, real badges, 15 s demo, 3-command quick start, "try it in Claude Code", Mac download, generated architecture SVG and scorecard table; shared header across gh-pages | Sat 7, numbers refreshed Wed 11 | Sonnet writes, Sol builds |

### Surprise bets

1. **Proof-or-refund escrow** (#261 spike Fri 6, build #273 Sat 7 – Mon 9). The
   buyer pays into an XRPL Escrow; the article's proof releases it, a broken
   promise lets it cancel back. Refunds stop depending on the writer's goodwill.
   Native XRPL (Escrow + crypto-conditions, no contract deploy) and new ground
   for x402. *Could win because* it is the one feature only XRPL makes cheap,
   and it turns our UC3 refund scene from "the liar cooperated" into "the
   ledger enforced it".
2. **Hire the agent** (#274, Tue 10). ResearchAgent sells its own answers over
   x402: an outside agent pays it, it pays the writers it buys from, then
   forwards a **citation royalty** to every writer it cited, free ones
   included, and returns the change. Gates hold: the caller's payment is the
   budget, our policy code makes every purchase, royalties are deterministic
   from the citation list. *Could win because* it is an AI-native business
   model (agents as customers *and* sellers), the Creativity criterion
   verbatim.
3. **Publish in one command** (#277, Fri 13): promoted from stretch to Day 9.

### Lanes

At most three coding lanes; the light lane (Sonnet/Opus docs, config, deck,
video, post drafts) runs beside them and touches no product code.

| Lane | Now (3 Nov) | Next |
|---|---|---|
| A · Reach (Sol) | #255 shipped | #270 app foundation (Wed 4 → Thu 5) → #259 Mac app (→ Sat 7) → #274 hire the agent (Sun 8 → Tue 10) → #277 publish (Wed 11 → Fri 13) → slack #280 |
| B · Engine (Sol; Opus designs) | #256 scorecard | #260 fact menu (Wed 4 → Fri 6) · Opus #261 spike Fri 6 → #273 escrow (Sat 7 → Mon 9) → #276 learns from receipts (Tue 10 → Thu 12) → slack #279, #281 |
| C · Design (Sol; Opus directs) | #257 + #258 | #271 brand kit (Thu 5 → Fri 6) → #262 motion (Sat 7 → Sun 8) → #275 RLUSD (Mon 9 → Wed 11) → slack #278 |
| Light (Sonnet, Opus) | — | #269 repo front door (Wed 4 → Thu 5) · #272 README (Sat 7, Wed 11) · deck v1 Sun 8, v2 Wed 11 · video storyboard Mon 9, cut Wed 11 · short description Tue 10 · daily post drafts |

### Polish to the pitch (no new features unless the streak runs into the weekend)

| Day | Work |
|---|---|
| Thu 12 | **Submit** (owner): description, deck, repo, video. Day 8 ships the same day; nothing in the video depends on it. |
| Fri 13 | Day 9 ships. Buffer for the official deadline (23:59 SGT). |
| Sat 14 – Sun 15 | Slack features if one slipped. Stage kit: the app runs fully offline (fixture) as the venue fallback; `make preflight` covers the app; 2-minute script timed; Q&A sheet with the scorecard numbers (Opus). |
| Mon 16 | Recorded run-throughs; fix what stumbles. |
| Tue 17 | Dress rehearsal on a phone hotspot; freeze `main`; release `v1.0.0`. |
| Wed 18 | Pitch, 11:30 SGT. |

### Post calendar

About one LinkedIn post a day, two on Saturdays and Sundays. Drafts come from
the li-bot skill (Sonnet); each feature post uses that day's issue **Post**
section (feature, visual, number, takeaway) and a clip from `make clip`
(#270).

| Date | Post | Visual | Number | Takeaway for engineers |
|---|---|---|---|---|
| Tue 3 | We're SFF finalists; publicly committing to one feature a day, 5–13 Nov | the calendar as a card | 9 days, 9 releases | how three agent lanes ship hands-off, merge on green |
| Wed 4 | Day 0: Claude Code bought an article over MCP | terminal clip | 23 s to a paid, cited answer | the LLM caller never holds spending authority |
| Thu 5 | Day 1: the app (#270) | 15 s keyboard-only clip | view switch ms, CLS 0 | one derived state model |
| Fri 6 | Day 2: fact menu (#260) | before → after chart | F1, wasted spend | signed metadata > prompt tweaks |
| Sat 7 a | Day 3: Mac app (#259) | DMG → receipt clip | cold start s | Electron `utilityProcess` ran the Node engine unchanged |
| Sat 7 b | Design: the README and brand, before / after (#271, #272) | README hero before/after | — | treat the README as a landing page with tests |
| Sun 8 a | Day 4: watch the money move (#262) | UC3 clip | ledger close → receipt s | animate the money, nothing else |
| Sun 8 b | Builder feedback: 5 things we'd fix on XRPL / x402 (#257) | the Top-5 table | N items from building | concrete repros beat wishlists |
| Mon 9 | Day 5: escrow (#273) | explorer create → cancel | +s, drops per purchase | native primitives over contracts |
| Tue 10 | Day 6: hire the agent (#274) | money-chain diagram | split of one S$2 question | citations as payment instructions |
| Wed 11 | Day 7: RLUSD (#275) | receipt + explorer | settle time, fee | `delivered_amount`, never `Amount` |
| Thu 12 | Day 8: learns from receipts (#276), and we submitted | wasted-spend-by-night chart | 39.5% → N% | your purchase log is ground truth |
| Fri 13 | Day 9: publish in one command (#277) | terminal clip | folder → paid in N s | supply side in one command |
| Sat 14 a | Build story: 9 features in 9 days | Releases page / evolution timeline | PRs, releases, agent-hours | a release a day forces "done" to mean shipped |
| Sat 14 b | Numbers: the 10-day scorecard, every metric before → after | scorecard table | all rows | measure nightly or you are guessing |
| Sun 15 a | Design: one grid for brand, icon and cast (#271, #258) | brand sheet | — | generate the brand from code |
| Sun 15 b | How the agents built it: Sol / Opus / Sonnet split | evolution charts | tokens, PRs per model | which work went to which model, and why |
| Mon 16 | Five hard gates: how we test that an LLM can't spend | gate-audit output | 0 violations over N runs | put the money rules in code and audit them nightly |
| Tue 17 | Two minutes: what we cut from the pitch | script draft | 120 s | — |
| Wed 18 | Pitch day at SFF | stage photo | — | — |

### How the loops run

- Each lane agent takes the next item in its lane, ships it with
  `.claude/skills/ship-pr/SKILL.md`, adds one changelog line here, fills the
  PR's **Story** section (post line, visual, number) and, on a feature day,
  cuts that day's release: from a clean, current `main`,
  `node scripts/release.mjs <day> "<title>" --push` (Day N is `v0.(N+1).0`; add
  `--dry-run` to preview the notes). Pushing the tag publishes the GitHub release.
- Every hill-climb PR pastes `make scorecard -- --compare <previous>` output.
  Ship it only if no gate metric regresses.
- Friction with XRPL, x402, the Starter Kit or Testnet goes into the builder
  feedback log the day it happens.
- Live calls use `EVAL_*` keys within `EVAL_SPEND_CAP_USD`; Testnet only; never
  real money, never cloud resources, never a printed key or seed. The live
  nightly scorecard runs on the owner's Mac, not in CI (decided).

### Needs a human

Everything only the owner can do lives in **[pinned issue #265](https://github.com/Collaboration95/theFastandtheFungible/issues/265)** (pinned, `needs-human`).
Agents add items there and keep working around them.

## Decisions log

- 3 Nov: Lane B fresh-set audit replaces corpus-specific subject/acronym/wafer/year lists before a frozen 48-question/24-new-document test; recommend 93.15% final-used spend [81.25–100.00], with synthetic/fixture caveat and no pooling of the reused holdout. No post-result tuning; [audit](../eval/FRESH-AUDIT.md).

- 3 Nov: Submission pack lives in `docs/submission/` (link-checked by hygiene). The deck is HTML exported to PDF by Playwright on the UX-DIRECTION ink/paper system, one slide per criterion, with every number sourced on the slide. The video and pitch label each scene Testnet, simulated or fixture, and the Claude Code scene does not claim the Testnet purchase (an SDK stdio client made it). Why: judges pre-assess the PDF and video, and overclaiming costs more than it gains.
- 3 Nov: Numbers v7 uses final-used gross spend as the pitch headline, preserving gross/net waste and every gate. Diagnose #320, add wafer-domain rejection and short identifier ranking; dev/synthetic checks then one final reused-heldout run. Point waste 19.95% meets <25%, CI 8.00–36.84% does not establish a below-target population rate. Separate live Testnet sanity evidence never stands in for benchmark confidence.
- 3 Nov (#312): screen and PDF share a question-aware selector over validated claim sentences; no uncited conclusion becomes the lead. Extracts say Lead finding. Report claims are concise extracts, with every cited passage printed once. Keep gross budget authority and gate-5 disclosures unchanged.
- 3 Nov: #278 keeps verification independent of the engine: delivered signed proofs plus per-run audit disclosure, offline by default, explicit Testnet opt-in; export PDF proof attachments and fail legacy unsigned evidence. #314 recovers only already-verified grants through exclusive re-answer, with no new spending.

- 3 Nov: #280 agent keys are hashed principals in the existing admission/purchase ledger, managed by CLI while #311 owns UI; scoped pause/revoke blocks unsigned work and preserves signed-intent recovery.
- 3 Nov: Numbers v6 preserves gross waste, adds confirmed-refund net waste and final-used spend with source-cluster CIs; fix requested-passage selection and the “buying … now” false positive, plus deterministic fact-key/scope vetoes. No heldout retuning or spending-authority change; gross/net 52.87% → 40.68%, target still missed.

- 3 Nov (#275/#310): preserve SGD budgets and fixed labelled demo FX while adding issuer-bound Testnet payments; use explicitly labelled test USD when the official RLUSD faucet requires authentication. Cancel only unsigned refused royalties and refund the caller atomically; uncertain signatures keep their reservation.

- 3 Nov: #311 relocates environment labels per UX-DIRECTION §3.2; net cost leads Spend while gross charges continue to consume budget. Keep the mandatory refund rail even though it makes the literal env-word count 2 rather than the spec's conflicting target 1; #314 tracks the confirmed reconciler-to-answer handoff gap.

- 3 Nov: UX sledgehammer ([direction](design/UX-DIRECTION.md), #311, #312): one header environment indicator replaces the per-surface SIMULATED/fixture labels, which stay on receipts, refunds, exports and where a model or search is substituted (gate 5 kept, relocated); motion limited to a ten-entry allowlist and #262's money flight is not built (budget-bar and status transitions only); ink-on-paper, Geist-only, seven type sizes, plain copy. Why: 8–10 labels and 30 keyframes per screen read as noise to a UX judge.
- 3 Nov: Numbers v5 freezes 48 historical dev + 92 new heldout questions (20 source groups) before the policy pair. Cluster-bootstrap CIs, same-vendor author disclosure, and no heldout tuning; the flat 52.87% waste result and wide interval stay visible.

- 3 Nov: #288 audit trail is a hash chain inside the money transactions (`audit_log`), not a separate log; tamper-evident, not signed or notarised, so COMPLIANCE.md says to pin the head. The denylist is a labelled operator hook (fail closed), not sanctions screening; hire-the-agent is documented as receive-and-forward custody, so "we never hold funds" is dropped for that flow.
- 3 Nov: #288 `data:prune` is an explicit command, default 30 days (long enough to challenge a bad delivery, short enough not to keep paid bodies and questions); it deletes content, never receipts or audit rows.
- 3 Nov (#276): freeze semis/packaging dev vs rates/power heldout before tuning; marginal expected-facts/S$ is deterministic policy, not model spending authority. Accept receipt fits only by grouped dev rules; identity wins this run. Publish the failed 25% waste target and sweep/dev regressions; no held-out retuning or test loosening.
- 3 Nov: #273 ships opted-in `escrow-policy-v1`: buyer-held hashlock, 120 s CancelAfter and a 15 s finish margin; conditional grant before private delivery, proof plus validated release before access; API/SDK/receipts only, direct exact default.

- 3 Nov: #279 injects faults only in test processes, Ledger and HTTP seams; SIGKILL recovery retains synthetic ledger and both journals; each completed iteration audits grants, receipts, refunds and caps. The 12 h soak remains an operator command, with actual shorter-run evidence recorded separately.
- 3 Nov: Day 2 release backfill tags the exact #304 commit with explicit historical notes; no package downgrade, existing tag move or Latest replacement.

- 3 Nov: #260 reuses #300’s signed manifest-v2 `covers` format; bounded untrusted promises are checked on the bound passage, never treated as coverage. Scorecards run locally; final calibration fit rejected; stays off, raw threshold unchanged.
- 3 Nov: #274 hire-v1 receives Testnet funds, reserves budget plus fee through the shared admission, pays a fixed 25% fee royalty equally by distinct cited writer, and returns gross unspent budget; API/SDK/CLI money chain precedes the queued UX work.

- 3 Nov: #261 recommends buyer-held hashlock + CancelAfter for opted-in Testnet writers; ledger enforces cancellation, buyer verifies proof; no fair-exchange or RLUSD claim ([spike](spikes/escrow.md), #273).
- 3 Nov: #287 retains serialized signing and releases payer sequencing on ledger proof, independent of writer delivery; uncertain sequences refuse new signing after a bounded wait. Live recovery reuses the journal blob every 15 s; no Tickets/local sequence allocator before SFF. Scorecard fingerprint v3 retains all exact hashes and prior history for telemetry-only source changes.

- 3 Nov: #277 uses the canonical #260 manifest v2 schema and passage-bound menu verifier; carry its shared protocol files until Lane B lands so the publishing command works from a clean clone.

- 3 Nov: #277 publishes locally with a private `.env.writer`, deterministic public topics, unverified identity and the operator payee denylist; npm distribution stays an owner choice on #265.
- 3 Nov: #286 uses one operator bearer token plus exact Host/Origin checks; local launchers generate and privately forward a token so the demo needs no extra setup.
- 3 Nov: #286 defaults: S$5/run, S$1/source, S$20 gross/wallet/UTC day, MCP caps zero; refunds never restore authority and pause is durable.

Significant product, design and process decisions, newest first. One line each: date, decision, why, link.

- 2026-11-07 — J2 (Reachability / Feasibility): bundled MCP 21.44 → 3.419 MB; cold initialize 6.3 s, Testnet app 27.0 s, UC3 try + ledger PASS 84.2 s; compact Python verification and no-purchase anchor guard. Evidence: docs/evidence/round4-j2/. No release cut.
- 3 Nov: Mac app wraps the Day 1 UI with a main-process protocol proxy, isolated utility-process engine and Keychain custody; final rebase included #286, so remote HTTPS mode uses Keychain tokens, bearer forwarding and shared wallet controls. Package real files because utilityProcess needs a real cwd; Developer ID auto-sign/notarise is ready, unsigned until #265. Tag releases build once before attaching their own DMG (#259).

- 3 Nov: Logo direction chosen: open index, because source boundaries and a route to evidence read at 16 px on the cast’s 24-unit grid; Ink/Paper with sparse Salmon layout accents. Explainers source moves into `site/` for one reviewable app/site identity kit (#271).
- 3 Nov: Added a 4th lane (Architecture) for #285–#288 because #286 auth must land before the Mac app #259 and hire-the-agent #274.
- 3 Nov: SDK: TypeScript in-repo now, Python stdlib example, npm publish pending owner (#265).

- 3 Nov: Overnight autonomous run: Opus orchestrates, Sol/Terra/Sonnet code, auto-merge on green (owner request).
- 3 Nov: Design bar: YC-style clean (Linear/Vercel/Stripe), no childish or hyper-interactive UI; motion only for meaning.
- 3 Nov: Day 1 of the feature run is the local app foundation (#270), because every later post needs a recordable clip.
- 3 Nov: Electron chosen over Tauri for the Mac app (#259): the backend is Node and runs unchanged.
- 3 Nov: Apple Developer ID: yes, owner sets it up later (#265). Until then the app is unsigned with a signing pipeline ready.
- 3 Nov: Nightly scorecard runs locally on the owner's Mac, not in CI.
- 3 Nov: Owner-only tasks live in pinned issue #265.
- 3 Nov: Cloud Run held in reserve; local-first.

## Changelog

- 2026-11-07 — K2 (UX / Reachability): diagnose all ten bought-but-missed dev questions, rank exact delivered technical sentences with passage context, and retain Supports on UC3; v3 answersIt 1/20 → 4/20, v3-dev 2/20 unchanged, negatives 2/10 unchanged, 140/140 online verifications and zero raw audit violations. [#410](https://github.com/Collaboration95/theFastandtheFungible/pull/410); evidence in docs/evidence/k2-lead/.

- 7 Nov: U1 UX polish: a judge walk at 1280/1440/390 found 10 issues and ranked them; Activity no longer ticks steps that haven't happened, the declined "Why ▸" lists plain-word decisions with value vs the bar, "under 1 s" replaces 0.0 s, the key-reveal card reads escrow → key → refund, plus a calmer Export menu, citations, disclosures and readable Settings names. Presentation only. Critique and before/after: `docs/evidence/u1-ux/`.
- 7 Nov: Lane X adds 22 primary-source XRPL explainers through ordinary signed menus and Testnet delivery; disclosed team authorship, no trust boost; dev-bank measurements and source catalogue in `docs/evidence/x-explainers/`.

- 7 Nov: Lane C adds direct portable mode dispatch, sanitized startup plans, a Testnet funding leaf and bounded worker close; three fresh-cache/fresh-wallet packed Testnet runs and unchanged-gate evidence in `docs/evidence/refactor-c/`.
- 7 Nov: Lane B runs independent app/demo/judge browser groups concurrently, seals one replay build per run, and enables all default browser specs; timings and target misses: `docs/evidence/refactor-b/`.

- 7 Nov: Lane A scopes fixture scratch, handles and process groups; leak gate rejects unowned leftovers, startup failures and TERM-ignoring grandchildren are covered, and live acceptance journals retain an explicit XDG-state reason. Evidence: `docs/evidence/refactor-a/`.

- 7 Nov: Shared owner Settings adds nine sections, guarded/audited local changes, macOS Keychain controls, onboarding and window persistence; fixture screenshots and axe evidence in [settings](evidence/settings/README.md). PR #386 completes the guarded zero-clone proxy; packed Testnet Settings cap/audit proof and unsigned arm64 DMG fixture recovery/smoke acceptance are recorded alongside the screenshots.
- 7 Nov — J1: frozen XRPL judge bank, eight disclosed team-authored builder notes, cited Testnet purchases, honest empty answers, corrected UC3 stance/plurals/cancellation labels; replay traces and goldens refreshed (docs/evidence/round4-j1).
- 7 Nov: J3 adds zero-clone `init`, field-level validation before provisioning, labelled real-writer lengths, ephemeral publishing and private live local Testnet discovery; evidence: `docs/evidence/round4-j3/`.

- 3 Nov: Pitch materials moved to the audited fresh-set headline (93.15% [81.25–100.00], 48 questions): slide 7 and PDF, 2-minute pitch with speaker-note caveats, Q&A (waste answer replaced, new overfitting answer from the rule audit), gate-audit and model-cost figures aligned to the fresh scorecard. 80.05% and 52.9% → 40.7% kept only as labelled history.
- 3 Nov: Lane B generalisation audit: four fresh domains, one LIVE run per policy, used spend 90.07% → 93.15%, paired CI touches zero; waste 6.85% [0.00–18.75], uplift +66.67 pts [45.83–83.33], zero gate violations, US$0.1800611 models. README/SFF tables and #321 slide-7 source note updated; simulated payments, no `src/` or deck HTML edits.

- 3 Nov: Submission pack ([docs/submission](submission/README.md)): 50/150/300-word descriptions, a 10-slide deck built from code with its PDF export (`node docs/submission/deck/export.mjs`), a 2:45 demo-video script with commands and existing release clips, a 2-minute pitch (282 words) with a 3-minute variant, and 10 judge Q&A answers. Recording is with the owner on #265.
- 3 Nov: Lane B Numbers v7: waste 40.68% → 19.95%, headline used spend 59.32% → 80.05% [63.16–92.00]; classify all 24 #320 wasted purchases, minimal scope/tokenizer fixes, all CIs and limits retained. Live UC2 purchase plus UC3 failed proof/refund/replacement, four validated Testnet txs, zero audit violations, US$0.3389854 models.
- 3 Nov: Lane C #314/#278 automatic verified-delivery → answer recovery, versioned answer/report receipt bundles, API/SDK and `npm run verify:answer` offline + read-only Testnet; UC3 FAILED → DONE with two receipts, one on-ledger refund, zero gate violations and an exact-citation tamper failure ([evidence](evidence/verify-278.md)). No `src/` edits.

- 3 Nov: Lane C #280 one wallet/many agents: private-file token creation, per-agent caps/pause/revoke, shared policy accounting and principal exports; two MCP clients + SDK spent 0.18 Testnet XRP + 24 drops fees, zero gate violations ([evidence](evidence/agents-280.md)).
- 3 Nov: Lane B Numbers v6: gross/net heldout waste 52.87% → 40.68% (paired 95% CI −28.57 to −1.23 pts); used spend 47.13% → 59.32%. Two extraction and four fact-scope regressions, README/scorecard definitions and CIs; 0 audit violations, US$0.4412058 models, simulated payments.

- 3 Nov: Lane C #275/#310 issued-currency quotes, policy/SDK/receipts, trust-line/reserve preflight and partial-payment rejection; unsigned denylisted royalty cancellation and caller refunds with audit coverage. Full UC2 writer received 0.90 test USD; 2,500-drop refused royalty returned, reserve zero ([evidence](evidence/rlusd-275-refund-310.md)). No `src/` changes.

- 3 Nov: UX direction for the redesign: 11-category anti-pattern audit with 29 before-screenshots, labelling and motion policies, screen specs for plan, payment, verification, refund and receipt; build filed as #311 and #312 ([doc](design/UX-DIRECTION.md)).
- Lane B Numbers: classify all 10 final wasted purchases in four categories; 140-question bank, source-cluster CIs and explicit country-scope veto. New heldout waste 52.87% → 52.87% [28.30, 73.31], target missed; no quality gain. Zero final audit violations; US$0.8681326 live models; simulated payments.

- 3 Nov: Lane D #288 hash-chained `audit_log` written in the same transaction as each admission, decision, reserve, sign, settle, deliver, proof, refund, refusal and pause; CSV/JSONL receipt export (`audit:export`, `/api/audit/receipts.*`); `audit:verify [--testnet]` (5 of 5 October Testnet payments re-confirmed read-only); hire-the-agent inbound, royalty and change payments covered too; payee denylist tests and audit reason; `data:prune`; [COMPLIANCE.md](COMPLIANCE.md).
- 3 Nov: Lane C #273 escrow-v1 integrated with the payer queue and durable reconciler; SYNTHETIC product-path Testnet finish 12.107 s, failed-proof cancel 129.448 s with writer offline, 459 drops fees; #288 hash-chain events and escrow-aware audit:verify; [evidence](evidence/escrow-273.md).

- 3 Nov: Lane A #279: 500 chaos iterations plus two 30-minute fixture soaks (1679 main fault episodes, 423 SIGKILLs, 124 additional escrow probes), zero double charges or invariants in completed runs; one interrupted harness run retained and duplicate observations repaired. Seeded 20-run CI smoke; 12 h operator mode. Day 2 / v0.3.0 backfilled on #304 with honest selection/uplift/waste notes ([evidence](evidence/chaos-279.md)).

- 3 Nov: Lane D #287 live payment reconciliation, reserve precheck, protected deep health/metrics, JSON money logs and ops runbook; synthetic queued-payment p95 307.91→6.24 ms under 300 ms writer delay; one verified 0.06 XRP Testnet payment ([evidence](evidence/payment-ops-287.md)).
- 3 Nov: #274 adds x402 hired answers, generic `sdk/x402` buyer, optional remote MCP hire, durable capped royalties/change and a separate caller demo; fixture and live chain evidence in `docs/evidence/hire-274.md`.

- 2026-11-03: #286 shared admission, wallet cap/pause, bearer and rebinding guards, capped decision inputs and adversarial injection pack; native token contract posted on #259.
- 3 Nov: Lane C #261 standalone Testnet escrow spike: clean release 14.492 s / 435 drops, cancel 54.871 s / 24 normal-path drops, nine validated txs including negative probes; #273 build contract and live builder feedback ([evidence](spikes/escrow.md)).

- 2026-11-03: Reused test search indexes and optimized leak-oracle comparisons to shorten hard-gate runs without changing coverage.
- 3 Nov: #277 Markdown publishing command, three starter articles, signed x402 writer and local registration; Testnet folder → verified paid read **18.90 s**, one **0.01 XRP** payment ([proof](evidence/publish-site-277.md)).

- MCP Testnet proof: stdio purchase settled on XRPL Testnet with delivered citations and a ledger-checked idempotent retry.

### Tue 3 Nov
- Live reliability: measured the same 30-run UC1–UC3/held-out sequence on real research/decision providers and XRPL Testnet; clarified the planner prompt without changing its spending-language guard, bounded provider retries and embedding failure fan-out. Synthetic corpus and scenario costs stay labelled; [paired evidence](evidence/live-reliability.md).
- UX lane #312: answer and claims, article-specific Activity, supporting tables/palette/settings, mobile Spend sheet and neutral site. UC3 PDF 50 → 4 pages on the same v0.5.0 snapshot; citation-backed dated lead replaces the author introduction. Rebased onto Lane B #320; UI makes no spending-policy change.
- UX lane #311: shell, environment popover, plan, payments/verification/refund, net Spend and receipt sheets; four allowed keyframes, no in-app cast/odometer. Recovery state clarified; #312 retains answer/supporting-screen/PDF/site work.
- Lane B #276: value-of-information veto, conservative signed-menu duplicate checks, keyed receipt refit and exact intent/answer labels; held-out waste 39.39% → 35.48% (target missed), flow F1 0.588 → 0.625, uplift +15.38 pts unchanged; dev waste 51.79% → 44.19%, flow F1 0.308 → 0.296. Zero gate violations; scorecard/README refreshed.
- Lane B #260: signed corpus fact menus, both decision providers and local scorecards; live F1 0.235 → 0.419, waste 36.19% → 47.19% (both targets missed), zero gate violations; README regenerated, fixture quality unchanged.
- Lane A #259: installed unsigned Apple Silicon DMG, 136,597,522 bytes (130.27 MiB); launch to interactive 2.070 s with fresh fixture data. UC1–UC3, refund, report, Keychain round trip and hardening checks pass; no live payment/signing claim. [Evidence](evidence/macos-app-259.md).
- Published the branded explainers and shared header to Pages, preserving the evolution dataset and branch-only content; added a manual publish script.
- UI polish: use the brand palette's purse icon in the budget card and correct singular count labels.
- Lane light #272 (pass 1): startup-style README (hero, Claude Code MCP in one command, local run, how a run works, Testnet proof, fixture-labelled scorecard table generated by `scripts/readme-scorecard.mjs`); MCP and make-target detail moved to [mcp.md](mcp.md) and [running.md](running.md); one header across the explainers pages via `scripts/site-header.mjs` (checked in `npm run hygiene`; slides and notes keep their own presentation chrome). App GIF and Mac download link wait for pass 2.
- Lane C #271: shipped the open-index brand kit, deterministic SVG/PNG/ICO/ICNS exports, app and explainers-source favicons/OG cards, naming audit, and two restrained cast refinements.
- Lane D #285: typed TypeScript SDK, SDK-backed MCP tools, validated config and mechanical API routers; fixture delivery/idempotency, route parity and unchanged MCP e2e verified.
- Architecture review ([REVIEW-NOV-2026.md](contracts/REVIEW-NOV-2026.md)): four do-now seams filed as #285 (SDK v0, config, route split), #286 (one spend gate, auth, injection hardening), #287 (live reconciler, health, metrics), #288 (audit trail, export, COMPLIANCE.md); fold-ins commented on #259, #273–#275, #277–#281.
- Lane light #269: repo front door. Description, topics and homepage set; MIT licence (revertible until the owner's veto on #265), CONTRIBUTING, SECURITY, Code of Conduct, issue templates, CODEOWNERS; `npm run hygiene` in `check:fast`; `scripts/release.mjs` and a release workflow for one tag per feature day.
- Lane A #270: keyboard-first Run/Writers, one event-derived state model, visible simulation rails, stage-review fixes #225–#231 and isolated recording/18 s clips; 11 production-browser checks pass, UC2 CLS 0.0138.
- Planned the feature-a-day run (9 days, 5–13 Nov, slack of 4), repo identity and the post calendar; filed #269–#281; owner-only items moved to #265 ([calendar](#feature-a-day-5-13-nov)).
- Lane A #255: reusable isolated engine + four stdio MCP tools; human caps and durable retries; fixture search → simulated purchase → delivered citations proven end to end.

### Mon 2 Nov
- Lane B: nightly scorecard + six-rule read-only gate audit (#256); 48 questions, 116 coverage snapshots, 10 timed API queries, zero provider calls and zero gate violations. Live unavailable without EVAL credentials.
- Lane C: added 15 implementation-backed feedback items plus the 15 September submissions, a mainnet gap checklist, and a restrained 48-state SVG system (including 16/24 px marks) with accessible React marks and reusable post cards (#257, #258); SFF timeline chapter follows the main merge.
- Planned the next 10 days: three lanes, two surprise bets, wave-1 issues #255–#262 ([Plan](#plan)).
- Audit cleanup: patched production dependencies, synchronized Stop scoring, isolated browser-test ports/ledgers, corrected preflight and docs, and aligned the search eval with production ([#254](https://github.com/Collaboration95/theFastandtheFungible/pull/254)).
- Resumed after the 10–11 Oct demo. Audits: CI green, 478 tests pass, fixture demo runs end to end.
- Judging criteria and PR template: every PR opens with the criterion it serves (#251).
- Filed the cleanup as #248–#250 (one PR). Started the CI-cost work. Started planning the next feature set.
- Closed stale draft PRs #245, #246. Cloud Run kept in reserve (code at `ce77f59`).

- 2026-11-04: Lane E ranks six XRPL/x402 findings, pins capability profiles, and adds a generated nine-row historical TESTNET ledger with bounded read-only refresh; fixture/browser/axe checks pass. Public tx lookup returned txnNotFound, so no fresh verification or deployment is claimed.

- 2026-11-04: Lane B adds exact component coverage ratchets (payments ≥85%), required Chromium/Python admission and parallel unchanged chaos; aggregate check rejects failed, cancelled or unexpected skipped gates; same-run GET recovery fixes the #345 oversized-SSE browser regression. Hosted CI: 278 → 249 s; all required jobs green. Evidence: docs/evidence/round2-b/.
- 3 Nov: Browser replay at `/demo/` uses the real app and recorded UC1–UC3 fixture event traces, including UC3 refund; no backend or keys.

- 2026-11-04: Lane D bundles #332 static UC1–UC3 replay, clean tgz/wheel/MCPB consumers (eight cited passages, one intent/receipt each), same-SHA release admission and actual-state controls; local fixture evidence and owner upload packet: docs/evidence/round2-d/.

- 2026-11-04 — Lane F: three pinned local writer origins in one search; canonical source identity v1 through policy, grants, citations, reports, receipts, calibration and hire recipients; v1 verification retained. Abortable bounded discovery and source-qualified unsigned refusals; offline collision/restart/dead-origin proof and screenshots: docs/evidence/round2-f/. Public remote federation deferred.
- 2026-11-04 — Lane I: agents can durably pause their own spending through TS/Python SDKs and MCP; operator-only resume, scoped audit and in-flight signing gates verified with synthetic fixtures (docs/evidence/round2-i/README.md).
- 2026-11-04 — Lane J: UX polish with no behaviour change: receipt "What your money bought" (summary line, dot+text status rows, expandable claim rows with exact passage, secondary verify), grouped Mac Settings cards with inline connection-test result, recovery screen with primary action and common causes; before/after in docs/evidence/round2-j/.
- 2026-11-04 — Lane J: UX polish with no behaviour change: receipt "What your money bought" (summary line, dot+text status rows, expandable claim rows with exact passage, secondary verify), grouped Mac Settings cards with inline connection-test result, recovery screen with primary action and common causes; before/after in docs/evidence/round2-j/.
- 2026-11-04 — Lane K: independent offline Python v1/v2/v3 receipt verifier, real Ed25519/secp256k1 checks, written spec and CLI; TS/Python agree on all 177 conformance cases; wheel consumer now verifies receipts; Python 3.10 also passes (docs/evidence/round2-k).
- 2026-11-04 — Lane L: documentation front door. README rewritten (pitch, hard guarantees kept, per-surface install paths with publication status stated, evidence table with scope labels, verified quick start, engineering and honesty sections); docs index reorganised by audience; new CHANGELOG.md (Unreleased 1.0.0 candidate from #332 and #341–#352, plus v0.1–v0.8). Counts from a real run at fd5a089b: 1,117 TypeScript and 205 Python tests.
- 2026-11-04 — Lane M: indexed source-row wallet/agent accounting and operational selectors; exact legacy oracle, concurrent reservation and SIGKILL recovery proof; 600-ask retained-history soak passes memory/p95-drift gates, loop p99 improves 4,261 → 206 ms but still misses <50 ms; no threshold changed (docs/evidence/round2-m/).

- 2026-11-04 — Lane N: trusted XRPL Credential writer identity, read-only bounded checks, advisory UI/SDK/MCP states; two Testnet credentials issued/accepted, third writer unverified; spending and signed receipts unchanged (docs/evidence/round2-n/README.md).
- 2026-11-04 — Lane N PR #357: implementation and live Testnet proof complete; GitGuardian incident 39528977 falsely flags the public credential type in 12 evidence locations. Merge awaits classification tracked in pinned #265; no scanner gate was loosened.

- 2026-11-04: Lane N credential evidence stores public type text and derives XRPL hex at runtime; scanner history repaired without ignores or gate changes.
- 2026-11-04 — Lane M2: exact-byte bounded validation caches and research/decision yields reduce worst worker interval p99 205.914 → 28.623 ms; all five integrated 600-ask soak gates pass, 200-run SIGKILL chaos has zero violations/double charges; no thresholds loosened (docs/evidence/round2-m2/README.md).

- 2026-11-04 · Lane P1 (Builder feedback / Feasibility): ledger auto-verifies 13/13 historical Testnet rows over bounded WebSocket; XRPL primitive links, CredentialCreate badges, truthful SGD/asset events, seven <30 s feedback repros and upstream drafts. Evidence: `docs/evidence/round2-p1/README.md`.
- 2026-11-04 — Lane Q: fixture-only Codespaces first run; consistent RA_URL/:8788 examples buy S$0.90 analyst evidence and report 2/2 facts; dash/quote normalisation and corpus-calibrated keyword abstention; clean Node 22 clone validated, no real Codespace (docs/evidence/round2-q/README.md).

- 2026-11-04 · Lane P2: `make testnet` isolates faucet wallets (0600); cold first validated hash 60.005 s. `/demo/` autoplays recorded XRP Testnet UC3 pay → failed proof → refund → re-buy with Pause, explorer/live checks; 1,874,689-byte JS+JSON, labelled simulated fallback. Evidence: `docs/evidence/round2-p2/README.md`.

- 2026-11-04 — Lane R: opt-in XRP key-reveal escrow makes XRPL the delivery channel; four validated Testnet transactions, two offline verifiers, pre-grant quarantine and three actual SIGKILL recovery boundaries. Evidence: `docs/evidence/round2-r/`.

- 2026-11-04 — Lane Z (Reachability): standalone MCP npm tarball, clean npx/SDK consumers, post-tag install snippets and labelled local zero-clone timing evidence; registries remain unpublished.
- 2026-11-04 — Lane T: opt-in policy-owned XRPL answer anchors, additive anchor-v1 receipts, TS/Python --ledger PASS on ledger 22048303 (12-drop fee), tamper FAIL, restart/conformance coverage; evidence round2-t.

- 2026-11-04 — Lane T recovery: preserve #364/#365 on rebase; prevent delayed environment onboarding from covering Ask. Existing browser assertions and 184 receipt conformance cases unchanged. Evidence: `docs/evidence/round2-t/README.md`.

- 2026-11-04 — Lane U: worker snapshots retain about 110 MiB (publisher index about 17 MiB); nursery 96→16 MiB, full RSS 982.93→906.84 MiB and GC max/p99 73.43/10.85→22.94/0.71 ms. Historical loaded-host loop miss was 57.44 ms; quiet-host full soak now passes all five gates at 25.8 ms ([evidence](evidence/soak-nov4-ab/README.md)); no threshold changed. [Evidence](evidence/round2-u/README.md).

- 2026-11-04 · Lane V1: added faucet-Testnet key-reveal autoplay, no-show cancellation, shared browser key/Condition and ciphertext proof, explicit ledger labels and fair-exchange footer; raw grant/citation audits retained.
- 2026-11-04 — Lane V2 (Reachability / UX): validated cold-wallet startup (3/3 captures; first hashes 76.448/77.810/71.768 s), Testnet Codespaces config (schema/local clone only), Testnet README hero and verify links, explicit MCP caps/hint, honest net/gross budget and kept/refunded counts; evidence docs/evidence/lane-v2/.

- 2026-11-04 — Lane W: add paired idle-loop control and opt-in span/CPU attribution, bound Store statement reuse and skip unused trace hydration; clean disposable consumer/tool scratch. Historical heavily loaded shared-host full soak failed; quiet-host full soak now passes all five gates at 25.8 ms ([evidence](evidence/soak-nov4-ab/README.md)); no gate loosened. Evidence: docs/evidence/round2-w/.
- 2026-11-04 · Lane X: live key-reveal lifecycle and policy checks, escrow-finish refunds/re-buy and multi-origin hire; local Testnet default after V2 with explicit Payment opt-out; cold-faucet hashes and verification in docs/evidence/lane-x/.

- 2026-11-04 — Feasibility (W2): controlled A/B/C/B/A plus load-affected B rerun find no W regression; quiet full C soak passes all five unchanged gates (loop p99 25.821 ms). Evidence: docs/evidence/soak-nov4-ab/README.md; local synthetic/SIMULATED only.

- 2026-11-04 — Lane Y: link RC SDK/Python/MCP installs and unsigned DMGs, report package MCP version, reconcile quiet-host soak evidence, mark upstream drafts unfiled, and record #367–#374.

- 2026-11-04 — Lane Y verification: replace pre-release URL prohibition with generated RC command and registry-status assertions; no spending or performance gate changed.

- 2026-11-04 — Reachability / Feasibility (Lane A3): `npx -y <mcp tgz> --testnet` runs real key-reveal + anchor on XRPL Testnet with no clone (init 11 s, cold wallets 17 s, validated hashes on s.altnet), devcontainer-in-CI Testnet boot workflow, and the Testnet cost card in README Numbers. Evidence: docs/evidence/round3-a/README.md; models/writers stay fixtures, faucet failure is a labelled SIMULATED fallback.

- 2026-11-04 — Lane B (Technical depth): the verifier passes our own runs. A refunded key reveal passes only with a validated writer refund (`key-reveal-proof`); `researchagent verify --ledger` (TS and Python, no Node) checks anchor, payments, refunds and escrow events read-only; anchoring is on by default on Testnet (`ANCHOR_RAIL=off` opts out); Export ⋯ downloads receipts.json; 8 new conformance vectors (192 → 200 cases). Evidence: docs/evidence/lane-b3/.

- 2026-11-04 — Lane B (Creativity / UX): the default `/demo/` replay is the Testnet key-reveal UC3 (key published, broken promise, writer-signed refund labelled as cooperative, second key reveal, anchor) with no "Failed" frame in any tab; fraud-proof download, gate-5 `missing_rail_label` for cooperative refunds, policy-only Testnet CredentialDelete for our own issuer. Replay goldens changed.

- 2026-11-04 — Reachability (Lane D3): `npx -y <mcp tgz> app --testnet` serves the web UI on 127.0.0.1 over the packed Testnet engine with no clone (cold 34.7 s to ready, browser-driven Kestrel purchase, validated hashes on s.altnet, S$5/day Testnet cap); tgz +0.19 MB; simulated `app` consumer in default CI. Evidence: [round3-d](evidence/round3-d/README.md).

- 2026-11-04 — Lane E: opt-in TEST-SGD key-reveal XLS-85 escrow (public-faucet issuer, no real value, stand-in for RLUSD), 3 happy + no-show ledger runs, 224/224 TS/Python conformance; RLUSD flag-gated control refreshed. MCP IOU and Lane C ledger rows follow up.
- 2026-11-04 — Feasibility / UX (Lane C3): `publish --testnet` (repo bin + MCP tgz) puts a faucet writer live with a Testnet Credential and key-reveal escrow in 43.8 s cold (buyer key-reveal sale by 67.7 s), a "Real writers" list (empty until consent) on README and /ledger/, `per_call_cap` clamp reason, first-touch polish sweep and the `npm run test:judge` headless judge path. Evidence: [docs/evidence/round3-c/](evidence/round3-c/README.md).

- 2026-11-07 — M1: zero-clone MCP and app Testnet IOU opt-in, cached TEST-SGD issuer/trust lines, labelled token amounts and IOU receipt evidence (stand-in for RLUSD; no real value).
## Testnet judge-path metrics · 7 Nov 2026

Historical round-4 observations on `421f5f9f`: fixture models / fictional writers,
real Testnet, no real value. [Evidence and limitations](evidence/round4-l4/judge-path.md).

| Metric | Observed |
|---|---:|
| Demo load → first verified hash / Done | ~1 s / 7 s |
| Ledger → 45/45 verified | 27.5 s (L4 results below) |
| MCP cold initialize / package | 56.5 s / 21.4 MB |
| Faucet setup (prior card / app / MCP) | 17 / 19.1 / 24.3 s |
| MCP fresh cache → verified anchored answer | ~112 s (sum) |
| App cold ready / fresh cache → anchored UC3 | 134 / ~190 s |
| UC3 fees: create / conditional finish / refund / anchor | 12 / 423 / 12 / 12 drops |
| UC3 six-transaction fees | 894 Testnet drops |
| Frozen judge-bank buy-and-cite hit rate | unmeasured; J1 owns measurement |
| Devcontainer CI / validated purchase | ~130 / 43.9 s; Codespace substitute |

### L4 fixture refresh · 7 Nov 2026

Fixture models, synthetic corpus, SIMULATED payments; 0 provider calls / US$0 /
0 Testnet drops. Historical fixture → fresh fixture (different input hashes,
descriptive only; see `eval/scorecard/ROUND4.md`). Historical LIVE fresh-set
numbers above remain a separate evidence class.

| Metric | 2026-11-03 fixture before | 7 Nov fixture after |
|---|---:|---:|
| usedSpendPct | 69.82 | 70.73 |
| wastedSpendPct | 30.18 | 29.27 |
| supportedFactUpliftPts | 36.55 | 37.93 |
| selectionF1Flow | 0.55 | 0.57 |
| p50FirstAnswerMs | 47 | 190 |
| p95FirstAnswerMs | 129 | 655 |
| coldStartMs | 581 | 3962 |
| Audit violations | 0 | 0 |

Live read-only ledger: **27.5 s → 1.970 s**, 45/45, first verified row 1.143 s
(`docs/evidence/round4-l4/live-ledger.json`). Local CI-style browser fixture:
**128 ms initially / 529 ms after rebase**, 45/45; no historical fixture timing retained. Six-second threshold unchanged.
- 2026-11-07 — R5 A: anchor DONE Testnet abstentions, expose no-purchase exports/fee labels, and show serial IOU provisioning progress; evidence and measured cold-start target miss: docs/evidence/r5-a/.
- 2026-11-07 — R5 K (Reachability / UX / Feasibility): answer-first team notes, question-ranked cited findings, relevant Disputes, honest policy declines with reasons and measured duration, and an Ask-clearing environment popover; evidence in docs/evidence/r5-k/.

- 7 Nov: P1 fixture-only threshold dev sweep; UC rows preserved, dev waste ceiling missed (30.30% > 18.75%); keep 0.20, v4 reserved for orchestrator. Evidence: `docs/evidence/p1-threshold/`.
