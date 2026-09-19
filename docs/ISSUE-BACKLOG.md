# ResearchAgent execution backlog

GitHub is the execution source of truth:

- [ResearchAgent — Paywalled Research Roadmap](https://github.com/users/Collaboration95/projects/9)
- [1 October critique milestone](https://github.com/Collaboration95/theFastandtheFungible/milestone/1)
- [10 October expanded local demo milestone](https://github.com/Collaboration95/theFastandtheFungible/milestone/2)
- [16 November SFF milestone](https://github.com/Collaboration95/theFastandtheFungible/milestone/3)

The product scope is financial-research article acquisition: discover relevant
open and paywalled evidence, explain which article is worth buying, require the
configured approval, unlock only the purchased evidence, and prove how it
changed the cited analysis. It is not a general-purpose purchasing agent.

## Project fields

Use `Workflow` as the execution state: Backlog, Ready, In progress, Review,
Blocked, or Done. Every issue also has Priority, Risk, Area, Size, Sprint,
Milestone, parent epic, and explicit dependency relationships.

The dated Sprint values are defined in
[PRODUCT-ROADMAP-2026.md](PRODUCT-ROADMAP-2026.md). Milestones represent the
three externally meaningful product cuts; sprints represent implementation
order inside those cuts.

## Epic structure

### 1 October — local critique product

- [#18 Truthful local research foundation](https://github.com/Collaboration95/theFastandtheFungible/issues/18)
- [#19 Official analyst product experience](https://github.com/Collaboration95/theFastandtheFungible/issues/19)
- [#17 Finance research planning and explainable article choice](https://github.com/Collaboration95/theFastandtheFungible/issues/17)
- [#4 Wallet-controlled paywalled article acquisition](https://github.com/Collaboration95/theFastandtheFungible/issues/4)
- [#3 Evidence impact, analyst dossier, and receipt](https://github.com/Collaboration95/theFastandtheFungible/issues/3)

### 10 October — reusable local product

- [#30 Reusable local research workspace](https://github.com/Collaboration95/theFastandtheFungible/issues/30)

### 16 November — real article payment and delivery

- [#31 Real protected-article payment and delivery](https://github.com/Collaboration95/theFastandtheFungible/issues/31)
- [#2 Post-October public demo delivery](https://github.com/Collaboration95/theFastandtheFungible/issues/2)

The hosting epic and its children are deliberately scheduled after 31 October.
OAuth, login, subscriptions, production billing, mainnet, and generic commerce
are outside the active roadmap.

## Ready queue

Only dependency-free issues are marked Ready:

1. [#8 Canonicalize and validate the article fixture corpus](https://github.com/Collaboration95/theFastandtheFungible/issues/8)
2. [#32 Wireframe the official views in Codex Excalidraw](https://github.com/Collaboration95/theFastandtheFungible/issues/32)

Start with #8. It establishes the article metadata, license, price, family,
access, and evidence-span contract required by wallet setup, research planning,
article valuation, failures, and later evaluation. #32 can run in parallel
because it is a design contract and does not change runtime data.

## Backlog contract

Every open implementation issue contains:

- user stories;
- objective and user/system value;
- in-scope and out-of-scope boundaries;
- observable acceptance criteria;
- explicit dependencies;
- verification commands or manual checks;
- stop and escalation conditions; and
- a stable `agent-orchestration:issue-key` for idempotent updates.

Do not mark an issue Ready while any blocking relationship is open. Do not
begin #7, #12, or #15 before 31 October. Do not weaken manual approval,
premium-content access, citation, licence, settlement, or fulfilment checks to
make a milestone pass.
