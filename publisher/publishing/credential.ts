// Operator-only Testnet identity issuance. Never reachable from model output.
import { chmod, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Client, Wallet } from 'xrpl'
import { testnetUrl } from '../../shared/xrpl.js'
import { CredentialIssuerSchema } from '../../shared/writer-verification.js'
import { fundTestnetWallet } from './publish.js'

export async function issueWriterCredential(subject: Wallet, root: string) {
  const file = join(root, 'issuer.private.json')
  let issuer: Wallet
  try { issuer = Wallet.fromSeed(JSON.parse(await readFile(file, 'utf8')).seed) }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw Error('Private Testnet issuer cache unavailable')
    issuer = Wallet.generate()
    await writeFile(file, JSON.stringify({ seed: issuer.seed }), { mode: 0o600, flag: 'wx' })
  }
  await chmod(file, 0o600)
  await fundTestnetWallet(issuer)
  const trust = { issuer: issuer.classicAddress, credentialTypeText: 'researchagent/writer-v1', label: 'Local operator · Testnet identity only' }
  const policy = CredentialIssuerSchema.parse(trust)
  const receiptFile = join(root, `${subject.classicAddress}.credential.json`)
  const client = new Client(testnetUrl())
  try {
    await client.connect()
    if ((await client.request({ command: 'server_info' })).result.info.network_id !== 1) throw Error('Testnet network ID required')
    let cached: { hash: string; acceptHash: string; trust: typeof trust } | undefined
    try { cached = JSON.parse(await readFile(receiptFile, 'utf8')) } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw Error('Credential receipt unavailable') }
    if (cached) {
      const entry = await client.request({ command: 'ledger_entry', ledger_index: 'validated', credential: { subject: subject.classicAddress, issuer: policy.issuer, credential_type: policy.credentialType } } as never) as unknown as { result: { validated?: boolean; node?: { Flags?: number } } }
      if (entry.result.validated && (Number(entry.result.node?.Flags) & 0x10000)) return cached
      throw Error('Saved writer credential is no longer accepted; ask the local operator')
    }
    const create = await client.submitAndWait({ TransactionType: 'CredentialCreate', Account: issuer.classicAddress, Subject: subject.classicAddress, CredentialType: policy.credentialType }, { wallet: issuer })
    const meta = create.result.meta
    if (typeof meta !== 'object' || meta.TransactionResult !== 'tesSUCCESS') throw Error('CredentialCreate did not validate successfully')
    const accept = await client.submitAndWait({ TransactionType: 'CredentialAccept', Account: subject.classicAddress, Issuer: issuer.classicAddress, CredentialType: policy.credentialType }, { wallet: subject })
    if (typeof accept.result.meta !== 'object' || accept.result.meta.TransactionResult !== 'tesSUCCESS') throw Error('CredentialAccept did not validate successfully')
    await writeFile(join(root, 'credential-issuers.json'), JSON.stringify([trust]), { mode: 0o600 })
    const receipt = { hash: create.result.hash, acceptHash: accept.result.hash, trust }
    await writeFile(receiptFile, JSON.stringify(receipt), { mode: 0o600 })
    return receipt
  } finally { await client.disconnect() }
}
