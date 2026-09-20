# ResearchAgent UO-04 portable prototype

This folder is a self-contained, editable prototype for the accepted UI-overhaul state map. It runs with no account, cloud service, external asset, provider key, wallet, or payment API.

## Run locally

From the repository root, use either built-in option:

```powershell
python -m http.server 4173 --directory ui-overhaul/prototype
```

Then open <http://127.0.0.1:4173/>. If Python is unavailable, any static file server may serve this folder; no package install is required. Opening `index.html` directly also works in browsers that allow module scripts on `file:` URLs, but a local server is recommended for consistent localStorage behavior.

The prototype is intentionally local-only. `app.js`, `styles.css`, and `index.html` are the editable source of truth. `localStorage` persists the simulated draft so the reload/recovery path can be rehearsed. Use **Reset demo** in the header to clear it.

## Rehearsal path

1. Start on **First-run home**, use the supported example, and choose **Start research**.
2. Walk **Question → Sources → Budget → Review**. Uncheck every profile once to see the accessible minimum-selection error.
3. On Review, open **Edit advanced settings**; approve the plan. This is plan approval only.
4. In Research, inspect **Sources** and **Activity**. Select **Answer from available evidence** to complete the open-only path without a purchase.
5. Use **View citation** to inspect a bound open fixture span. Return to Research and choose **Review purchase** for the separate exact-quote modal; cancel it to prove no state change.
6. Open **Prototype controls · rehearse recovery states** to simulate quote expiry, policy blocking, unknown payment, access fulfilment failure, and reload recovery. Each state offers a local recovery action.
7. Use **Pause** and **Resume** in the workspace header. Use **Save draft and exit**, then **Resume draft** on the returning-user home.
8. Paste or choose **What should I cook for dinner tonight?** to exercise the truthful unsupported-scope state. It creates no run, purchase, or unrelated evidence.

## Representative viewports

The CSS is designed for 320px reflow and 200% text zoom, with primary review targets at 360, 390, 768, 1024, and 1440 CSS pixels. Desktop working surfaces stay centered with one answer/progress region; Sources and Activity are tabs rather than a third column. Narrow layouts stack source actions while keeping status and consent visible.

The named high-fidelity states are available through the click path:

| Screen | State-map coverage | Local route/action |
| --- | --- | --- |
| Question | Q1 | Home → Start research → Question |
| Review | V1/V2 | Question → Sources → Budget → Review |
| Research | R1/P1/T1/L1 | Approve plan → Research |
| Purchase approval | P2 | Research → Review purchase |
| Answer | A1/A2 | Research → Answer from available evidence |

## Truthful simulation labels

The UI labels synthetic fixture records, open vs protected evidence, fixture conversion, and local settlement simulation. The exact purchase modal states that it does not pay a real publisher and that no XRPL Testnet transaction is submitted or validated. If a future validated runtime uses Testnet, that environment would be labelled separately. Premium recommendation, quote review, approval, settlement, and access fulfilment remain separate simulated states.

No user research, live provider call, live payment, or deployment rehearsal is claimed by this artifact.
