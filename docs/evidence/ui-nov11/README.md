# UI lane evidence · 11 November 2026

Lane UI-2 (design system, plain-English money copy, accessibility, recorded replay). Base: `a9584014` (K4 #442) on top of HU #438 and HF #441.
The merge gate receipt is the `local-gate` commit status on the PR head; no SHA is embedded here, because editing this file would change it.

## Evidence classes

- `before/local`, `before/hosted`: Playwright captures at 1440 and 390 against the local app, with committed recorded run responses and a synthetic hosted status. These prove presentation, not live models, cloud deployment or fresh ledger validation.
- `before/replay`: original source from the same base built in an isolated scratch directory, served statically. XRPL sockets are closed deliberately; live validation is not claimed.
- `after/`: the same viewports and inputs. Local and hosted capture the home, plan, answer, decline, receipt, Settings (hidden when hosted), ledger failure/retry, command palette, cited passage, all sources and mobile spend. Replay captures the recorded run, receipt, citation, ledger, decline and its read-only Settings.
- `after/<mode>/audit-<width>.json` hold the axe results (local, hosted, replay, desktop recovery, at 1440 and 390). All are empty: no violations in any captured state. The earlier aggregate `after/audit.json` and `after/replay-audit.json` were intermediate files from before the citation and replay-banner fixes, so they are removed.
- Replay Settings is a read-only explanation. Hosted Settings remains hidden. Neither is evidence of changing owner configuration on a public host.
- The payment recording contains historical Testnet receipts; no new Testnet transactions, faucet calls, cloud resources or real-money activity occur in this lane.
- `bundle.json` is the measured first-load JS/CSS before, after, and with the lazy splits turned off. The lazy split of Settings, OwnerSettings and Presenter saves about 5.9 KB gzip, so it is kept but is not a headline claim.

## Intended visual and interaction changes

- **Design system:** spacing, radius, shadow, duration, focus and z-index tokens; control borders at ≥3:1 and warning text at ≥4.5:1 on every light surface; two breakpoints (1100, 780); dead and empty CSS removed; one geometric 20-unit icon set with a 1.5 stroke replacing glyph hacks.
- **Motion:** the spinner and typing dots animate; generic entrance motion is gone. Under reduced motion the plan countdown stays visible and requires an explicit Start, with a Pause control; nothing starts silently.
- **Money clarity:** the mobile summary says "Net cost … budget left"; escrow holds are a named amount in the bar and the text; key-reveal steps are in plain words with the engine terms in a "Technical details" disclosure; end-of-run toasts expire after 10 s.
- **One vocabulary:** one verdict word list (Buy, Skip, Rewrite, Blocked) shared by the plan table, decline view, sources and Show work summaries; one refund word list; one budget naming (Budget, Default budget, Per-article limit, Daily limit); "Trust 0.80" and "No history" instead of T/H/C; one short "Team-authored" badge with the detail as a tooltip.
- **Accessibility:** the cited passage region is keyboard-focusable and named (B10); the command palette uses one interactive role per option (B09); repeated region names and heading levels fixed (B31); the Run/Writers switch is navigation with `aria-current` (I-16); the plan timer announces its real state (B28).
- **Replay:** one compact bar, "Replay · recorded <date>", "Start here · key reveal", and "Ask your own question" linking to the hosted app. The hosted address is one value in `shared/links.json` and feeds the replay, the HTML meta and the site config.
- **Local verify:** "Verify on XRPL in your browser" now also appears on a finished local run, not only when hosted.

Goldens and assertions changed only for these intended labels and semantics (listed in the PR's "Loosened" section); recorded evidence and transaction data are unchanged. No financial, leakage, timing or performance threshold is relaxed.
