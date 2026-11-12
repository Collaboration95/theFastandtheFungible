# Submission descriptions

Environment for all three form variants: **XRPL Testnet demo**.
Writer provenance: two team-authored writers supply paid implementation notes; Open Records supplies free records.
[Status and limits](../../README.md#status-and-limits) · [Prepared answers](qa-prep.md).

## ~50 words

ResearchAgent gives coding agents a research wallet. Ask a question and set a budget.
It searches free sources, then policy rules decide purchases of missing expertise
over x402. Writers collect by revealing the article key on the XRP Ledger.
Your browser independently checks that the key matches the payment lock.

## ~150 words

ResearchAgent gives coding agents a research wallet. Ask a question and set a budget.
It searches free sources first, then policy rules decide purchases of missing expertise
over x402. The language model cannot spend or raise the budget.

Writers collect payment by publishing an article key through native XRP Ledger escrow.
The key that unlocks the article is the same key that releases the writer’s payment.
Your browser reads the public transactions and checks the match. Answers cite the
passages delivered; exported receipts can also be checked with our TypeScript and
Python verifiers, written separately.

The first buyers we target are XRPL/x402 integrators using coding agents to implement
paid endpoints or diagnose settlement failures. They can buy a specific practitioner
detail with a cited passage and checkable payment. Use the hosted browser demo or add
the same tools to Claude Code over MCP: one question, one budget, verifiable delivery.

## ~300 words

ResearchAgent is a search engine for agent-readable expertise, with a wallet.
A coding agent can ask a question and set a budget, search free sources, then buy
missing expertise over x402. Policy rules decide purchases, at most one article per
round for three rounds. The budget is the only spending authority; the language model
cannot spend or raise its cap.

The writer encrypts the article and signs its price, key hash and content hashes.
Policy locks payment in native XRP Ledger escrow. The writer collects by publishing
the article key. The app grants access after ledger validation, then cites the delivered
passages. The key that unlocks the article is the same key that releases the writer’s
payment. Your browser reads both transactions from a public node and checks the match.

The same research tools work in Claude Code over MCP, in the browser, and through
TypeScript and Python SDKs. Export receipts to check them outside the app with our
separately written verifiers. Judges can verify a recorded hosted run without asking
a question: the featured run’s browser check shows all five hard gates Held.

We target XRPL/x402 integrators using coding agents to implement paid endpoints or
diagnose failed settlement. Practitioner notes offer the specific detail a free abstract
omits, with a cited passage and a checkable payment. [Example: how writers get paid](../../data/corpus/v2/articles/team-xrpl-explainers/product-writer-paid.json).

Since SingHacks, the prototype has become released software with native key-reveal
escrow, receipt verification and an agent-to-agent hire path. The hosted demo makes
the full loop accessible from one link. Its public scoreboard reports questions,
settled purchases, answer times, model costs and recorded audit violations. The
repository includes dated evidence and runnable builder feedback. Start with the
recorded proof, then ask your question and check the delivery key yourself.
