# ResearchAgent codebase map

This folder contains the current architecture map for the repository.

- `scene.excalidraw` is the editable Excalidraw source.
- `exports/codebase-map-split.svg` is the rendered preview of the decomposed version for GitHub and code review.
- `exports/codebase-map.svg` is the original single-map preview retained for comparison.
- The map marks synthetic/mock components in amber, optional live seams in orange, and known drift or follow-up work in red.

The current canvas is split into four focused views: runtime flow, mock/live
boundaries, code and verification structure, and current risks/next work. It
reflects the fixture-first runtime as implemented: 12 synthetic source records,
a TypeScript fallback catalog, synthetic premium evidence, fixture settlement,
deterministic LLM fallbacks, and local JSON run persistence.
