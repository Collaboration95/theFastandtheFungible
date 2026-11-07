# The agent

![The agent's story loop](loop.gif)

ResearchAgent's one character: a pixel-art agent that does the research. Its head is the
open-index mark: two Ink source boundaries frame a Paper visor, and the
ascending route crosses it in Salmon. On a light page the head reads as the logo; on a
dark page the visor glows. It wears an Ink coat with a Slate belt and the wallet
pouch at the hip. The front leg is Ink and the back leg Slate, so the walk reads at 1×.
A 1-px Paper rim on every part keeps it legible on GitHub dark (#0d1117) and
light (#ffffff).

Brand tokens only (`palette` from `design/cast/build-cast.mjs`, plus the brand's
#655D55 secondary and a ledger grey midway between #C9BFB2 and #655D55). The
standing agent is 16 × 24 px. Format and charm were inspired by an owner-supplied
README reference. The shapes, face and palette are original.

## Poses

One row per animation in `sprite-sheet.png` (48 × 32 cells; `sprite-atlas.json`
has rects and durations):

| Row | Frames | Story |
| --- | --- | --- |
| idle | 2 | the route blinks |
| walk | 4 | stride, pass, stride, pass |
| search | 4 | magnifier over a locked page; hidden lines stay grey |
| thinking | 4 | hand to chin, dots count up: deciding what is worth buying |
| pay | 4 | coin from hand into the escrow lock's slot; the slot turns Salmon |
| key-reveal | 4 | the writer's key drops in, turns; shackle opens, page lines turn Ink |
| verified | 4 | carries the unlocked page; green check badge |
| refund | 4 | broken promise (red ×, red keyhole); the coin returns to the hand |

`hero.gif` (README) walks the dashed ledger line through search → thinking → pay
→ key reveal → verified, then walks off with the page. That segment of the ledger
turns Salmon and stays: the proof is anchored. `loop.gif` is the same story in
place for the explainers site; `state-search.gif` and `state-thinking.gif` are
small app-state loops.

## Use

- App: `<AgentSprite animation="search" />` (`src/components/AgentSprite.tsx`)
  steps through one sheet row with CSS `steps()`, holding frame 0 under
  `prefers-reduced-motion`. It is an illustration only: it never starts a
  payment or implies settlement, and it never replaces a real label, receipt or
  ledger link.
- Site: `site/brand/agent-loop.gif` with `agent-still.png` for reduced motion.
- Scale only by integers with nearest-neighbour (`image-rendering: pixelated`).
- The logo stays the open-index mark and lockup in `design/brand/`.

## Regenerate

```
node design/character/build-character.mjs          # write every export
node design/character/build-character.mjs --check  # fail on drift
```

Pure Node, no dependencies: frames are character grids in the generator, PNGs
use `node:zlib`, GIFs use the generator's own LZW encoder (16-colour table,
index 0 transparent, disposal 2, infinite loop). `tests/character.test.tsx` runs
the drift check in `npm run check:fast` and CI. Evidence and file sizes:
[docs/evidence/character](../../docs/evidence/character/README.md).
