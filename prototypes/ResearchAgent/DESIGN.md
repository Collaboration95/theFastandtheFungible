# ResearchAgent design context

ResearchAgent is a quiet research terminal for an economics professor, fund
manager, or investor who wants to turn a question into a defensible decision.
The product surface is a tool, not a presentation: ask first, narrow the brief,
choose the evidence universe, then inspect the sources that can change the
answer.

## Visual system

The **Quiet Evidence Terminal** direction keeps the existing Black Paper / Trace
Desk palette but removes the editorial showcase treatment. The warm newsprint
canvas is a reading surface; the charcoal header is a stable application frame;
the paper panels are reserved for decisions, source inspection, and the dossier.
Newsreader is used for question and conclusion hierarchy. IBM Plex Sans carries
the interface and body copy. IBM Plex Mono is reserved for token caps, prices,
source scores, state labels, and event metadata.

The signature elements are the **scope bar** and the **research path**. The
scope bar is a compact, editable checkpoint before research begins. The path is
a numbered vertical sequence—Search, Purchase, Answer—that keeps the evidence,
XRPL settlement, and conclusion in one reading order. It is a status-bearing
workflow, not a decorative ribbon; hero statistics and presentation-only
explainer blocks are not part of the product shell.

## Palette and token ownership

`src/styles.css` is the runtime token owner. The mapping is:

`DESIGN.md semantic palette → :root CSS variables → shared React primitives`

Newsprint `#F2E9DD`, Paper `#FBF8F2`, Paper Deep `#E9DFD1`, Ink `#24211E`,
Charcoal `#171716`, Muted `#655D55`, Rule `#C9BFB2`, Editorial Salmon `#D9A28F`,
Salmon Deep `#91503F`, Evidence Green `#2F6B4F`, Caution Ochre `#9A6B20`, and
Block Red `#9B3E35` are the shared semantic values. Accent colours communicate
state with text and labels; they are never the only signal.

## Layout and density

Desktop uses a narrow workspace rail, a centered research column, and a compact
evidence side rail after a run starts. The start state is intentionally sparse:
one question, a few grounded suggestions, and one composer. Results use dense
source rows because comparison is the task. There is no forced full-height
nested scroller; the document owns vertical scrolling and the evidence drawer
owns its own overflow.

At 780px the rail collapses and the evidence side rail stacks below the source
set. At 520px source rows preserve title, preview, match, price, and action as a
stacked record. Controls stay touchable and the same source decisions remain
available.

## Shape, motion, and content

Surfaces are flat with hairline rules and near-square controls. Rounded pills
are limited to semantic badges and compact filter chips. Motion is minimal:
state changes may transition the budget bar, but research results do not depend
on animation. Reduced motion removes transitions and smooth scrolling.

Write in plain, specific language: “Buy S$0.20”, “Skipped · duplicate”, and
“GridScope blocked: S$1.40 exceeds the remaining S$1.00.” Never expose a truth
score or imply that fixture payment reached a real publisher. Open evidence,
premium preview, unlocked text, fixture settlement, and dossier citations stay
distinct.
