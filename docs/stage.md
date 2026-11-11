# Stage kit · 18 November 2026

Ten minutes before the 11:30 SGT pitch, run from the checkout:

```sh
node scripts/stage-check.mjs --video /absolute/path/to/final-video.mp4
```

This prints GO / NO-GO per check and **USE TIER 1–4**. Checks run in parallel,
with a five-second limit each. It reads hosted status once, reusing one cookie
jar in the Mac's temp directory; it never plans, admits or asks a question.
GitHub release checks use the authenticated `gh` CLI (install it and sign in
before the event). Release assets and the explainer pages are advisory: their
failure is printed but does not change the live presentation tier. An omitted
`--video` means NOT CHECKED; it never claims the offline video is ready.
Deck and video paths must be readable regular files: at least 8 bytes with a
`%PDF-` version header for the deck, or at least 16 bytes with an MP4 `ftyp`
box for the video. This checks signatures, not playback or presentation duration.
An empty, unreadable or wrong-type file is NO-GO.
`--json` emits the same report as JSON. `--deck <file.pdf>` overrides the deck.

Prepare tabs in one dedicated browser profile: A, the finished “How writers get paid” preset with
its anchor; B, “Which XRPL validators are run by Singapore banks?”; C, B's
published proof of refusal; D, A's EscrowFinish at the Fulfillment field; E,
the replay; F, the local deck PDF. Preparing A and B uses two questions: the
check itself uses zero. Prepare these only within the available hosted quota;
this Mac's quota resets at 08:00 SGT on 12 November. Keep the final MP4 and
`docs/evidence/hosted-export-nov11/receipts.json` on disk, and a hotspot ready.

| Tier | Show | Say |
|---|---|---|
| 1 · Live | Prepared A–D. Click the explorer and Run the checks; both read the public ledger. A busy sandbox means use prepared runs, without asking again. | “A run from ten minutes ago on our live Testnet sandbox.” |
| 2 · Sandbox unavailable | Already-open tabs, or the judges' corner's committed run and the explorer. If the entire site is unreachable, the corner cannot load either: use tier 3. | “A recorded run from the live sandbox, 11 Nov.” |
| 3 · Explorer, node or prepared key transaction unavailable | Local replay and offline receipt verification. | “Replay of a recorded Testnet run, no backend.” |
| 4 · No network | Local MP4 (0:09–1:27), PDF slides 3, 5 and 10; offline verifier. | “This is our recorded demo.” |

The pinned EscrowFinish lookup must pass for tiers 1 and 2, even if the node's
current-ledger probe succeeds. Failed or missing required checks select the
applicable lower tier. Tier 3 needs a replay build and passing offline verifier;
tier 4 needs a valid deck, video and passing offline verifier. Missing tier-4
requirements are printed as NOT READY; an omitted video never earns readiness.

Start the offline replay before the pitch:

```sh
node scripts/stage-check.mjs --serve-replay --rebuild
```

It builds into the temp directory, prints its URL and stays running until
Ctrl-C. It binds an ephemeral loopback port; its content security policy blocks
requests outside that origin. `--replay-dir <built-directory>` serves an existing
build. No fixed demo port is used. Keep this terminal running while showing it.

Offline verification (no public-node lookup):

```sh
node --import tsx scripts/verify-answer.ts public/judge/hosted-run-nov11.receipts.json
```

Two-minute beats: 0:00–0:15, research with a wallet; 0:15–0:50, one prepared
purchase and the key on the ledger; 0:50–1:20, refusal and its proof;
1:20–1:40, progress since SingHacks and one-command access; 1:40–2:00, builder
feedback and close. Save browser verification for Q&A. Speak the observed
purchase count and cost, rather than a rehearsed number from a different run.
Never type a fresh question during the timed pitch. Every tier keeps its true
recording, fixture, writer and XRPL Testnet / no real value labels.
