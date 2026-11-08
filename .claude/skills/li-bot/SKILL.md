---
name: li-bot
description: Draft or explore LinkedIn post ideas about ResearchAgent for the SFF finals push. Only when the user types /li-bot.
disable-model-invocation: true
argument-hint: <idea or task, e.g. "explore a post on the MCP server">
---

# li-bot: LinkedIn drafts for the SFF push

Task: $ARGUMENTS

You only write drafts. Never publish, post, message anyone, or commit drafts to this repo (it's public).

## Where drafts live

- Drafts folder: `/Users/speedpowermac/Documents/projects/CODE_MAIN/personal/linkedin/planning/tftf/`.
  - In this repo it's also reachable as the symlink `linkedin/`. The symlink is git-excluded through `.git/info/exclude`, so it can't be committed. Keep it that way.
- One folder per post: `planning/tftf/<post-slug>/` with `draft.md` (post copy) and `notes.md` (facts, sources, angle). The series overview and facts are in `planning/tftf/notes.md`; update it when you add or change a post.
- The LinkedIn repo is its own git repo. Follow its rules and don't commit there unless the user asks.

## Read before drafting (full paths)

LinkedIn repo, for voice and conventions:
- `/Users/speedpowermac/Documents/projects/CODE_MAIN/personal/linkedin/AGENTS.md`
- `/Users/speedpowermac/Documents/projects/CODE_MAIN/personal/linkedin/skils/guru-voice/SKILL.md` and its `references/examples.md`
- `/Users/speedpowermac/Documents/projects/CODE_MAIN/personal/linkedin/planning/tftf/notes.md` (series plan, verified facts, people to thank)
- Earlier ResearchAgent posts in `/Users/speedpowermac/Documents/projects/CODE_MAIN/personal/linkedin/published/`: `singhacks-researchagent/`, `researchagent-ai-tinkerers-invitation/`, `researchagent-ai-tinkerers-demo/`

This repo, for what's happening in the sprint:
- `docs/SFF-PUSH.md`: tracker, plan, feature-a-day calendar with post angles, scorecard, changelog
- `docs/JUDGING-CRITERIA.md`: Ripple-track criteria
- GitHub issue #265 "Human intervention needed": owner-only tasks and dates
- Recent merged PRs: `gh pr list --state merged --limit 20`, then `gh pr view <n>`. Each PR's **Story** section has a one-line post angle, and its **Metric** line has the number.

## The sprint in one paragraph

ResearchAgent is an evidence workspace with a wallet. It answers from free sources first and, when the missing piece is paywalled, buys the article it needs from the writer (at most one per round, up to three rounds) over x402 on XRPL Testnet, inside a budget the user sets. It then verifies the writer's promises and refunds on-chain if one is broken. The Fast and the Fungible made the top three of the Ripple track at SingHacks 2026 and present at the finals on **Wed 18 Nov, 11:30 SGT**, at the Swiss Pavilion at the Singapore FinTech Festival. Submission is due Thu 12 Nov. Until then the team ships one notable feature a day (Mac app, MCP server, scorecard, and more), and the owner posts about one a day, two on weekends.

## Rules

- Use only facts you can point to: published posts, notes, the tracker, PRs, the scorecard. Never invent numbers, quotes, people or events. If a fact is missing, leave a `[TODO: …]` and list it at the end.
- Say "top three of the Ripple track", not "second place".
- Write labelled numbers honestly: XRPL **Testnet**; benchmark numbers with their date.
- When done, reply with the draft text, the file path, and any TODOs for the owner.
