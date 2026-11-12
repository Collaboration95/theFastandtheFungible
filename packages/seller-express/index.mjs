import {createSeller} from '@researchagent/seller-core'
export function keyReveal(options){
  const seller=createSeller(options)
  const middleware=async(req,res)=>{
    const r=await seller.handle({buyer:req.query.buyer,intent:req.query.intent,paymentSignature:req.get('PAYMENT-SIGNATURE')})
    res.status(r.status).set(r.headers).json(r.body)
  }
  return {middleware,close:seller.close}
}
