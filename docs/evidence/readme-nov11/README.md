# README screenshot run (11 Nov 2026)

> **Superseded the same day.** The README hero is now captured from the re-recorded default
> replay by `node docs/submission/deck/export.mjs --refresh-shots`; see
> [`../replay-nov11/README.md`](../replay-nov11/README.md). This note describes the earlier
> image and stays as history.

**XRPL Testnet · no real value.** Fixture models (`fixture · extractive-fixture`,
`fixture · metadata-fixture`), keyword search, fictional writers (AlphaLeak, The Fab
Floor), faucet-funded wallets. Not a quality or latency benchmark.

[`docs/media/readme-answer.png`](../../media/readme-answer.png) is a 2× capture of this run
in the current app (`main` at `9e161c84`), light theme, 1280 × 920 CSS pixels, sidebar
hidden and the refunded article's promise list collapsed. Nothing was edited in the image.

How it was made: `make testnet OFFSET=3300` (fixture models, isolated faucet wallets), then
the demo question "Are Kestrel Semiconductor's advanced-packaging lead times in Malaysia
getting shorter?" with the default S$2.00 budget, asked in the browser and confirmed by the
5 s plan modal. The run finished `Done · 1 kept · 1 refunded · net S$0.40`.

| Step | Transaction | Ledger | Fee (drops) |
|---|---|---:|---:|
| Escrow created, AlphaLeak | [F20697BA…30FCDCB](https://testnet.xrpl.org/transactions/F20697BA03D3F6C14406C90C4AFBCC148567C674A4A97221120C6B21E30FCDCB) | 22221068 | 12 |
| Key published (EscrowFinish); the article then failed its promise | [327B24A0…3A088ECD](https://testnet.xrpl.org/transactions/327B24A0937C55D72E1683EF01961216DC7EAC654BDF8929A9D3D6583A088ECD) | 22221070 | 423 |
| Refund, writer-signed (fixture writer cooperates) | [4539243E…D01AAECA](https://testnet.xrpl.org/transactions/4539243E17FF335BBF34BAB8C4E9B0FC4145D011845BE9960C70226BD01AAECA) | 22221072 | 12 |
| Escrow created, The Fab Floor | [B444BB4A…75FCA360](https://testnet.xrpl.org/transactions/B444BB4AB6198A3247A427F7FB213F3EAE63171B3E2E267EE613252B75FCA360) | 22221075 | 12 |
| Key published (EscrowFinish), sha256(K) = Condition ✓ | [D2D5F79E…BE32093D](https://testnet.xrpl.org/transactions/D2D5F79EF07E60083EBFF0A77FC98ADB4F570216C5C51B1418A13869BE32093D) | 22221078 | 423 |
| Answer anchor (AccountSet, memo = audit head) | [136E6843…C1C364B2](https://testnet.xrpl.org/transactions/136E6843E737627D4222944E56A105903884C2B0F0C1254890858EA8C1C364B2) | 22221080 | 12 |

All six were looked up read-only on `s.altnet.rippletest.net` on 11 Nov 2026:
`validated: true`, `tesSUCCESS`, with the types and fees above. The receipts of this run
are not committed; the README's re-checkable receipts are the earlier
[lane-b3 run](../lane-b3/UC3.receipts.json).
