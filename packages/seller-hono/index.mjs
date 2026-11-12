import {createSeller} from '@researchagent/seller-core'
export function keyReveal(options){
  const seller=createSeller(options)
  const middleware=async c=>{
    const r=await seller.handle({buyer:c.req.query('buyer'),intent:c.req.query('intent'),paymentSignature:c.req.header('PAYMENT-SIGNATURE')})
    return c.json(r.body,r.status,r.headers)
  }
  return {middleware,close:seller.close}
}
