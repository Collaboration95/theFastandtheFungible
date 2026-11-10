# Demo video: shot list for the owner (2:30)

The form's "Demo link" field asks for "a video run-through of what we built". Judges
watch it **before** the pitch, and their view counts toward the final score. Judges will
not install anything first, so the video **leads with the product in the browser**, then
the same product answering inside Claude Code over MCP, then the proof. Target **2:30**,
never over 3:00. Eight shots; voice-over about 310 words at 130 words a minute.

**Recording is a human task.** Track it on
[#265](https://github.com/Collaboration95/theFastandtheFungible/issues/265). Record once
the live sandbox answers (see check 1), upload unlisted, then fill `{{VIDEO_URL}}`
([placeholders](README.md#placeholders)).

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
2. **The release exists.** `gh release view v1.0.2` lists `researchagent-mcp-1.0.2.tgz`
   and the Python wheel.
3. **The public site is current.** <https://collaboration95.github.io/theFastandtheFungible/ledger/>
   shows "Testnet ledger" with readable operation names, and
   <https://collaboration95.github.io/theFastandtheFungible/progress/> loads. If not,
   gh-pages has not been republished (`npm run site:publish`); ask an agent on #265.
4. **A fresh, private terminal and browser.** Light theme, 18 pt terminal font,
   1920×1080, no bookmarks bar, window title hidden. Run these off camera:
   ```sh
   export REL=https://github.com/Collaboration95/theFastandtheFungible/releases/download/v1.0.2
   export TGZ=$REL/researchagent-mcp-1.0.2.tgz
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
| 3 | 0:42–1:02 | 20 s | Refund and key reveal, on the ledger |
| 4 | 1:02–1:30 | 28 s | The same product inside Claude Code (MCP) |
| 5 | 1:30–1:48 | 18 s | Verify it: Python verifier and `/ledger/` |
| 6 | 1:48–2:04 | 16 s | One line, no clone: `try --testnet` |
| 7 | 2:04–2:20 | 16 s | Builder feedback and honest limits |
| 8 | 2:20–2:30 | 10 s | Close |

### Shot 1 · Title (0:00–0:07)

- **On screen:** deck slide 1, or the README hero.
- **Caption:** "XRPL Testnet · no real value"
- **VO (21 words):** "This is ResearchAgent: research with a wallet. It pays writers for
  the articles it's missing, inside your budget, on the XRP Ledger."

### Shot 2 · The live sandbox (0:07–0:42)

- **Open:** <https://ra-front-651013803640.asia-southeast1.run.app>. Pause 1 s on the home
  screen so the environment indicator is readable.
- **Ask:** the "Kestrel lead times" example (*"Are Kestrel Semiconductor's
  advanced-packaging lead times in Malaysia getting shorter?"*) with budget S$2.00.
- **On screen:** the 5-second plan (free sources first; at most one article per round, up
  to three rounds), then the payment card filling in place: escrow created, writer
  published key, `sha256(K) = Condition ✓`, ciphertext decrypts ✓, then the lead finding
  with its citation and "Anchored on XRPL".
- **Edit:** speed up waits ×3 with the clock; play the plan and the card at 1×.
- **Caption:** "Live sandbox · XRPL Testnet · no real value · fictional writers" plus the
  model label shown on the answer.
- **VO (60 words):** "Open the link, ask a question, set a budget. A five-second plan
  shows what it will do: free sources first, then at most one article per round. A model
  recommends what to buy, but only policy code can pay. Each payment sits in a native
  XRPL escrow, and the writer is paid by publishing the article's key on the ledger."

### Shot 3 · Refund and key reveal, on the ledger (0:42–1:02)

- **On screen:** in the payment card, the AlphaLeak row: "Refund · writer-signed · fixture
  writer cooperates (a real writer could refuse)". Click its EscrowFinish `tx ↗`; on the
  explorer zoom to *TransactionType: EscrowFinish*, *Fulfillment* and *validated*.
- **Caption:** "XRPL Testnet · the Fulfillment is the article key" → "Refund is
  writer-signed: our fixture writer cooperates; a real writer could refuse"
- **VO (45 words):** "Here's the key, on the ledger, in the fulfilment. Delivery and
  payment are one event. This article broke its promise, so the writer signed a refund
  and its trust score dropped. A real writer could refuse; then the buyer keeps a fraud
  proof anyone can check."

### Shot 4 · The same product inside Claude Code (1:02–1:30)

- **Type:**
  ```sh
  claude mcp add researchagent -e MCP_MAX_BUDGET_MINOR=200 -e MCP_DAILY_CAP_MINOR=500 -- npx -y $TGZ --testnet
  claude
  ```
  Prompt: *"Use researchagent: ask_expert 'Can an XRPL escrow hold RLUSD today, and what
  must the issuer enable before a buyer can lock it?' with budget_sgd=2. Show the answer,
  its citations, the explorer links and every label."*
- **On screen:** Claude Code's answer with citations to the team builder notes, the
  explorer links for create, finish and anchor, and the labels it returns
  (`rail: xrpl-testnet`, fixture models, team-authored writer).
- **Edit:** speed up the first cold call ×4 with the clock.
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
  python3 -m venv /tmp/ra && . /tmp/ra/bin/activate
  pip install -q $REL/researchagent-1.0.2-py3-none-any.whl
  curl -sLO https://raw.githubusercontent.com/Collaboration95/theFastandtheFungible/v1.0.2/docs/evidence/lane-b3/UC3.receipts.json
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
- **Caption:** "<!--f:feedback_line-->7 ranked findings with runnable repros · 35 numbered findings (B01–B35) · 15 September submissions (4–5 Sep) · 8 upstream drafts, 0 filed<!--/f-->"
- **VO (40 words):** "We wrote down what fought us: seven ranked findings, each with a
  script that reproduces it. The top one: the RLUSD issuer lacks the flag token escrow
  needs, so we use a labelled Testnet token. Mainnet is a checklist, not a claim."

### Shot 8 · Close (2:20–2:30)

- **On screen:** the README hero, then the repo URL.
- **Caption:** "github.com/Collaboration95/theFastandtheFungible · XRPL Testnet only · no
  real value"
- **VO (21 words):** "ResearchAgent. An open market where agents pay the people who
  know, and the ledger keeps everyone honest. Thank you."

Cut list if long: shot 7 to captions only, then shot 6.

## After recording

1. Export 1080p MP4, **under 3:00**, with burned-in captions. Check every caption against
   the label rules above.
2. Upload as **unlisted** (YouTube or Drive; Drive must be "anyone with the link"). Open
   the link in a private window to check it plays.
3. Put the link in the form, the deck (`VIDEO_URL` in `scripts/facts.mjs`, then
   `node scripts/facts.mjs && node docs/submission/deck/export.mjs`; it lands on slide 14),
   the README links line (the video slot comment marks the spot), and `HOSTED_VIDEO_URL`
   for the sandbox footer.
4. Attach the MP4 to the release (`gh release upload v1.0.2 video.mp4`), not to git.
