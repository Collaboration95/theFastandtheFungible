# Two-minute pitch · Wed 18 Nov, 11:30 SGT, Swiss Pavilion

Tenity's emails say both 2 and 3 minutes, so this script is **2:00** and the
[3-minute variant](#three-minute-variant) adds three beats. Ask Tenity which it
is (open item in the organiser brief). Spoken at about 140 words a minute.

The brief says to skip the problem statement and cover the solution, key
developments, and what we achieved since SingHacks. So we open on the
mechanism, not the problem. Slide numbers refer to
[the deck](ResearchAgent-SFF-deck.pdf) (14 slides); each slide's speaker notes in
[deck/index.html](deck/index.html) name the judging criteria it serves.

**Rules for the speaker:**
- Say "Testnet" in the first 20 seconds. Call the hosted app "our live Testnet
  sandbox" (open 13–19 Nov); never say "live service", "production" or
  "mainnet".
- Every number below is on a slide with its source, and comes from
  [facts.json](facts.json). Don't round up. Read this page rendered on GitHub:
  the markers that keep numbers in sync are hidden there.
- The deck has no placeholders: every number on it is filled from
  [facts.json](facts.json), and its export fails if one is stale.

## Script (~265 words)

**[0:00 · slide 1]**
ResearchAgent is research with a wallet. Give it a question and a budget. It
answers from free sources, then buys the articles it's missing, straight from
the writer, over x402 on the XRP Ledger: at most one per round, up to three
rounds, inside your budget. Everything you'll see runs on XRPL Testnet, and you
can try it yourself in our live sandbox until 19 November.

**[0:18 · slide 5]**
Here's what's new. The writer only gets paid by publishing the article's key on
the ledger. We lock payment in a native XRPL escrow whose condition is the hash
of that key. Delivery and payment become one ledger event. No smart contract.

**[0:36 · slide 6]**
From the command line it works in a stablecoin-style token too, through XLS-85 token escrow. Official
RLUSD is one issuer flag away, and that's our top piece of builder feedback.

**[0:48 · slides 2–3]**
At SingHacks we had a prototype: a language model proposed each purchase, a
person approved every quote, and payment was simulated by default. Since then we merged <!--f:prs-->270<!--/f-->
pull requests. Today a judge opens one link, or runs one line with no clone and
no account. It buys, catches a broken promise, gets refunded, re-buys, anchors
the answer and prints "result: pass" with six Testnet links.

**[1:08 · slide 7]**
Don't trust us, verify it. Two verifiers, written separately, one in Python with no
Node, re-check every receipt against the ledger. Our ledger page lists
<!--f:transactions-->61<!--/f--> historical Testnet transactions with live
read-only checks.

**[1:22 · slide 8]**
The same package is an MCP server for Claude Code and a local app. And it knows
when not to buy: ask it something its sources can't answer and it spends nothing,
and the refusal is anchored on the ledger, so anyone can open the proof. On
<!--f:offtopic_N-->ten<!--/f--> off-topic questions from a blind bank it bought
nothing. The slide shows that bank with both numbers.
[Evidence](../evidence/v5-heldout/README.md).

**[1:36 · slide 9]**
Our measured key-reveal purchase used <!--f:fee_drops-->435<!--/f--> drops in
network fees, 12 from the buyer and 423 from the writer. Only policy code spends, and the blind banks ran on Testnet with
<!--f:heldout_violations-->0<!--/f--> gate violations.

**[1:48 · slide 14]**
Every payment has a Testnet hash. ResearchAgent: paid on delivery, proven on
the ledger.

**[2:00]**

## Three-minute variant

Add these beats at the marked points (about +125 words, ~2:55 in total).

**After slide 6 (+0:20) · What the ledger can't do:** "Key reveal makes
*delivery* atomic, not *quality*. If the article breaks its promise after the
key is out, the refund is writer-signed. Our test writer cooperates; a real one
could refuse. So the buyer gets a fraud proof anyone can check, and the writer's
trust score drops. We label that on every refund."

**After slide 8 (+0:20) · Writers:** "Writers join with one command. A Markdown
folder becomes a Testnet writer with an XRPL credential in <!--f:writer_s-->33.9<!--/f-->
seconds (J3, #389). Our demo writers are fictional or labelled team-authored,
and we have no independent writers yet. That list stays empty until a real
person consents."

**On slide 12 (+0:15) · Honest limits:** "What's not done: payer keys in a
KMS, RLUSD escrow until the issuer allows it, and KYB and sanctions screening.
We wrote a mainnet checklist instead of claiming readiness."

## Timing marks for rehearsal

| Mark | Slide | Beat | Words |
|---|---:|---|---:|
| 0:00 | 1 | What it is, Testnet | 46 |
| 0:18 | 5 | Key reveal | 42 |
| 0:36 | 6 | Stablecoin escrow, RLUSD flag | 26 |
| 0:48 | 2–3 | Since SingHacks, one link or one line | 46 |
| 1:08 | 7 | Verify | 29 |
| 1:22 | 8 | Reachability, judge bank | 34 |
| 1:36 | 9 | Fees, gates | 23 |
| 1:48 | 14 | Close | 19 |

Running out of time? Cut slide 6 (the stablecoin beat) first, then slide 9.
Never cut the "Testnet" line on slide 1.

## Speaker notes: numbers to say exactly

- **`try` timing, if asked**: one cold run took <!--f:try_s-->84.2<!--/f--> s
  with an empty npm cache and fresh faucet wallets, 7 Nov;
  <!--f:try_misses-->2 of 4<!--/f--> cold attempts overran 90 s. Source:
  `docs/evidence/round4-j2/`. It is not in the script any more: the live
  sandbox is the first thing judges use.
- **"<!--f:heldout_n-->sixteen<!--/f--> of <!--f:heldout_N-->twenty<!--/f-->"**:
  <!--f:heldout_line-->v5 blind held-out: 16/20 bought and cited, 0/10 off-topic purchases (run once, 11 Nov, on XRPL Testnet: fixture research and decision models with answers written offline, team-authored writers)<!--/f-->.
  The key fact leads the answer in <!--f:answers_it-->7/20<!--/f-->; 0 gate
  violations. Say that the development sets are separate (v1
  <!--f:dev_v1-->16/20<!--/f-->), because we tuned on them. Do not say "fifteen
  of twenty": that was an earlier, tuned bank.
- **"<!--f:prs-->270<!--/f--> pull requests"**: merged into `main` since
  <!--f:since-->21 Sep<!--/f-->, counted at <!--f:sha-->bd52beff<!--/f--> on
  <!--f:as_of-->11 Nov 2026<!--/f-->. Say "since SingHacks", not "in a week".
- **SingHacks baseline**: in the event build (19–20 Sep, `e16435a3`) a language
  model proposed each purchase and a person approved every quote
  (`approvalPolicy: 'MANUAL_APPROVAL_REQUIRED'`); payment was a fixture by
  default with optional Testnet settlement. The earlier prototype tag
  `hackathon-baseline` (7 Sep) had no approval step. Today there is no
  per-purchase approval: policy code buys within the budget after one plan confirmation.
- **"<!--f:fee_drops-->435<!--/f--> drops"**: 12 for EscrowCreate, paid by the buyer, plus 423 for the
  conditional EscrowFinish, paid by the writer, as we sign on Testnet. rippled's own minimum
  is 360 (10 + 350). At an assumed S$2 per XRP that is S$0.00087,
  a projection.
- **"0 gate violations"**: the read-only gate audit on the v5 held-out and
  off-topic banks, run on XRPL Testnet on 11 Nov
  ([evidence](../evidence/v5-heldout/README.md)). The earlier 10-run, 568-observation
  audit (fresh-question evaluation, 3 Nov) used simulated payments: do not quote it as
  a Testnet result.
- **The 93% number is not in the 2-minute script.** If asked, say it exactly:
  "On 48 fresh synthetic questions, 93.15% of gross article spend bought a
  requested fact retained in the final cited answer (95% CI 81.25–100.00%)."
  Live decision models, fixture research, simulated payments. Not a production
  result; the paired gain over the old policy (+3.08 pts, 0.00–9.43) is not
  significant. See [qa-prep.md](qa-prep.md#19-does-it-actually-buy-the-right-things).

## If a live demo is allowed

Use the live sandbox (https://ra-front-651013803640.asia-southeast1.run.app):
ask "What does an x402 402 Payment Required response contain?" (the first
preset) with a S$2 budget before you start speaking, so the payment settles
under the first beats; it buys one article in about 20 seconds. Backup: run
`npx -y <release tgz> try --testnet` in a terminal (about 84 s cold; a rerun on
the same wallets reuses the run and prints the same six links; say it is a
rerun). Fallback with no network: the
[browser replay](https://collaboration95.github.io/theFastandtheFungible/demo/)
from a cached tab. It is a replay of a recorded Testnet run, and the banner
says so.
