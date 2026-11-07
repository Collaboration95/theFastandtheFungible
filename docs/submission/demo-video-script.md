# Demo video: shot list for the owner (2:50)

The form's "Demo link" field asks for "a video run-through of what we built".
Judges watch it **before** the pitch, and their view counts toward the final
score. The organiser brief gives no length limit, so we aim for **2:50 and never
go over 3:00**. That way it fits a 3-minute slot and still reads as respectful
of judges' time. Nine shots. Voice-over is about 370 words at 135 words a minute.

**Recording is a human task.** Track it on
[#265](https://github.com/Collaboration95/theFastandtheFungible/issues/265).
Record on Wed 11 or Thu 12 Nov, **after v1.0.0 is published**
(shot 2 needs the `try` subcommand, which is in v1.0.0). Upload by Thu 12 Nov.

## Before you press record

1. **The release exists.** `gh release view v1.0.0` lists
   `researchagent-mcp-1.0.0.tgz` and the Python wheel.
2. **The public site is current.** Open
   <https://collaboration95.github.io/theFastandtheFungible/ledger/>. The first
   rows must read "RLUSD", not `524C5553…`. On
   <https://collaboration95.github.io/theFastandtheFungible/demo/>, the hashes
   must be collapsed into "6/6 Testnet hashes verified live ✓ · show", and the
   lead finding must sit under "Supports". If not, gh-pages has not been
   republished since #388/#390; ask an agent on #265 before recording.
   (On 7 Nov the live site still showed the old hex and hash wall.)
3. **A fresh, private terminal.** Light theme, 18 pt font, 1920×1080, window
   title hidden. Run these first, off camera:
   ```sh
   export REL=https://github.com/Collaboration95/theFastandtheFungible/releases/download/v1.0.0
   export TGZ=$REL/researchagent-mcp-1.0.0.tgz
   export npm_config_cache=$(mktemp -d)   # empty npm cache: what a judge gets
   export XDG_STATE_HOME=$(mktemp -d)     # fresh faucet wallets, mode 0600, never printed
   clear
   ```
   Then type the commands below in full on camera. The `$TGZ` variable only
   hides the long URL; shot 2 shows the full URL once as a caption.
4. **Never show** `.env`, `.env.writer`, any `*.private.json`, or a shell
   history containing a seed. Nothing in this script prints a seed.
5. **No real money, and no extra spending.** Everything is XRPL Testnet faucet
   XRP. `try` uses a stable intent key: running it again on the same wallets
   reuses the run instead of buying again.
6. **Ports:** the commands pick ephemeral ports. Don't use 5100, 8788 or 8790.

## Label rules (hard gate 5)

Every shot carries a caption bar in Geist, bottom-left, that says what is real:

- **"XRPL Testnet · no real value"** only when a validated Testnet transaction
  or a live command against Testnet is on screen.
- **"Fixture models · fictional writers"** whenever the Kestrel, AlphaLeak or
  Fab Floor writers appear.
- **"Team-authored writer · real content · not an independent writer"**
  whenever the XRPL builder-notes writer appears (shot 5).
- **"TEST-SGD · our Testnet IOU · no real value · stand-in for RLUSD"** in
  shot 6. Never call it RLUSD.
- **"Replay of a recorded Testnet run · no backend"** on `/demo/`.
- **"Sped up ×N · real time shown"** whenever footage is accelerated, with a
  real-time clock in the corner.
- Never say or caption "hosted", "live service" or "mainnet".

## Shots

| # | Time | Length | What |
|---:|---|---:|---|
| 1 | 0:00–0:08 | 8 s | Title |
| 2 | 0:08–0:40 | 32 s | One line: `try --testnet` |
| 3 | 0:40–0:58 | 18 s | The key on the ledger (explorer) |
| 4 | 0:58–1:20 | 22 s | The product view: `/demo/` replay |
| 5 | 1:20–1:48 | 28 s | Your own question: zero-clone app |
| 6 | 1:48–2:08 | 20 s | Stablecoin escrow over MCP |
| 7 | 2:08–2:22 | 14 s | A writer in one command |
| 8 | 2:22–2:40 | 18 s | Verify it: Python verifier and `/ledger/` |
| 9 | 2:40–2:50 | 10 s | Close |

### Shot 1 · Title (0:00–0:08)

- **On screen:** deck slide 1 (`docs/submission/ResearchAgent-SFF-deck.pdf`,
  page 1).
- **Caption:** "XRPL Testnet · no real money · runs on your machine"
- **VO (18 words):** "This is ResearchAgent: research with a wallet. It buys
  the one article it's missing, straight from the writer, on the XRP Ledger."

### Shot 2 · One line, the whole judge path (0:08–0:40)

- **Type, on camera:**
  ```sh
  npx -y $TGZ try --testnet
  ```
- **On screen:** npm installs. Faucet wallets are made. Then the numbered
  lines appear: `1. Create`, `2. Finish · sha256(K) = Condition ✓`,
  `3. Refund · writer-signed · fixture writer cooperates (a real writer could refuse)`,
  `4. Re-buy create`, `5. Re-buy finish`, `6. Anchor`, then the verifier block
  ending `PASS testnet 12/12 (read-only, s.altnet)` and `RESULT PASS`. Hold 2 s
  on `RESULT PASS`.
- **Edit:** speed up the install and faucet wait (×4 or more), with the
  real-time clock in the corner. Play the six numbered lines and RESULT at 1×.
  The cold run took 84.2 s in our measurement; show whatever your run took.
- **Captions:** first "`npx -y …/releases/download/v1.0.0/researchagent-mcp-1.0.0.tgz try --testnet`"
  (full URL, 3 s), then "XRPL Testnet · no real value · fixture models ·
  fictional writers · sped up ×N".
- **Fallback:** if the faucet fails, `try` prints a labelled SIMULATED run with
  its reason. Don't use that take. Wait and rerun with a new `XDG_STATE_HOME`.
  If Testnet stays down, use the committed run in
  [`docs/evidence/round4-j2/try-output.txt`](../evidence/round4-j2/try-output.txt)
  (create
  [9126E19D…](https://testnet.xrpl.org/transactions/9126E19D7BE8356061F7F44756E64FE6FB12C6B5F99621661D00DEA9B015B8CD)),
  captioned "recorded 7 Nov".
- **VO (58 words):** "No clone, no account, one line. It installs, gets Testnet
  wallets from the faucet, and asks a question with a two-dollar budget. It buys
  an article, catches a broken promise, gets a refund, buys a better one and
  anchors the answer. Then it verifies all of it against the ledger. Six
  transactions. Result: pass."

### Shot 3 · The key is on the ledger (0:40–0:58)

- **Do:** ⌘-click link **2 (Finish)** from shot 2's output. It opens
  `https://testnet.xrpl.org/transactions/<hash>`.
- **On screen:** the explorer page. Zoom to *TransactionType: EscrowFinish*,
  *Fulfillment*, *Condition* and *validated*. Then ⌘-click link **3 (Refund)**
  and zoom to the Payment from the writer.
- **Caption:** "XRPL Testnet · EscrowFinish · the Fulfillment is the article key"
  → "Refund is writer-signed: the fixture writer cooperates; a real writer could
  refuse".
- **VO (46 words):** "This is the trick. The buyer locks payment in a native
  XRPL escrow. To get paid, the writer has to publish the article's key, right
  here in the fulfilment. Delivery and payment are one ledger event. This
  article broke its promise, so the money came back."

### Shot 4 · What a person sees: the browser replay (0:58–1:20)

- **Open:** <https://collaboration95.github.io/theFastandtheFungible/demo/>
  (default tab "Testnet UC3 · key reveal").
- **On screen:** the run plays. Show the plan sheet, the Spend panel, the AlphaLeak row turning
  "Refund · writer-signed", the Fab Floor row with "sha256(K) = Condition ✓ ·
  ciphertext decrypts ✓", and the cited answer with the lead finding under
  Supports. Finish on "6/6 Testnet hashes verified live ✓ · show". Click
  *show* once.
- **Caption:** "Replay of a recorded Testnet run · no backend · fixture models ·
  fictional writers"
- **VO (45 words):** "Here's the same story as a person sees it. A five-second
  plan, then every payment changes state in place. Your browser re-checks the
  key against the ledger and decrypts the article itself. The model only
  recommends what to buy. Policy code spends, inside your budget."

### Shot 5 · Your own question, in the real app (1:20–1:48)

- **Type:**
  ```sh
  npx -y $TGZ app --testnet --open
  ```
  The ready line prints `fixture models · XRPL TESTNET · no real value`, the
  payer address and the caps. The browser opens on `127.0.0.1:<port>`.
- **Ask:** *"Can RLUSD be escrowed with key reveal today?"* with budget S$2.
  Backup question: *"How much does EscrowFinish with a fulfillment cost on XRPL
  Testnet?"* Both were bought and cited in the frozen v1 development bank
  ([round4-j1](../evidence/round4-j1/README.md), J03 and J01).
- **On screen:** the answer cites the team builder notes. The source card shows
  "team-authored · real content · not an independent writer · Testnet". Open
  the payment row's `tx ↗`.
- **Edit:** speed up waiting (×3), with the clock.
- **Caption:** "Local app, no clone · XRPL Testnet · team-authored writer · real
  content · not an independent writer"
- **VO:** "No MCP client? The same package runs the full app on
  your machine. Ask it something about XRPL. It buys from a writer made of our
  own build notes. It's labelled as ours, not independent. On twenty judge
  development questions, 16 came back bought and cited. On twenty new held-out
  questions, 8 did. Both used fixture models and Testnet."

### Shot 6 · A stablecoin escrow, from Claude Code (1:48–2:08)

- **Type:**
  ```sh
  claude mcp add researchagent -e MCP_MAX_BUDGET_MINOR=200 -e MCP_DAILY_CAP_MINOR=500 -- npx -y $TGZ --testnet --iou
  claude
  ```
  Prompt: *"Use researchagent: wallet_status, then ask_expert 'What did the
  Kestrel–TSMC deal do to margins?' with budget_sgd=2. Show the purchases, the
  explorer links and every label."*
- **On screen:** `wallet_status` with `rail: xrpl-testnet`, then an
  `ask_expert` result with a TEST-SGD amount and the label "TEST-SGD · IOU
  issued by our Testnet issuer · no real value · stand-in for RLUSD", then
  the EscrowCreate on the explorer.
- **Honesty note:** our committed evidence for TEST-SGD over MCP comes from the
  stdio probe ([m1-iou](../evidence/m1-iou/README.md)), not from Claude Code.
  This shot is only true if Claude Code itself paid on camera. If it fails
  (first-run IOU setup took 92 s on our probe), use the app instead:
  `npx -y $TGZ app --testnet --iou --open`, same question, and change the
  caption to "Local app".
- **Caption:** "Claude Code over MCP · XRPL Testnet · TEST-SGD · our Testnet IOU
  · no real value · stand-in for RLUSD"
- **VO (44 words):** "Any agent can use it. Claude Code adds it with one line.
  The spending caps live in the environment, where the model can't raise them.
  Add one flag and the escrow settles in a stablecoin-style test token. Official
  RLUSD needs one issuer flag."

### Shot 7 · A writer in one command (2:08–2:22)

- **Type:**
  ```sh
  npx -y $TGZ init my-notes
  npx -y $TGZ publish ./my-notes --testnet
  ```
- **On screen:** `Writer live · address r… · CredentialCreate tx ↗ · first sale
  will appear as EscrowFinish`. ⌘-click the Credential link.
- **Caption:** "XRPL Testnet · starter notes, not a real writer · public faucet"
- **If J3 (`init`) has not merged:** skip `init`, and use
  `curl -L https://github.com/Collaboration95/theFastandtheFungible/archive/refs/tags/v1.0.0.tar.gz | tar xz --strip-components=2 '*/examples/writer-starter'`
  then `publish ./writer-starter --testnet`.
- **VO (30 words):** "Writers join with one command. A Markdown folder becomes
  a Testnet writer with an XRPL credential. Ours took 33.9 s
  from a fresh folder."

### Shot 8 · Don't trust us, verify it (2:22–2:40)

- **Type:**
  ```sh
  python3 -m venv /tmp/ra && . /tmp/ra/bin/activate
  pip install -q $REL/researchagent-1.0.0-py3-none-any.whl
  curl -sLO https://raw.githubusercontent.com/Collaboration95/theFastandtheFungible/v1.0.0/docs/evidence/lane-b3/UC3.receipts.json
  researchagent verify UC3.receipts.json --ledger
  ```
  Four lines, ending `PASS testnet 12/12 (read-only, s.altnet)` and `RESULT PASS`.
- **Then open:** <https://collaboration95.github.io/theFastandtheFungible/ledger/>
  and let "Read-only check finished: 61/61 validated" appear (wait for the live result; do not preclaim success).
- **Caption:** "Python verifier · no Node · read-only XRPL Testnet lookups" →
  "61 historical Testnet transactions · checked live from your browser"
- **VO (40 words):** "Don't trust us. Verify it. A Python verifier with no
  Node re-checks every receipt against the ledger. Our ledger page re-validates
  forty-five transactions from your browser in about two seconds. Every number
  in this video has a hash."

### Shot 9 · Close (2:40–2:50)

- **On screen:** deck slide 12 (links, before-mainnet list, the agent strip).
- **Caption:** "github.com/Collaboration95/theFastandtheFungible · XRPL Testnet
  only · no hosted instance"
- **VO (21 words):** "ResearchAgent. An open market where agents pay the
  people who know, and the ledger keeps everyone honest. Thank you."

## After recording

1. Export 1080p MP4, **under 3:00**, with burned-in captions. Check every
   caption against the label rules above.
2. Upload as **unlisted** (YouTube or Drive; Drive must be "anyone with the
   link"). Open the link in a private window to check it plays.
3. Replace `{{VIDEO_URL}}` in `docs/submission/deck/index.html` (slide 12),
   `docs/submission/README.md` and the form. Then re-export:
   `node docs/submission/deck/export.mjs`.
4. Attach the MP4 to the release (`gh release upload v1.0.0 video.mp4`),
   not to git.

J5 measurement for recording: v2 held-out 8/20; v1 dev 16/20 buy-and-cite; zero blanks and terminal gate violations per bank. Online receipt verification: 16/20 dev, 8/20 held-out; no-purchase anchors are missing and remain failed checks. [Evidence](../evidence/j5-coverage/README.md).
