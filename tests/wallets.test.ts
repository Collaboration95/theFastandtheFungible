import { describe, expect, it } from 'vitest'
import { Wallet } from 'xrpl'
// @ts-expect-error plain .mjs script, no declarations
import { addressEnvName, createMissing, paidSlugs, upsertEnv } from '../scripts/wallets.mjs'

describe('make wallets CREATE=1 (#133), dry run: no faucet, no file', () => {
  it('maps every paid roster publisher, and only those, to a wallet variable', () => {
    const slugs = paidSlugs()
    expect(slugs).toContain('alphaleak')
    expect(slugs).toContain('notfinancialtimes')
    expect(slugs).not.toContain('open-records') // free only
    expect(addressEnvName('the-fab-floor')).toBe('XRPL_PUBLISHER_THE_FAB_FLOOR_ADDRESS')
  })

  it('writes seed and address into .env text for missing wallets only; the seed is never printed', () => {
    const lines: string[] = []
    const wallets = [Wallet.generate(), Wallet.generate()]
    const env = { XRPL_PUBLISHER_KOPI_CONTRARIAN_SEED: 'sExisting' } as Record<string, string>
    const envText = 'DEEPSEEK_API_KEY=x\nXRPL_PUBLISHER_ALPHALEAK_SEED=\n'
    const result = createMissing({ slugs: ['alphaleak', 'kopi-contrarian', 'the-fab-floor'], env, envText, log: (line: string) => lines.push(line), generate: () => wallets.shift()! })
    expect(result.created.map((c: { name: string }) => c.name)).toEqual(['PUBLISHER_alphaleak', 'PUBLISHER_the-fab-floor'])
    const [alpha, fab] = result.created.map((c: { wallet: Wallet }) => c.wallet)
    expect(result.envText).toBe(`DEEPSEEK_API_KEY=x\nXRPL_PUBLISHER_ALPHALEAK_SEED=${alpha.seed}\nXRPL_PUBLISHER_ALPHALEAK_ADDRESS=${alpha.classicAddress}\nXRPL_PUBLISHER_THE_FAB_FLOOR_SEED=${fab.seed}\nXRPL_PUBLISHER_THE_FAB_FLOOR_ADDRESS=${fab.classicAddress}\n`)
    const stdout = lines.join('\n')
    expect(stdout).toContain(alpha.classicAddress)
    for (const seed of [alpha.seed!, fab.seed!]) expect(stdout).not.toContain(seed)
    expect(stdout).not.toContain('kopi-contrarian')
  })

  it('upserts without duplicating a variable', () => {
    expect(upsertEnv('A=1', 'B', '2')).toBe('A=1\nB=2\n')
    expect(upsertEnv('B=\nC=3\n', 'B', '2')).toBe('B=2\nC=3\n')
  })
})
