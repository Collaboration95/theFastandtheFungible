import { json, assert } from './common.mjs'
const e=json('docs/evidence/escrow-273.json')
const create=e.transactions.find(t=>t.operation==='create' && t.intentId==='escrow-273:cancel')
const cancel=e.transactions.find(t=>t.operation==='cancel')
assert.ok(create && cancel); assert.equal(create.createSequence,cancel.createSequence)
assert.ok(cancel.ledgerDate-create.ledgerDate>=120)
assert.equal(cancel.buyerBalanceChangeDrops,Number(create.amountDrops)-Number(cancel.feeDrops))
console.log('Historical evidence replay: explicit EscrowCancel after 120 s returns principal minus fee. No fresh expiry or payment experiment.')
