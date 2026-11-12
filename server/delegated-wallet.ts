import { randomBytes } from 'node:crypto'
import { Router, type Response } from 'express'
import { deriveAddress, verify } from 'ripple-keypairs'
import { z } from 'zod'
import type { ApiContext } from './api/context.js'
import type { Ledger } from '../shared/xrpl.js'
import { loadConfig } from './config.js'

/** A ledger grant never replaces application policy or proof of visitor identity. */
export async function hasEscrowDelegation(ledger: Ledger, owner: string, delegate: string) {
  let marker: unknown
  for (let page = 0; page < 10; page++) {
    const { result } = await ledger.request({ command: 'account_objects', account: owner, type: 'delegate', ledger_index: 'validated', limit: 200, ...(marker ? { marker } : {}) })
    if (result.account_objects?.some((d: { Authorize?: string; Permissions?: { Permission: { PermissionValue: string } }[] }) =>
      d.Authorize === delegate && d.Permissions?.length === 1 && d.Permissions[0].Permission.PermissionValue === 'EscrowCreate')) return true
    marker = result.marker
    if (!marker) return false
  }
  return false
}
export function delegatedWallets(context: ApiContext) {
  const router = Router(), bindings = new Map<string, string>(), challenges = new Map<string, { message: string; until: number }>()
  const principal = (res: Response): string => res.locals.hostedSession?.principal ?? res.locals.agent?.id ?? 'operator'
  const enabled = () => loadConfig().WALLET_MODE === 'delegated' && !!context.payer?.address
  router.get('/api/wallet/delegation', (_req, res) => res.json({ enabled: enabled(), agent: enabled() ? context.payer!.address : undefined, address: bindings.get(principal(res)) }))
  router.post('/api/wallet/delegation/challenge', (_req, res) => {
    if (!enabled()) return res.sendStatus(404)
    for (const [key, c] of challenges) if (c.until < Date.now()) challenges.delete(key)
    if (challenges.size >= 5000) return res.sendStatus(429)
    const message = Buffer.from(`researchagent:Testnet:wallet-binding:${context.payer!.address}:${randomBytes(32).toString('hex')}`).toString('hex').toUpperCase()
    challenges.set(principal(res), { message, until: Date.now() + 120000 }); res.json({ message })
  })
  router.post('/api/wallet/delegation/connect', async (req, res) => {
    if (!enabled()) return res.sendStatus(404)
    const input = z.object({ address: z.string().max(40), publicKey: z.string().max(70), signature: z.string().max(160) }).strict().parse(req.body)
    const key = principal(res), c = challenges.get(key); challenges.delete(key)
    let valid = false
    try { valid = !!c && c.until >= Date.now() && deriveAddress(input.publicKey) === input.address && verify(c.message, input.signature, input.publicKey) } catch { /* bad proof */ }
    if (!valid) return res.sendStatus(403)
    if (!(await hasEscrowDelegation(context.payer!.ledger, input.address, context.payer!.address!))) return res.status(409).json({ error: 'EscrowCreate delegation is not active.' })
    if (bindings.size >= 5000 && !bindings.has(key)) return res.sendStatus(429)
    bindings.set(key, input.address); res.json({ address: input.address })
  })
  router.post('/api/wallet/delegation/disconnect', (_req, res) => { bindings.delete(principal(res)); res.json({ disconnected: true }) })
  return { router, bindRun(res: Response, runId: string) {
    if (loadConfig().WALLET_MODE !== 'delegated') return
    const address = bindings.get(principal(res))
    if (!address) throw new Error('Connect your Testnet wallet before asking.')
    const run = context.store.getRun(runId)
    context.store.updateRun(runId, { checkpoint: { ...run.checkpoint, delegatedOwner: address } })
  }, requireBinding(res: Response) {
    if (loadConfig().WALLET_MODE === 'delegated' && !bindings.has(principal(res))) throw new Error('Connect your Testnet wallet before asking.')
  } }
}
