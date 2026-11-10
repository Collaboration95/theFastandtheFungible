# Two-minute pitch · Wed 18 Nov, 11:30 SGT, Swiss Pavilion

Tenity's emails say both 2 and 3 minutes, so this script is **2:00** and the
[3-minute variant](#three-minute-variant) adds three beats. Ask Tenity which it
is (open item in the organiser brief). Spoken at about 140 words a minute.

The brief says to skip the problem statement and cover the solution, key
developments, and what we achieved since SingHacks. So we open on the
mechanism, not the problem. Slide numbers refer to
[the deck](ResearchAgent-SFF-deck.pdf) (12 slides).

**Rules for the speaker:**
- Say "Testnet" in the first 20 seconds. Call the hosted app "our live Testnet
  sandbox" (open 13–19 Nov); never say "live service", "production" or
  "mainnet".
- Every number below is on a slide with its source, and comes from
  [facts.json](facts.json). Don't round up. Read this page rendered on GitHub:
  the markers that keep numbers in sync are hidden there.
- Fill any `{{…}}` placeholders from the [README list](README.md#placeholders)
  before rehearsing. If one is still empty on the day, drop that sentence.

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
It works in a stablecoin-style token too, through XLS-85 token escrow. Official
RLUSD is one issuer flag away, and that's our top piece of builder feedback.

**[0:48 · slide 3]**
At SingHacks we had a prototype: a language model planned each purchase, and
payment was simulated by default. Since then we merged <!--f:prs-->217<!--/f-->
pull requests. Today a judge opens one link, or runs one line with no clone and
no account. It buys, catches a broken promise, gets refunded, re-buys, anchors
the answer and prints "result: pass" with six Testnet links.

**[1:08 · slide 7]**
Don't trust us, verify it. Two independent verifiers, one in Python with no
Node, re-check every receipt against the ledger. Our ledger page lists
<!--f:transactions-->61<!--/f--> historical Testnet transactions with live
read-only checks.

**[1:22 · slide 8]**
The same package is an MCP server for Claude Code and a local app. Ask about
XRPL and it can buy from our labelled team build notes. With fixture models
on Testnet, <!--f:heldout_n-->seven<!--/f--> of <!--f:heldout_N-->twenty<!--/f-->
blind held-out questions were bought and cited, and on
<!--f:offtopic_N-->ten<!--/f--> off-topic questions it bought nothing.
Development sets are reported separately. [Evidence](../evidence/v4-heldout/README.md).

**[1:36 · slide 9]**
Our measured key-reveal purchase used <!--f:fee_drops-->435<!--/f--> drops in
network fees. The model only recommends; policy code spends, and our gate audit
found zero violations.

**[1:48 · slide 12]**
Every claim has a Testnet hash. ResearchAgent: agents pay the people who know,
and the ledger keeps them honest.

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
seconds (J3, #389). Our research writers are fictional, and we have no
independent writers yet. That list stays empty until a real person consents."

**Before slide 12 (+0:15) · Honest limits:** "What's not done: payer keys in a
KMS, RLUSD escrow until the issuer allows it, and KYB and sanctions screening.
We wrote a mainnet checklist instead of claiming readiness."

## Timing marks for rehearsal

| Mark | Slide | Beat | Words |
|---|---:|---|---:|
| 0:00 | 1 | What it is, Testnet | 46 |
| 0:18 | 5 | Key reveal | 42 |
| 0:36 | 6 | Stablecoin escrow, RLUSD flag | 26 |
| 0:48 | 3 | Since SingHacks, one link or one line | 46 |
| 1:08 | 7 | Verify | 29 |
| 1:22 | 8 | Reachability, judge bank | 34 |
| 1:36 | 9 | Fees, gates | 23 |
| 1:48 | 12 | Close | 19 |

Running out of time? Cut slide 6 (the stablecoin beat) first, then slide 9.
Never cut the "Testnet" line on slide 1.

## Speaker notes: numbers to say exactly

- **`try` timing, if asked**: one cold run took <!--f:try_s-->84.2<!--/f--> s
  with an empty npm cache and fresh faucet wallets, 7 Nov;
  <!--f:try_misses-->2 of 4<!--/f--> cold attempts overran 90 s. Source:
  `docs/evidence/round4-j2/`. It is not in the script any more: the live
  sandbox is the first thing judges use.
- **"<!--f:heldout_n-->seven<!--/f--> of <!--f:heldout_N-->twenty<!--/f-->"**:
  <!--f:heldout_line-->v4 blind held-out: 7/20 bought and cited, 0/10 off-topic purchases (run once, 7 Nov; fixture decision model, team-authored writers, XRPL Testnet)<!--/f-->.
  The key fact leads the answer in <!--f:answers_it-->2/20<!--/f-->; 0 gate
  violations. Say that the development sets are separate (v1
  <!--f:dev_v1-->16/20<!--/f-->), because we tuned on them. Do not say "fifteen
  of twenty": that was an earlier, tuned bank.
- **"<!--f:prs-->217<!--/f--> pull requests"**: merged into `main` since
  <!--f:since-->21 Sep<!--/f-->, counted at <!--f:sha-->522d32e0<!--/f--> on
  <!--f:as_of-->10 Nov 2026<!--/f-->. Say "since SingHacks", not "in a week".
- **SingHacks baseline**: the prototype (tag `hackathon-baseline`) let a
  language model plan purchases; payment was a fixture by default with optional
  Testnet settlement. The old deck line about a human approving purchases was wrong; do not repeat it.
- **"<!--f:fee_drops-->435<!--/f--> drops"**: 12 for EscrowCreate plus 423 for the conditional
  EscrowFinish, measured on Testnet. At an assumed S$2 per XRP that is S$0.00087,
  a projection.
- **"Zero violations"**: the read-only gate audit, 10 runs and 568 observations
  on the fresh-question evaluation, 3 Nov, with simulated payments.
- **The 93% number is not in the 2-minute script.** If asked, say it exactly:
  "On 48 fresh synthetic questions, 93.15% of gross article spend bought a
  requested fact retained in the final cited answer (95% CI 81.25–100.00%)."
  Live decision models, fixture research, simulated payments. Not a production
  result; the paired gain over the old policy (+3.08 pts, 0.00–9.43) is not
  significant. See [qa-prep.md](qa-prep.md#19-does-it-actually-buy-the-right-things).

## If a live demo is allowed

Use the live sandbox (https://ra-front-651013803640.asia-southeast1.run.app):
ask the Kestrel lead-times example with a S$2 budget before you start speaking,
so the payments settle under the first beats. Backup: run
`npx -y <release tgz> try --testnet` in a terminal (about 84 s cold; a rerun on
the same wallets reuses the run and prints the same six links; say it is a
rerun). Fallback with no network: the
[browser replay](https://collaboration95.github.io/theFastandtheFungible/demo/)
from a cached tab. It is a replay of a recorded Testnet run, and the banner
says so.
