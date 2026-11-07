// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import OwnerSettings from '../src/components/OwnerSettings'

const values = { MCP_MAX_BUDGET_MINOR: 0, MCP_DAILY_CAP_MINOR: 0, WALLET_DAILY_CAP_MINOR: 500, SETTLEMENT_RAIL: 'simulated', ESCROW_MODE: 'payment', ESCROW_ASSET: 'XRP', ANCHOR_RAIL: 'off' }
afterEach(() => { cleanup(); vi.unstubAllGlobals(); history.replaceState(null, '', '/') })
function backend(status = 200) {
  const calls: { path: string; init?: RequestInit }[] = []
  vi.stubGlobal('fetch', vi.fn(async (path: string, init?: RequestInit) => {
    calls.push({ path, init })
    const code = init?.method === 'POST' ? status : 200
    const body = path === '/api/settings' ? { values, csrf: 'synthetic-csrf', keys: { DEEPSEEK_API_KEY: '••••••••' }, version: '1.0.0-rc.2' }
      : path === '/api/ledger' ? { rail: 'xrpl-testnet', wallets: [{ role: 'buyer', address: 'synthetic-address', balanceDrops: null }, { name: 'Synthetic publisher', address: 'synthetic-funded', balanceDrops: '1000000' }, { address: 'synthetic-unnamed', balanceDrops: null }] }
      : path === '/api/writers/status' ? { publishers: [{ name: 'Synthetic writer', credential: { status: 'unverified' } }, { name: 'No credential writer' }] } : { saved: true }
    return { ok: code < 400, status: code, json: async () => body }
  }))
  return calls
}
async function open(section: string) {
  await screen.findByText('Only you can change these settings. Policy code remains the spending authority.')
  fireEvent.click(within(screen.getByRole('navigation', { name: 'Settings sections' })).getByRole('button', { name: section }))
}

it('saves owner limits with CSRF and reports that restart is required', async () => {
  const calls = backend(); render(<OwnerSettings />); await open('Budget and limits')
  fireEvent.change(screen.getByLabelText('Per-call cap'), { target: { value: '125' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save settings' }))
  await screen.findByText('Saved and audited. Restart the app to apply configuration changes.')
  const saved = calls.find(c => c.init?.method === 'POST')!
  expect(saved.path).toBe('/api/settings')
  expect(saved.init?.headers).toMatchObject({ 'X-Settings-CSRF': 'synthetic-csrf', 'X-Settings-UI': location.origin })
  expect(JSON.parse(String(saved.init?.body))).toEqual({ ...values, MCP_MAX_BUDGET_MINOR: 125 })
})

it.each([403, 503])('clears transient credentials even when save is refused (%s)', async status => {
  const calls = backend(status); render(<OwnerSettings />); await open('Models')
  const input = screen.getByLabelText('Replace key') as HTMLInputElement
  fireEvent.change(input, { target: { value: 'synthetic-replacement' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save key' }))
  await screen.findByText(status === 403 ? 'Settings requires the local owner UI.' : 'Action unavailable. Check configuration and retry.')
  expect(input.value).toBe('')
  expect(document.body.textContent).not.toContain('synthetic-replacement')
  const request = calls.find(c => c.path === '/api/settings/key')!
  expect(JSON.parse(String(request.init?.body))).toEqual({ account: 'DEEPSEEK_API_KEY', value: 'synthetic-replacement' })
})

it('shows unavailable balances and unverified writers without suggesting verification', async () => {
  backend(); render(<OwnerSettings />); await open('Wallets')
  expect(await screen.findByText('synthetic-address')).toBeTruthy()
  expect(screen.getAllByText('Unavailable')).toHaveLength(2)
  expect(screen.getByText('Synthetic publisher')).toBeTruthy()
  expect(screen.getByText('Wallet', { exact: true, selector: 'td' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Writers' }))
  expect(await screen.findByText('Synthetic writer')).toBeTruthy()
  expect(screen.getAllByText('unverified', { exact: true })).toHaveLength(2)
})

it('requires the explicit reset phrase and reports restart after reset', async () => {
  const calls = backend(); render(<OwnerSettings />); await open('Data')
  const reset = screen.getByRole('button', { name: 'Reset settings' }) as HTMLButtonElement
  expect(reset.disabled).toBe(true)
  fireEvent.change(screen.getByLabelText('Type RESET SETTINGS'), { target: { value: 'RESET SETTINGS' } })
  fireEvent.click(reset)
  await waitFor(() => expect(calls.some(c => c.path === '/api/settings/reset')).toBe(true))
  await screen.findByText('Settings reset. Restart to apply.')
})

it('onboarding confirms selected network and caps through the guarded save path', async () => {
  history.replaceState(null, '', '/?settings=1&onboarding=1')
  const calls = backend(); render(<OwnerSettings />)
  await screen.findByText('Only you can change these settings. Policy code remains the spending authority.')
  fireEvent.change(screen.getByLabelText('Network'), { target: { value: 'xrpl-testnet' } })
  fireEvent.change(screen.getByLabelText('Per-call cap · SGD cents'), { target: { value: '100' } })
  fireEvent.click(screen.getByRole('button', { name: 'Confirm caps and start' }))
  await screen.findByText('Saved and audited. Restart the app to apply configuration changes.')
  expect(JSON.parse(String(calls.find(c => c.init?.method === 'POST')?.init?.body))).toEqual({ ...values, SETTLEMENT_RAIL: 'xrpl-testnet', MCP_MAX_BUDGET_MINOR: 100 })
})

it('saves a replacement key without returning its value to the page', async () => {
  backend(); render(<OwnerSettings />); await open('Models')
  fireEvent.change(screen.getByLabelText('Provider'), { target: { value: 'OPENAI_API_KEY' } })
  fireEvent.change(screen.getByLabelText('Replace key'), { target: { value: 'synthetic-openai' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save key' }))
  await screen.findByText('Key saved in the local environment file. Restart to apply.')
  expect(document.body.textContent).not.toContain('synthetic-openai')
})

it('payment selection is included in the deferred settings save', async () => {
  const calls = backend(); render(<OwnerSettings />); await open('Payments')
  fireEvent.change(screen.getByLabelText('Escrow mode'), { target: { value: 'key-reveal' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save settings' }))
  await screen.findByText('Saved and audited. Restart the app to apply configuration changes.')
  expect(JSON.parse(String(calls.find(c => c.init?.method === 'POST')?.init?.body)).ESCROW_MODE).toBe('key-reveal')
})

it('copies a versioned agent command with zero default authority and opens release metadata', async () => {
  backend()
  const writeText = vi.fn(async () => {})
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  const openWindow = vi.spyOn(window, 'open').mockImplementation(() => null)
  render(<OwnerSettings />); await open('Connect an agent')
  fireEvent.click(screen.getByRole('button', { name: 'Copy Claude command' }))
  await screen.findByText('Command copied.')
  expect(writeText).toHaveBeenCalledWith(expect.stringContaining('MCP_MAX_BUDGET_MINOR=0'))
  fireEvent.click(screen.getByRole('button', { name: 'About' }))
  fireEvent.click(screen.getByRole('button', { name: 'Check for updates' }))
  await screen.findByText('Update check opened.')
  expect(openWindow).toHaveBeenCalledWith(expect.stringContaining('/releases'), '_blank', 'noopener')
  openWindow.mockRestore()
})
