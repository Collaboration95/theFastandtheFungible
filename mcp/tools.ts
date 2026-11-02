import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { RunSnapshotSchema, type RunSnapshot } from '../shared/contracts/run.js'
import { articleUrl } from '../shared/contracts/manifest.js'

const corpusLabel = 'SYNTHETIC · fictional writers and articles'

export function presentRun(run: RunSnapshot, publisherUrl: string) {
  const answer = run.answers.at(-1) ?? null
  const citations = answer?.claims.flatMap(claim => claim.citations.map(citation => {
    const content = run.contents.find(c => c.resourceId === citation.resourceId && c.version === citation.version && c.spans.some(p => p.id === citation.spanId))
    if (!content) throw new Error('Citation has no delivered passage')
    const candidate = run.candidates.find(c => c.profileId === content.profileId && c.resourceId === content.resourceId && c.version === content.version)
    const grant = run.grants.find(g => g.resourceId === content.resourceId && g.version === content.version && run.intents.some(i => i.intentId === g.intentId && i.status === 'VERIFIED'))
    if (!candidate || (candidate.tier !== 'FREE' && !grant)) throw new Error('Citation has no verified grant')
    return { ...citation, claimId: claim.id, writer: content.publisher, passage: content.spans.find(p => p.id === citation.spanId)!.text, url: new URL(articleUrl(content.profileId, content.resourceId, citation.spanId), publisherUrl).href, grantIntentId: grant?.intentId ?? null }
  })) ?? []
  return { run_id: run.runId, phase: run.phase, corpusLabel, labels: run.labels, budgetMinor: run.budgetMinor, spentMinor: run.spentMinor, answer, citations,
    purchases: run.intents.map(intent => {
      const receipt = run.receipts.find(r => r.intentId === intent.intentId)
      return { intentId: intent.intentId, resourceId: intent.resourceId, writer: run.candidates.find(c => c.profileId === intent.profileId && c.resourceId === intent.resourceId)?.publisher ?? intent.profileId,
        priceMinor: intent.amountMinor, status: intent.status, verified: intent.status === 'VERIFIED', refunded: intent.status === 'REFUNDED', txHash: receipt?.xrpl?.txHash ?? null, explorerUrl: receipt?.xrpl?.explorerUrl ?? null, label: receipt?.label ?? run.labels.settlement }
    }) }
}

export function createMcpServer(apiUrl: string) {
  const server = new McpServer({ name: 'research-agent', version: '0.1.0' }, { instructions: 'Search writers for public metadata. Ask questions within the operator cap; only engine policy can purchase. Preserve all fixture and settlement labels and cite returned passage URLs.' })
  const request = async (path: string, body?: unknown): Promise<unknown> => {
    const response = await fetch(new URL(path, apiUrl), { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'error', signal: AbortSignal.timeout(15_000) })
    if (!response.ok) throw new Error(`Backend rejected command (${response.status})`)
    return response.json()
  }
  const statusSchema = z.object({ labels: z.record(z.string(), z.string()), corpusLabel: z.string(), publisherUrl: z.url(), maxMinor: z.number(), dailyMinor: z.number(), spentMinor: z.number(), reservedMinor: z.number(), rail: z.string(), payerAddress: z.string().nullable() })
  const status = async () => statusSchema.parse(await request('/api/mcp/status'))
  const result = (data: Record<string, unknown>) => ({ content: [{ type: 'text' as const, text: JSON.stringify(data) }], structuredContent: data })
  const guarded = async (action: () => Promise<Record<string, unknown>>) => {
    try { return result(await action()) }
    catch { return { ...result({ error: 'ResearchAgent command failed. Check backend availability, arguments and idempotency key. No automatic retry of a new purchase.', labels: ['mode unavailable; no evidence returned'] }), isError: true } }
  }
  server.registerTool('search_expertise', { description: 'Search all registered writers for expertise. Free: returns public title, writer, tier, price in SGD cents, abstract, relevance and article URL; never bodies or passages. Preserve the mode labels.', inputSchema: z.object({ query: z.string().trim().min(1).max(2000), k: z.number().int().min(1).max(50).optional() }).strict(), annotations: { readOnlyHint: true, openWorldHint: true } }, async args => guarded(async () => await request(`/api/mcp/search?${new URLSearchParams({ query: args.query, k: String(args.k ?? 10) })}`) as Record<string, unknown>))
  server.registerTool('ask_expert', { description: 'Research a question and return a cited answer, delivered citation passages, purchases and mode labels. budget_sgd is a request, never authorization: the engine clamps it to human-configured per-call and daily SGD caps (default zero). Only deterministic policy picks and pays. Set a stable idempotency_key for retries; reuse it to retrieve the same run without another charge. No clarification prompts. If still running, use get_run with the returned run_id.', inputSchema: z.object({ question: z.string().trim().min(1).max(2000), budget_sgd: z.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER / 100), idempotency_key: z.string().min(1).max(200).optional() }).strict(), annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } }, async args => guarded(async () => {
    const mode = await status()
    let run = RunSnapshotSchema.parse(await request('/api/mcp/runs', { ...args, clarify: 'never' }))
    const deadline = Date.now() + 45_000
    for (let delay = 25; !['DONE', 'STOPPED', 'FAILED'].includes(run.phase) && Date.now() < deadline; delay = Math.min(delay * 2, 1000)) {
      await new Promise(done => setTimeout(done, delay))
      run = RunSnapshotSchema.parse(await request(`/api/mcp/runs/${encodeURIComponent(run.runId)}`))
    }
    const requestedMinor = Math.floor(args.budget_sgd * 100 + 1e-7)
    return { ...presentRun(run, mode.publisherUrl), requestedBudgetMinor: requestedMinor, clamped: run.budgetMinor < requestedMinor, humanMaxBudgetMinor: mode.maxMinor, humanDailyCapMinor: mode.dailyMinor }
  }))
  server.registerTool('get_run', { description: 'Read an existing MCP run and its cited answer, delivered citation passages, purchases and mode labels. Does not start a run or authorize spending.', inputSchema: z.object({ run_id: z.string().uuid() }).strict(), annotations: { readOnlyHint: true, openWorldHint: false } }, async args => guarded(async () => {
    const mode = await status()
    return presentRun(RunSnapshotSchema.parse(await request(`/api/mcp/runs/${encodeURIComponent(args.run_id)}`)), mode.publisherUrl)
  }))
  server.registerTool('wallet_status', { description: 'Read settlement rail, public payer address, operator per-call and daily caps, gross SGD spend and reserved budgets for the UTC day. Never returns seeds, signing keys or other credentials. No spending.', inputSchema: z.object({}).strict(), annotations: { readOnlyHint: true, openWorldHint: false } }, async () => guarded(async () => {
    const { publisherUrl: _publisherUrl, ...mode } = await status()
    return { ...mode, day: new Date().toISOString().slice(0, 10), remainingMinor: Math.max(0, mode.dailyMinor - mode.spentMinor - mode.reservedMinor) }
  }))
  return server
}
