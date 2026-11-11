# Demo video kit

Everything for the required demo video except your voice. Agents recorded the footage from
real runs, captioned it, and cut a draft with a synthetic voice so you can check timing.
You record the voice-over (about 30 minutes) or approve a text-to-speech track; the
decision is A4 on [#265](https://github.com/Collaboration95/theFastandtheFungible/issues/265).
The shots and words are in the [script](../demo-video-script.md); the cut itself is
[shots.json](shots.json).

| File | What it is |
|---|---|
| `scratch/video/out/ResearchAgent-demo-DRAFT-synthetic-voice.mp4` | 1920×1080 H.264 draft: footage, labels, burned-in subtitles, synthetic voice |
| `scratch/video/out/ResearchAgent-demo-NOVOICE-clean.mp4` | same picture and labels, no audio, nothing else on screen: record over this |
| `scratch/video/out/ResearchAgent-demo-NOVOICE-cues.mp4` | same, with a timecode and each sentence at the time to say it (recording aid, not for upload) |
| [timing.csv](timing.csv), [timing.json](timing.json) | shot and sentence times, labels, and which footage each segment uses |
| [captions.srt](captions.srt), [voiceover.txt](voiceover.txt) | subtitles timed to the synthetic read; the plain words, one block per shot |

`scratch/` is gitignored: the MP4s stay on the Mac that built them. Nothing is uploaded anywhere.

## Re-record (one command)

```sh
make video-record                                    # every scene, about 12 minutes
make video-record ARGS="--scenes hosted-ask"         # one scene
```

Needs `ffmpeg`, `tmux`, Playwright's Chromium (`npx playwright install chromium`), network,
and for the Claude Code scene a logged-in `claude`. A pass asks the hosted demo at most
**4 questions** (it waits while the demo is busy). If the demo is not `ready` the recorder
starts a local `HOSTED=1` stack instead and the captions say so; `--target hosted` refuses
to fall back, `--wait-hosted` waits for `ready`. Each clip's `scratch/video/clips/<scene>.json`
names where its footage came from.

| Scene | Shot | Real source |
|---|---|---|
| `title-card`, `close-card` | 1, 8 | cards drawn from the README's own lockup and text |
| `hosted-ask` | 2 | the hosted demo, one question, one Testnet purchase, "Verify on XRPL" |
| `replay-key-reveal` | 3 | the public replay, then the EscrowFinish on the XRPL explorer |
| `hosted-decline` | 3b | the hosted demo, a declined question and its proof of refusal |
| `claude-mcp` | 4 | the real `claude` CLI with the real MCP server, Testnet faucet wallets |
| `python-verify`, `ledger` | 5 | the released Python wheel; the public `/ledger/` page |
| `try-testnet` | 6 | `npx … try --testnet` from the v1.1.0 release |
| `builder-feedback` | 7 | `docs/BUILDER-FEEDBACK.md` on GitHub |

Terminal scenes are real sessions captured screen by screen and drawn at 1080p. Output is not
mocked or edited; the renderer only shows your home directory as `~` and hides the personal
usage figures in Claude Code's status line. The recorder removes its test MCP server and
work folder afterwards (Claude Code keeps a "trusted folder" entry for `~/ra-demo`).

## Re-assemble (one command)

```sh
make video-assemble          # about a minute: draft, no-voice and cues cuts, plus captions and timing
make video-assemble ARGS="--plan"                  # print the timeline only
make video-assemble ARGS="--only s2-sandbox"       # rebuild one shot
```

Waits longer than a shot allows are sped up and labelled "Sped up ×N · real time shown"
with a clock, so footage is never silently accelerated. To drop or reorder a shot, edit
[shots.json](shots.json) (`"enabled": false`, or `--without s6-try`).

## Your voice

1. Watch `NOVOICE-cues.mp4`, then read [voiceover.txt](voiceover.txt).
2. Record each shot as its own file, named by shot id, in `scratch/video/voice/owner/`:
   `s1-title.wav`, `s2-sandbox.wav`, … Start speaking at the time in `timing.csv`; a shot
   stretches to fit a longer read. Keep Testnet and "no real value" wording as written.
3. `make video-assemble ARGS="--voice owner"` writes `ResearchAgent-demo-OWNER-voice.mp4`
   (add `--subs` to burn subtitles timed to the synthetic read; for upload, let YouTube
   time your transcript instead). One continuous recording works too:
   `--voice-file take.wav` lays it over the no-voice cut from 0:00.
4. Check the cut against the label rules in the script, upload **unlisted**, then follow
   "After recording" in the script.

## State of the first pass (11 Nov)

- The hosted footage was recorded after the 11 Nov redeploy and shows the app as it was:
  "Planned with offline rules: the planner was unavailable." and, on the declined question,
  "Written from offline extracts: the model was unavailable." Re-record `hosted-ask` once the
  hosted demo answers with live models.
- Shot 3b (proof of refusal) is **off**: on the hosted demo "Publish proof page" failed twice
  with "The proof page could not be created". Re-record `hosted-decline`, then set
  `"enabled": true` in shots.json.
- The voice is macOS `say` (Samantha): a placeholder for timing, not for upload.
