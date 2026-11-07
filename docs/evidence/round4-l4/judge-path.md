# Round-4 judge-path measurement extract

Observed 7 Nov 2026 ~11:35–12:30 SGT, macOS Node 26.3.1, main `421f5f9f`.
Source: `notes/review-nov7/07-mock-judges-r4.md`, §0 and §5, retained from the
owner's review workspace. Fixture models and fictional writers, real XRPL
Testnet, no real money. This extract does not claim a fresh L4 run.

- Demo load 1.2 s; first verified hash ~1 s; Done 7 s.
- Ledger load 0.85 s; 45/45 validated 27.5 s.
- MCP tgz 21.4 MB; fresh-cache initialize 56.5 s; wallets 24.3 s;
  ask 30.8 s; total ~112 s to verified anchored answer (sum, not first hash).
- App ready 134 s; wallets 19.1 s included; Ask → Done 44 s → anchor 56 s;
  fresh cache → anchored UC3 ~190 s (sum).
- Faucet setup prior card 17 s; current app 19.1 s / MCP 24.3 s.
- Six app UC3 transactions independently validated: two creates at 12 drops,
  two conditional finishes at 423, refund Payment at 12, anchor at 12:
  894 drops total (0.000894 Testnet XRP); anchor alone 12 drops.
- Nightly devcontainer Testnet jobs green 6 and 7 Nov: ~130 s job,
  43.9 s validated purchase. Substitutes for Codespace; no Codespace run.
- Judge-bank hit rate: not measured in round 4; J1 owns the frozen bank.
- RLUSD control: issuer flags 2174353408 at ledger 22058675 lack
  AllowTrustLineLocking despite enabled TokenEscrow. Predicted refusal only;
  no rejected RLUSD escrow transaction was submitted.
