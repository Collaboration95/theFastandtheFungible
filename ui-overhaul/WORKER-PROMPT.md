# Bounded worker assignment template

The orchestrator fills every bracket before delegation. This is an assignment
contract, not a request to re-plan the whole product.

```text
Work package: [UO-ID and title]
Objective / user consequence: [one concrete outcome]
Baseline / branch: [commit and checkout]
Dependencies already accepted: [IDs and relevant contracts]
Read: [only relevant repo-relative files and sections]
Visual evidence: [Sxx IDs / prototype screens / expected states]
Write ownership: [explicit files or directories; everything else read-only]
Do not change: [shared contracts, unrelated work, deferred roadmap]

Implement [bounded scope]. The complete product brief is in
ui-overhaul/DESIGN-BRIEF.md; use it to resolve style/flow conflicts, not to expand
this assignment. Preserve source restrictions, exact purchase approval,
server-owned limits, premium access, citations and truthful mode labels.

Acceptance:
- [observable behavior]
- [error/empty/back/reload or relevant edge behavior]
- [responsive and accessible interaction]

Verify: [exact relevant commands and manual checks from TESTING.md]
Default to fixture LLM and settlement with isolated test data. Do not spend,
call live providers, reset user data, publish, or change GitHub. Never bypass a
failed test or security guard to satisfy a screenshot.

Record evidence under ui-overhaul/evidence/[UO-ID]/ when useful. Return:
1. Behavior changed and files edited.
2. Tests actually run with result (PASS/FAIL/NOT RUN), no inferred passes.
3. Browser/viewport/scenario and reviewed screenshot paths for UI work.
4. Contract changes, integration needs, and remaining risks.
5. Any out-of-scope issue discovered; do not silently implement it.

If ownership must expand, tell the orchestrator the concrete dependency first.
Do not edit another worker's files, refactor the entire app, or commit/push
unless the orchestrator explicitly assigns that responsibility.
```

Prefer concise summaries and evidence paths to long transcripts. Workers do not
independently approve their own work-package completion; the orchestrator checks
the result and records the gate in `STATUS.md`.
