import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Wallet } from 'xrpl'

type Script = { network?: number; create?: string; accept?: string; entry?: { validated: boolean; node?: { Flags: number } } }
let script: Script = {}
const submitted: string[] = []
vi.mock('xrpl', async importOriginal => ({
  ...await importOriginal<typeof import('xrpl')>(),
  Client: class {
    async connect() {}
    async disconnect() {}
    async request(request: { command: string }) {
      if (request.command === 'server_info') return { result: { info: { network_id: script.network ?? 1 } } }
      return { result: script.entry ?? { validated: false } }
    }
    async submitAndWait(tx: { TransactionType: string }) {
      submitted.push(tx.TransactionType)
      const result = tx.TransactionType === 'CredentialCreate' ? script.create ?? 'tesSUCCESS' : script.accept ?? 'tesSUCCESS'
      return { result: { hash: tx.TransactionType === 'CredentialCreate' ? 'C'.repeat(64) : 'D'.repeat(64), meta: { TransactionResult: result } } }
    }
  },
}))
vi.mock('../publisher/publishing/publish.js', () => ({ fundTestnetWallet: vi.fn(async () => {}) }))
const { issueWriterCredential } = await import('../publisher/publishing/credential.js')

const dirs: string[] = []
const root = async () => { const dir = await mkdtemp(join(tmpdir(), 'writer-credential-')); dirs.push(dir); return dir }
afterEach(async () => { for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true }); script = {}; submitted.length = 0 })

describe('writer Credential issuance (operator code only)', () => {
  it('creates a private issuer, issues and accepts a Credential, and records the trust policy without seeds', async () => {
    const dir = await root(), subject = Wallet.generate()
    const receipt = await issueWriterCredential(subject, dir)
    expect(submitted).toEqual(['CredentialCreate', 'CredentialAccept'])
    expect(receipt).toMatchObject({ hash: 'C'.repeat(64), acceptHash: 'D'.repeat(64), trust: { credentialTypeText: 'researchagent/writer-v1' } })
    expect((await stat(join(dir, 'issuer.private.json'))).mode & 0o777).toBe(0o600)
    expect((await stat(join(dir, `${subject.classicAddress}.credential.json`))).mode & 0o777).toBe(0o600)
    expect(JSON.stringify(receipt)).not.toContain('seed')
    expect(await readFile(join(dir, 'credential-issuers.json'), 'utf8')).not.toContain('seed')
  })
  it('reuses the saved Credential while the ledger still shows it accepted, and refuses once it is not', async () => {
    const dir = await root(), subject = Wallet.generate()
    const first = await issueWriterCredential(subject, dir)
    submitted.length = 0
    script.entry = { validated: true, node: { Flags: 0x10000 } }
    expect(await issueWriterCredential(subject, dir)).toEqual(first)
    expect(submitted).toEqual([])
    script.entry = { validated: true, node: { Flags: 0 } }
    await expect(issueWriterCredential(subject, dir)).rejects.toThrow('no longer accepted')
  })
  it('refuses a non-Testnet network, a failed create or accept, and a corrupt issuer cache', async () => {
    const subject = Wallet.generate()
    script = { network: 0 }
    await expect(issueWriterCredential(subject, await root())).rejects.toThrow('Testnet network ID')
    script = { create: 'tecNO_PERMISSION' }
    await expect(issueWriterCredential(subject, await root())).rejects.toThrow('CredentialCreate did not validate')
    script = { accept: 'tecNO_ENTRY' }
    await expect(issueWriterCredential(subject, await root())).rejects.toThrow('CredentialAccept did not validate')
    script = {}
    const dir = await root()
    await writeFile(join(dir, 'issuer.private.json'), '{', { mode: 0o600 })
    await expect(issueWriterCredential(subject, dir)).rejects.toThrow()
  })
})
