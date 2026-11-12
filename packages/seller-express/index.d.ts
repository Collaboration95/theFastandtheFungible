import type {RequestHandler} from 'express'
import type {SellerOptions} from '@researchagent/seller-core'
export type {SellerOptions} from '@researchagent/seller-core'
export function keyReveal(options:SellerOptions):{middleware:RequestHandler;close():void}
