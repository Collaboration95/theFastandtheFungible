# Explainer site type and labels, 11 Nov 2026

Local static site only, served on an OS-assigned loopback port. No hosted
questions, GitHub browsing, cloud changes or site publication. The shared
T3 browser captured the home before edits and after at 1280×900 and 390×844. The after captures were refreshed after the font-loading and footer changes; [phone footer](footer-390.png).

| Width | Before | After |
|---|---|---|
| 1280 | [Home before](before-1280.png) | [Home after](after-1280.png) |
| 390 | [Home before](before-390.png) | [Home after](after-390.png) |

Applied design change F in the owner's order: dead replay links first, Geist
Mono, 600-weight headings, local fonts only, product colours, then archive
navigation. The original three replay links and the metadata generator now
point to `demo/`. A single Archive footer link leads to the October build log,
which links its project map and talk deck; their historical content is retained.

The home, guide pages and generated footer use the exact canonical pill:
"XRPL Testnet demo · no real value", with a green #2F6B4F dot. The full live
label is "Shared XRPL Testnet demo · live answers, rule-based buying · no real
value". Replay context uses "Replay · XRPL Testnet, recorded 11 Nov 2026 ·
fictional writers · no real value". README uses "live demo"; its dated hero
caption keeps the original evidence context. Deck labels use the same grammar.

Observed computed styles: home h1 Geist / 600; guide h1 and h2 weight 600,
letter-spacing -0.02em; guide code/pre Geist Mono with the local font loaded.
At 390 the document and viewport are both 390 px wide, without horizontal
overflow. Font resource requests are local; no Google Fonts requests remain.
Cards are flat; active talk and ledger colours match product tokens. Ledger
amounts show XRP, raw drops remain in the title, fees remain drops and hashes
use uppercase 8…8. The plain key-match verdict retains its checked raw formula
under Technical details; verification logic is unchanged.

Focused verification: 46 tests across the site, judge pack, deck, progress and
release-URL suites passed. Site contracts now pin the requested footer, canonical
pill and working replay destination, and reject third-party font references.
The existing proof/tampering expectations remain intact. No gate, threshold or
budget was loosened. Full local verification is required on the final PR head.
