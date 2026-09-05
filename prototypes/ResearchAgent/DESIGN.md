# ResearchAgent design context

ResearchAgent is a calm financial newsroom for an evidence market. Its single
job is to turn Elena Tan's research budget into the strongest defensible dossier
available, while making cost, provenance, independence, and uncertainty visible.

## Visual system

The Black Paper / Trace Desk direction uses a deep charcoal shell and warm
newsprint reading surface. Display headlines use Newsreader; controls and body
copy use IBM Plex Sans; prices, IDs, scores, and event codes use IBM Plex Mono.
The palette is intentionally small: Newsprint `#F2E9DD`, Paper `#FBF8F2`, Ink
`#24211E`, Charcoal `#171716`, Muted Ink `#6F6860`, Rule `#C9BFB2`, Editorial
Salmon `#D9A28F`, Evidence Green `#2F6B4F`, Caution Ochre `#9A6B20`, and Block
Red `#9B3E35`.

The memorable signature is the Evidence Trace Desk: a labelled lineage ribbon
that connects the question to open evidence, a live gap, premium purchases,
and claim families. It remains legible without animation or colour.

## Layout and tokens

`src/styles.css` is the one runtime token owner. The documented path is:

`DESIGN.md → :root semantic CSS variables → shared React components`

Desktop is a narrow guided-phase rail plus a reading surface. The source desk
and inspector split at desktop and stack at 1000px. At 390px the trace becomes
a vertical lineage, source rows become cards, and the dossier is a single
column. The document owns the scrollbar; drawers own their internal scroll.

Static surfaces are flat. Rules, type scale, and spacing carry hierarchy. Near-
square rectangles are used for controls and evidence; rounded pills are limited
to compact status badges. Print removes shell controls and preserves dossier,
citations, and limitations.

## Content rules

Use specific editorial language: “Skipped because it repeats Northstar Wire”
and “Blocked: S$1.40 exceeds the remaining S$1.00.” Never use a truth score,
guaranteed confidence, or imply a fixture paid a real publisher. Fixture,
premium preview, unlocked text, settlement, and evidence access are distinct
states.
