# ResearchAgent design context

> **Direction of 3 Nov 2026:** the redesign spec in
> [docs/design/UX-DIRECTION.md](../design/UX-DIRECTION.md) (one environment
> label, a seven-size Geist-only type scale, ink-on-paper colour, a motion
> allowlist, plain copy) supersedes the visual, motion and labelling sections
> below where they disagree. The build is tracked in #311 and #312.

ResearchAgent is a calm deep-research workspace for someone who wants to turn a
broad question into a defensible, evidence-backed answer. The product surface
is a tool, not a presentation: ask first, choose the allowed evidence universe,
set a spending mandate, review the plan, then inspect the sources that can
change the answer. The first-run home/demo may use a more expressive treatment;
the working workspace stays focused and neutral.

## Visual system (UX-1, #311)

`src/styles.css` owns the tokens from UX-DIRECTION §5: Paper #FBF8F2,
Surface white, Ink #24211E, Muted #655D55, Rule #E8E2D8 and strong rule
#C9BFB2. Green #2F6B4F, red #9B3E35 and ochre #9A6B20 convey state alongside
text. Geist Sans carries all product text and tabular amounts. Seven sizes:
12, 13, 14, 15, 20, 28 and 32 px; weights 400/500/600. Geist Mono is for
copyable hashes, ids, code and Show work. Radii are 6/10/12 px. The only
pill is EnvIndicator; no gradients, glows, decorative cast or odometer.

The 48 px shell has Run/Writers and one permanent environment control,
including in recording mode. Its first-visit popover explains writers,
payments, search and the actual models. The raw API labels are unchanged.
ReceiptSheet retains its transaction row and environment footer, PaymentRow
labels every refund rail, Writers states that articles are fictional, and
decision captions name the provider. Model/search/planner substitutions use
Notice. Show work keeps verbatim labels. Exports keep their environment notes.

SpendPanel headlines **net cost**, while the bar distinguishes net, refunded
and reserved amounts. Remaining authority subtracts gross spend and reserves;
refunds never restore it. PaymentRow owns verification and retry; ReceiptSheet
opens from each payment. Only the 5 s PlanSheet starts the plan. No spending
is authorized by a payment-row control or model output.

RunActivity uses the same event-derived state as payment rows. A reconciled,
verified payment with an unfinished recovery checkpoint says Recovering and
offers Resume answer; the server handoff follow-up is #314. During an active
run, Activity remains open through completion to preserve reading position;
saved runs open collapsed. The user can collapse it at any time.

Motion uses four keyframes: fade-in, rise-4, spin and countdown, with only the
pending spinner looping. The budget bar transitions in 240 ms; payment status
in 160 ms; the plan countdown takes 5 s. Reduced motion removes transitions
and animations. Verify 320/360/390/768/1024/1440 px, 200% text zoom and axe.

Answer layout, supporting screens, mobile Spend sheet refinements, PDF and
site work remain #312. Cast assets remain available to social cards and the
separate cast QA gallery, with no app imports.

## Brand

**ResearchAgent** is the product name, one word and camel case. The **open
index** mark frames an ascending route between two source boundaries: research
that leads to evidence. No mascot or currency symbol in the logo. The cast
shares its 24-unit grid and 1.5-unit stroke. The search pose is a lens;
AlphaLeak's broken promise uses a split seal without a cartoon face.

`design/brand/build-brand.mjs` is the SVG source of truth. It outlines the
bundled Geist Regular glyphs (no external font request), produces ink and
on-dark marks, wordmarks and horizontal/stacked lockups, then rasterizes via
pinned Chromium. Ink `#24211E` on Paper `#FBF8F2` is primary. Editorial Salmon
`#D9A28F` is a sparse layout accent, never small text. Evidence Green and Block
Red retain their semantic state meanings with check/exclamation shapes and
adjacent text. On-dark artwork is for Dock and dark social surfaces only.

Keep at least **4 grid units of clear space** around the mark and **one capital
R height** around a wordmark or lockup. Minimum mark size **16 px**, wordmark
visible capital height **16 px**, horizontal lockup height **32 px**. Do not
stretch, rotate, add shadows, recolour to imply a transaction, or animate the
logo. The macOS master has a 100 px transparent inset, an 824 px rounded tile
and centered mark at 1024 px; leave the padding intact. Maskable PWA marks stay
within the central 80% safe circle. `desktop/build/icon.icns` and `icon.png`
are ready for the packaging lane; no claim of a signed or installed Mac app.

Geist is the identity and interface face. Geist Mono is for technical identifiers
and Show work; editorial faces are excluded from the product. Write plainly and specifically:
“Search expertise. Buy the missing evidence.” Avoid hype and unsupported
quality claims. `npm run check:naming` scans prose and visible UI names,
preserving URL/npm slugs, code identifiers and verbatim historical records.

Regenerate with `npm run brand:build`, then `npm run brand:verify`. See
`design/brand/README.md` for the output map and cast review. `site/` holds the
explainers source with page-specific OG/Twitter metadata; merging it to main
is distinct from publishing it to gh-pages.

## Answer and exports (UX-2, #312)

A shared question-aware selector ranks exact sentences from citation-validated claims; it never takes the first sentence of `conclusion`. Extracts are headed Lead finding. The PDF uses the same selector, one claims section and only cited passages, once. Export owns report, changes and copy link. Sources and purchase reasons are plain tables; mobile Spend opens a native modal bottom sheet.
