import { llmConfig } from '../agents/llm.js'
import { Router } from 'express'
import { z } from 'zod'
import { performance } from 'node:perf_hooks'
import { compatibleJson, testCost, validateProviderUrl } from '../agents/compatible.js'
import { loopback } from '../admission.js'
import type { ActiveWork } from '../agents/active-work.js'
export function providersRouter(work: ActiveWork) {
  const router = Router()
  router.post('/api/providers/test', async (req, res) => {
    // admissionGuard already verifies the operator bearer; require one even on loopback.
    if (!process.env.RA_API_TOKEN || !req.get('Authorization') || !loopback(req.socket.remoteAddress?.replace(/^::ffff:/, '') ?? '')) return res.status(403).json({ ok: false, latencyMs: 0, error: { code: 'unauthorized', message: 'Local operator bearer required' } })
    const start = performance.now()
    const release = work.acquire()
    try {
      const input = z.object({ baseUrl: z.string().optional(), model: z.string().min(1).max(200).optional() }).strict().parse(req.body ?? {})
      const profile = { ...llmConfig(), ...(input.baseUrl ? { baseUrl: input.baseUrl } : {}), ...(input.model ? { model: input.model } : {}) }
      validateProviderUrl(profile.baseUrl)
      const result = await compatibleJson(profile, { instruction: 'Return {"ok":true}' }, work.signal)
      z.object({ ok: z.literal(true) }).parse(JSON.parse(result.choices?.[0]?.message?.content ?? ''))
      const usage = z.object({ prompt_tokens: z.number().int().nonnegative().optional(), completion_tokens: z.number().int().nonnegative().optional() }).parse(result.usage ?? {})
      res.json({ ok: true, latencyMs: performance.now() - start, inputTokens: usage.prompt_tokens, outputTokens: usage.completion_tokens, costUsd: testCost(usage.prompt_tokens, usage.completion_tokens) })
    } catch { res.json({ ok: false, latencyMs: performance.now() - start, error: { code: 'provider_unavailable', message: 'Provider test failed; check the configured profile.' } }) }
    finally { release() }
  })
  return router
}
