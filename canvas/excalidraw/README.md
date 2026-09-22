# ResearchAgent product wireframes

This folder is the editable visual contract for the canonical ResearchAgent
journey. It uses the repository's native Excalidraw scene format and existing
visual language: newsprint background, charcoal navigation, editorial display
type, utility labels, salmon accents, green verified states, and red policy or
error states.

## Review the canvas

1. Open [`scene.excalidraw`](./scene.excalidraw) in Excalidraw (or import it from the Excalidraw file picker).
2. Zoom to fit the board. The ten official views are arranged left-to-right across the first row, then left-to-right across the second row.
3. Follow salmon arrows for the primary path. Follow red dashed arrows to the explicit error/recovery state below each view.
4. Read the cream `ANNOTATION` panel at the bottom of each view for content, actions, and responsive priorities.
5. Use [`exports/official-researchagent-views.svg`](./exports/official-researchagent-views.svg) for a static review or GitHub diff preview.

The scene remains editable: every panel is a native Excalidraw rectangle, text element, or arrow. `build-official-views.mjs` deterministically regenerates the scene and SVG export if the visual contract needs to be revised.

## View coverage

| View | Primary responsibility | Error / recovery state |
| --- | --- | --- |
| 01 Landing | Question, trust boundary, and obvious entry | Missing question or source profile |
| 02 Wallet + mandate | Wallet mode, balance, allowlist, cap, expiry | Wallet unavailable or invalid mandate |
| 03 Approach + plan | Editable source-family order and checks | Cap or family-independence violation |
| 04 Evidence workspace | Working answer, gap, families, citations, locked premium state | Partial fixture retrieval or cite gap |
| 05 Article comparison | Value, price, family lineage, recommendation | Duplicate family or source above cap |
| 06 Purchase checkpoint | Exact quote and the only manual approval gate | Quote expiry or settlement unavailable |
| 07 Impact diff | Claim-level before/after and exact paid span | Missing span or no changed claim |
| 08 Dossier | Cited analyst memo, limitations, export | Unverified claim blocks export |
| 09 Evidence Receipt | Settlement truth, license/family lineage, spans, JSON/print | Local write unavailable / retry |
| 10 History / library | Local run and receipt revisit, safe reset | Reset requires confirmation |

## Contract guardrails shown in the wireframes

- Approval is explicit and human: there is no auto-buy path, and skip remains available.
- Premium text is shown as `PREMIUM LOCKED` until settlement and unlock complete; the body is never represented as client-visible before that point.
- Citations identify exact spans and carry license and source-family lineage.
- Partner Demo Wallet is visibly simulated. XRPL Testnet is optional and must never expose a seed to the browser, logs, repository, or screenshots.
- Fixture publishers and article text are labelled synthetic/untrusted. No live crawl or real publisher body is implied.
- Error transitions explain what remains locked and how to recover. Notes call out keyboard focus, 44px-ish actions, mobile stacking, and color-independent status text.

## Export provenance

The SVG is a review export. The source of truth is
[`scene.excalidraw`](./scene.excalidraw), not the SVG. The canvas is a product
contract, not proof that every depicted future surface is implemented.
