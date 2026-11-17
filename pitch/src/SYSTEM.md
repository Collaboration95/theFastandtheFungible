# Finals deck system

The deck is built from these sources into `pitch/index.html`, one self-contained file that
opens by double-click. Never edit `index.html`; edit `src/` and rebuild.

```
node scripts/pitch-build.mjs            # src/ → index.html (fonts and images inlined)
node scripts/pitch-build.mjs --watch    # rebuild on save; refresh the browser
node scripts/pitch-export.mjs pitch   # build, then out/NN.png + out/deck.pdf from file://
```

The export opens the file with no server. It fails on a page error, any request other than the
file itself, a font that does not load, a missing image, or a slide that overflows 1920 × 1080.
PNGs are named by slide number: `00.png` is the intro.

## Files

| File | Owns |
|---|---|
| `base.css` | tokens, type, components, stage, print |
| `deck.js` | stage scaling, keys, click-to-advance, the nav pill, in-slide steps, the marker, print/final state |
| `icons.svg` | icon sprite (24-unit grid): `<svg class="i"><use href="#i-key"/></svg>` |
| `slides/NN-name.html` | one slide, with its own `<style>` and `<script>` |

## Slide-file contract

- Exactly one `<section class="slide f-…" id="sN">`, where N is the file number (`03-since.html` → `s3`).
  `#N` in the URL deep-links to it.
- Every selector in its `<style>` starts with `#sN` (the build warns otherwise). Don't restyle
  base components globally; scope overrides (`#s5 .pill{…}`).
- Its `<script>` runs in its own function scope after `deck.js`, so plain `const` is safe.
- Asset paths are relative to the slide file (`../assets/qr-try.svg`); the build inlines
  them. `<img data-inline src="x.svg">` is replaced by the SVG markup so CSS can colour it.
- Frame: 1920 × 1080, padding 88 px top/bottom and 100 px left/right (`--pad-y`, `--pad-x`). Content is
  visible on arrival. No slide transitions.

## Keys and steps

| Key | Does |
|---|---|
| → Space PgDn Enter | next slide, unless the slide's `next()` hook consumes it (only the intro does) |
| ← PgUp Backspace | previous slide |
| ↓ / ↑ | next / previous in-slide step (↓ after the last returns to 0; ↑ stops at 0) |
| 1–9 · 0 / Esc | jump to a step · back to step 0 |
| Home / End · f | first / last slide · fullscreen |
| click on a slide | next slide (as →); clicks inside an element marked `data-click` (step rows) are its own |
| nav pill ← / → | previous / next; the pill ("← N / total →") sits in a band under the stage, never on a slide or in print |

A slide with steps registers a hook:

```js
Deck.on('s4', {
  steps: 4,                         // ↓/↑ and 1–4 drive it
  set(n, { animate }) { … },        // n = 0 is the rest state: arrival, after leaving, print
  enter(el, { dir, from }) { … },   // optional
  leave(el) { … },                  // optional
  next() { return true },           // optional: consume →; only the intro uses this
  final(el) { … },                  // optional: print state if it differs from step 0
})
Deck.step('s4', 2)                  // from the slide's own click handlers
```

`animate` is false under reduced motion and in print: jump straight to the end state.

## Tokens

| Role | Tokens |
|---|---|
| Fields (Dusk to day, one per slide) | Lightness rises with the story; each slide file sets `#sN{background:var(--light),linear-gradient(150deg in oklch,var(--sN-a),var(--sN-b))}` from the ramp in `base.css`. White text is ≥ 4.5:1 on every stop |
| Ramp | 0 `#27145C → #2B1A6D` dusk · 1 `#2B1A6D → #2F1E76` with a low orange horizon · 2 `#2F1E76 → #2A268B` · 3 `#2A268B → #2532A3` · 4 `#2532A3 → #213CBB → #2A3AA6` · 5 `#2A3AA6 → #0A5C95 → #037569` (sapphire → ocean → sea teal, bridging into the green) · 6 `#00836D → #0B8762 → #04764C` · 7 `#04764C → #036E7E → #0465AF` (daylight close) · 8 appendix `#1E1250 → #120B36`. `--light` (10 % white, top right) on 0–5, `--light-g` (6 %) on 6–8 |
| Bookends | `.f-book` marks the intro, slide 1 and slide 7. Their text and tiles use `--bk-ink` (white), `--bk-ink-2` (82 %), `--bk-line`, `--bk-tile`, `--bk-tile-line`, `--bk-brand`, `--bk-mk` (= `--marker`) |
| Accents | `--marker` / `--warm-1` the brand orange `#F5622A` (the loop, the appendix highlight) · `--blue-1` `#2244D2` (accent on white cards) · `--green-1` `#0B8762` |
| Ink on white | `--ink` text · `--ink-2` secondary · `--ink-3` connectors · `--line` hairline · `--soft` sunken |
| On a field | `--on` white · `--on-2` 80 % · `--on-line` 22 % hairline |
| Meaning | `--paid` / `--paid-bg` / `--paid-ink` · `--wall` / `--wall-bg` / `--wall-ink` · `--marker` (orange, the loop on any field) |
| Type (Geist, 800 for headlines) | display 122 (slide 1 uses 108) · h2 92 · h3 52 · body 38 · small 28 · label 22. Tracking: −0.05em display, −0.045em h2, −0.03em h3, −0.01 to −0.03em body. Geist Mono only for hashes, URLs, code |
| Radii | card 28 · row 20 · tile 16 · pill 999 |
| Shadow | `--sh-card` (inner top highlight + hairline + soft drop), `--sh-lift` |
| Spacing | 8 px grid; 100 px side margins |

