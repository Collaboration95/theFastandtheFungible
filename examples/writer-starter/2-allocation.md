---
title: Malaysia grid planning notes
tier: PAID
price: 0.10
abstract: A fictional allocation briefing demonstrating signed evidence delivery.
tags: Malaysia, colocation, grid, energy
synthetic: true
---

## Research scope

I spent last Tuesday morning in a meeting room in Bayan Lepas, staring at a single-line diagram that had been redrawn three times since breakfast. The subject was a new advanced packaging plant, and the question was simple enough to state and hard to answer: how do you feed it? I'll walk through the arithmetic here, because the numbers are the argument, and because I think the arithmetic is more interesting than the conclusion.

## The load, and why it

The Phase 2 plant needs a 45 MW grid connection. That figure comes from the developer's own load schedule, which I have now read closely enough to have opinions about. It is not a constant. A packaging line is a collection of tools that cycle: etchers, deposition chambers, ovens, and the facility systems that keep them alive. The 45 MW is a coincident peak, the number you get when you assume the worst reasonable alignment of tool duty cycles on a hot afternoon in March.

## Capacity methodology

What matters for the grid is not the peak alone but the shape around it. I asked for fifteen-minute interval data from the Phase 1 plant next door, which has been running since 2021. Its peak is lower, but its load factor is around 0.78, which is high for an industrial customer and tells you the plant is process-limited rather than batch-limited. If Phase 2 behaves the same way, its average draw will sit somewhere near 35 MW, and the difference between average and peak is what the network has to be able to absorb without voltage sag.

## What the grid can actually

The transmission corridor into Bayan Lepas is fed from the main grid via 275 kV lines that terminate at a substation a few kilometres away. From there, 132 kV circuits distribute into the industrial parks. I pulled the most recent system adequacy report from the grid operator, and the southern corridor has headroom, but headroom is a seasonal thing. During the inter-monsoon months, when several large generators in the north go down for maintenance, the import capability into the island's southern tip tightens.

## Allocation context

This is where the arithmetic gets uncomfortable. A 45 MW connection is not a 45 MW problem. If the plant's power factor at the point of connection is 0.95, the reactive power requirement is about 15 MVAr, and that has to come from somewhere: either the plant's own compensation or the network. If the plant installs capacitors to hold power factor near unity, the grid sees mostly real power, and the voltage support burden falls back on the transmission system. If it does not, the local 132 kV bus will sag every time a large motor starts.

I ran a rough short-circuit calculation with the fault level data I could get. At the proposed point of connection, the three-phase fault level is on the order of 1500 MVA. A 45 MW load is small against that, which is good news for voltage stability but bad news for protection coordination, because the plant's contribution to a fault is negligible and the utility's relays will not see it. That is a design detail, not a showstopper, but it is the kind of thing that adds months if it is discovered late.

## The generation side, and why

## Research limitations

Penang does not generate much of its own power. The island imports most of what it uses from the mainland, and the mainland's mix is dominated by combined-cycle gas and coal. I have written before that the marginal generator in Peninsular Malaysia is usually a gas turbine, and that is still true. So the emissions arithmetic for this plant is straightforward: 45 MW at a capacity factor of, say, 0.85 is about 335 GWh per year, and at a marginal emissions factor of roughly 0.45 tonnes of CO2 per MWh, that is about 150,000 tonnes per year. That is the number the sustainability team will have to defend, and it is why they keep asking me about power purchase agreements.

A dedicated PPA with a solar farm sounds attractive until you do the hourly matching. Solar in Penang produces at a capacity factor around 0.15 to 0.17, and it produces nothing at night, when the packaging lines run hardest. If you want 45 MW of firm capacity from solar plus storage, you are looking at a few hundred MW of panels and a battery that costs more than the plant's tool set. I am not saying it cannot be done; I am saying the arithmetic does not flatter anyone who claims it is cheap.

## What I would actually recommend

The boring answer is the right one. Connect to the grid, pay for a firm connection, and install enough on-site compensation to keep the power factor near unity. Then negotiate a PPA that matches the plant's actual load shape, not its peak. The 45 MW figure is a design constraint, not a procurement target, and treating it as the latter is how you end up with a battery you use four hours a day.

I would also push for interval metering at the point of connection from day one, and for a data-sharing agreement with the utility. The Phase 1 plant's data has been invaluable for this analysis, and I suspect the same will be true for Phase 2. Grid planning is a long game, and the more we know about how these plants actually behave, the better the next connection will be.

One last thing. The meeting on Tuesday ended with a decision to commission a detailed load flow study, which is the correct outcome. But I left with a nagging feeling that we are still planning these connections one plant at a time, when the real question is what happens when there are five of them. The southern corridor has headroom today. It will not have headroom forever, and the arithmetic that tells you when it runs out is the same arithmetic I have just walked through. I would rather do it now, in a meeting room, than later, in a blackout.
