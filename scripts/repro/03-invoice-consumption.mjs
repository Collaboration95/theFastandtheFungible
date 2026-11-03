import { read, assert } from './common.mjs'
import { runInNewContext } from 'node:vm'
const source=read('node_modules/x402-xrpl/dist/express.js')
const start=source.indexOf('var InMemoryInvoiceStore = class')
const end=source.indexOf('var UsageMeter',start)
assert.ok(start>=0 && end>start)
const Store=runInNewContext(source.slice(start,end)+'; InMemoryInvoiceStore')
const store=new Store(); store.put('invoice',{amount:'1000'},{ttlSeconds:60})
assert.ok(store.get('invoice')); store.consume('invoice'); assert.equal(store.get('invoice'),undefined)
assert.ok(source.includes('invoiceStore.consume(invoiceId)'))
console.log('Pinned 0.3.4 default store loses consumed requirements: no settlement/delivery replay record. Offline store reproduction, no signing.')
