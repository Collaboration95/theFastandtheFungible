# Demo video: owner voice and recording plan

Nine owner voice filenames are retained. Record natural owner audio only; no
synthetic voice belongs in the final. The silent VID-4 review cut estimates timing
at 150 words/minute and marks the missing same-run Trace shot.

The hosted footage is from accepted judge-week build `88c3a00b`, captured at
1280×720 and scaled to the 1920×1080 cut. Two hosted questions were used; the
budget is exhausted. Both automated takes stopped at the inherited key-check
selector after a visible match. Failed raw sidecars remain failed. The retained
second take supplies the observed answer and key check, not a clean complete take.

## Run boundaries

- Featured verification: **421bae3d-564c-48f8-b5e8-5034b195860a**, preset 2,
  **12 Nov**, **24 passed, 0 failed, 2 not checked**, **5/5 gates Held**.
  Its **31.1 s Start→Done**, one article / four passages, **S$0.40** and no refund
  belong to that recorded run, not the fresh hosted question. The Verify button
  checks the bundle without a question. [Featured evidence](../evidence/hosted-export-nov12/README.md).
- Hosted ask: **0fe8cdb8-541e-4c7b-80c6-854c73cfb4f6**, third preset,
  observed **Done in 20.7 s**, **one article, S$0.40 of S$2.00**, no refund.
  [Create](https://testnet.xrpl.org/transactions/A82A7252D93C091CAD313107579B7807D3C5D8B24B049C607B95C16D5BC1EC31),
  [finish](https://testnet.xrpl.org/transactions/60D4CA28A9BCB7E1C792CF71261AAEE520CAE117245F9E32E12259D05E1B814C),
  [anchor](https://testnet.xrpl.org/transactions/207668C454F96E06D9E0C76F1ECC6C55FAAB734BB150B5D7F25CDD3C8B1E227E).
  These hashes were read from validated public Testnet ledgers. Verification
  submitted nothing. Planning and the five-second modal are outside Done timing.

The narration describes the shared key, not an absolute network-secrecy guarantee.
The app grants access after validated success; public signed submission can expose
the key before final validation and a later failure remains a risk. Historical
answer text visible in the raw take is retained evidence, not the final narration.

The deployed chip reads “Shared XRPL Testnet demo · rule-based buying · no real
value”. Do not replace it with “live answers, rule-based buying” in the observed
clip: per-answer Models provenance was not exported before the session closed.
Future complete takes must inspect Models. Team-authored and fictional writer,
local replay, simulated buyer, published-tool and Testnet labels remain explicit.

## s1-title: Title

ResearchAgent: research with a wallet on XRPL Testnet. Paid on delivery. Proven on the ledger.

Source: title-card. Label: XRPL Testnet · no real value.

## s3b-refusal: Verify without a question

The featured recorded run is from 12 November: all five gates held. Verify it without asking a question. The browser reports twenty-four checks passed and two not checked.

Source: hosted-observed, before the question. Label: Hosted demo · featured run 421bae3d · 12 Nov · 5/5 gates Held · no question used · XRPL Testnet.

## s2-sandbox: Ask, plan and buy

How does the writer get paid, and what stops the agent from reading the article and then refusing to pay? Set a budget. This run finished in 20.7 seconds and bought one S$0.40 article. Only policy code pays. The key that unlocks the article is the same key that releases the writer's payment. Show work compares the searches with the confirmed plan.

Source: hosted-observed; explicit capture-gap card for missing Trace. Label: Hosted demo · rule-based buying · team-authored writer · XRPL Testnet · no real value · incomplete take.

## s3-refund: Check the key; know the refund limit

The writer collects by publishing the article key. Signed submission can expose the key before validation. This browser reads the create and finish from a public node and hashes the key. It matches. That proves the key reveal, not quality. This recorded refund needed the writer's signature; a real writer could refuse.

Source: key-check, replay-key-reveal. Label: Local replay · recorded Testnet escrow · fictional writers · browser key check · no real value.

## s4-claude: Claude Code over MCP

Claude Code can use the same research tools over MCP. The spending caps come from the environment; the calling model can't raise them. This result cites our own labelled notes and links its Testnet payments.

Source: claude-mcp. Label: Claude Code + MCP · XRPL Testnet · team-authored writer · real content · not an independent writer · no real value.

## s5-verify: Verify outside the app

Export the receipts and check them outside the app. Our TypeScript and Python verifiers were written separately. Read the passed and skipped checks; a receipt verification result does not certify a writer's identity.

Source: python-verify. Label: Published v1.1.1 Python verifier · recorded sandbox receipts · read-only XRPL Testnet checks.

## s6-try: Writer identity on the ledger

Three operator-run writers now hold accepted Testnet Credentials. A Testnet Permissioned Domain lists the credential issuer and type accepted for identity display. It's our attestation: not KYC, quality certification or payment permission.

Source: hosted-writers; separate fresh session, zero questions. Label: Hosted demo · accepted Testnet Credentials · Testnet Permissioned Domain · operator-issued identity, not KYC or quality · no real value.

## s7-feedback: Unsigned ledger verdicts

We ask rippled before signing. In recorded unsigned probes, RLUSD escrow returned no permission on Testnet and Mainnet. The matched TEST-SGD control succeeded on Testnet. Nothing was submitted. Our browser sandbox pays in Testnet XRP; TEST-SGD is a labelled stand-in, and mainnet spending remains disabled.

Source: builder-feedback. Label: Recorded unsigned simulate results · Testnet + Mainnet reads · nothing signed/submitted.

## s8-close: Close

Check the recorded proof, then ask your question. ResearchAgent: paid on delivery, proven on the ledger.

Source: close-card. Label: XRPL Testnet only · no real value.

## Recording and owner handoff

Media is outside git at `/Users/speedpowermac/Documents/ChatGPT/tftf-wt/video-out/vid-4/`.
The external `shots.json` describes the honest review cut: featured 12 Nov corner
first, the fresh hosted ask with its own numbers and 1× action modal, the key match,
and an explicit same-run Trace gap. No third hosted question is authorized here.
The tracked shot recipe describes the intended complete capture and retains Trace
and Writers marks; it does not turn the failed raw take into a clean one.

The optional refusal question is “Which airlines ordered new narrowbody jets at the 2026 Farnborough Airshow?”.
It was not submitted. Inspection showed planning itself reserves a counted hold,
so VID-4 skipped the optional decline and ledger-URL scenes.

MCP prompt: `ask_expert 'What does an x402 402 Payment Required response contain?' with budget_sgd=2`.
The inherited published v1.1.1 MCP result is labelled team-authored. Python uses
the published v1.1.1 wheel retrieved through authenticated `gh release download`.
These historical terminal clips retain their own questions, receipts and counts;
they do not verify the featured 12 Nov run. The local replay retains fictional
writers and the writer-signed refund limitation. The unsigned ledger verdict card
keeps its observation date and ledger indexes; it signs or submits nothing.

Use `VIDEO_DIR` with `node scripts/video/assemble.mjs --voice none --spec <external-shots.json> --docs-out <captions-dir>`.
The full-length NOVOICE review cut is **incomplete**, with owner voice gaps marked
in the cues version. Put owner takes in `voice/owner/<shot-id>.wav` under VID-4,
following `owner-read-sheet.txt`, then assemble with `--voice owner` and retime
captions against the actual read. Missing same-run Trace remains a separate capture
gap. Upload and the public final video URL remain owner work in pinned issue #265.

Signed Testnet fee reference: buyer <!--f:fee_create-->12<!--/f--> drops;
writer <!--f:fee_finish-->423<!--/f--> drops. The historical unsigned probe card
charges nothing. No media is committed.
