# Two-minute pitch · Wed 18 Nov, 11:30 SGT, Swiss Pavilion

Spoken at about 140 words a minute. The judges know the problem, so we skip it
and lead with what we built and what changed since SingHacks. The slide numbers
refer to [the deck](ResearchAgent-SFF-deck.pdf). If the slot is three minutes,
use the [3-minute variant](#three-minute-variant).

Rules for the speaker: say "Testnet" once, early, and plainly. Every number
below is in the deck with its source. Don't round up.

## Script (~290 words)

**[0:00 · slide 1]**
ResearchAgent is research with a wallet. You give it a question and a budget.
It answers from free sources first, then buys the one article it is missing,
straight from the writer, over x402 on the XRP Ledger. Everything you'll see
settled on XRPL Testnet.

**[0:20 · slide 2]**
The model decides what is worth buying, but it can never spend. Only
deterministic policy code can pay, inside your budget, one charge per intent.
Our gate audit found zero violations across ten runs.

**[0:35 · slide 3]**
At SingHacks, a human approved every purchase. Since then we've shipped five
releases and forty pull requests, and other agents can now use it.

**[0:45 · slide 4]**
Claude Code adds it with one command, and the caps stay in human hands. There's
a Mac app, an SDK, per-agent allowances, and one command that turns a Markdown
folder into a paid writer. That took 19 seconds on Testnet.

**[1:05 · slide 5]**
The part we're proudest of: other agents can hire ResearchAgent over x402. It
buys what it needs, returns the change, and pays a royalty to every writer it
cites, even the free ones. The citation list becomes a payment instruction.
Five hops, every drop accounted for on the ledger.

**[1:25 · slide 6]**
And when a writer lies, the ledger enforces the refund. With native XRPL
Escrow, a failed proof cancelled and returned the full amount, with the writer
offline.

**[1:40 · slides 7 and 9]**
Model calls cost less than half a US cent per question, and network fees are
twelve drops. On 48 questions we hadn't tuned on, 93% of article spend bought a
fact in the final cited answer. We also logged 35 pieces of builder feedback
for XRPL and x402.

**[1:52 · slide 10]**
Every claim here has a Testnet transaction you can check. ResearchAgent: an
open market where agents pay the people who know.

**[2:00]**

## Three-minute variant

Use the script above, and add these three beats at the marked points (about
+120 words, ~2:55 total).

**After slide 3 (+0:20)** · *What it learned:* "We also measure whether it buys
the *right* thing. We froze 48 new questions before running anything. 93% of
article spend bought a fact in the final answer, and the confidence interval
runs from 81 to 100. Our earlier 80% was on a set we had looked at too often,
so we no longer use it."

**After slide 6 (+0:20)** · *Why XRPL:* "XRPL let us do this without a single
smart contract. Escrow, issued currencies, invoice IDs and memos are native,
fees are twelve drops, and ledgers close in seconds. That's what makes paying
per article viable."

**Before slide 10 (+0:20)** · *Honest limits:* "What's not done: payer keys in a
KMS, the official RLUSD issuer and live FX, KYB and sanctions screening. We
wrote a mainnet checklist rather than claim readiness."

## Speaker notes: the 93% sentence

Say it as written, and keep these caveats ready. They are also on slide 7.

- **Exact claim:** "On 48 fresh synthetic questions, 93.15% of gross article
  spend bought a requested fact retained in the final cited answer (95% CI
  81.25–100.00%)." Say "93%", not "93% of facts" or "93% accurate".
- **What it is not:** live decision models, but a fixture research corpus and
  simulated payments. It is not a production result or a customer ROI.
- **Not a significant improvement:** the paired gain over the previous policy
  is +3.08 points (95% CI 0.00–9.43), which includes zero. Don't say "better".
- **Limits:** the policy and the questions were written by the same agent and
  frozen before one run each. The labels are from the same model vendor as the
  decision model and await human review. The questions follow templates.
- **Historical, don't quote as current:** 80.05% (a reused holdout) and the
  52.9% → 40.7% waste figures.
- Source: `eval/scorecard/fresh-results.json`, `eval/FRESH-AUDIT.md`, PR #327.

## If the live demo is allowed

Swap the slide-5 beat for a 25-second clip: `make clip UC=UC3` (refund scene),
or the hire-the-agent terminal from the [video script](demo-video-script.md) (scene 5).
The venue fallback is the Mac app offline, where payments are simulated and the
header says so.
