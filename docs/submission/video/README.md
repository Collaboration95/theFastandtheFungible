# Demo video kit · VID-3

The cut and owner voice text follow §3 of the final pitch shot list. Nine original
shot/voice-file IDs are retained. `s3b-refusal` now shows zero-question verification;
`s6-try` shows writer identity. `s2-sandbox` is **record after redeploy** and excluded
from assembly, so the available cut is explicitly PARTIAL. No synthetic voice is
produced. No media is committed.

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

## Release pins

Video pins share `publishedReleases` in `shared/links.json` with the builders'
corner. The regression rejects an unpublished tag. Before recording, the kit
checks v1.1.1 and its uploaded tgz/wheel through the existing release-link helper.
Run the live test with:

```sh
CHECK_RELEASE_URLS=1 npx vitest run tests/video-kit.test.js
```

Terminal assets are fetched using authenticated `gh release download`. Python
receipts are copied from `public/judge/hosted-run-nov11.receipts.json`. No GitHub
browser access, raw-URL fetch or synthetic result substitution is used.
Current-main features postdate v1.1.1; the published tools prove compatibility,
not inclusion of those features in the release.

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

## VID-3 recorded acceptance

Captured from local product source `61d46489` (current main at lane start), with
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

## State: second pass, 11 Nov

This anchor preserves links to VID-2's historical acceptance. Its v1.1.0,
2:55 hosted draft is superseded by the VID-3 local footage described above.
The old cue times do not apply to this cut. Record hosted-URL scenes after
redeploy and use the owner's voice.
