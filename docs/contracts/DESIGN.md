# ResearchAgent design context

ResearchAgent is a calm deep-research workspace for someone who wants to turn a
broad question into a defensible, evidence-backed answer. The product surface
is a tool, not a presentation: ask first, choose the allowed evidence universe,
set a spending mandate, review the plan, then inspect the sources that can
change the answer. The first-run home/demo may use a more expressive treatment;
the working workspace stays focused and neutral.

## Visual system

The **Quiet Evidence Terminal** direction keeps the existing calm, neutral
surfaces and restrained semantic accent. The working canvas is a reading
surface; the application frame is stable; panels are reserved for decisions,
source inspection, and the dossier. A neutral sans-serif carries interface and
answer text. A compact mono treatment may be used for token caps, prices, state
labels, and event metadata. Any expressive/editorial face or illustration is
limited to the first-run home/demo, not the research workspace.

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

Desktop uses a centered answer/progress workspace after a run starts. Sources
and Activity are secondary tabs or disclosures; an evidence drawer may own its
own overflow, but there is no default three-column layout. The start state is
intentionally sparse: one question, a few grounded suggestions, and one
composer. Results use readable source rows because comparison is the task. The
document owns vertical scrolling.

At 780px the workspace and its secondary inspection regions stack. At 520px
source rows preserve title, access state, relevance, family, price, and action
as a stacked record. Controls stay touchable and the same source decisions
remain available. Verify the redesign at 360/390/768/1024/1440px, 200% text
zoom, and 320px reflow without body overflow.

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
