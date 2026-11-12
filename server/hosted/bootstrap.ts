import express from 'express'
import { isIP } from 'node:net'
import { Wallet, type Transaction } from 'xrpl'
import type { Config } from '../config.js'
import { testnetLedger } from '../../shared/xrpl.js'
import { XrplPayer } from '../xrpl.js'
import { requireSpending } from './control.js'
export function validateHosted(config: Config) {
  const origin = new URL(config.HOSTED_ORIGIN || '')
  if (origin.protocol !== 'https:' || origin.origin !== config.HOSTED_ORIGIN || origin.username || origin.password) throw new Error('Hosted origin must be an exact HTTPS origin')
  if (!config.HOSTED_IP_HMAC_KEY || config.HOSTED_IP_HMAC_KEY.length < 32 || !isIP(config.HOSTED_TRUSTED_PROXY || '')) throw new Error('Hosted proxy and HMAC key required')
  const end = Date.parse(config.HOSTED_ADMISSIONS_UNTIL || '2026-11-19T16:00:00Z')
  if (!Number.isFinite(end) || end > Date.parse('2026-11-19T16:00:00Z')) throw new Error('Invalid admissions deadline')
  const minor = Number(config.HOSTED_QUESTION_CAP_MINOR ?? 200)
  if (!Number.isSafeInteger(minor) || minor < 0 || minor > 200) throw new Error('Invalid hosted question cap')
  if (config.SEARCH_EMBEDDINGS === 'live' && config.EMBEDDING_PROVIDER !== 'local') throw new Error('Hosted remote embedding attempts are not qualified; use keyword discovery')
  if (config.LLM_PROVIDER === 'openai-compatible' || config.DECISION_PROVIDER === 'compatible') throw new Error('Hosted providers must use qualified bounded profiles')
}
export function hostedPayer(config: Config) {
  if (config.SETTLEMENT_RAIL !== 'xrpl-testnet' || !config.XRPL_PAYER_SEED) return undefined
  const wallet = Wallet.fromSeed(config.XRPL_PAYER_SEED), sign = wallet.sign.bind(wallet)
  // Synchronous check immediately before cryptographic signing, after all RPC awaits.
  wallet.sign = ((tx: Transaction, ...args: []) => { if (tx.TransactionType !== 'EscrowCancel') requireSpending(config); return sign(tx,...args) }) as typeof wallet.sign
  return new XrplPayer(testnetLedger(),wallet)
}
export function pausedShell() {
  const app = express()
  const body = {questionCapMinor:0,state:'paused',capabilities:{ask:false,scope:false,history:false,receipts:false,pdf:false,settings:false,faultControls:false},remaining:{questions:0,minor:0},labels:{models:'unavailable',rail:'Shared XRPL Testnet demo · no real value'},links:{repo:'https://github.com/Collaboration95/theFastandtheFungible',deck:'',video:'',progress:'',replay:'https://collaboration95.github.io/theFastandtheFungible/demo/'}}
  app.disable('x-powered-by')
  app.use((_req,res,next)=>{res.set('Cache-Control','no-store');next()})
  app.get('/livez',(_req,res)=>res.json({status:'ok'}))
  app.get(['/startupz','/readyz'],(_req,res)=>res.status(503).json({status:'paused'}))
  app.get('/api/demo/status',(_req,res)=>res.json(body))
  app.use((_req,res)=>res.status(503).json({error:'The shared Testnet demo is paused.',...body}))
  return app
}
