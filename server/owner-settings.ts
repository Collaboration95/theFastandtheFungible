import { Router } from 'express'
import { randomBytes } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { z } from 'zod'
import type { ApiContext } from './api/context.js'
import { receiptBundle } from './receipt-bundle.js'
import { loadConfig } from './config.js'
import { loopback } from './admission.js'
import pkg from '../package.json' with { type: 'json' }

import { OwnerSettings } from './owner-config.js'
export { OwnerSettings } from './owner-config.js'
const accounts = ['LLM_API_KEY', 'DEEPSEEK_API_KEY', 'OPENAI_API_KEY', 'CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'] as const
export function ownerSettingsRouter({ store, payer }: ApiContext) {
  const router = Router(), csrf = randomBytes(32).toString('hex'), config = loadConfig()
  const file = resolve(config.RA_DATA_DIR || dirname(config.APP_DB || 'data/app.db'), 'owner-settings.json')
  const values = () => ({ MCP_MAX_BUDGET_MINOR: Number(config.MCP_MAX_BUDGET_MINOR ?? 0), MCP_DAILY_CAP_MINOR: Number(config.MCP_DAILY_CAP_MINOR ?? 0), WALLET_DAILY_CAP_MINOR: Number(config.WALLET_DAILY_CAP_MINOR ?? 2000), SETTLEMENT_RAIL: config.SETTLEMENT_RAIL === 'xrpl-testnet' ? 'xrpl-testnet' : 'simulated', ESCROW_MODE: config.ESCROW_MODE || 'key-reveal', ESCROW_ASSET: config.ESCROW_ASSET || 'XRP', ANCHOR_RAIL: config.ANCHOR_RAIL || 'xrpl-testnet' })
  let pending: Record<string, unknown> = {}
  try { pending = OwnerSettings.partial().parse(JSON.parse(readFileSync(file, 'utf8'))) } catch { /* Missing or invalid settings never grant authority. */ }
  // Browser metadata is forwarded only by the local UI proxy. Agent bearers never acquire owner authority.
  router.use('/api/settings', (req, res, next) => {
    const origin = (req.get('Origin') || req.get('X-Settings-UI')), expected = config.RA_WEB_ORIGIN || req.get('X-Settings-UI') || `http://${req.get('Host')}`
    let localOrigin = false
    try { localOrigin = Boolean(origin && new URL(origin).protocol === 'http:' && loopback(new URL(origin).hostname)) } catch { /* deny malformed origin */ }
    if (!localOrigin || res.locals.agent || !loopback(req.socket.remoteAddress?.replace(/^::ffff:/, '') || '') || origin !== expected || req.get('Sec-Fetch-Site') !== 'same-origin') return void res.sendStatus(403)
    if (req.method !== 'GET' && req.get('X-Settings-CSRF') !== csrf) return void res.sendStatus(403)
    next()
  })
  router.get('/api/settings', (_req, res) => res.json({ values: { ...values(), ...pending }, csrf, version: pkg.version, storage: dirname(file), restartRequired: Object.keys(pending).length > 0,
    runs: store.listRuns().map(r => ({runId:r.runId, question:r.question})), keys: Object.fromEntries(accounts.map(k => [k, config[k] ? '••••••••' : 'Not configured'])) }))
  router.post('/api/settings', (req, res) => {
    const parsed = OwnerSettings.safeParse(req.body)
    if (!parsed.success) return void res.status(400).json({ error: 'Invalid settings' })
    // Durable audit before saving. No active run is granted additional authority by this write.
    store.audit.append({ kind: 'policy', surface: 'owner-ui', principal: 'human', data: { action: 'settings-save', before: values(), after: parsed.data, applies: 'restart' } })
    mkdirSync(dirname(file), { recursive: true, mode: 0o700 })
    writeFileSync(file + '.tmp', JSON.stringify(parsed.data), { mode: 0o600 }); renameSync(file + '.tmp', file)
    pending = parsed.data
    res.json({ saved: true, restartRequired: true })
  })
  router.post('/api/settings/prompt-budget', (req, res) => {
    const parsed = z.object({ budgetMinor: z.number().int().min(0).max(500), universal: z.boolean() }).strict().safeParse(req.body)
    if (!parsed.success) return void res.sendStatus(400)
    store.audit.append({ kind: 'policy', surface: 'owner-ui', principal: 'human', data: { action: 'prompt-budget-change', ...parsed.data } }); res.json({ saved: true })
  })
  router.post('/api/settings/key', (req, res) => {
    const parsed = z.object({ account: z.enum(accounts), value: z.string().trim().min(1).max(4096) }).strict().safeParse(req.body)
    if (!parsed.success) return void res.status(400).json({ error: 'Invalid credential' })
    // Preserve the local app's existing environment storage; never create a second credential store.
    const credentials = resolve(config.DOTENV_CONFIG_PATH || '.env')
    let source: string
    try { source = readFileSync(credentials,'utf8') } catch { return void res.status(409).json({error:'Configure credentials in the launcher environment, then restart.'}) }
    if (/[\r\n]/.test(parsed.data.value)) return void res.sendStatus(400)
    const line = parsed.data.account + '=' + JSON.stringify(parsed.data.value)
    const pattern = new RegExp('^(?:export\\s+)?' + parsed.data.account + '\\s*=.*$', 'gm')
    source = pattern.test(source) ? source.replace(pattern, () => line) : source + '\n' + line + '\n'
    writeFileSync(credentials + '.tmp', source, { mode:0o600 }); renameSync(credentials + '.tmp', credentials)
    store.audit.append({ kind: 'policy', surface: 'owner-ui', principal: 'human', data: { action: 'provider-key-replaced', provider: parsed.data.account.replace('_API_KEY','').replace('_API_TOKEN','') } })
    res.json({ saved: true, restartRequired: true })
  })
  router.get('/api/settings/receipts/:id', (req, res) => {
    try { res.json(receiptBundle(store, req.params.id)) } catch { res.sendStatus(404) }
  })
  router.get('/api/settings/runs', (_req, res) => res.json(store.listRuns().map(r=>({runId:r.runId, question:r.question}))))
  router.post('/api/settings/faucet', async (_req, res) => {
    const address = contextAddress()
    if (!address) return void res.status(409).json({ error: 'Configure a Testnet wallet first' })
    try { const response = await fetch('https://faucet.altnet.rippletest.net/accounts', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({destination:address}), signal: AbortSignal.timeout(15000) }); if (!response.ok) throw Error('Faucet unavailable'); res.json({ funded:true, address }) } catch { res.status(503).json({error:'Testnet faucet unavailable'}) }
  })
  router.get('/api/settings/export', (_req, res) => res.json({ label: 'Owner data export; includes granted research content', runs: store.listRuns().map(r => receiptBundle(store, r.runId)), audit: store.auditEntries() }))
  router.post('/api/settings/reset', (req, res) => {
    if (req.body?.confirmation !== 'RESET SETTINGS') return void res.sendStatus(400)
    // Reset preferences only: payment journals must survive uncertain settlement.
    store.audit.append({ kind: 'policy', surface: 'owner-ui', principal: 'human', data: { action: 'settings-reset' } })
    writeFileSync(file, '{}', { mode: 0o600 }); pending = {}; res.json({ saved: true, restartRequired: true })
  })
  function contextAddress() { return payer?.address }
  return router
}
