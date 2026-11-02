# Claude Code → ResearchAgent MCP fixture transcript summary

Fresh, non-persistent Claude Code print session, only four ResearchAgent MCP tools enabled. Engine providers and payments are fixtures; the calling Claude model is real. No Testnet transaction was attempted.

UC2's recorded pricing-and-margins clarification is included in the question because MCP skips interactive clarification.

```json
{
  "result": "PASS",
  "elapsedSeconds": 23.3,
  "mode": "fixture providers; SIMULATED settlement; fictional writers; no XRPL transaction",
  "tools": [
    {
      "name": "mcp__researchagent__wallet_status",
      "input": {}
    },
    {
      "name": "mcp__researchagent__search_expertise",
      "input": {
        "query": "What's the analyst outlook on Kestrel Semiconductor's latest deal with TSMC (pricing & margins)?"
      }
    },
    {
      "name": "mcp__researchagent__ask_expert",
      "input": {
        "question": "What's the analyst outlook on Kestrel Semiconductor's latest deal with TSMC (pricing & margins)?",
        "budget_sgd": 2,
        "idempotency_key": "claude-uc2"
      }
    },
    {
      "name": "mcp__researchagent__ask_expert",
      "input": {
        "question": "What's the analyst outlook on Kestrel Semiconductor's latest deal with TSMC (pricing & margins)?",
        "budget_sgd": 2,
        "idempotency_key": "claude-uc2"
      }
    },
    {
      "name": "mcp__researchagent__wallet_status",
      "input": {}
    }
  ],
  "runs": [
    {
      "run_id": "0638aaed-37ca-4cf2-b765-2fdc256eaec5",
      "phase": "DONE",
      "budgetMinor": 200,
      "spentMinor": 90,
      "labels": {
        "research": "fixture · extractive-fixture",
        "decision": "fixture · metadata-fixture",
        "publisher": "local",
        "settlement": "SIMULATED SGD · no real funds",
        "search": "keyword only (embeddings unavailable)",
        "plan": "fixture · scope-fixture"
      },
      "purchases": [
        {
          "intentId": "0638aaed-37ca-4cf2-b765-2fdc256eaec5:1:notft-kestrel-tsmc-deal-margins:v1",
          "resourceId": "notft-kestrel-tsmc-deal-margins",
          "writer": "NotFinancialTimes",
          "priceMinor": 90,
          "status": "VERIFIED",
          "verified": true,
          "refunded": false,
          "txHash": null,
          "explorerUrl": null,
          "label": "SIMULATED SGD · no real funds"
        }
      ],
      "citations": [
        {
          "resourceId": "notft-kestrel-tsmc-deal-margins",
          "version": "v1",
          "spanId": "p1",
          "claimId": "evidence-[\"notft-kestrel-tsmc-deal-margins\",\"v1\",\"p1\"]",
          "writer": "NotFinancialTimes",
          "passage": "Kestrel Semiconductor lost a fifth of its consensus gross margin in a single morning. On 1 October 2026, the average fiscal 2027 gross margin estimate across the five brokers covering the Singapore-based fabless designer fell to 55.2% from 58.5%, after three of the five revised their models to absorb the terms of a new wafer supply agreement with TSMC. The stock closed 4.1% lower in Taipei, its worst session since February.",
          "url": "http://127.0.0.1:56404/w/notfinancialtimes/blog/notft-kestrel-tsmc-deal-margins#p-p1",
          "grantIntentId": "0638aaed-37ca-4cf2-b765-2fdc256eaec5:1:notft-kestrel-tsmc-deal-margins:v1"
        },
        {
          "resourceId": "notft-kestrel-tsmc-deal-margins",
          "version": "v1",
          "spanId": "p2",
          "claimId": "evidence-[\"notft-kestrel-tsmc-deal-margins\",\"v1\",\"p2\"]",
          "writer": "NotFinancialTimes",
          "passage": "The revisions were not a judgment on demand. They were arithmetic. Under the previous contract, Kestrel paid about US$19,800 for each N3P wafer. The new agreement, signed on 29 September and disclosed in a brief filing before the Taipei open, prices the same wafer at roughly US$22,500. That is a rise of 13.6%, and it lands directly on a product line that accounts for the majority of Kestrel's data-center accelerator volume.",
          "url": "http://127.0.0.1:56404/w/notfinancialtimes/blog/notft-kestrel-tsmc-deal-margins#p-p2",
          "grantIntentId": "0638aaed-37ca-4cf2-b765-2fdc256eaec5:1:notft-kestrel-tsmc-deal-margins:v1"
        },
        {
          "resourceId": "notft-kestrel-tsmc-deal-margins",
          "version": "v1",
          "spanId": "p4",
          "claimId": "evidence-[\"notft-kestrel-tsmc-deal-margins\",\"v1\",\"p4\"]",
          "writer": "NotFinancialTimes",
          "passage": "Kestrel agreed to advance US$1.1 billion against future wafer deliveries, payable in three instalments, the last of them due by the end of April 2027. Against Kestrel's US$2.4 billion of cash and short-term investments, that is about 46% of the balance sheet committed to a single supplier. Daniel Okafor, who covers the name for Kestrel's most cautious broker, described the structure as \"a capacity option dressed as a purchase order\" and cut his target price to NT$410 from NT$520.",
          "url": "http://127.0.0.1:56404/w/notfinancialtimes/blog/notft-kestrel-tsmc-deal-margins#p-p4",
          "grantIntentId": "0638aaed-37ca-4cf2-b765-2fdc256eaec5:1:notft-kestrel-tsmc-deal-margins:v1"
        },
        {
          "resourceId": "notft-kestrel-tsmc-deal-margins",
          "version": "v1",
          "spanId": "p9",
          "claimId": "evidence-[\"notft-kestrel-tsmc-deal-margins\",\"v1\",\"p9\"]",
          "writer": "NotFinancialTimes",
          "passage": "The timing of the disclosure has a macro dimension that Kestrel's investors did not ask for. The yen's slide past 165 against the dollar has made TSMC's Japanese advanced packaging subsidiary, AP1, more cost-competitive in dollar terms, and the Bank of Japan's reluctance to tighten further has kept the currency weak. TSMC has used that cost advantage to hold the line on packaging prices even as wafer prices rise. For Kestrel, that is a small mercy: the packaging step on the K2 is quoted in yen, and the currency move offsets perhaps 80 basis points of the wafer increase.",
          "url": "http://127.0.0.1:56404/w/notfinancialtimes/blog/notft-kestrel-tsmc-deal-margins#p-p9",
          "grantIntentId": "0638aaed-37ca-4cf2-b765-2fdc256eaec5:1:notft-kestrel-tsmc-deal-margins:v1"
        },
        {
          "resourceId": "or-kestrel-tsmc-filing-2026-09-29",
          "version": "v1",
          "spanId": "p1",
          "claimId": "evidence-[\"or-kestrel-tsmc-filing-2026-09-29\",\"v1\",\"p1\"]",
          "writer": "Open Records",
          "passage": "On 29 September 2026 Kestrel Semiconductor announced a five-year agreement with TSMC for N3P wafer capacity, 24,000 wafers a month from Q3 2027, plus advanced-packaging slots. The disclosure was made in an exchange filing published before the opening of trading. Kestrel will pay a US$1.1 billion prepayment and gave no margin guidance. The previous contract covered 16,000 wafers a month.",
          "url": "http://127.0.0.1:56404/w/open-records/blog/or-kestrel-tsmc-filing-2026-09-29#p-p1",
          "grantIntentId": null
        },
        {
          "resourceId": "open-kestrel-semiconductor-exchange-filings-july-25-2026",
          "version": "v1",
          "spanId": "p1",
          "claimId": "evidence-[\"open-kestrel-semiconductor-exchange-filings-july-25-2026\",\"v1\",\"p1\"]",
          "writer": "Open Records",
          "passage": "On July 25, 2026, Kestrel Semiconductor published its quarterly exchange filings with the Taiwan Stock Exchange and the Tokyo Stock Exchange. The filings, dated July 24, 2026, cover the period from April 1 to June 30, 2026. Kestrel reported net revenue of NT$142.3 billion for the quarter, a figure that appears in the consolidated income statement on page 12 of the Taiwan filing. The company also disclosed a gross margin of 48.7 percent, down from 51.2 percent in the same quarter of 2025. Operating income was NT$38.9 billion, and net income was NT$31.4 billion. These figures are stated in the filing without adjustment for foreign exchange fluctuations.",
          "url": "http://127.0.0.1:56404/w/open-records/blog/open-kestrel-semiconductor-exchange-filings-july-25-2026#p-p1",
          "grantIntentId": null
        },
        {
          "resourceId": "or-penang-packaging-output-2026-q3",
          "version": "v1",
          "spanId": "p4",
          "claimId": "evidence-[\"or-penang-packaging-output-2026-q3\",\"v1\",\"p4\"]",
          "writer": "Open Records",
          "passage": "A Kestrel statement dated 2 September 2026 says Phase 2 reached its rated capacity on 28 August 2026. The statement gives no unit figures. A second statement dated 20 September 2026 says the plant operated at 92 per cent of rated capacity in the week ending 18 September 2026. The record states no customer lead times.",
          "url": "http://127.0.0.1:56404/w/open-records/blog/or-penang-packaging-output-2026-q3#p-p4",
          "grantIntentId": null
        },
        {
          "resourceId": "or-wafer-capacity-prepayment-explainer",
          "version": "v1",
          "spanId": "p2",
          "claimId": "evidence-[\"or-wafer-capacity-prepayment-explainer\",\"v1\",\"p2\"]",
          "writer": "Open Records",
          "passage": "The practice is not new. Foundries and their largest customers have used advance payments for decades, particularly when a customer needs assurance that a new process node will be available in volume. The prepayment can cover a portion of the total contract value or the entire amount. It can be refundable or non-refundable, depending on the terms. Public disclosures rarely include the full contract, so the exact terms are often known only to the parties and their auditors.",
          "url": "http://127.0.0.1:56404/w/open-records/blog/or-wafer-capacity-prepayment-explainer#p-p2",
          "grantIntentId": null
        }
      ]
    },
    {
      "run_id": "0638aaed-37ca-4cf2-b765-2fdc256eaec5",
      "phase": "DONE",
      "budgetMinor": 200,
      "spentMinor": 90,
      "labels": {
        "research": "fixture · extractive-fixture",
        "decision": "fixture · metadata-fixture",
        "publisher": "local",
        "settlement": "SIMULATED SGD · no real funds",
        "search": "keyword only (embeddings unavailable)",
        "plan": "fixture · scope-fixture"
      },
      "purchases": [
        {
          "intentId": "0638aaed-37ca-4cf2-b765-2fdc256eaec5:1:notft-kestrel-tsmc-deal-margins:v1",
          "resourceId": "notft-kestrel-tsmc-deal-margins",
          "writer": "NotFinancialTimes",
          "priceMinor": 90,
          "status": "VERIFIED",
          "verified": true,
          "refunded": false,
          "txHash": null,
          "explorerUrl": null,
          "label": "SIMULATED SGD · no real funds"
        }
      ],
      "citations": [
        {
          "resourceId": "notft-kestrel-tsmc-deal-margins",
          "version": "v1",
          "spanId": "p1",
          "claimId": "evidence-[\"notft-kestrel-tsmc-deal-margins\",\"v1\",\"p1\"]",
          "writer": "NotFinancialTimes",
          "passage": "Kestrel Semiconductor lost a fifth of its consensus gross margin in a single morning. On 1 October 2026, the average fiscal 2027 gross margin estimate across the five brokers covering the Singapore-based fabless designer fell to 55.2% from 58.5%, after three of the five revised their models to absorb the terms of a new wafer supply agreement with TSMC. The stock closed 4.1% lower in Taipei, its worst session since February.",
          "url": "http://127.0.0.1:56404/w/notfinancialtimes/blog/notft-kestrel-tsmc-deal-margins#p-p1",
          "grantIntentId": "0638aaed-37ca-4cf2-b765-2fdc256eaec5:1:notft-kestrel-tsmc-deal-margins:v1"
        },
        {
          "resourceId": "notft-kestrel-tsmc-deal-margins",
          "version": "v1",
          "spanId": "p2",
          "claimId": "evidence-[\"notft-kestrel-tsmc-deal-margins\",\"v1\",\"p2\"]",
          "writer": "NotFinancialTimes",
          "passage": "The revisions were not a judgment on demand. They were arithmetic. Under the previous contract, Kestrel paid about US$19,800 for each N3P wafer. The new agreement, signed on 29 September and disclosed in a brief filing before the Taipei open, prices the same wafer at roughly US$22,500. That is a rise of 13.6%, and it lands directly on a product line that accounts for the majority of Kestrel's data-center accelerator volume.",
          "url": "http://127.0.0.1:56404/w/notfinancialtimes/blog/notft-kestrel-tsmc-deal-margins#p-p2",
          "grantIntentId": "0638aaed-37ca-4cf2-b765-2fdc256eaec5:1:notft-kestrel-tsmc-deal-margins:v1"
        },
        {
          "resourceId": "notft-kestrel-tsmc-deal-margins",
          "version": "v1",
          "spanId": "p4",
          "claimId": "evidence-[\"notft-kestrel-tsmc-deal-margins\",\"v1\",\"p4\"]",
          "writer": "NotFinancialTimes",
          "passage": "Kestrel agreed to advance US$1.1 billion against future wafer deliveries, payable in three instalments, the last of them due by the end of April 2027. Against Kestrel's US$2.4 billion of cash and short-term investments, that is about 46% of the balance sheet committed to a single supplier. Daniel Okafor, who covers the name for Kestrel's most cautious broker, described the structure as \"a capacity option dressed as a purchase order\" and cut his target price to NT$410 from NT$520.",
          "url": "http://127.0.0.1:56404/w/notfinancialtimes/blog/notft-kestrel-tsmc-deal-margins#p-p4",
          "grantIntentId": "0638aaed-37ca-4cf2-b765-2fdc256eaec5:1:notft-kestrel-tsmc-deal-margins:v1"
        },
        {
          "resourceId": "notft-kestrel-tsmc-deal-margins",
          "version": "v1",
          "spanId": "p9",
          "claimId": "evidence-[\"notft-kestrel-tsmc-deal-margins\",\"v1\",\"p9\"]",
          "writer": "NotFinancialTimes",
          "passage": "The timing of the disclosure has a macro dimension that Kestrel's investors did not ask for. The yen's slide past 165 against the dollar has made TSMC's Japanese advanced packaging subsidiary, AP1, more cost-competitive in dollar terms, and the Bank of Japan's reluctance to tighten further has kept the currency weak. TSMC has used that cost advantage to hold the line on packaging prices even as wafer prices rise. For Kestrel, that is a small mercy: the packaging step on the K2 is quoted in yen, and the currency move offsets perhaps 80 basis points of the wafer increase.",
          "url": "http://127.0.0.1:56404/w/notfinancialtimes/blog/notft-kestrel-tsmc-deal-margins#p-p9",
          "grantIntentId": "0638aaed-37ca-4cf2-b765-2fdc256eaec5:1:notft-kestrel-tsmc-deal-margins:v1"
        },
        {
          "resourceId": "or-kestrel-tsmc-filing-2026-09-29",
          "version": "v1",
          "spanId": "p1",
          "claimId": "evidence-[\"or-kestrel-tsmc-filing-2026-09-29\",\"v1\",\"p1\"]",
          "writer": "Open Records",
          "passage": "On 29 September 2026 Kestrel Semiconductor announced a five-year agreement with TSMC for N3P wafer capacity, 24,000 wafers a month from Q3 2027, plus advanced-packaging slots. The disclosure was made in an exchange filing published before the opening of trading. Kestrel will pay a US$1.1 billion prepayment and gave no margin guidance. The previous contract covered 16,000 wafers a month.",
          "url": "http://127.0.0.1:56404/w/open-records/blog/or-kestrel-tsmc-filing-2026-09-29#p-p1",
          "grantIntentId": null
        },
        {
          "resourceId": "open-kestrel-semiconductor-exchange-filings-july-25-2026",
          "version": "v1",
          "spanId": "p1",
          "claimId": "evidence-[\"open-kestrel-semiconductor-exchange-filings-july-25-2026\",\"v1\",\"p1\"]",
          "writer": "Open Records",
          "passage": "On July 25, 2026, Kestrel Semiconductor published its quarterly exchange filings with the Taiwan Stock Exchange and the Tokyo Stock Exchange. The filings, dated July 24, 2026, cover the period from April 1 to June 30, 2026. Kestrel reported net revenue of NT$142.3 billion for the quarter, a figure that appears in the consolidated income statement on page 12 of the Taiwan filing. The company also disclosed a gross margin of 48.7 percent, down from 51.2 percent in the same quarter of 2025. Operating income was NT$38.9 billion, and net income was NT$31.4 billion. These figures are stated in the filing without adjustment for foreign exchange fluctuations.",
          "url": "http://127.0.0.1:56404/w/open-records/blog/open-kestrel-semiconductor-exchange-filings-july-25-2026#p-p1",
          "grantIntentId": null
        },
        {
          "resourceId": "or-penang-packaging-output-2026-q3",
          "version": "v1",
          "spanId": "p4",
          "claimId": "evidence-[\"or-penang-packaging-output-2026-q3\",\"v1\",\"p4\"]",
          "writer": "Open Records",
          "passage": "A Kestrel statement dated 2 September 2026 says Phase 2 reached its rated capacity on 28 August 2026. The statement gives no unit figures. A second statement dated 20 September 2026 says the plant operated at 92 per cent of rated capacity in the week ending 18 September 2026. The record states no customer lead times.",
          "url": "http://127.0.0.1:56404/w/open-records/blog/or-penang-packaging-output-2026-q3#p-p4",
          "grantIntentId": null
        },
        {
          "resourceId": "or-wafer-capacity-prepayment-explainer",
          "version": "v1",
          "spanId": "p2",
          "claimId": "evidence-[\"or-wafer-capacity-prepayment-explainer\",\"v1\",\"p2\"]",
          "writer": "Open Records",
          "passage": "The practice is not new. Foundries and their largest customers have used advance payments for decades, particularly when a customer needs assurance that a new process node will be available in volume. The prepayment can cover a portion of the total contract value or the entire amount. It can be refundable or non-refundable, depending on the terms. Public disclosures rarely include the full contract, so the exact terms are often known only to the parties and their auditors.",
          "url": "http://127.0.0.1:56404/w/open-records/blog/or-wafer-capacity-prepayment-explainer#p-p2",
          "grantIntentId": null
        }
      ]
    }
  ]
}
```
