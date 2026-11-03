import { afterEach, expect, it, vi } from 'vitest'
import { lookup } from 'node:dns/promises'
vi.mock('node:dns/promises', () => ({ lookup: vi.fn() }))
import { compatibleFetch } from '../server/agents/compatible.js'
import { decide, FixtureDecisionProvider } from '../server/agents/decision.js'
import { JsonDecisionProvider } from '../server/agents/json-decision.js'
import { exampleCandidate } from '../shared/contracts/examples.js'
import { fixture } from './byok-fixture.js'
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs() })
it('rejects a reviewed hostname rebound to private/metadata before any socket', async () => {
  const resolve = vi.mocked(lookup)
  for (const address of ['127.0.0.1', '169.254.169.254', '10.0.0.1', '100.100.100.200', '192.168.1.1']) {
    resolve.mockResolvedValue({ address, family: 4 } as never)
    await expect(compatibleFetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { Authorization: 'Bearer synthetic' } })).rejects.toThrow('not public')
  }
  expect(lookup).toHaveBeenCalledTimes(5)
})
it('generic maximum confidence, Luna model name, threshold zero and calibration cannot buy', async () => {
  const f = await fixture()
  try {
    vi.stubEnv('DECISION_MODEL', 'gpt-6-luna'); vi.stubEnv('DECISION_CALIBRATION','on')
    const provider = new JsonDecisionProvider()
    const input = { question:'Question?', conclusion:'Unknown', gap:'Missing dates', candidates:[{...exampleCandidate, tier:'PAID' as const}], readSources:[], budgetMinor:200, spentMinor:0, reservedMinor:0, perSourceCapMinor:100, round:1, threshold:0, requirement:true, provider }
    const result = await decide(input)
    expect(result.selectedResourceId).toBeUndefined(); expect(result.calibration).toBeUndefined(); expect(result.rows.every(r => r.verdict !== 'BUY' && !r.wouldBuy && !r.calibrated)).toBe(true)
    expect(result.promptVersion).toContain('UNCALIBRATED')
    const bad = { ...provider, name:'compatible' as const, model:'gpt-6-luna', judgeRound:async()=>({gapMaterial:1}), judgeCandidate:async()=>({addressesGap:Infinity}) } as unknown as FixtureDecisionProvider
    await expect(decide({...input, provider:bad})).rejects.toThrow('unavailable')
  } finally { await f.close() }
})
