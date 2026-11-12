# Demo video kit · VID-3

The cut and owner voice text follow §3 of the final pitch shot list. Nine original
shot/voice-file IDs are retained. `s3b-refusal` now shows zero-question verification;
`s6-try` shows writer identity. `s2-sandbox` is **record after redeploy** and excluded
from assembly, so the available cut is explicitly PARTIAL. No synthetic voice is
produced. No media is committed.

Use Node 22 (`.nvmrc`); current main's bundle budget checks the deployment runtime.
On this Mac, prefix the commands below with `mise exec node@22 --` if the shell
selects a different Node version.

```sh
make video-record
make video-record ARGS="--list"
make video-record ARGS="--scenes judges-corner,key-check,writer-credentials --target local"
make video-assemble ARGS="--voice none"
```

Media defaults to `/Users/speedpowermac/Documents/ChatGPT/tftf-wt/video-out/vid-3/`:
`clips/` holds MP4s, sidecars and private working transcripts; `out/` holds silent
partial cuts and `last-build.json`. Use VIDEO_DIR for a distinct take. Sidecars
retain actual timing marks and verification results; accelerated waits in the
assembled cut show speed and elapsed time. All output is 1920×1080, 30 fps.

## Scenes and provenance

| Scene | Source | State |
|---|---|---|
| title-card / close-card | Local static cards, no mascot | Record locally |
| judges-corner | Current-main local HOSTED=1, unchanged 11 Nov sandbox bundle; real public Testnet reads | No question consumed |
| key-check | Current-main local replay, fictional writer, recorded Testnet escrow; fresh browser hashing | Requires actual match |
| writer-credentials | X2 local HOSTED=1 harness, real Testnet identity, simulated buyer | Three operator-issued credentials; not KYC or quality |
| replay-key-reveal | Current-main replay served on an ephemeral port | Recorded, fictional writer; writer-signed refund |
| builder-feedback | Card from committed ledger-dry-run output, observed 11 Nov | Unsigned Testnet/Mainnet verdicts; nothing submitted |
| claude-mcp | Published v1.1.1 tgz, real Claude Code call + Testnet | Visible label must say team-authored |
| python-verify | Published v1.1.1 wheel, committed recorded sandbox receipts | Real read-only ledger checks |
| try-testnet | Optional published v1.1.1 CLI | Fictional writers, fixture models, Testnet |
| hosted-ask / hosted-decline / ledger | Actual deployed URLs | **Record after redeploy**; recorder skips them |

`--target local` is the default and the only enabled target in this lane. There
is no automatic hosted probe or hosted question. The existing hosted ask body
remains for the next pass; re-enable it deliberately after redeploy and capture
all marks before removing shot deferral. Keep **live answers, rule-based buying**.
Never relabel old footage as a new release or a deployed feature.

Writers first asks a local zero-budget question to obtain signed search metadata;
there is no purchase. The local stack rebuilds the app and reuses the existing X2 evidence harness.
It reads existing mode-0600 operator writer key files privately, passes them only
to the child, and generates throwaway keys for fictional writers. It does not run
the credential setup script, fund wallets, or create ledger objects. Models and
buyer payments stay fixture/simulated. No engine, UI or server hook is added.
Every listener uses ephemeral ports; never 5100, 8788 or 8790.

## Prepared run after #499

Shot 2 uses the exact third preset: **“How does the writer get paid, and what stops the agent from reading the article and then refusing to pay?”**
The observed lead in T3-1 was:

> the writer gets paid by publishing the article's key on the XRP Ledger: the payment waits in an escrow that only that key can open, so an agent cannot read the article unless the writer is paid.

**12 Nov clarification (retained quote, not final narration):** the key that unlocks the article is the same key that releases the writer’s payment. The app shows it only after EscrowFinish validates. Signed submission exposes the key earlier; anyone (the writer first) can still claim with that key until CancelAfter.

