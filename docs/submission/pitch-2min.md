# Two-minute pitch · Wed 18 Nov, 11:30 SGT, Swiss Pavilion

Spoken at about 140 words a minute. The judges know the problem, so we skip it
and lead with what we built and what changed since SingHacks. The slide numbers
refer to [the deck](ResearchAgent-SFF-deck.pdf). If the slot is three minutes,
use the [3-minute variant](#three-minute-variant).

Rules for the speaker: say "Testnet" once, early, and plainly. Every number
below is in the deck with its source. Don't round up.

## Script (~285 words)

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
It costs less than half a US cent in model calls per question, and network fees
are twelve drops. Along the way we logged 35 pieces of builder feedback for
XRPL and x402, each with a repro and a fix.

**[1:52 · slide 10]**
Every claim here has a Testnet transaction you can check. ResearchAgent: an
open market where agents pay the people who know.

**[2:00]**

## Three-minute variant

Use the script above, and add these three beats at the marked points (about
+120 words, ~2:55 total).

**After slide 3 (+0:20)** · *What it learned:* "We also measure whether it buys
the *right* thing. On 92 held-out questions, wasted spend fell from 53% to 41%.
That still misses our 25% target, and we publish the miss with its confidence
interval."

**After slide 6 (+0:20)** · *Why XRPL:* "XRPL let us do this without a single
smart contract. Escrow, issued currencies, invoice IDs and memos are native,
fees are twelve drops, and ledgers close in seconds. That's what makes paying
per article viable."

**Before slide 10 (+0:20)** · *Honest limits:* "What's not done: payer keys in a
KMS, the official RLUSD issuer and live FX, KYB and sanctions screening. We
wrote a mainnet checklist rather than claim readiness."

## If the live demo is allowed

Swap the slide-5 beat for a 25-second clip: `make clip UC=UC3` (refund scene),
or the hire-the-agent terminal from the [video script](demo-video-script.md) (scene 5).
The venue fallback is the Mac app offline, where payments are simulated and the
header says so.
