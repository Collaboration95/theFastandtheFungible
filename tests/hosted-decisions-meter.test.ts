import { afterEach, expect, it, vi } from 'vitest'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { resources } from './helpers/resource-scope.js'
import { Store } from '../server/store.js'
import { loadConfig } from '../server/config.js'
import { HostedLimits } from '../server/hosted/limits.js'
import { hostedExecution, meteredFetch } from '../server/hosted/execution.js'
import { DECISIONS_URL } from '../server/agents/openai-decisions.js'

// LIVE-DEC (11 Nov): OpenAI Decisions has no output-token parameter and answers HTTP 400 "Unknown parameter:
// 'max_output_tokens'" to one. The hosted meter added it to every decision request, so every live gpt-6-luna round on
// the hosted demo failed and bought nothing. The reservation must still hold the operator's output bound.
const closers: (() => void)[] = []
afterEach(() => { for (const close of closers.splice(0)) close(); vi.unstubAllEnvs() })
function setup() {
  vi.stubEnv('HOSTED', '1')
  const dir = resources().tempDir('live-dec-meter-'), control = join(dir, 'control.json')
  writeFileSync(control, JSON.stringify({ admissionsPaused: false, spendingPaused: false, reasonCode: 'test', expiresAt: '2026-11-19T16:00:00Z' }))
  const config = loadConfig({ HOSTED: '1', HOSTED_CONTROL_PATH: control, HOSTED_IP_HMAC_KEY: 'key'.repeat(12), HOSTED_DECISION_INPUT_USD_PER_MILLION: '0.25', HOSTED_DECISION_OUTPUT_USD_PER_MILLION: '1', HOSTED_DECISION_OUTPUT_TOKENS: '8192', HOSTED_RESEARCH_INPUT_USD_PER_MILLION: '0.4', HOSTED_RESEARCH_OUTPUT_USD_PER_MILLION: '1.6' })
  const store = new Store(join(dir, 'app.db')); closers.push(() => store.close())
  const limits = new HostedLimits(store, config)
  const hold = limits.reserve('visitor', 'key', 'question', '1.2.3.4', 200, 'submit', {})
  const sent: { url: string; body: Record<string, unknown> }[] = []
  let usage: object | undefined = { input_tokens: 900, output_tokens: 0 }
  const transport = async (url: string, init: RequestInit) => {
    sent.push({ url, body: JSON.parse(String(init.body)) as Record<string, unknown> })
    return new Response(JSON.stringify({ answers: [], ...(usage ? { usage } : {}) }), { headers: { 'Content-Type': 'application/json' } })
  }
  const call = (provider: 'decision' | 'research', url: string, body: unknown) => hostedExecution.run({ limits, holdId: hold.id, principal: 'visitor' }, async () => { await (await meteredFetch(transport, provider)(url, { method: 'POST', body: JSON.stringify(body) })).json() })
  const attempts = () => store.hostedState(db => db.prepare('SELECT provider, reserved, input_tokens, output_tokens FROM hosted_attempts ORDER BY id').all() as { provider: string; reserved: number; input_tokens: number; output_tokens: number }[])
  return { sent, call, attempts, withoutUsage: () => { usage = undefined } }
}

it('sends an OpenAI Decisions request without an output-token field, as built', async () => {
  const { sent, call } = setup()
  const request = { model: 'gpt-6-luna', input: '{"question":"q"}', questions: [{ name: 'gap_material', type: 'predicate', instructions: 'i' }] }
  await call('decision', DECISIONS_URL, request)
  expect(sent).toHaveLength(1)
  expect(sent[0].body).toEqual(request)
  expect(sent[0].body).not.toHaveProperty('max_output_tokens')
  expect(sent[0].body).not.toHaveProperty('max_tokens')
})

it('still reserves the operator output bound for a Decisions call, then settles on reported usage', async () => {
  const { call, attempts, withoutUsage } = setup()
  const body = { model: 'gpt-6-luna', input: 'x'.repeat(2000), questions: [] }
  // Reported usage (900 input, 0 output) replaces the reservation.
  await call('decision', DECISIONS_URL, body)
  // Without usage the conservative charge stands: input bytes + 1024 at US$0.25, the 8192-token output bound at US$1.00.
  withoutUsage()
  await call('decision', DECISIONS_URL, body)
  const input = Buffer.byteLength(JSON.stringify(body)) + 1024
  expect(attempts()).toEqual([
    { provider: 'decision', reserved: Math.ceil(900 * 0.25), input_tokens: 900, output_tokens: 0 },
    { provider: 'decision', reserved: Math.ceil(input * 0.25 + 8192 * 1), input_tokens: input, output_tokens: 8192 },
  ])
})

it('keeps the output ceiling for other decision endpoints and leaves research requests unchanged', async () => {
  const { sent, call } = setup()
  await call('decision', 'https://api.openai.com/v1/responses', { model: 'gpt-6-luna', input: 'q' })
  await call('decision', 'https://compatible.example/v1/chat/completions', { model: 'judge', messages: [] })
  await call('research', 'https://api.deepseek.com/chat/completions', { model: 'deepseek-flash', max_tokens: 3000, messages: [] })
  expect(sent.map(s => [s.body.max_output_tokens, s.body.max_tokens])).toEqual([[8192, undefined], [undefined, 8192], [undefined, 3000]])
})

it('still refuses a Decisions request over the hosted input allowance before dispatch', async () => {
  const { call, sent, attempts } = setup()
  await expect(call('decision', DECISIONS_URL, { model: 'gpt-6-luna', input: 'x'.repeat(50_000), questions: [] }))
    .rejects.toMatchObject({ code: 'question_token_cap' })
  expect(sent).toEqual([])
  expect(attempts()).toEqual([])
})
