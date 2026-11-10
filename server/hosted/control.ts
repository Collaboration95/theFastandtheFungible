import { readFileSync } from 'node:fs'
import type { Config } from '../config.js'
export type HostedControl = { admissionsPaused: boolean; spendingPaused: boolean; reasonCode: string; expiresAt: string }
export const closedControl: HostedControl = { admissionsPaused: true, spendingPaused: true, reasonCode: 'control_unavailable', expiresAt: '1970-01-01T00:00:00Z' }
/** Deliberately uncached: a pause is observed at every authority boundary. */
export function readControl(path: string, now = Date.now()): HostedControl {
  try {
    const c = JSON.parse(readFileSync(path, 'utf8')) as HostedControl
    if (typeof c.admissionsPaused !== 'boolean' || typeof c.spendingPaused !== 'boolean' || !/^[a-z0-9_-]{1,64}$/.test(c.reasonCode) || !Number.isFinite(Date.parse(c.expiresAt)) || Date.parse(c.expiresAt) <= now) return closedControl
    return c
  } catch { return closedControl }
}
export function hostedControl(config: Config) { return readControl(config.HOSTED_CONTROL_PATH || 'data/hosted-control.json') }
export class HostedError extends Error {
  constructor(readonly status: number, readonly code: string) { super(code) }
}
export function requireSpending(config: Config) { if (hostedControl(config).spendingPaused) throw new HostedError(503, 'spending_paused') }
export function requireAdmissions(config: Config, now = Date.now()) {
  if (now >= Date.parse(config.HOSTED_ADMISSIONS_UNTIL || '2026-11-19T16:00:00Z')) throw new HostedError(503, 'ended')
  const control = hostedControl(config)
  if (control.admissionsPaused || control.spendingPaused) throw new HostedError(503, 'paused')
}
