import type {Handler} from 'hono'
import type {SellerOptions} from '@researchagent/seller-core'
export type {SellerOptions} from '@researchagent/seller-core'
export function keyReveal(options:SellerOptions):{middleware:Handler;close():void}
