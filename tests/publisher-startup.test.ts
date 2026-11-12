import { afterEach, expect, it, vi } from 'vitest'
import express from 'express'
import { createPublisherApp } from '../publisher/routes.js'
import { startPublisher } from '../publisher/server.js'
import { SIMULATED_LABEL, XRPL_LABEL } from '../shared/contracts/publisher.js'

vi.mock('../publisher/routes.js', () => ({ createPublisherApp: vi.fn() }))
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks() })

it('fails startup and closes the journal when the writer registry cannot load', async () => {
  vi.stubEnv('PUBLISHER_PORT', '0')
  const app = express()
  app.locals.ready = app.locals.writersReady = Promise.reject(new Error('Writer keys unavailable'))
  app.locals.journal = { close: vi.fn() }
  app.locals.closePublishing = vi.fn(async () => {})
  const listen = vi.spyOn(app, 'listen')
  vi.mocked(createPublisherApp).mockReturnValue(app)
  await expect(startPublisher()).rejects.toThrow('Writer keys unavailable')
  expect(listen).not.toHaveBeenCalled()
  expect(app.locals.journal.close).toHaveBeenCalledOnce()
  expect(app.locals.closePublishing).toHaveBeenCalledOnce()
})

it.each([['simulated', SIMULATED_LABEL], ['xrpl-testnet', XRPL_LABEL]])('labels startup for the %s rail', async (rail, label) => {
  vi.stubEnv('PUBLISHER_PORT', '0')
  vi.stubEnv('SETTLEMENT_RAIL', rail)
  const app = express()
  app.locals.ready = app.locals.writersReady = Promise.resolve()
  app.locals.journal = { close: vi.fn() }
  app.locals.closePublishing = vi.fn(async () => {})
  vi.mocked(createPublisherApp).mockReturnValue(app)
  const log = vi.spyOn(console, 'log').mockImplementation(() => {})
  const signals = ['SIGTERM', 'SIGINT'] as const
  const before = signals.map(signal => process.listeners(signal))
  const server = await startPublisher()
  try {
    expect(server.listening).toBe(true)
    expect(log).toHaveBeenCalledWith(expect.stringContaining(` · ${label}`))
  } finally {
    await new Promise<void>((done, reject) => server.close(error => error ? reject(error) : done()))
    signals.forEach((signal, i) => {
      for (const listener of process.listeners(signal)) if (!before[i].includes(listener)) process.removeListener(signal, listener)
    })
  }
})