That local HOSTED=1 measurement used live DeepSeek, fixed buying rules and one
**S$0.40** key-reveal purchase of `product-writer-paid` on XRPL Testnet.
Its [EscrowFinish](https://testnet.xrpl.org/transactions/BC2B4BAD2D7E7615E3A3B6A74888899F433615EE99D4E0ACD75F5CC9C2BA9F01) is the T3-1 reference, not the old x402 payment.
The primary hosted take is still **record after redeploy**. Check that take's
actual lead and purchase, then follow its own EscrowFinish. Retain **live answers,
rule-based buying** only for an actual live-answer take; inspect fallback provenance.
Shot 2's owner voice text now reads this question and observed lead; recheck full
cut duration against the owner's audio. The 360-word limit is unchanged.

Re-record local home/corner and Writers footage against #499 so visible presets
are current. Historical MCP, Python and replay footage keep their original
questions, transaction links, labels and dates. No historical x402 take becomes
a writer-payment take. The identity-only local free question remains setup for
signed writer metadata, with no purchase.

## Release pins

Video pins share `publishedReleases` in `shared/links.json` with the builders'
corner. The regression rejects an unpublished tag. Before recording, the kit
checks v1.1.1 and its uploaded tgz/wheel through the existing release-link helper.
Run the live test with:

```sh
CHECK_RELEASE_URLS=1 npx vitest run tests/video-kit.test.js
```

Terminal assets are fetched using authenticated `gh release download`. Python
future receipts are copied from the featured path in `shared/judge-run.json` (currently `public/judge/hosted-run-nov12.receipts.json`). The existing VID-3 captures below retain their 11 Nov bundle. No GitHub
browser access, raw-URL fetch or synthetic result substitution is used.
Current-main features postdate v1.1.1; the published tools prove compatibility,
not inclusion of those features in the release.

The video wrapper warms the server's real advisory identity cache before opening
the local take. The evidence harness omits production's startup prewarm; after
the asynchronous refresh change, its first question can otherwise retain pending
observations. The recorder still requires three actual verified UI badges.

## Owner audio

`voiceover.txt` and `demo-video-script.md` contain the exact owner lines, with the
specified local-acceptance alternative for the corner. Record each shot's audio
as `voice/owner/<shot-id>.wav` under VIDEO_DIR. `--voice owner` requires every
selected shot's recording. `--voice-file <take.wav>` accepts a continuous owner
track; `--voice none` uses text-only timing estimates at 150 words/minute. Recheck
the duration with the actual voice. No `say`/TTS fallback is allowed.

Before calling the cut final: re-record the hosted URL after orchestrator redeploy,
retain true source/model/writer labels, check a real key match and actual pass/skip
counts, and verify why-bought plus the Trace search comparison. Owner upload and
public video links remain in pinned issue #265. No upload is performed here.

## Current featured receipts

The featured export is **one hosted run, 12 Nov**, preset 2, run
`421bae3d-564c-48f8-b5e8-5034b195860a`: **09:07:38.656–09:08:09.738 SGT,
31.1 s Start→Done**, one article / four passages for **S$0.40**, no refund.
Planning and the five-second modal are excluded; model cost is unmeasured.
Browser and published v1.1.1 TS: **24 passed, 0 failed, 2 not checked/skipped**;
published v1.1.1 wheel: **25 passed, 0 failed, 2 skipped**; Testnet **6/6** each.
All five browser gates are **Held**; explicit grant **1953** precedes paid reads
**1954–1957**. Identity skips remain explicit. Live DeepSeek plan/final answer,
rule-based buying, initial fixture draft and keyword fallback; team-authored writer;
XRPL Testnet, no real value.

[Evidence and transaction links](../../evidence/hosted-export-nov12/README.md). Existing clips below are historical; changing the featured path does not re-record them.

## VID-3 historical recorded acceptance

Browser clips refreshed from main base `16bfffd2` after the shipping rebase, with
published v1.1.1 CLI artifacts. Nine clean scene clips are in video-out/vid-3/clips.
Corner: **45 passed · 2 not checked**, zero admission/run requests. Key:
**sha256(key) = lock ✓**, public Testnet ledger 22224890. Writers: **3** live badges,
local zero-budget question, no purchase. Python: **46 passed, 0 failed, 2 skipped**,
**11/11** Testnet checks and anchor ledger 22228575. MCP: actual v1.1.1 call,
**S$0.40 / S$2.00**, team-authored label, create/finish/anchor links.

Terminal timing was corrected: JPEG concat inputs use a millisecond timebase,
so marks no longer drift (78.742 s transcript → 78.733 s MP4, within one frame).
The authenticated gh download is launched with `npx --package <local-tgz>
researchagent-mcp`, since a local archive passed as the executable returns
Permission denied. No product or gate threshold changed.

<a id="state-second-pass-11-nov"></a>

## State: VID-4 hosted pass, 12 Nov

Explicit `--target hosted` is restored after DEPLOY-5 accepted deployed build
`88c3a00b`. Local remains the default, with no hosted probe or automatic fallback.
Hosted scenes and `s2-sandbox` are enabled. Hosted browser capture is 1280×720;
assembly scales it to the existing 1920×1080 cut. Use `VIDEO_DIR` to keep media
outside git. The recorder caps each pass at two hosted questions and stops on a
failed take rather than automatically spending another question.

VID-4 used **two hosted questions**, then stopped. Both answered and displayed a
matching browser key check. The inherited selector incorrectly expected a text
checkmark where the current UI renders SVG; both automated takes ended there,
before Trace/Writers. A separate zero-question hosted Writers clip retains all
three accepted Credential badges. The selector now checks the actual matching-result state,
with a regression against the rendered production component and a mismatch case.
Failed raw media and sidecars remain failed evidence; they are not clean takes.

The hosted corner verified the featured 12 Nov bundle: **24 passed, 2 not checked**,
with **all five gates Passed** (the UI word for Held) and zero question requests.
The deployed header says **rule-based buying**; it deliberately separates the
configured buying mode from each answer's provenance. No UI text was substituted.

Artifacts are in `video-out/vid-4`: a full-length **NOVOICE review cut** retains
observed hosted footage and explicitly marks the missing same-run Trace segment.
It is not the completed submission video. VID-3 clips retain their original
local/replay/published-tool labels. The full cut now uses the captured **12 Nov**
featured run `421bae3d` for the zero-question corner, before the ask. Its speech
and captions say **5/5 gates Held**, **24 passed, 2 not checked**. The fresh ask
keeps its own **20.7 s**, **one article, S$0.40**; it does not inherit the featured
run's 31.1-second timing. Owner voice remains tracked in #265.

The final script, voiceover, shots, captions and VID-4 owner read sheet use:
“The key that unlocks the article is the same key that releases the writer's
payment.” The app grants access after validated success; signed public submission
can expose the key before final validation. The earlier T3-1 quotation above is
historical answer text, not a network-secrecy guarantee or the final voice line.
Domain excerpts say **Testnet Permissioned Domain**. The owner sheet now points
to `video-out/vid-4/voice/owner` and contains the final read text.

For a review cut with external shot edits and captions, the assembler accepts
`--spec /absolute/path/shots.json --docs-out /absolute/path/captions`. This avoids
rewriting unrelated files. The orchestrator assigned the video script, voice text,
shots and captions to VID-4 for the final cold-read corrections. No synthetic voice,
video files, product/UI/server changes, or relaxed gates are included in this PR.
