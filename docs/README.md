# ResearchAgent documentation

Start with the [README](../README.md): what it does, the hard guarantees, how to
use it from an agent, and the evidence behind the headline claims. The
[changelog](../CHANGELOG.md) lists what changed in each release. The
[explainers site](https://collaboration95.github.io/theFastandtheFungible/) has the
walkthrough, slides, project map and build log.

Pick the section for your role.

## Agent developers

Build on ResearchAgent from code or an MCP client.

- [TypeScript SDK](sdk.md): `ask`, `getRun`, `verify`, `hire`, `pay`, the kill switch and release artifacts.
- [Python SDK](sdk-python.md): the same surface in standard-library Python, plus the offline receipt verifier.
- [MCP server](mcp.md): connect Claude Code, Codex or Claude Desktop (stdio, app-hosted HTTP, `.mcpb`); the seven tools, caps and idempotency.
- [Bring your own key](byok.md): one OpenAI-compatible endpoint for research and a generic judge that is labelled UNCALIBRATED and can never buy; the endpoint boundary and Stop.
- [Receipt format](receipt-spec.md): v1, v2 and v3 wire fields, canonical bytes, signatures, audit links and offline verification. [Contribution contract](contracts/CONTRIBUTION.md) defines "what your money bought".
- [x402 and XRPL](x402-xrpl.md): the v2 flow as built (headers, invoiceId, facilitator, refund), validation before signing, finality, wallet safety, Starter Kit compatibility.
- [Browser replay](https://collaboration95.github.io/theFastandtheFungible/demo/): the real UI on recorded UC1–UC3 fixture traces; no backend or keys. Source: `src/` with `npm run build:demo`.
- [Verify any answer](sdk.md#verify-an-exported-answer-278): offline signatures and citations, optional read-only Testnet checks; [UC3 tamper evidence](evidence/verify-278.md).

## Writers and publishers

- [Publish your expertise](publishing.md): turn a Markdown folder into a signed, payable writer.
- [Publisher container](publisher-deploy.md): the standalone publisher image.
- [Compliance posture](COMPLIANCE.md): custody, audit trail and export, payee denylist, retention, and what we do not claim.
- [Writer-site reference look](reference/).

## Operators and Mac users

- [Mac app guide](../desktop/README.md) and [signing](../desktop/SIGNING.md): first launch, Keychain, Settings, recovery. [Installed-app acceptance](evidence/macos-app-259.md).
- [Running it](running.md): every make target, the demo keys, Docker.
- [Operations runbook](RUNBOOK.md): seeded faults, crash recovery, reconciliation, the soak. [Payment operations](evidence/payment-ops-287.md).
- [Recording clips](RECORDING.md) for demos.
- [Security contract](contracts/SECURITY.md): secrets, access, settlement, manifests and refunds. Also [SECURITY.md](../SECURITY.md) for reporting.

## Contracts and design (as built)

- [Product](contracts/PRODUCT.md): what we promise, to whom, and the demo use cases.
- [Architecture](contracts/ARCHITECTURE.md): the components and the shape of a run. Its [Nov 2026 review](contracts/REVIEW-NOV-2026.md) ranks the seams for the SFF push.
- [Design](contracts/DESIGN.md): visual system, layout and content rules. Current direction: [UX direction](design/UX-DIRECTION.md); [UX walkthrough](ux-walkthrough/index.html) has screenshots of the shipped UI.
- [Design record](FINAL-PUSH.md): the October 2026 decisions D1–D24 and why.

## Reviewers and judges: evidence

Start with the [judging criteria](JUDGING-CRITERIA.md) and the [SFF push tracker and changelog](SFF-PUSH.md). The [submission pack](submission/README.md) holds the description, deck, video script, pitch and Q&A. Every packet below states its scope: synthetic, fixture, local or Testnet.

**Round 2 (3–4 Nov 2026)**

| Packet | Shows |
|---|---|
| [round2-a](evidence/round2-a/README.md) | Run history load 34.4 s → 313 ms; bounded streams; late refund recovery |
| [round2-b](evidence/round2-b/README.md) | Coverage floors per component (payments at 86.2% branches), the CI job graph, fail-closed receipts |
| [round2-c1](evidence/round2-c1/README.md) | BYOK matrix, Stop latency, active-work cap of four |
| [round2-c2](evidence/round2-c2/README.md) | Recoverable Mac app: 13 packaged recovery cases, IPC canaries |
| [round2-d](evidence/round2-d/README.md) | SDK, wheel and MCPB built once and installed in clean consumers; release admission; browser replay |
| [round2-e](evidence/round2-e/README.md) | Nine historical Testnet transactions on the [ledger page](https://collaboration95.github.io/theFastandtheFungible/ledger/) ([source](../site/ledger/index.html), [data](../site/ledger/transactions.json)) |
| [round2-f](evidence/round2-f/README.md) | Three independent local origins; collided IDs kept distinct |
| [round2-g](evidence/round2-g/README.md) | "What your money bought": 30 claim-to-passage links, tamper results |
| [round2-h](evidence/round2-h/README.md) | Same-engine workload baseline on a shared host, with the misses it retained (a baseline, not final acceptance) |
| [round2-i](evidence/round2-i/README.md) | Agent kill switch across SDKs and MCP |
| [round2-j](evidence/round2-j/README.md) | UX polish before and after |
| [round2-k](evidence/round2-k/README.md) | Python receipt verifier; 177 conformance cases, 100% agreement |
| [round2-m](evidence/round2-m/README.md) | Indexed retained-history accounting with exact oracle equivalence |
| [round2-m2](evidence/round2-m2/README.md) | Retained-history follow-up profiling and measurements |
| [round2-n](evidence/round2-n/README.md) | Accepted writer Credentials on Testnet; advisory identity only |
| [round2-p1](evidence/round2-p1/README.md) | 13/13 live transaction checks and seven runnable feedback repros |
| [soak-nov4](evidence/soak-nov4.md) | Real-SIGKILL soak, host-sleep diagnosis, 30-minute verification |

**Earlier evidence**

- [Payment chaos](evidence/chaos-279.md), [escrow](evidence/escrow-273.md), [hire](evidence/hire-274.md), [agents and allowances](evidence/agents-280.md), [RLUSD](evidence/rlusd.md) and [RLUSD refund](evidence/rlusd-275-refund-310.md).
- [Live reliability](evidence/live-reliability.md), [numbers on Testnet](evidence/numbers-v7-testnet.md), [Starter Kit interop](evidence/starter-kit-interop.md), [publish-site proof](evidence/publish-site-277.md), [streaming](evidence/stream-281.md), [waste analysis](evidence/waste-320.md).
- [Decision model report](../eval/REPORT-decisions.md) and [coverage report](../eval/REPORT-coverage.md): measured on the real corpus.
- [Builder feedback](BUILDER-FEEDBACK.md): six ranked XRPL and x402 findings, the living log, the mainnet checklist and September submissions.
- [Release notes](releases/day-2.md) and every tag on the [releases page](https://github.com/Collaboration95/theFastandtheFungible/releases).

## Maintenance rule

Update an existing document instead of adding a dated audit, handoff, prompt
or status log. The exceptions are the changelog in SFF-PUSH.md and the
user-facing [CHANGELOG.md](../CHANGELOG.md). Keep transient verification output in the pull request.
