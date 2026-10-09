# Stage script, 10 Oct (5 min + Q&A)

Demo first, then explain it on the page (`talk/index.html`). Timings assume
UC3 at Stage 1× pace (~69 s). Words in quotes are said out loud.

## Before going on

- `make live` (add `CF_BACKUP=1` if the primary Cloudflare quota is spent).
- In the app, press `.` → clarify **never**, then **Reset reputation**.
  Otherwise AlphaLeak is already blocked from the last rehearsal and round 1
  won't buy it.
- Open `talk/index.html` in a second tab, scrolled to the top. On the page:
  `→` next section, `←` back, `R` replays the widget on screen.
- Hide the terminal with `.env`. Don't press Stop during the run (a purchase
  already in flight still completes).

## 0:00 Intro (20 s)

"Hi, I'm Guruprasath. My team and I built ResearchAgent: a research assistant
with a wallet. It answers from free sources first. When the missing piece is
behind a paywall, it can buy just that one article from the writer, for a few
cents, inside a budget you set. And if the article doesn't contain what the
writer promised, the money comes back."

## 0:20 Ground truth (15 s)

"Quick ground truth. The writers' websites and their search run on this
laptop, so it never searches the open web, and the writers are fictional.
The models are real API calls, and the payments are real transactions on the
XRPL Testnet, which uses test money."

Don't say "it's not connected to the internet": DeepSeek, the decision model,
Cloudflare embeddings and XRPL Testnet are all online, and someone will ask.

## 0:35 A random question (25 s)

Type: **"Write a haiku about being the first demo at AI Tinkerers."**

"First, something random, so you can see it's a live model and not a
recording." Point at the label under the reply: "It knows this needs no
research, so it searched nothing and bought nothing."

Backup if the haiku routes to research: "Why is Canberra the capital of
Australia and not Sydney?" Don't use "How big is the Sun?": that exact
question and answer are an example inside the prompt. Rehearse the haiku
once; it hasn't been run live.

## 1:00 The paid scenario (1:45)

Setup, while you click the **Malaysia packaging lead times** preset:

"Now a real research question. Say I design chips and I'm about to book
packaging capacity with Kestrel Semiconductor in Penang. Kestrel's fictional.
I need to know: are its lead times getting shorter? I give it S$2. That
budget is the only permission it has to spend."

| On screen | Say |
|---|---|
| Plan card | "It shows its plan and gives me five seconds before it can spend anything." |
| Free answer + open gap | "Free sources first. It found the new plant and the capacity, but no lead times, and it says exactly what's missing." |
| Decision list, budget moving | "A decision model scores every paywalled article against that gap. AlphaLeak is cheap and promises exactly this, so code buys it." |
| Red "Proof failed", green "Refunded S$0.30" | "The article arrives and its promise doesn't check out: it promised a dated figure and there isn't one. Code challenges the writer, the writer refunds on-chain, and its track record halves." |
| Yellow v2 | "Round two buys an honest writer for 40 cents. Now the answer has numbers: 26 weeks in June, 18 in September." |
| View receipt | "Every charge is a real Testnet transaction. 40 cents net." |

If a fallback chip appears: "that's the labelled fallback". If the run is
slow: "the buying decision is a real model call". Past 75 s, move on and open
the finished run in Q&A.

## 2:45 Transition (5 s)

"That was a lot in a minute. Let me show you what actually happened."
Switch to the page tab.

## 2:50 The page (2:00)

Press `→` between sections. Each widget replays when it scrolls in.

| Section | Say (one or two lines) |
|---|---|
| Hero | "That's the run you just saw, replayed from its event log: S$2 budget, 40 cents net, one refund." |
| Who does what | "Five parts. DeepSeek writes. A decision model from OpenAI judges. Plain code pays. Cloudflare powers search. XRPL Testnet settles." |
| 1 · Search | "No central index. Each writer searches its own articles and sends back a teaser and signed promises, never the paid text." |
| 2 · Free answer | "Free answer first, every sentence cited. The facts you asked for are frozen before it reads anything, so no article can move the goalposts." |
| 3 · Decide | "The decision model returns probabilities, not prose. Code multiplies them by the writer's track record and picks the best value per dollar. AlphaLeak wins on price: that's the hole a cheat uses." |
| 4 · Only code pays | "The LLM has no buy button. The budget is the only permission." |
| 5 · x402 | "Paying is just HTTP. Ask for the article, get a 402 with the price in a header, pay the writer's wallet on the ledger, ask again with the signed payment, get the article." |
| 6 · Verify | "Neither side trusts the other. The writer checks the ledger before it delivers. We check its signature before paying and every promise after. A sealed envelope with fingerprints on the outside." |
| 7 · Refund | "Broken promise: challenge, refund on-chain, track record 0.8 to 0.4, blocked. The ledger can't force a refund, so the penalty lives in the track record." |
| Close | "An LLM writes, a decision model chooses, code pays. Questions?" |

Short on time: skip "Why this model", "4 · Only code pays" and "How we built
it". Keep those for Q&A.

## Q&A pointers

- Numbers: `docs/QA-PACK.md`. Say "on our synthetic benchmark" for every
  benchmark number.
- "How we built it" is the last section of the page.
- "Can the LLM spend?" "It can name what's missing; only policy code can pay."
- Shout-a-question: off-corpus questions should spend S$0 and name what they
  couldn't find.
