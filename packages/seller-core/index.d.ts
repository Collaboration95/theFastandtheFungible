import type {Client,Wallet} from 'xrpl'
export interface Envelope {ciphertext:string;iv:string;tag:string;plaintextHash:string}
export interface Requirements {scheme:'key-reveal-escrow';network:'xrpl:1';asset:'XRP';amount:string;payTo:string;maxTimeoutSeconds:number;extra:{invoiceId:string;buyer:string;condition:string;cancelAfter:number}}
export interface Offer {x402Version:2;resource:{url:string};accepts:[Requirements];extensions:{keyReveal:Envelope}}
export interface SellerOptions {client:Client;wallet:Wallet;dbPath:string;resourceUrl:string;content:(intent:string)=>string|Uint8Array|Promise<string|Uint8Array>;amountDrops?:string;maxOffers?:number;timeoutSeconds?:number;withhold?:boolean}
export interface SellerRequest {buyer:string;intent:string;paymentSignature?:string}
export interface SellerReply {status:number;headers:Record<string,string>;body:unknown}
export function createSeller(options:SellerOptions):{handle(request:SellerRequest):Promise<SellerReply>;close():void}
export function conditionFor(key:Uint8Array):string
export function commitment(offer:Offer):string
export function seal(content:Uint8Array):{key:Buffer;envelope:Envelope}
export function open(envelope:Envelope,finish:{Condition:string;Fulfillment:string},condition:string):Buffer
export function checkCreate(tx:Record<string,unknown>,offer:Offer):void
export function encodeHeader(value:unknown):string
export function decodeHeader<T = unknown>(value:string):T