Smallest text that must read from 8 m: 28 px on a card, 30 px on a field. Slides 1, 3, 5, 6 and 7 have nothing under 28 px
except the two labels below ("XRPL Testnet" ≥ 22 px, "(simulated payments)" ≥ 24 px).

## Components

- **card** `.card`: white with a barely-there vertical gradient and `--sh-card`.
- **ghost** `.ghost`: translucent panel on a field, for the "before" side of a contrast.
- **row** `.rows > .row`: rows inside a card; base adds the hairline between them.
- **tile** `.tile`: 64 px icon square, inner gradient and hairline.
- **pill** `.pill`, `.pill.wall`, `.pill.paid`, `.pill.on-field`: 26 px, 1 px inset hairline. Short words only.
- **connector** `<i class="conn"></i>`: hairline with a chevron that stretches to its grid cell.
- **number** `.num`: 800 weight, tabular, tight tracking.
- **okdot** `.okdot`: the green check.
- **marker** `<span class="mk">words</span>`: the deck's **one** emphasis device, a hand-drawn loop. Used exactly twice:
  slide 1 ("paywalled.") and slide 4 ("pays the writer."). No other ellipses, underlines, discs, sparkles or corner
  shapes anywhere. deck.js fits the loop to the phrase's ink (canvas glyph metrics) so it stays about 20 px clear of
  every glyph (descenders, ascenders, the full stop) and sets the span's margins so it clears the neighbouring words
  and the line above. Colour via `--mk-c`: `--marker`, the paywall's orange, on every field.
  It draws on in 0.5 s, 0.25 s after the slide appears, and is static in print or under reduced motion.
- **brand tile**: every ResearchAgent logo is the white rounded square with the black mark (as on the intro), with a
  soft shadow; on the intro its edge is white.
- **label** `.label`: the only quiet labels in the deck are "XRPL Testnet" (slide 2's app bar) and
  "(simulated payments)" (beside 31 → 48 on slide 6). Add no others: no eyebrows, no "recorded run", no "no real value".

## Motion

Only the intro reveal is transition-like; there are no slide transitions. The marker draws once on arrival.
Slides 1–6 play short arrival motion (≤ 1.5 s, no loops) that shows the paywall, money or key state:

- deck.js adds `.play` to a slide on a **forward** arrival only. Going backwards, in print and under reduced
  motion there is no `.play`, and the slide is simply in its final state.
- Keyframes are from-only with `backwards` fill, so **the resting CSS is the final state**. Delays come from
  `--t` (seconds). Primitives in `base.css`: `[data-enter]` fade up, `.pop` spring in (origin `--o`), `.stamp`,
  `.run` (from `--dist` to the left), `.bump` (knocked back by `--back`/`--tilt`, rests at its own transform),
  `.shake` (`--a`), `.draw` (SVG `path.draw` gets `--len` from deck.js; other elements scaleX 0 → 1),
  `.sweep` (clip reveal in `--n` steps). Easing tokens `--ease` (entrances) and `--spring`.
- `Deck.seq('s4', [[1, 200], …, [0, 1750]])` auto-runs in-slide steps after arrival (slide 4); leaving, a
  click or any key cancels it. A step the presenter asks for (↓/↑/digits/click) also ends `.play`.
- Hook `enter(el, ctx)` gets `ctx.play` (true when the slide is playing its arrival motion).
