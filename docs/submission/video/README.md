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

## State (second pass, 11 Nov)

The first pass (morning) predated v1.1.0 and showed the planner and model fallback notices, so
every scene was re-recorded on **11 Nov, about 11:30–12:00 SGT**, from current `main` at v1.1.0
(`3157fe41`). The hosted demo ran v1.1.0 with live DeepSeek planning and answers and a labelled
fixture purchase decision (its chip reads "live answers, rule-based buying"). The cut is **2:55
with shot 3b** and about 2:35 without it.

| Scene | Source of this footage |
|---|---|
| `hosted-ask` | the hosted demo: "What does an x402 402 Payment Required response contain?", one S$0.40 Testnet purchase, "Anchoring…" becomes "Anchored on XRPL", "Run the checks" ends on "26 passed · 2 not checked" |
| `hosted-decline` | the hosted demo: "Which airlines ordered new narrowbody jets at the 2026 Farnborough Airshow?", "No source covers this question yet. Nothing was bought.", Publish proof page, the live proof page ("Refused to spend.") |
| `claude-mcp` | real `claude` CLI (Claude Code 2.1.322) and the v1.1.0 MCP tgz on the same x402 question: one S$0.40 purchase, three explorer links |
| `python-verify`, `try-testnet` | the v1.1.0 wheel (`PASS testnet 12/12`, `RESULT PASS`) and the v1.1.0 tgz (`try --testnet`, `RESULT PASS` in 63 s this run) |
| `replay-key-reveal`, `ledger`, `builder-feedback` | the public replay and EscrowFinish on the explorer, `/ledger/` (61/61 validated), `BUILDER-FEEDBACK.md` on GitHub |
| `title-card`, `close-card` | cards drawn from the README lockup |

- **Shot 3b is on.** "Publish proof page" works on the hosted demo again (#462). The question is
  deliberately off the library: it shares no words with any writer or free source, so no
  fictional-writer record is read. Words like "outlook" or "prices" match the open central-bank
  records, get a free answer, and leave nothing to refuse. Its voice-over now says "no source
  covered the question" (the proof page shows 0 paid articles found).
- **x402 instead of RLUSD.** On hosted the RLUSD preset buys three articles and leads with
  EscrowCreate (mock-judge round 9, H9-01); the x402 question buys one in about 20 s.
- Recorder fixes this pass: the verify wait accepts "N passed · K not checked" (the app says
  that when some checks were skipped), `hosted-ask` waits for the anchor line, and the terminal
  scenes switch off npm's upgrade notice.
- No personal data on screen: home paths show as `~`, no email, no key or seed, and Claude
  Code's usage figures are blanked. The demo flipped to `paused` once mid-recording and one take
  was retried; the pass asked the hosted demo 9 questions in total (several passes).

**Left for you** (the voice and the upload, tracked as A4 on #265), and what to know first:

1. Record the voice-over, or approve the synthetic one; upload **unlisted**; set the links.
2. Claude Code's prose calls the source "one team-authored explainer from an unverified writer,
   not an independent one", but the closing Labels line it prints still says "Fixture models
   and fictional writers". That line is the v1.1.0 MCP tool's own label, so it only changes in a
   new release; the caption on the shot says team-authored. The voice-over's "labelled as ours"
   matches Claude's prose, not that last line.
3. The hosted card says "26 passed · 2 not checked", not "All N checks passed". The Python
   verifier skips two checks on the same kind of export (writer credentials, which need an
   online lookup, and historical origin, which this receipt format doesn't need), so the two
   are most likely those; I did not open the browser card's groups to confirm. The voice-over
   doesn't claim "all".
4. The proof page's own chip says "fixture models", while the app chip says "live answers,
   rule-based buying". Both are true (answers are live, buying is rule-based); the caption uses
   the app's wording.
5. Avoid asking "writer never reveals the key" with Verify on camera until H9-02 is fixed (an
   export that reads fictional free sources fails verification). None of the recorded questions
   reads one.
6. The voice is macOS `say` (Samantha): a placeholder for timing, not for upload.
