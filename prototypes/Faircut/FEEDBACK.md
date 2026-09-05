# Implementation feedback log

This is builder and integration feedback gathered while implementing FairCut;
it is not a substitute for the required three-person comprehension review.

| Observation | Product or engineering change |
| --- | --- |
| A validated XRPL transaction can still carry a non-success result (`tecNO_DST_INSUF_XRP`) when a destination is not activated. | Reconciliation now requires both `validated: true` and `TransactionResult: tesSUCCESS`; the failed attempt remains documented as a real failure observation. |
| XRPL responses may expose payment amount as `Amount` or `DeliverMax`. | The signer guard normalizes both fields and checks the exact 8,000-drop value, destination, source tag, memo invoice, and bounded ledger sequence. |
| Fixture success is easy to mistake for live settlement when both paths share a state transition. | `settlementStatus`, mode labels, receipt projections, and action-panel copy distinguish fixture simulation, recorded evidence, and live validation. |
| A clean asset can look protected while still being in the public bundle. | The clean MP3 lives under `server/assets/`; the route returns 402 before payment evidence and exposes the actual byte digest after delivery. |
| Delivery verification needs stronger evidence than a symbolic digest. | Fulfilment now hashes the returned bytes and validates the manifest, ODRL digest, MIME type, container/effective duration, placement, attribution, and purchase reference. |
