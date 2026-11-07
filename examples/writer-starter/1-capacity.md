---
# Required: title, abstract, tier, price. Scalars only; no YAML lists.
# Optional: tags, synthetic, questions, entity, measure.
# questions: What changes? | What evidence exists?
# entity: electricity
# measure: share
# Real notes: synthetic: false, 150–3,000 words in at least 4 paragraphs.
title: Solar electricity share for Malaysia colocation
tier: PAID
price: 0.10
abstract: A synthetic worked example comparing contracted renewable electricity share with hourly matching.
tags: Malaysia, colocation, solar, renewable, electricity, share, contracts
synthetic: true
---

## Research scope

This is the follow-up I promised to the readers who asked what Kestrel's second packaging plant in Penang actually buys when it buys electricity. I now have six weeks of fifteen-minute interval data from the plant's incoming meter, the connection agreement, and the public summary of its solar award, and together they answer the question more precisely than any press release.

## The firm supply

Phase 2 was commissioned on 15 August 2026 and sits on a 45 MW firm connection at 132 kV. In the six weeks to 26 September 2026 its metered peak was 38.6 MW and its average was 31.2 MW. The average will rise as the second half of the tool set comes up to rated throughput; my estimate for the steady state is 35 MW, and I would be surprised by anything outside 33 to 37 MW. At 35 MW the plant consumes roughly 307 GWh in a year.

The connection itself was not cheap. The utility required a dedicated 132 kV bay at the Bayan Lepas substation and a second incoming feeder for redundancy, and the plant pays a maximum-demand charge on its highest half-hour each month. In August that half-hour fell on a Tuesday afternoon during a heat spell, which is exactly the coincident peak the original load schedule anticipated.

## Capacity methodology

Almost all of that energy arrives through the utility on the standard high-voltage industrial terms. There is no on-site generation beyond emergency diesel sets, which have run only for testing.

## The solar contract

The green power award is the second line in the bill. The contract was signed on 8 September 2026, runs for 21 years and covers 40 MW of solar nameplate at a farm in Kedah that is due to start exporting in the second quarter of 2027. Until then the contract delivers nothing.

When the farm is running, I model its output at a capacity factor of 0.16, which gives about 56 GWh a year. Against 307 GWh of consumption that is 18%; against the higher 335 GWh figure, the one that assumes the 45 MW connection is used at 85% of capacity, it is 17%. I quote 17% as the conservative number.

## Allocation context

## What the interval data says

The interval data shows why the annual share flatters the contract. Between 10:00 and 15:00 on a clear day the modelled solar output would cover about 55% of the plant's draw. Between 19:00 and 07:00 it covers nothing, and those twelve hours carry 52% of the plant's weekly energy, because the night shifts run the reflow and test lines hardest. On an hourly-matched basis the contract covers about 9% of consumption, roughly half the annual figure.

## Cost

At the published round price, the contracted energy costs a little more than the grid energy it displaces. On my numbers the premium adds about 0.4% to the plant's annual electricity bill, which is small next to the swing from the quarterly fuel-cost surcharge. The company is paying for a certificate trail, not for cheaper power.

## Research limitations

## What would change the numbers

Three things would move the share. A second award in next year's round, which the company has not ruled out, could double it. A battery sized to shift midday output into the evening would raise the hourly-matched figure much more than the annual one. And a slower ramp of the second tool set would lower consumption and push the annual share above 18% without any new contract.

## Method

The interval data covers 1 August to 26 September 2026 at fifteen-minute resolution. I excluded the commissioning days before 15 August. Solar output is modelled from ten years of irradiance records for the farm's district, not from metered generation, because the farm is not yet built. Consumption figures are metered, not estimated, except for the steady-state projection, which I have flagged wherever it appears. The arithmetic and the spreadsheet are available to subscribers on request, and I will update this note when the farm starts exporting and there is real generation data to compare against the model.
