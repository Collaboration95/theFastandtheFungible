# Two-minute pitch · Wed 18 Nov, 11:30 SGT, Swiss Pavilion

Tenity's emails say both 2 and 3 minutes, so this script is **2:00** and the
[3-minute variant](#three-minute-variant) adds three beats. Ask Tenity which it
is (open item in the organiser brief). Spoken at about 140 words a minute.

The brief says to skip the problem statement and cover the solution, key
developments, and what we achieved since SingHacks. So we open on the
mechanism, not the problem. Slide numbers refer to
[the deck](ResearchAgent-SFF-deck.pdf) (12 slides).

**Rules for the speaker:**
- Say "Testnet" in the first 20 seconds, and never say "live service",
  "hosted" or "mainnet".
- Every number below is on a slide with its source. Don't round up.
- Fill any `{{…}}` placeholders from the [README list](README.md#placeholders)
  before rehearsing. If one is still empty on the day, drop that sentence.

## Script (~265 words)

**[0:00 · slide 1]**
ResearchAgent is research with a wallet. Give it a question and a budget. It
answers from free sources, then buys the articles it's missing, straight from
the writer, over x402 on the XRP Ledger: at most one per round, up to three
rounds, inside your budget. Everything you'll see runs on XRPL
Testnet, on your own machine.

**[0:18 · slide 5]**
Here's what's new. The writer only gets paid by publishing the article's key on
the ledger. We lock payment in a native XRPL escrow whose condition is the hash
of that key. Delivery and payment become one ledger event. No smart contract.

**[0:36 · slide 6]**
It works in a stablecoin-style token too, through XLS-85 token escrow. Official
RLUSD is one issuer flag away, and that's our top piece of builder feedback.

**[0:48 · slide 3]**
At SingHacks, a human approved every purchase. Since then: 183 merged pull
requests. Today a judge runs one line. No clone, no account. In one cold 84-second measurement it
buys, catches a broken promise, gets refunded, re-buys, anchors the answer and
prints "result: pass" with six Testnet links.

**[1:08 · slide 7]**
Don't trust us, verify it. Two independent verifiers, one in Python with no
Node, re-check every receipt against the ledger. Our ledger page lists 61 historical Testnet transactions with live read-only checks.

**[1:22 · slide 8]**
The same package is an MCP server for Claude Code and a local app. Ask about
XRPL and it can buy from our labelled team build notes. With fixture models
on Testnet, seven of twenty blind held-out questions were bought and cited,
and on ten off-topic questions it bought nothing. Development sets are
reported separately. [v4](../evidence/v4-heldout/README.md).

**[1:36 · slide 9]**
Our measured key-reveal purchase used 435 drops in network fees. The model only
recommends; policy code spends, and our gate audit found zero violations.

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
folder becomes a Testnet writer with an XRPL credential in 33.9 seconds (J3, #389). Our
research writers are fictional, and we have no independent writers yet. That
list stays empty until a real person consents."

**Before slide 12 (+0:15) · Honest limits:** "What's not done: payer keys in a
KMS, RLUSD escrow until the issuer allows it, and KYB and sanctions screening.
We wrote a mainnet checklist instead of claiming readiness."

## Timing marks for rehearsal

| Mark | Slide | Beat | Words |
|---|---:|---|---:|
| 0:00 | 1 | What it is, Testnet | 46 |
| 0:18 | 5 | Key reveal | 42 |
| 0:36 | 6 | Stablecoin escrow, RLUSD flag | 26 |
| 0:48 | 3 | Since SingHacks, one line, 84 s | 46 |
| 1:08 | 7 | Verify | 29 |
| 1:22 | 8 | Reachability, judge bank | 34 |
| 1:36 | 9 | Fees, gates | 23 |
| 1:48 | 12 | Close | 19 |

Running out of time? Cut slide 6 (the stablecoin beat) first, then slide 9.
Never cut the "Testnet" line on slide 1.

## Speaker notes: numbers to say exactly

- **"84 seconds"**: one cold run, empty npm cache and fresh faucet wallets, 7
  Nov. If asked, two of four cold attempts finished under 90 s (73.8 s and 84.2
  s); two overran. Source: `docs/evidence/round4-j2/`.
- **"Seven of twenty"**: v4 held-out, blind 20-question XRPL bank, bought and
  cited on Testnet; the key fact leads the answer in 2/20; all ten off-topic
  v4 negatives abstained (0/10 purchases); 0 gate violations. Say that the
  development sets are separate (v1 16/20), because we tuned on them. Team-authored
  writers, fixture decision model. Source: `docs/evidence/v4-heldout/`. Do not
  say "fifteen of twenty": that was an earlier, tuned bank.
- **"183 merged pull requests"**: 21 Sep–7 Nov 2026. Say "since SingHacks", not
  "in a week".
- **"435 drops"**: 12 for EscrowCreate plus 423 for the conditional
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

Run shot 2 of the [video script](demo-video-script.md) on stage, started before
you speak, so the 84 s wait runs under the first beats. If you rerun on wallets
that already ran it, `try` reuses that run and prints the same six links without
buying again; say it is a rerun. Fallback
with no network: the [browser replay](https://collaboration95.github.io/theFastandtheFungible/demo/)
from a cached tab. It is a replay of a recorded Testnet run, and the banner
says so.
