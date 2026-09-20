# UO-04 component and state inventory

This is an editable prototype inventory, not a production implementation contract. Each component is represented in `app.js` and rendered with semantic HTML.

| Component | Owner / state | Default vs secondary | States and recovery | Responsive / keyboard notes |
| --- | --- | --- | --- | --- |
| Home composer | scope authority / H0 | Default | Supported question → Q1; unsupported → U1 with text retained | Full-width textarea; labelled; examples remain ordinary editable values |
| Returning card | draft/run authority / H1 | Default for saved state | Resume last safe draft; New research preserves prior records | Wraps on narrow widths; Resume is a named button |
| Stepper + StepHeader | draft state / Q1, S1, B1, V1 | Default orientation | Back and Save draft preserve state | Horizontal scroll labels collapse at narrow width; current step announced |
| SourceProfileList | source authority / S1 | Default | Zero selection error; named allowed profiles; selected count | Checkbox labels retain family, access, and explanation at 320px |
| BudgetEditor + BudgetSummary | budget authority / B1, R1 | Default | Cap, spent, remaining, wallet, per-source ceiling remain distinct | Range has label/output; summary strip wraps instead of creating a column |
| PlanSummary + Disclosure | plan authority / V1/V2 | Readable default, advanced secondary | Advanced settings reveal only; plan approval never implies purchase | Native details/summary keyboard behavior |
| ProgressPanel | run authority / R1/T1 | Default | Ready, pause, resume, stop concept, reload recovery banner | Pause/Resume is a text action in compact header |
| SourceRow | purchase/access authority / P1/P3/F1 | Default in Sources tab | Open, recommendation, unlocked, blocked, expired, pending, fulfilment failure | Stable title/relevance/family/access/price/action order; stacks on narrow |
| ApprovalModal | purchase authority / P2 | Focused modal | Cancel, exact approval, expired quote; settlement/access remain separate | `role=dialog`, labelled, Tab/Shift+Tab trap, Escape closes, focus restores to Review purchase, explicit final button |
| ActivityFeed | run/purchase authority / P3/L1 | Secondary tab | Receipts, skips, blocks, unknown outcomes, recovery | Timeline rows stack at narrow widths |
| AnswerPanel | synthesis/citation authority / A1/E1/A2 | Default destination | Open-only answer, fallback/limitation concept, final cited answer | Answer remains centered; evidence labels are text, not colour only |
| EvidenceDrawer | citation authority / A2 | Secondary inspection | Exact bound span, access mode, reason shown; close restores trigger | Side drawer becomes full width; Tab/Shift+Tab trap; Escape/Done closes and restores the citation trigger |
| Prototype controls | local fixture simulator | Advanced/test-only | Expiry, block, pending, fulfilment, reload | Clearly labelled as simulation; never appears as product authority |

No component calls a provider or payment service. A production adapter must remain server-authoritative for scope, plan, quote, cap, settlement, protected access, and citation validation.
