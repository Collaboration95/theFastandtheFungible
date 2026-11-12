# Video production kit

The source is `shots.json`. Read `../demo-video-script.md` and `owner-read-sheet.txt`
for the current owner takes. The tracked copy mirrors the owner’s external read sheet.
The story ends on the key match. One visual end card carries the limits and the short link/QR.

`voiceover.txt` is generated from the shot recipe. `captions.srt` and `timing.*` are
planning estimates, not measured owner timing. Run `node scripts/video/plan-docs.mjs`
after a copy edit. Assemble against real owner audio to replace those estimates.

<a id="state-second-pass-11-nov"></a>

Media stays outside git in `/Users/speedpowermac/Documents/ChatGPT/tftf-wt/video-out/vid-5/`.
The silent full cut uses the current hosted UI, including the main-column payment
steps and inline matching-key result. Home, recorded verification and Writers
were captured in the same fresh browser session. One live question bought one
S$0.40 article; no second question was used. The raw hosted clip is 1280×720.
The Claude Code and Python clips retain their original recorded provenance.

The frozen narration and owner read sheet are unchanged. The external `shots.json`
is the take-specific edit recipe: it ends the narrated story on the inline key
match, then holds one silent limits card with the `/try/` link and QR. Rebuild with
`VIDEO_DIR` pointing at that directory and `--spec` pointing at its recipe;
use `--docs-out` there for captions and timings. The tracked recipe remains the
narration source; its timings are estimates. Owner audio is still pending.
Retain raw sidecars, receipts, run boundaries and speed labels.

No additional hosted questions are needed to assemble this take. The final upload and public video link
are tracked in the pinned owner issue. The orchestrator handles final footage and publication.
