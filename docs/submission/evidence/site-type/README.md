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
caption keeps the original evidence context. Deck labels use the same grammar. The replay's fixture-model context remains separate from its canonical environment label.

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

## Mobile font and tap-target check

The before tree is 2f2edf58, after judge-copy correction and before design F.
The after tree is 3b2a51849e89cdbf3e84888785dd285ab7160d5e. Lighthouse 12.8.2 used a local gzip-6
mirror, 390×844 at DPR 3, simulated 150 ms / 1.6384 Mbps and 4× CPU, with a
fresh headless Chrome for each sample. These are one-pair diagnostics on this
Mac, not hosted-demo measurements or a statistical performance claim.

| Tree | Performance | Accessibility | Best practices | FCP | LCP | TBT | CLS | Transfer | Font requests |
|---|---:|---:|---:|---|---|---|---:|---:|---:|
| before | 95 | 100 | 100 | 2.32 s | 2.32 s | 0 ms | 0.000 | 55.7 KiB | 1 |
| after | 100 | 100 | 100 | 1.05 s | 1.20 s | 0 ms | 0.000 | 54.0 KiB | 1 |

[Summary](lighthouse-summary.json), [before raw report](lighthouse-before.json.gz),
[after raw report](lighthouse-after.json.gz). The after page made zero Google
Fonts requests. Site font declarations use swap; replay navigation reuses the
app's Geist Variable face instead of loading a second brand font. The generated
replay header's font references changed; its layout and height did not.

The phone browser contract checks all four footer links at least 44×44 px,
no horizontal overflow, a visible home heading with Google font domains blocked,
and exactly one local Geist download. The built replay contract checks one Geist
download and no brand-font request. Both passed before these measurements.
