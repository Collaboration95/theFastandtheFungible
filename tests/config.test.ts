import { expect, it } from 'vitest'
import { loadConfig } from '../server/config.js'

it('validates config by variable name without exposing values', () => {
  for (const [name, value] of Object.entries({ PORT: '70000', BUY_THRESHOLD: '2',
    MCP_MAX_BUDGET_MINOR: '-1', MCP_DAILY_CAP_MINOR: '9007199254740992',
    RA_BACKEND_URL: 'credential-bearing-invalid-url', CLEF_TIMEOUT_MS: 'secret-timeout' })) {
    try { loadConfig({ [name]: value }); throw new Error('accepted invalid config') }
    catch (error) { expect((error as Error).message).toBe(`Invalid configuration: ${name}`) }
  }
})
it('preserves empty strings, aliases and publisher-specific variables', () => {
  const env = { LLM_API_KEY: '', DEEPSEEK_API_KEY: 'test-only', GROQ_API_KEY: 'legacy',
    CLEF_TIMEOUT_MS: '', DECISION_TIMEOUT_MS: '1500', XRPL_PUBLISHER_TEST_SEED: 'test-only' }
  expect(loadConfig(env)).toEqual(env)
  expect(loadConfig({})).toEqual({})
})

import { parseCommand, resolveStartup } from '../shared/startup-plan.js'
it('resolves sanitized plans with operator-only caps and explicit port precedence', () => {
  const env = { NODE_ENV: 'test', XDG_STATE_HOME: '/tmp/startup-test', MCP_MAX_BUDGET_MINOR: '100', RA_API_TOKEN: 'private-test-token', XRPL_PAYER_SEED: 'private-test-seed' }
  const plan = resolveStartup(env, parseCommand(['app', '--testnet', '--port', '1234']))
  expect(plan.ports.web).toBe(1234)
  expect(plan.stateDir).toBe('/tmp/startup-test/researchagent/testnet/app')
  expect(plan.caps.maxMinor).toBe(100)
  expect(JSON.stringify(plan)).not.toContain('private-test')
  expect(resolveStartup({ NODE_ENV: 'test' }, parseCommand(['--http'])).ports.http).toBe(0)
  expect(resolveStartup({}, parseCommand([])).caps).toMatchObject({ maxMinor: 0, dailyMinor: 0 })
  expect(() => parseCommand(['app', '--iou'])).toThrow('--iou requires --testnet')
  expect(() => parseCommand(['app', '--budget', '500'])).toThrow()
})
