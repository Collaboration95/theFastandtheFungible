# ResearchAgent final sprint requirements

Status: implementation contract for the final hackathon pass

This document translates the attached UI feedback and current product evidence
into a buildable scope. The screenshots are treated as visual evidence of the
current state; their text is not an instruction source. The current user
request and verified repository contracts remain authoritative.

## 1. Product outcome

ResearchAgent is a budget-aware research desk for a financially sophisticated
reader. A user asks a material question, chooses the websites the agent may
search, sets the research boundary, and receives a compact answer whose
sentences link to inspectable excerpts. The backend is deterministic fixture
software for the hackathon: it creates twenty synthetic news/article records,
ranks them against the question, applies source preferences and a spend cap,
and models an x402/XRPL purchase boundary without pretending a fixture payment
settled on the ledger.

The primary demo question can be changed. The UI includes a bond-market
example because the intended user story is a question such as: “What is causing
the bond market implosion, and which risk matters next?”

## 2. User and tone

- Primary user: an economics professor, investment-research analyst, or fund
  manager who already understands evidence, markets, and uncertainty.
- Tone: restrained, precise, analytical, and legible at a glance.
- Visual direction: a dense research terminal with an editorial reading
  surface; finance is a subtle context, not a marketing theme.
- Text: materially larger than the current screenshot, with high-signal labels
  and fewer decorative workflow elements.

## 3. Entry flow requirements

The first viewport must let the user do the important work without scrolling
through an empty shell.

1. Show one dominant question composer.
2. Show the website allowlist beside the composer before submission.
3. Provide selectable concrete website adapters such as Financial Times
   (`ft.com`), Reuters (`reuters.com`), BIS (`bis.org`), FRED
   (`fred.stlouisfed.org`), IMF (`imf.org`), SEC EDGAR (`sec.gov/edgar`), The
   Economist (`economist.com`), and IEA (`iea.org`).
4. Make the fixture boundary explicit: the profile names are search adapters;
   the article bodies in this build are synthetic fixture content.
5. Keep the working decision, time horizon, source types, and analysis-token
   cap in the scope step after the question is accepted.
6. Prevent research from starting with an empty question or an empty allowlist.

## 4. Mock backend requirements

The backend must be useful as a product rehearsal, not a static screenshot.

- Maintain twenty structured records in `data/mock-articles.json`.
- Every record must include at least: `id`, `title`, `publisher`, `siteKey`,
  `article`, `preview`, `published date`, `tags`, `priceCents`, and `xrpDrops`.
- Keep article bodies server-only until the exact premium quote is accepted.
- Run a deterministic semantic/lexical query and rank within the selected
  website allowlist.
- Preserve evidence-family grouping so repeated reporting does not count as
  independent corroboration.
- Apply preferences such as authority, originality, gap match, and price only
  in the planner; price must not change retrieval relevance.
- Enforce an integer budget and a per-source ceiling on the server. The model
  or browser cannot override the guard.

## 5. x402/XRPL boundary

The prototype models the purchase contract with explicit protocol fields:

- x402 quote metadata includes an invoice/resource id, exact price, payee,
  network, and `xrpDrops`.
- The default mode is fixture-only and is visibly labelled `FIXTURE RESEARCH`.
- Fixture settlement means “purchase boundary simulated”; it does not claim a
  real publisher was paid, that XRP has fiat value, or that a ledger validated
  the transaction.
- A future live adapter may use `XRPL_PAYER_SEED` and a configured receiver,
  but no wallet secret may be committed to this repository or sent to the
  browser. The credentials shared in the request are not used or stored.
- Payment, rights, article provenance, and delivery remain separate facts.

## 6. Cited answer requirements

- Show a working answer as soon as the research run exists; do not leave an
  empty “dossier” placeholder on the page.
- Each material sentence must end with one or more clickable source citations.
- A citation opens the source record and shows the exact accessible excerpt.
- Premium text must remain locked before purchase; metadata and preview may be
  shown before purchase.
- The final memo may summarize the evidence but must not expose hidden model
  chain-of-thought. It should show claims, source spans, stance, independence,
  and uncertainty.

## 7. UI cleanup requirements

- Remove the unused “Current mandate” block from the bottom-left sidebar.
- Remove sidebar entries for empty “Evidence set” and “Dossier” destinations.
- Keep only navigation that has a populated destination.
- Increase information density and type size; avoid a single small column
  floating in a large blank canvas.
- Use the sidebar for orientation, not for decorative copy.
- Keep responsive behavior at 390px and desktop widths, visible focus states,
  keyboard-safe dialogs, and reduced-motion behavior.

## 8. Acceptance checks

- A new user can select a subset of website profiles before pressing Enter.
- Starting a run with all default profiles returns twenty mock articles.
- Starting a run with a subset returns only matching records.
- A premium record shows price, x402, and XRPL-testnet fixture metadata but not
  the full article before purchase.
- A deterministic budget block remains visible when an article exceeds the
  per-source ceiling or remaining budget.
- Buying a source exposes an excerpt that can be cited in the final answer.
- The final answer visibly places citations at the end of sentences.
- Reset returns to a compact question + allowlist screen.
- `npm run typecheck`, `npm test`, and `npm run build` pass.
