# Demo video: shot list for the owner (2:30)

The form's "Demo link" field asks for "a video run-through of what we built". Judges
watch it **before** the pitch, and their view counts toward the final score. Judges will
not install anything first, so the video **leads with the product in the browser**, then
the same product answering inside Claude Code over MCP, then the proof. Target **2:30**,
never over 3:00. Eight shots plus one optional insert (3b); voice-over about 330 words.

**Agents have prepared everything except your voice.** The footage is recorded, captioned
and cut, with a synthetic-voice draft to review timing. You record the voice-over (about
30 minutes) or approve a text-to-speech track, upload unlisted, then fill `{{VIDEO_URL}}`
([placeholders](README.md#placeholders)). How to re-record a scene, where your voice
goes and how to re-assemble: [video/README.md](video/README.md). Track the human steps on
[#265](https://github.com/Collaboration95/theFastandtheFungible/issues/265).

Numbers below come from [facts.json](facts.json); read this page rendered on GitHub, where
the markers that keep them in sync are hidden.

## Before you press record

1. **The live sandbox is up.** Open
   <https://ra-front-651013803640.asia-southeast1.run.app>. The one environment indicator
   must say XRPL Testnet and no real value, and
   `curl -s https://ra-front-651013803640.asia-southeast1.run.app/api/demo/status` must
   report `"state":"ready"`. If it is not up yet, record shots 2–3 in the zero-clone app
   instead (`npx -y $TGZ app --testnet --open`, same question) and caption them
   "Local app, no clone" instead of "Live sandbox".
2. **The release exists.** `gh release view v1.1.0` lists `researchagent-mcp-1.1.0.tgz`
   and the Python wheel.
3. **The public site is current.** <https://collaboration95.github.io/theFastandtheFungible/ledger/>
   shows "Testnet ledger" with readable operation names, and
   <https://collaboration95.github.io/theFastandtheFungible/progress/> loads. If not,
   gh-pages has not been republished (`npm run site:publish`); ask an agent on #265.
4. **A fresh, private terminal and browser.** Light theme, 18 pt terminal font,
   1920×1080, no bookmarks bar, window title hidden. Run these off camera:
   ```sh
   export REL=https://github.com/Collaboration95/theFastandtheFungible/releases/download/v1.1.0
   export TGZ=$REL/researchagent-mcp-1.1.0.tgz
   export npm_config_cache=$(mktemp -d)   # empty npm cache: what a judge gets
   export XDG_STATE_HOME=$(mktemp -d)     # fresh faucet wallets, mode 0600, never printed
   clear
   ```
5. **Never show** `.env`, `.env.writer`, any `*.private.json`, or a shell history with a
   seed. Nothing in this script prints a seed.
6. **No real money.** Everything is XRPL Testnet. The sandbox pays from its own pre-funded
   Testnet wallet within per-visitor caps; the terminal shots use faucet wallets.
7. **Ports:** the commands pick ephemeral ports. Don't use 5100, 8788 or 8790.

## Label rules (hard gate 5)

Every shot carries a caption bar in Geist, bottom-left, that says what is real:

- **"Live sandbox · XRPL Testnet · no real value"** on the hosted app. Add the model label
  the app shows on that answer (live models, or "fixture models" if it fell back). Never
  caption "live service", "production" or "mainnet".
- **"XRPL Testnet · no real value"** when a validated Testnet transaction or a live command
  against Testnet is on screen.
- **"Fictional writers"** whenever Kestrel, AlphaLeak or The Fab Floor appear.
- **"Team-authored writer · real content · not an independent writer"** whenever the XRPL
  builder-notes writer appears.
- **"Replay of a recorded Testnet run · no backend"** on `/demo/`.
- **"Sped up ×N · real time shown"** whenever footage is accelerated, with a real-time
  clock in the corner.

## Shots

| # | Time | Length | What |
|---:|---|---:|---|
| 1 | 0:00–0:07 | 7 s | Title |
| 2 | 0:07–0:42 | 35 s | The live sandbox: ask, plan, pay |
| 3 | 0:42–1:02 | 20 s | Refund and key reveal, on the ledger (recorded replay) |
| 3b | optional, +17 s | 17 s | It can say no, and prove it (hosted decline and proof of refusal) |
| 4 | 1:02–1:30 | 28 s | The same product inside Claude Code (MCP) |
| 5 | 1:30–1:48 | 18 s | Verify it: Python verifier and `/ledger/` |
| 6 | 1:48–2:04 | 16 s | One line, no clone: `try --testnet` |
| 7 | 2:04–2:20 | 16 s | Builder feedback and honest limits |
| 8 | 2:20–2:30 | 10 s | Close |

Times are the target; the assembled draft in
[video/timing.csv](video/timing.csv) has the real ones (about 2:35 without 3b, about 2:55 with it).

### Shot 1 · Title (0:00–0:07)

- **On screen:** deck slide 1, or the README hero.
- **Caption:** "XRPL Testnet · no real value"
- **VO (21 words):** "This is ResearchAgent: research with a wallet. It pays writers for
  the articles it's missing, inside your budget, on the XRP Ledger."

### Shot 2 · The live sandbox (0:07–0:42)

- **Open:** <https://ra-front-651013803640.asia-southeast1.run.app>. Pause 1 s on the home
  screen so the environment indicator is readable.
- **Ask:** type *"What does an x402 402 Payment Required response contain?"*, with budget
  S$2.00. It is not one of the three presets: on 11 Nov the RLUSD preset bought three
  articles and led with EscrowCreate (mock-judge round 9, H9-01), while this question buys
  one article in about 20 s and leads with `PAYMENT-REQUIRED` and `PAYMENT-SIGNATURE`. The
  hosted writers are the team-authored XRPL notes, not the fictional Kestrel writers.
- **On screen:** the 5-second plan (free sources first; at most one article per round, up
  to three rounds), then the payment card filling in place under "Payment unlocked by the
  writer's key": Payment locked in escrow, Writer released the key, Key matches the escrow
  lock ✓, Article unlocked ✓, then the lead finding with its citation and "Anchored on XRPL".
  End on "Verify on XRPL in your browser": press **Run the checks** and let it finish.
- **Edit:** the assembler compresses waits and labels them "Sped up ×N · real time shown"
  with a clock; the plan and the card play at 1×.
- **Caption:** "Live sandbox · XRPL Testnet · no real value · team-authored writers", with the
  model wording from the app's own environment chip (today "live answers, rule-based
  buying").
- **VO (60 words):** "Open the link, ask a question, set a budget. A five-second plan
  shows what it will do: free sources first, then at most one article per round. A model
  recommends what to buy, but only policy code can pay. Each payment sits in a native
  XRPL escrow, and the writer is paid by publishing the article's key on the ledger."

### Shot 3 · Refund and key reveal, on the ledger (0:42–1:02)

- **On screen:** the recorded replay ([/demo/](https://collaboration95.github.io/theFastandtheFungible/demo/),
  the key-reveal run, which is where the fictional AlphaLeak writer appears). In the payment
  card, step 2 "Writer released the key": click its `tx ↗`; on the explorer see
  *EscrowFinish*, *Success* and the *Escrow Fulfillment*, which is the article key. Go back
  to the replay for the refund line: "Refund signed by the writer. This demo writer agrees
  to refund; a real writer could refuse."
- **Caption:** "Replay of a recorded Testnet run · fictional writers · no backend" →
  "XRPL Testnet · the Fulfillment is the article key" → "Refund is
  writer-signed: our fixture writer cooperates; a real writer could refuse"
- **VO (45 words):** "Here's the key, on the ledger, in the fulfilment. Delivery and
  payment are one event. This article broke its promise, so the writer signed a refund
  and its trust score dropped. A real writer could refuse; then the buyer keeps a fraud
  proof anyone can check."

### Shot 3b · It can say no, and prove it (optional, about 17 s)

- **On screen:** on the live sandbox, ask a question the library does not cover: *"Which
  airlines ordered new narrowbody jets at the 2026 Farnborough Airshow?"*. It shares no
  words with any writer or free source, so no fictional-writer record is read and nothing
  is bought: "No source covers this question yet. Nothing was bought." Press **Share proof
  of refusal**, read the confirmation ("Publish this proof?"), publish, and open the proof
  page ("Refused to spend.", S$0.00 spent, an XRPL Testnet transaction). Avoid
  finance-sounding words ("outlook", "prices"): the open central-bank records answer those
  from free sources, and then there is no refusal to prove.
- **Caption:** "Live sandbox · XRPL Testnet · no real value" plus the app's model wording.
- **VO (32 words):** "It can also say no. Here no source covered the question, so it bought nothing, and the refusal is anchored on XRPL Testnet. Anyone can open
  the proof page and check it."
- **Cut this shot first** if the video runs long: nothing else refers to it.

### Shot 4 · The same product inside Claude Code (1:02–1:30)

- **Type:**
  ```sh
  claude mcp add researchagent -e MCP_MAX_BUDGET_MINOR=200 -e MCP_DAILY_CAP_MINOR=500 -- npx -y $TGZ --testnet
  claude
  ```
  Prompt: *"Use researchagent: ask_expert 'What does an x402 402 Payment Required response
  contain?' with budget_sgd=2. Reply briefly: the answer in two sentences, the explorer
  links, and the labels on one line."* (A short reply
  keeps the final screen readable; Claude prints the citations and every label itself.)
- **On screen:** Claude Code's answer with citations to the team builder notes, the
  explorer links for create, finish and anchor, and the labels it returns
  (`rail: xrpl-testnet`, fixture models, team-authored writer).
- **Edit:** the first cold call is compressed and labelled "Sped up ×N · real time shown".
- **Caption:** "Claude Code over MCP · XRPL Testnet · no real value · team-authored writer
  · real content · not an independent writer"
- **Honesty note:** only use this shot if Claude Code itself paid on camera. If it
  declines to buy, keep the take and say so in the VO ("here it decided the free sources
  were enough"), or retry with the backup question *"How much does EscrowFinish with a
  fulfillment cost on XRPL Testnet?"*.
- **VO (48 words):** "Any agent can use it. Claude Code adds it with one line, and the
  spending caps live in the environment, where the model can't raise them. Ask about
  XRPL and it buys from our own build notes, labelled as ours, and answers with
  citations and ledger links."

### Shot 5 · Don't trust us, verify it (1:30–1:48)

- **Type:**
  ```sh
  python3 -m venv ra && . ra/bin/activate
  pip install -q $REL/researchagent-1.1.0-py3-none-any.whl
  curl -sLO https://raw.githubusercontent.com/Collaboration95/theFastandtheFungible/v1.1.0/docs/evidence/lane-b3/UC3.receipts.json
  researchagent verify UC3.receipts.json --ledger
  ```
  Ends `PASS testnet 12/12 (read-only, s.altnet)` and `RESULT PASS`.
- **Then open:** <https://collaboration95.github.io/theFastandtheFungible/ledger/> and let
  the read-only check finish (wait for the live result; do not preclaim success).
- **Caption:** "Python verifier · no Node · read-only XRPL Testnet lookups" →
  "<!--f:transactions-->61<!--/f--> Testnet transactions · checked live from your browser"
- **VO (34 words):** "Don't trust us. A Python verifier, written separately from our
  TypeScript one, re-checks every receipt against the ledger. Our ledger page re-validates
  every recorded transaction from your browser."

### Shot 6 · One line, no clone (1:48–2:04)

- **Type:** `npx -y $TGZ try --testnet` (caption the full URL once, 3 s).
- **On screen:** the six numbered lines (create, finish with `sha256(K) = Condition ✓`,
  refund, re-buy create, re-buy finish, anchor) and `RESULT PASS`. Hold 2 s.
- **Edit:** sped up ×6 or more with the real-time clock. Our one cold measurement was
  <!--f:try_s-->84.2<!--/f--> s and <!--f:try_misses-->2 of 4<!--/f--> cold runs overran
  90 s; show whatever your run took.
- **Fallback:** if the faucet fails, `try` prints a labelled SIMULATED run with its
  reason. Don't use that take; rerun with a new `XDG_STATE_HOME`, or use the committed run
  in [`docs/evidence/round4-j2/try-output.txt`](../evidence/round4-j2/try-output.txt)
  captioned "recorded 7 Nov".
- **Caption:** "XRPL Testnet · no real value · fixture models · fictional writers · sped up ×N"
- **VO (30 words):** "For builders: one line, no clone, no account. It buys, catches a
  broken promise, gets refunded, re-buys, anchors the answer and verifies all six
  transactions against the ledger."

### Shot 7 · Builder feedback and honest limits (2:04–2:20)

- **On screen:** [BUILDER-FEEDBACK.md](../BUILDER-FEEDBACK.md) top-7 table on GitHub, then
  the mainnet checklist heading.
- **Caption:** "<!--f:feedback_line-->7 ranked findings with runnable repros · 35 numbered findings (B01–B35) · 15 submissions on 4–5 Sep · 8 upstream drafts, 0 filed<!--/f-->"
- **VO (40 words):** "We wrote down what fought us: seven ranked findings, each with a
  script that reproduces it. The top one: the RLUSD issuer lacks the flag token escrow
  needs, so we use a labelled Testnet token. Mainnet is a checklist, not a claim."

### Shot 8 · Close (2:20–2:30)

- **On screen:** the README hero, then the repo URL.
- **Caption:** "github.com/Collaboration95/theFastandtheFungible · XRPL Testnet only · no
  real value"
- **VO (21 words):** "ResearchAgent. An open market where agents pay the people who
  know, and the ledger keeps everyone honest. Thank you."

Cut list if long: shot 3b, then shot 7 to captions only, then shot 6.

## After recording

1. Export 1080p MP4, **under 3:00**, with burned-in captions: put your per-shot
   recordings in `scratch/video/voice/owner/` and run `make video-assemble ARGS="--voice owner"`
   ([video/README.md](video/README.md#your-voice)). Check every caption against the label
   rules above.
2. Upload as **unlisted** (YouTube or Drive; Drive must be "anyone with the link"). Open
   the link in a private window to check it plays.
3. Put the link in the form, the deck (`VIDEO_URL` in `scripts/facts.mjs`, then
   `node scripts/facts.mjs && node docs/submission/deck/export.mjs`; it lands on slide 14),
   the README links line (the video slot comment marks the spot), and `HOSTED_VIDEO_URL`
   for the sandbox footer.
4. Attach the MP4 to the release (`gh release upload v1.1.0 video.mp4`), not to git.
