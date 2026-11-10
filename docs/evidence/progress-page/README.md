# /progress/ ("Since SingHacks"), ledger restyle and home card · 10 Nov 2026

Local Chromium (Playwright) against `site/` served from an ephemeral port, at 390 × 844 and 1440 × 900, with `prefers-reduced-motion: reduce` for the captures. Screenshots were taken with facts at `1f9df59c`; the committed page counts at the `source_sha` recorded in `site/progress/data.json`, so its numbers can be newer than the captures. Ledger rows were re-checked read-only against public XRPL Testnet servers (61/61 validated); no transaction was submitted and no real value moved.

| Check | Result |
| --- | --- |
| Horizontal overflow, 390 and 1440, progress / home / ledger / October log | 0 px on every page |
| Console errors, with and without reduced motion | none |
| axe (serious or critical), progress at 390 and 1440 with every stop open | none (`tests/judge-path.spec.ts`) |
| Count-up with motion on | ends on the exact rendered numbers (215 · 13 · 61 · 7/20 · 84.2 s · 1,011 at capture time) |
| Reduced motion | numbers render final; no animation |
| Ledger viewer and judge-path ledger specs | pass (61 rows, 61/61 on stubbed sockets) |

Files: `progress-1440.jpg`, `progress-390.jpg` (full page), `progress-*-first-screen.png`, `home-*.jpg`, `ledger-*.jpg` (first screen), `evolution-*.jpg` (archive banner).

Rebuild the page with `npm run site:progress` (see `site/SOURCE.md`). Every number comes from git, `gh`, `CHANGELOG.md`, `docs/SFF-PUSH.md` or a committed evidence file; a missing source stops the build.

Kept honest on purpose: the prototype's own README (tag `hackathon-baseline`) shows a language model planned purchases and optional Testnet settlement already existed, so the page does not claim "a person approved every purchase". The 15 builder-feedback submissions are dated 4–5 September, as the feedback document records. Early tags were published minutes apart (v0.1.0 → v0.2.0 contains one PR), so a rail stop shows one to three shipped items rather than padding to three.
