import { z } from 'zod'
import { Router } from 'express'
import type { ApiContext } from './context.js'
import { DROPS_PER_MINOR, LedgerViewSchema, type LedgerView } from '../../shared/contracts/index.js'

export function walletRouter(context: ApiContext) {
  const router = Router()
  const { payer, client, store } = context
  // Read-only Testnet view for the ledger panel: public addresses, live balances, receipts per payee.
  let ledgerCache: { at: number; view: Promise<LedgerView> } | undefined
  const ledgerView = async (): Promise<LedgerView> => {
    if (!payer?.address) return { rail: 'simulated' }
    // Paid publishers are the registry entries with a wallet (#138).
    const publishers = (await client.registry()).filter(p => p.wallet).map(p => [p.wallet!, p.name] as const)
    const runs = store.listRuns()
    const receipts = runs.flatMap(run => run.receipts).filter(r => r.xrpl)
    const refundedDrops = (intentId: string) => (runs.flatMap(run => run.intents).find(i => i.intentId === intentId)?.refund?.amountMinor ?? 0) * DROPS_PER_MINOR
    const balance = async (address: string) => {
      try { return String((await payer.ledger.request({ command: 'account_info', account: address, ledger_index: 'validated' })).result.account_data.Balance) }
      catch { return null }
    }
    const wallet = async (role: 'buyer' | 'publisher', name: string, address: string) => {
      const mine = receipts.filter(r => (role === 'buyer' ? r.xrpl!.payer : r.xrpl!.payTo) === address)
      return { role, name, address, balanceDrops: await balance(address), receivedDrops: String(role === 'buyer' ? 0 : Math.max(0, mine.filter(r => !r.xrpl!.asset || r.xrpl!.asset === 'XRP').reduce((sum, r) => sum + Number(r.xrpl!.amountDrops) - refundedDrops(r.intentId), 0))), payments: mine.length }
    }
    return LedgerViewSchema.parse({ rail: 'xrpl-testnet', network: 'xrpl:1', accountExplorer: 'https://testnet.xrpl.org/accounts', updatedAt: new Date().toISOString(),
      wallets: await Promise.all([wallet('buyer', 'ResearchAgent (buyer)', payer.address), ...publishers.map(([address, name]) => wallet('publisher', name, address))]) })
  }
  router.get('/api/ledger', async (_req, res) => {
    if (!ledgerCache || Date.now() - ledgerCache.at > 5000) ledgerCache = { at: Date.now(), view: ledgerView() }
    try { res.json(await ledgerCache.view) } catch { ledgerCache = undefined; res.status(503).json({ error: 'Ledger view unavailable.' }) }
  })
  router.get('/api/wallet/status', (_req, res) => res.json({ ...store.walletStatus(), agents: store.agentKeys.list().map(key => store.agentStatus(key.id)) }))
  router.post('/api/wallet/pause', (req, res) => {
    store.setPaused(z.object({ paused: z.boolean() }).strict().parse(req.body).paused, { surface: 'operator', principal: 'api-token' })
    res.json(store.walletStatus())
  })
  return router
}
