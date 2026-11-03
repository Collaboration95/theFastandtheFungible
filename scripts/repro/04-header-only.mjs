import { assert } from './common.mjs'
import { x402Fetch } from 'x402-xrpl'
let calls=0, signs=0
const challenge={x402Version:2,accepts:[{scheme:'exact',network:'xrpl:1',asset:'XRP',amount:'1000',payTo:'rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV',maxTimeoutSeconds:60}]}
const buyer=x402Fetch({network:'xrpl:1',fetchImpl:async()=>{calls++;return new Response(null,{status:402,headers:{'PAYMENT-REQUIRED':Buffer.from(JSON.stringify(challenge)).toString('base64')}})},paymentHeaderFactory:async()=>{signs++;throw Error('must not sign')}})
const response=await buyer('https://offline.invalid/article')
assert.equal(response.status,402);assert.equal(calls,1);assert.equal(signs,0)
console.log('Pinned 0.3.4 returns unpaid 402 for header-only v2 challenge; mocked transport, no wallet.')
