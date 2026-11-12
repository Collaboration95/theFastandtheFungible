import type {SellerOptions} from '@researchagent/seller-core'
export function testnetPurchase(serve:(options:SellerOptions)=>Promise<{url:string;close:()=>void|Promise<void>}>):Promise<void>
