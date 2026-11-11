# H7: hosted hardening (11 November 2026)

Local verification only: `HOSTED=1`, fixture research and decision models, simulated payments and ephemeral ports. No hosted questions, cloud changes, live providers or Testnet transactions.

The before/after load proof uses six visitors for 120 seconds with the H6 readiness-latency schedule, an uptime request every 10 seconds, then 5,200 cookieless requests from one address. Before runs the pinned pre-H7 source with inline readiness; after runs the production background readiness cache. Readiness network latency is a stand-in, explicitly recorded in each JSON; the hosted gateway, publisher and packaging guard are real local processes.

Results are being collected in `before.json` and `after.json`. The production balance-to-alert wiring and the front's nginx substitutions are separately checked by automated tests. The operator deployment remains the orchestrator's responsibility.
