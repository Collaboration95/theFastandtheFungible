**Why:** three small strings undercut credibility on stage. All were verified at HEAD.

1. **"Replaying" on live runs.** `src/components/RunTape.tsx:89` shows "Replaying · " whenever the cursor is finite. That includes live stage-paced runs (D13), so a live run reads as canned (OVERNIGHT-REPORT-OCT8 §6, item 1).
2. **Decimals split.** `src/components/Answer.tsx:65` splits the rest of the conclusion with `/[^.!?]+[.!?]+/g`, so "55.2%" renders as "55. 2%". That is UC2's margin figure.
   - Split only on sentence punctuation followed by whitespace and a capital, as `src/format.tsx:9` already does for the lead sentence.
3. **Wrong settlement label in the PDF.** `server/report-template.ts:34` hard-codes "SIMULATED SGD · no real funds" even when settlement ran on XRPL Testnet. That is a gate-5 mislabel.
   - Use `report.labels?.settlement`, as line 44 already does.

**Write scope:**
- the three files above
- their tests: `tests/report.test.ts` and a component test

Do not touch `src/fixtures/wpui.test.tsx`, which the uncommitted v1.2 UI work modifies.

**Acceptance:** one test per fix. The report test asserts that a Testnet run's PDF shows the Testnet label and does not show "SIMULATED SGD".

---
**Rules:** read `AGENTS.md` and `FINAL-PUSH.md` first; decisions are closed, and the hard gates are in `prompt.md` §2.
- Work in `../tftf-wt/<id>` and stay inside the write scope.
- Never bind 5100, 8788 or 8790.
- `npm run check:fast` must pass.
- Ship with the `ship-pr` skill.
