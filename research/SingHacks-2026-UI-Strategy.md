# SingHacks 2026 — Winner-Quality UI Strategy

Research snapshot: 3 September 2026, Singapore time

## Executive principle

A strong hackathon UI is not a complete product. It is a visual proof of one
important job being completed.

For ClaimReady or Agent Spend Guard, the first screen should answer three
questions almost instantly:

1. What problem is this solving?
2. What is the agent doing right now?
3. What safe, useful outcome did the user get?

The winning shape is therefore:

    concrete input
      -> visible processing
      -> evidence / policy check
      -> one decision or approval
      -> receipt, claim draft, or next action

Do not build a marketing landing page plus a large dashboard plus settings.
Build one exceptional product surface and make every visible state work.

## What the research says

### Presentation is part of judging

[Devpost’s judging interviews](https://info.devpost.com/blog/hackathon-judging-tips)
explicitly emphasize storytelling, a working demo, and showing enough of the
technical work to establish credibility. One judge also called out projects
that over-index on backend work while providing almost no front end.

[Devpost’s demo guide](https://info.devpost.com/blog/how-to-present-a-successful-hackathon-demo)
recommends setting the scene quickly, showing the working project, skipping
mundane setup such as credentials, and ending by connecting the result back to
the original problem.

[Devpost’s video guide](https://info.devpost.com/blog/6-tips-for-making-a-hackathon-demo-video)
recommends writing the script early and leaving two or three hours at the end
for polish, recording, and submission. This means the demo path should shape
the UI from the beginning, not be added after the build.

### Beauty helps, but does not replace usability

[Nielsen Norman Group’s aesthetic-usability research](https://www.nngroup.com/articles/aesthetic-usability-effect/)
finds that attractive interfaces are perceived as more usable and can create a
strong first impression. It also warns that visual polish cannot rescue a
seriously confusing workflow.

[NN/G’s visual-design guidance](https://www.nngroup.com/articles/good-visual-design/)
repeatedly comes back to grid alignment, a clear type system, intentional
color, and consistency. Their [visual hierarchy guide](https://www.nngroup.com/articles/visual-hierarchy-ux-definition/)
describes the job of hierarchy as directing the eye in the intended order.

### Simplicity comes from progressive disclosure

[Progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/)
means showing the few things needed for the current decision and placing
advanced detail behind an obvious secondary action. For these demos:

- show the verdict first;
- show the 2–3 strongest reasons next;
- place the complete evidence, raw tool output, and technical trace behind
  “Why?” or “View evidence”;
- expose approval controls only when an action is ready.

### Agent skills are useful when they create a design contract

The official [Anthropic frontend-design skill](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md)
asks the agent to ground the work in the subject, choose a specific visual
direction, use deliberate typography, select one memorable signature element,
and critique the plan before coding. It specifically warns against generic AI
visual defaults and scattered animation.

The [Anthropic Claude Code frontend plugin](https://github.com/anthropics/claude-code/tree/main/plugins/frontend-design)
packages this behavior for frontend work. The accompanying
[frontend-aesthetics cookbook](https://github.com/anthropics/claude-cookbooks/blob/main/coding/prompting_for_frontend_aesthetics.ipynb)
is useful for prompt examples.

For implementation review, use Vercel’s [Web Interface Guidelines](https://vercel.com/design/guidelines)
and its [agent skill](https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines).
The review catches keyboard/focus problems, weak interaction states, unsafe
forms, layout instability, unclear copy, and animation issues. The official
installation route is:

    npx skills add https://github.com/vercel-labs/agent-skills --skill web-design-guidelines

If you install a remote skill during a hackathon, pin or vendor the version you
used. Do not let a mutable remote instruction source change the acceptance
criteria halfway through the build.

## The two product screens

### ClaimReady — “the claim desk”

The product surface is a case console, not a chat window.

Primary user: traveler or claims operator.

Primary job: determine whether a disruption is likely covered and prepare the
next claim action.

#### First viewport

    ┌─────────────────────────────────────────────────────────────┐
    │ ClaimReady                         Case C-1042   ● Ready    │
    ├────────────────┬──────────────────────────┬───────────────┤
    │ INPUT          │ WHAT WE FOUND            │ NEXT ACTION   │
    │                │                          │               │
    │ itinerary.pdf  │ Tokyo → Singapore        │ LIKELY COVERED │
    │ policy.pdf     │ Flight delayed 6h        │               │
    │ incident note  │ Hotel receipt missing    │ Draft claim → │
    │                │                          │ View evidence │
    │ [Analyze case] │ agent trace / 3 findings  │               │
    └────────────────┴──────────────────────────┴───────────────┘

Use recognizable travel artifacts: boarding-pass geometry, a route line, a
receipt, and a calm case-file structure. The signature moment can be the route
line becoming a coverage timeline as the agent verifies each fact.

#### The only required states

1. **Ready to analyze** — the input is visible and the primary action is clear.
2. **Extracting facts** — show itinerary, incident, and document steps with
   stable geometry.
3. **Coverage result** — show “Likely covered,” “Missing evidence,” or “Likely
   excluded,” never a vague confidence score alone.
4. **Evidence drawer** — show the exact policy clause, document source, and
   extracted fact supporting the result.
5. **Claim draft ready** — show the draft and missing evidence; do not claim an
   insurer has approved it.

Do not add account settings, a general chatbot, a claims inbox, a profile page,
or a dozen policy categories in the MVP.

### Agent Spend Guard — “the approval desk”

The product surface is a payment-control console, not a crypto wallet dashboard.

Primary user: a person delegating a small purchase to an AI agent.

Primary job: allow a useful paid action without granting the agent unlimited
authority.

#### First viewport

    ┌─────────────────────────────────────────────────────────────┐
    │ Spend Guard                         Request R-018  ● Review  │
    ├──────────────────────────┬──────────────────────────────────┤
    │ AGENT REQUEST             │ CONTROL CHECKS                   │
    │ “Get the FX data…”        │ ✓ service is allowlisted          │
    │                           │ ✓ amount is within $0.10 budget   │
    │ $0.03 USDC · testnet      │ ✓ destination matches endpoint    │
    │ Data provider             │ ! human approval required         │
    │                           │                                  │
    │ [Block] [Approve $0.03]   │ View request details              │
    └──────────────────────────┴──────────────────────────────────┘

Use a single transaction ribbon as the signature element:

    request → verify → approve → paid → receipt

The UI should say “Approve $0.03” rather than “Sign transaction.” Put XRPL,
RLUSD, x402, and facilitator details in an expandable technical drawer. The
main screen should make sense to someone who has never used crypto.

#### The only required states

1. **Request received** — show service, amount, destination, and budget.
2. **Checking** — show the guard validating the request.
3. **Approval required** — make the human boundary visually unmistakable.
4. **Blocked** — show the exact rule that stopped an over-budget or redirected
   request.
5. **Paid / receipt** — show the response, transaction reference, and what the
   user received.

Do not build a portfolio view, token market, wallet settings, generic agent
chat, or arbitrary service discovery in the first version.

## A design recipe that looks intentional

### 1. Choose one visual world

Pick a domain metaphor before asking an agent to generate components.

- ClaimReady: travel desk + case file + route evidence.
- Agent Spend Guard: payment control room + approval stamp + receipt trail.

The metaphor should influence the shape of the evidence, status, labels, and
motion. It should not turn into decorative illustration everywhere.

### 2. Establish a tiny token system

Before coding, define:

- one page background;
- one surface color;
- one ink color;
- one brand accent;
- semantic success / warning / danger colors;
- one border treatment;
- one radius family;
- two type roles maximum;
- three useful type sizes: display, body, utility;
- one spacing rhythm.

The goal is not to pick the “perfect” palette. The goal is to prevent every
agent from inventing a different blue, radius, shadow, and font size.

### 3. Spend boldness in one place

Choose one signature element:

- ClaimReady: a route/evidence timeline that resolves into a coverage result.
- Agent Spend Guard: a request-to-receipt transaction ribbon.

Keep everything else quiet. Avoid combining a dramatic background, giant
gradient headline, animated cards, 3D object, glowing cursor, and particle
field. One memorable move reads as taste; six reads as a template collection.

### 4. Use open composition, not card soup

Use one major work surface with clear columns or rails. Cards should group
meaningful objects such as a policy excerpt, a payment request, or a receipt.
Do not place every label in a separate rounded rectangle.

Avoid:

- default bento grids;
- nested cards inside cards inside cards;
- fake KPI tiles;
- a card for every agent;
- pills used as decoration;
- a full-width hero above a separate dashboard when the dashboard is the demo.

### 5. Make agentic behavior visible without showing chain-of-thought

Show:

- the current step;
- the tool name in plain language;
- a short result;
- the evidence or policy reference;
- the approval boundary;
- the final receipt.

Do not show private chain-of-thought or a wall of streaming model text. A
compact “Checking coverage clause 4.2” or “Verifying destination” status is more
credible and more readable.

## UI build scope for a 1.5-day event

### Components to build

1. App shell with a quiet header.
2. Primary input surface.
3. Agent activity timeline.
4. Decision banner.
5. Evidence drawer.
6. One primary action.
7. Approval or refusal state.
8. Receipt / claim-draft result.

### States to fixture before styling

Create deterministic fixtures for:

- clean happy path;
- missing evidence;
- conflicting or malicious input;
- over-budget or wrong-destination payment for Spend Guard;
- responsive mobile layout;
- slow or failed tool response.

The UI should look designed in all states. Do not style only the happy path.

### What to cut first

Cut in this order if time gets tight:

1. landing-page sections;
2. authentication;
3. account management;
4. multiple policies/services;
5. analytics charts;
6. decorative 3D or particle effects;
7. secondary agent roles.

Never cut the decision state, the evidence, the refusal path, or the final
receipt. Those are the product.

## Agent workflow for UI quality

Use agents sequentially with an explicit source-of-truth file, not as several
agents editing the same screen concurrently.

### UI art director

Output: `DESIGN.md` or `UI-SPEC.md` containing audience, page job, visual
direction, palette, typography, layout, copy, states, signature element, and
anti-patterns.

### Frontend builder

Output: the working screen using the accepted spec, real fixture content,
accessible semantics, responsive behavior, and all required states.

### Visual QA agent

Output: screenshots at desktop and mobile sizes, a mismatch list, and concrete
repairs. It must inspect the rendered page, not only source code.

### Demo producer

Output: a scripted 90-second route, one clean screenshot, one failure/approval
screenshot, and a backup recording path.

### Suggested handoff contract

Every agent returns:

- files changed;
- commands run;
- screenshots inspected;
- tests or checks passed;
- known gaps;
- next action;
- whether it changed the design contract.

No agent may silently change the visual direction, add a new page, introduce a
new component family, or add a dependency just to make the screen look busier.

## Copy-paste prompts

### UI art director

    You are the art director for a 1.5-day fintech hackathon demo.
    Product: [ClaimReady / Agent Spend Guard].
    User: [specific user].
    Single job: [one job].
    The demo must be understandable in 5 seconds and complete in 90 seconds.

    Propose two sharply different but buildable visual directions. Choose one.
    Return: subject/audience, visual metaphor, 4–6 named colors, two type roles,
    layout wireframe, component inventory, exact visible copy, five UI states,
    one signature motion, and a list of things to avoid.

    Constraints: one primary screen, no generic SaaS dashboard, no random KPI
    cards, no decorative pills, no crypto jargon in primary copy, no more than
    one major animation, accessible contrast, keyboard support, mobile layout,
    and real interaction in every visible control.

### Frontend builder

    Implement only the accepted UI-SPEC.md. Do not reinterpret the visual
    direction or add unrequested sections. Build the primary workflow first.
    Use deterministic fixtures and make every visible control work.

    Required states: idle, processing, result, missing/conflicting evidence,
    approval or refusal, and success receipt. Use semantic HTML, visible focus,
    stable loading geometry, reduced-motion support, and responsive behavior.
    Keep agent activity concise: show step, tool, result, and evidence—not
    private chain-of-thought.

### Visual QA agent

    Inspect the rendered application at desktop and mobile sizes. Take
    screenshots of the first viewport and every important state.

    Run a 5-second test: can a new viewer tell what the product does, who it is
    for, and what to click? Run a first-click test: is the primary action
    obvious? Check alignment, hierarchy, copy, contrast, focus, touch targets,
    loading stability, overflow, error recovery, and reduced motion.

    Return only concrete findings with severity, screenshot/state, cause, and
    smallest repair. Flag generic AI patterns: repeated cards, equal-weight
    panels, excessive rounded containers, decorative gradients, fake metrics,
    and motion without a job.

### Demo producer

    Create a 90-second judge route for [ClaimReady / Agent Spend Guard]. Start
    with the painful input, show one natural-language request, reveal the
    agent’s useful steps, show evidence, pause at approval or refusal, and end
    with a claim draft or payment receipt.

    Skip login, settings, empty navigation, and technical setup. Prepare a
    deterministic backup fixture and a screen recording in case the live demo
    fails. Use plain language and finish with one measurable outcome.

## Verification checklist

Before showing anyone:

- Can someone understand the product from one screenshot?
- Is there exactly one dominant action?
- Does the first viewport contain real, believable data?
- Does the visible flow reach a result in under 90 seconds?
- Is the agent’s work legible without fake “thinking” text?
- Are evidence and policy references one click away?
- Is money movement or claim approval human-gated?
- Does the refusal state look as designed as the success state?
- Do mobile and desktop preserve hierarchy?
- Are focus, keyboard, contrast, and reduced motion acceptable?
- Did the last 2–3 hours include screenshot QA and recording?

## Sources

- [Devpost — presenting a successful hackathon demo](https://info.devpost.com/blog/how-to-present-a-successful-hackathon-demo)
- [Devpost — winning hackathon demo videos](https://info.devpost.com/blog/6-tips-for-making-a-hackathon-demo-video)
- [Devpost — advice from hackathon judges](https://info.devpost.com/blog/hackathon-judging-tips)
- [NN/G — aesthetic-usability effect](https://www.nngroup.com/articles/aesthetic-usability-effect/)
- [NN/G — good visual design](https://www.nngroup.com/articles/good-visual-design/)
- [NN/G — visual hierarchy](https://www.nngroup.com/articles/visual-hierarchy-ux-definition/)
- [NN/G — progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/)
- [NN/G — testing visual design](https://www.nngroup.com/articles/testing-visual-design/)
- [Anthropic — frontend-design skill](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md)
- [Anthropic — Claude Code frontend-design plugin](https://github.com/anthropics/claude-code/tree/main/plugins/frontend-design)
- [Anthropic — prompting for frontend aesthetics](https://github.com/anthropics/claude-cookbooks/blob/main/coding/prompting_for_frontend_aesthetics.ipynb)
- [Vercel — Web Interface Guidelines](https://vercel.com/design/guidelines)
- [Vercel — web-design-guidelines agent skill](https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines)

