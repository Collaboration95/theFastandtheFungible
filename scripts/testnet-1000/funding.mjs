// The helper funds 15 peer accounts with 6 XRP each from a 100 XRP faucet grant.
// Return 4.2 XRP from one writer (which keeps 1.8 XRP), then give each payer 1 XRP.
// This leaves all eight payers at least 7 XRP and funds up to 1,100 x 40-minor buys.
export const fundingPlan = { writerToBuyerDrops: '4200000', buyerToPayerDrops: '1000000' }
