// Generated from shared/presentation.ts. Run node scripts/site-presentation.mjs; do not edit.
const buyingLabels = { fixture: "rule-based buying", live: "model-judged buying" };
const money = (minor) => `S$${(minor / 100).toFixed(2)}`;
const ENV = {
  testnet: "XRPL Testnet demo \xB7 no real value",
  testnetShort: "Testnet demo \xB7 no real value",
  simulated: "Simulated demo \xB7 fixture models \xB7 no real value",
  simulatedShort: "Simulated \xB7 no real value",
  simulatedReceipt: "Simulated payment \xB7 no ledger entry",
  hosted: "Shared XRPL Testnet demo \xB7 live answers, rule-based buying \xB7 no real value",
  hostedSimulated: "Shared demo \xB7 simulated payments \xB7 fixture models \xB7 no real value",
  // A status chip describes configuration; answer provenance belongs to the recorded run.
  hostedConfigured: (testnet, buying) => `Shared ${testnet ? "XRPL Testnet demo" : "demo \xB7 simulated payments"} \xB7 ${buyingLabels[buying]} \xB7 no real value`,
  writers: "fictional writers and labelled team-authored notes",
  hostedWriters: "team-authored writers",
  localSimulated: (models) => `Simulated demo \xB7 ${models} \xB7 no real value`,
  localTestnet: (models) => `XRPL Testnet demo \xB7 ${models} \xB7 no real value`,
  replay: (date, testnet = true) => `Replay \xB7 ${testnet ? "XRPL Testnet" : "simulated payments"}, recorded ${date} \xB7 fictional writers \xB7 no real value`,
  replayShort: (testnet = true) => testnet ? "Replay \xB7 Testnet demo" : "Replay \xB7 Simulated demo"
};
const shortTx = (hash) => hash.length > 16 ? `${hash.slice(0, 8)}\u2026${hash.slice(-8)}`.toUpperCase() : hash.toUpperCase();
const dateSGT = (iso) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Singapore" }).format(new Date(iso));
const whenSGT = (iso) => `${dateSGT(iso)}, ${new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Singapore" }).format(new Date(iso))} SGT`;
export {
  ENV,
  buyingLabels,
  dateSGT,
  money,
  shortTx,
  whenSGT
};
