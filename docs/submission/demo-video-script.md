# Demo video: run-through script (2:45)

The form's demo link is "a video run-through of what the team has built".
Judges watch it before the pitch, so it carries the detail the 2-minute pitch
can't. **Recording is a human task.** It is tracked on
[issue #265](https://github.com/Collaboration95/theFastandtheFungible/issues/265),
with a target recording date of **Wed 11 Nov** and upload by Thu 12 Nov.

## Ground rules

- **Labels.** Each scene's caption says what is real. "XRPL Testnet" is used
  only where a validated transaction is on screen. Fixture scenes keep the app's
  header indicator ("Demo · simulated payments") in frame. That covers hard
  gate 5.
- **No new spending to make the video.** The live evidence scripts replay their
  journals idempotently, so rerunning them shows the same hashes without paying
  again. Don't delete `data/hire-demo-live/` or `scratch/*` state to "get a
  fresh run".
- **Ports.** Use the given `OFFSET`s so nothing collides with a main demo
  (5100/8788/8790).
- **Never show** `.env`, `.env.writer`, `caller.private.json` or a terminal
  that has echoed a seed. Close editors before recording the terminal.
- **Capture.** App scenes come from `make clip` (Playwright, 1920×1080).
  Terminal and explorer scenes come from a QuickTime screen recording at
  1920×1080, terminal font 18 pt, light theme. Cut in any editor and add
  captions in Geist.
- **Voice.** Either the owner records the voice-over (recommended; sounds like
  a team) or we use a TTS track. That is the owner's decision on #265. Keep the
  VO under 330 words.

## Clips that already exist (release assets)

| Asset | Release | Usable? |
|---|---|---|
| `uc3-2026-11-03.mp4` (refund scene, UX-1 UI) | [v0.5.0](https://github.com/Collaboration95/theFastandtheFungible/releases/tag/v0.5.0) | **Yes**, for scene 3 if it isn't re-recorded |
| `before-after.png` (UX-1 before/after) | v0.5.0 | Yes, as a still in scene 8 |
| `ResearchAgent-0.5.0-arm64.dmg` | v0.5.0 | The installer for scene 7 |
| `uc2-2026-11-02.mp4` / `.webm` | [v0.2.0](https://github.com/Collaboration95/theFastandtheFungible/releases/tag/v0.2.0) | **No.** It shows the pre-UX-1 interface; re-record scene 2 |
| `macos-uc2.png`, `macos-uc3.png` | [v0.4.0](https://github.com/Collaboration95/theFastandtheFungible/releases/tag/v0.4.0) | No, pre-UX-1 |

If #312 (UX part 2) merges before 11 Nov, re-record scenes 2 and 3 on the new
`main`.

## Scenes

### Scene 1 · Cold open (0:00–0:10)

- **On screen:** the deck's title slide (`docs/submission/ResearchAgent-SFF-deck.pdf`, page 1), then a cut.
- **Caption:** "XRPL Testnet · no real money · fictional writers"
- **VO:** "This is ResearchAgent: research with a wallet. It buys the one article
  it's missing, straight from the writer, over x402 on the XRP Ledger, inside a
  budget you set."

### Scene 2 · Ask, plan, pay, cite (0:10–0:35)

- **Command:** `make clip UC=UC2 VIEWPORT=1920x1080` (starts its own ephemeral
  servers, drives ⌘K → question → clarification → plan → paid, cited answer, and
  saves `clips/uc2-<date>.mp4`). To drive it by hand instead:
  `make record OFFSET=300` and open the printed `?record=1` URL.
- **On screen:** the 5-second plan sheet, the Spend panel, one payment row
  turning Verified, and the answer with citations.
- **Caption:** "Offline demo · simulated payments (header indicator)"
- **VO:** "You ask a question and set a budget. It answers from free sources
  first, shows a five-second plan, then buys one article. The model only
  recommends. Deterministic policy code makes the payment, and every citation
  points at a delivered passage."

### Scene 3 · A broken promise is refunded (0:35–0:55)

- **Command:** `make clip UC=UC3 VIEWPORT=1920x1080`, or reuse v0.5.0's
  `uc3-2026-11-03.mp4`.
- **On screen:** the AlphaLeak row: "didn't contain what it promised ·
  Refunded S$0.30". Open the receipt side sheet.
- **Caption:** "Offline demo · simulated refund"
- **VO:** "Each article is checked against the writer's signed promises. This
  one lied, so the money came back, and the article is never cited."

### Scene 4 · Claude Code buys research over MCP (0:55–1:20)

- **Commands** (fresh clone, fixture mode, no keys):
  ```sh
  claude mcp add researchagent -e MCP_MAX_BUDGET_MINOR=200 -e MCP_DAILY_CAP_MINOR=500 -- node --import "$PWD/node_modules/tsx/dist/loader.mjs" "$PWD/mcp/server.ts"
  claude
  ```
  Prompt: *"Search the writers, then ask_expert: What's the analyst outlook on
  Kestrel Semiconductor's latest deal with TSMC (pricing & margins)? Request
  budget_sgd=2. Show citations, purchases and all mode labels."*
- **Then cut to** the Testnet proof of the same MCP path:
  [D65FDA44…2FC9F9](https://testnet.xrpl.org/transactions/D65FDA447AAC788BA7451615FCB6BDD62960AB066DC5A0BB150980B9E32FC9F9)
  on the explorer (validated, 0.09 XRP).
- **Caption:** "Claude Code: fixture mode, simulated payment" → "Same MCP tools,
  stdio client, XRPL Testnet, 3 Nov"
- **VO:** "Any agent can use it. Claude Code adds it with one command. The
  spending caps live in the environment, so the calling model can't raise
  them. Over MCP on Testnet, a question became a paid, cited answer in 23
  seconds, and a retry didn't charge twice."
- **Honesty note:** the Testnet purchase was driven by the MCP SDK stdio client,
  not by Claude Code ([write-up](../../eval/mcp/testnet-2026-11-03.md)). The
  caption must not say "Claude Code paid on Testnet".

### Scene 5 · Hire the agent (x402 agent-to-agent) (1:20–1:45)

- **Command** (replays the recorded live run; same hashes, no new payment):
  ```sh
  OFFSET=1300 node --import tsx scripts/hire-demo.mjs --live
  ```
  Fallback with no Testnet access: `node --import tsx scripts/hire-demo.mjs`
  (labelled fake ledger).
- **On screen:** the five-hop money chain in the terminal, then the explorer
  for the caller payment
  [8AD6FD7B…](https://testnet.xrpl.org/transactions/8AD6FD7B05EF9BCA0C738101102EC8094949CBB29CD44A6875D8CDFB24296134)
  and the free-writer royalty
  [48C600E3…](https://testnet.xrpl.org/transactions/48C600E3E5DE212BA38AA60A9FA7855DD91AFF3DAC7D153ECED4E373E68BD95E).
  Overlay the deck's slide-5 table as a still.
- **Caption:** "XRPL Testnet · fixture research · fictional writers"
- **VO:** "Other agents can hire ResearchAgent over x402. It buys what it needs,
  returns the change, and pays a royalty to every writer it cites, including
  free writers. 220,000 drops in, and every drop is accounted for on the
  ledger."

### Scene 6 · The ledger enforces the refund (1:45–2:05)

- **On screen:** explorer pages for the failed-proof pair:
  [EscrowCreate EAA86976…](https://testnet.xrpl.org/transactions/EAA86976171D6238EF53947AA33D7D2FF8C4B328823F5575720FD72444F60A72)
  → [EscrowCancel C007A296…](https://testnet.xrpl.org/transactions/C007A2966C71ADAE1743612E3386BB2F53FB0AF5F4B0B03D6ED67856E78408FA).
  Then the honest-proof finish
  [7367BA10…](https://testnet.xrpl.org/transactions/7367BA104561692202D04DBC1D15F8FB08FAD7ABA6BA5C76C82BEA1D02BD4846).
  Optional: `OFFSET=1600 node --import tsx scripts/evidence/escrow-273.ts`,
  which only reconciles and reads the completed intents.
- **Caption:** "XRPL Testnet escrow · synthetic article"
- **VO:** "With native XRPL Escrow, the refund doesn't depend on the writer's
  goodwill. Proof passed, and the escrow released in 12 seconds. Proof failed,
  and it cancelled and returned the full amount, with the writer offline."

### Scene 7 · Writers publish in one command; the Mac app (2:05–2:25)

- **Commands:**
  ```sh
  cp -R examples/writer-starter my-notes
  OFFSET=800 npm run publish:site -- ./my-notes
  ```
  Show the printed "Folder → searchable, payable writer" time, then the
  recorded Testnet read
  [ED26E003…](https://testnet.xrpl.org/transactions/ED26E003037BC6BD3F1E580F3C5E019F30E170535C9E034F45DFE1EB08F15FA5)
  (18.90 s folder → paid read).
- **Then:** open `ResearchAgent-0.5.0-arm64.dmg` from v0.5.0, drag to
  Applications, right-click → Open (unsigned), and press ⌘K.
- **Caption:** "Testnet wallet funded from the faucet · synthetic starter
  articles" → "Mac app · offline demo"
- **VO:** "Writers join with one command: a Markdown folder becomes a paid
  writer on Testnet in 19 seconds. And the whole thing ships as a Mac app that
  works offline."

### Scene 8 · Check it yourself (2:25–2:45)

- **Commands:**
  ```sh
  npm run audit:verify -- --testnet                         # hash chain + read-only Testnet lookups
  npm run gate:audit -- --db data/hire-demo-live/app.db     # the five gates on the hire run
  npm run verify                                            # lint, types, the test suites, build (speed up 8×)
  ```
- **On screen:** `RESULT PASS`, `0 violations`, the test summary, then the
  deck's slide 10 (the Testnet transactions), then the repo URL.
- **Caption:** "github.com/Collaboration95/theFastandtheFungible"
- **VO:** "Don't trust us. Verify it. The audit chain re-checks every receipt
  against the ledger, the gate audit finds zero violations, and every number in
  this video links to a validated Testnet transaction. That's ResearchAgent."

## After recording

1. Export 1080p MP4, under 3:00, with burned-in captions. Upload as unlisted
   (YouTube or Drive; the owner chooses) and paste the link into the form,
   deck slide 10 (replace the TODO) and `README.md`.
2. Attach the MP4 to the next release (`gh release upload`), not to git.
3. Re-export the deck: `node docs/submission/deck/export.mjs`.
