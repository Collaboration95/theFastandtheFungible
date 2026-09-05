---
version: alpha
colors:
  shell: "#171714"
  raisedShell: "#211f1b"
  paper: "#f4f0e7"
  paperSecondary: "#ebe4d8"
  ink: "#302d28"
  copper: "#c97945"
  success: "#39725a"
  warning: "#a66b1f"
  danger: "#a43d35"
  focus: "#2f6fd6"
typography:
  display:
    fontFamily: "Newsreader, Georgia, serif"
    fontSize: "3.2rem"
    lineHeight: "0.99"
  body:
    fontFamily: "IBM Plex Sans, Noto Sans, system-ui, sans-serif"
    fontSize: "1rem"
    lineHeight: "1.45"
  evidence:
    fontFamily: "IBM Plex Mono, SFMono-Regular, Consolas, monospace"
    fontSize: "0.6875rem"
    lineHeight: "1.4"
rounded:
  control: "2px"
  panel: "5px"
spacing:
  unit: "4px"
  page: "38px"
components:
  primaryAction:
    background: "#171714"
    foreground: "#f4f0e7"
    radius: "2px"
  evidenceRule:
    color: "#d8cfbf"
    width: "1px"
  statusChip:
    radius: "2px"
    border: "1px"
---

## Overview

FairCut is a product workspace for Leah Tan, a Singapore-based independent
filmmaker clearing one 12-second cue for a Singapore/Japan travel campaign
before midnight. The surface is product-first: a film editing desk crossed
with a quiet rights investigation. Its memorable signature is the Rights Trace
Ribbon, which links the actual film timecode to audition, policy, settlement,
delivery, and receipt evidence.

The design must never resemble a wallet dashboard, crypto exchange, generic AI
chat, marketplace grid, or neon cyberpunk terminal. It should feel like an
editorial cutting room: warm paper, hairline rules, precise timecode, and one
copper playhead.

The UI is English-first for a global product with Japan territory support. It
does not claim a Japanese locale. The audience, market, language, and evidence
decision is recorded in UX-CONTRACT.md.

## Colors

The shell uses deep charcoal (`shell`, `raisedShell`) to establish a focused
editing-room frame. Work surfaces use warm ivory (`paper`, `paperSecondary`)
instead of white. Copper is expressive and reserved for active playhead,
selection, and the primary trace. Green, amber, and red are semantic and always
paired with text or an icon. Focus blue is never used as a brand accent.

Runtime ownership: `src/styles.css` is the single token owner. Components use
semantic CSS variables only; no screen-local color palette is permitted.

## Typography

Newsreader is a restrained editorial face for the film insight, cue names, and
decisive outcome copy. IBM Plex Sans handles controls and explanations. IBM Plex
Mono handles timecode, exact drops, hashes, state codes, and evidence labels.
The fonts are bundled through pinned `@fontsource` packages, so the first paint
does not depend on a third-party CDN. A Japanese-capable system fallback remains
available if Japanese copy is introduced later; that locale is not currently
owned by this prototype.

## Layout

Desktop uses a fixed 82px navigation rail, a flexible editing surface, and a
324px mandate/action inspector. The center surface owns the film monitor,
20-second timeline, Rights Trace Ribbon, and aligned candidate comparison. The
inspector owns the current decision only. At 820px the rail becomes an actual
focusable mobile navigation drawer and the inspector flows below the comparison.
At 390px the page remains single-column with an internal timeline viewport; the
page itself never scrolls horizontally.

## Elevation & Depth

Static surfaces are flat. Hierarchy comes from tone, hairline rules, spacing,
and a very small number of fixed overlays. The evidence drawer is the only
substantial elevation because it is an inspection layer. Toasts sit above it.

## Shapes

Panels and controls are near-square with 2px controls and 5px secondary panels.
Circular shape is reserved for playback and status dots. No pill-heavy UI,
glassmorphism, gradients, or decorative crypto motifs.

## Components

The component vocabulary is intentionally small and shared in `App.tsx`:
`Button` styles are expressed through `.button` plus intent/emphasis classes;
`Waveform` owns keyboard-reachable audition; `CandidateRow` owns aligned
comparison; `EvidenceDrawer` owns modal focus trap/Escape/focus restoration;
`StatusIcon` pairs every semantic state with a text label. The global scrollbar
baseline is in `src/styles.css`. Durable token mapping is:

```text
DESIGN.md → src/styles.css semantic variables → App.tsx shared components
```

The `DESIGN.md` values above mirror the runtime variables exactly. A future
theme should remap semantic roles, never copy component-local hex values.

## Do's and Don'ts

- Do show the exact purchase object (12s clean stem + narrow ODRL package).
- Do keep creative fit visibly separate from rights eligibility.
- Do use plain-language outcomes before protocol detail.
- Do label fixture, recorded Testnet, and live Testnet evidence distinctly.
- Do preserve the warm paper / dark shell contrast at 200% zoom.
- Don't call a fixture settlement validated or show a fabricated explorer link.
- Don't call provenance ownership, ODRL a universal legal guarantee, or SHA-256
  an ISCC.
- Don't add a fake wallet balance, arbitrary transaction form, or approve-anyway
  override.
