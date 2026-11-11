import { spawn } from 'node:child_process'
// Operator-only: no engine/model entry point. Public evidence never contains signing material.
import { readFileSync, writeFileSync, mkdirSync, statSync, renameSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { Client, Wallet } from 'xrpl'
const state = join(homedir(), '.config/researchagent-hosted/wallets')
const dir = 'docs/evidence/writer-credentials-nov12'
const issuerFile = join(state, 'XRPL_CREDENTIAL_ISSUER_SEED')
const typeText = 'researchagent/writer-v1'
const credentialType = Buffer.from(typeText).toString('hex').toUpperCase()
const expiration = Date.parse('2026-11-30T00:00:00Z') / 1000 - 946684800
const client = new Client('wss://s.altnet.rippletest.net:51233', { timeout: 20000, connectionTimeout: 15000, maxFeeXRP: '0.002' })
const evidenceFile = join(dir, 'ledger.json')
mkdirSync(dir, { recursive: true })
const readOptional = file => { try { return readFileSync(file, 'utf8') } catch (e) { if (e.code !== 'ENOENT') throw e } }
const evidence = JSON.parse(readOptional(evidenceFile) ?? '{"transactions":[]}')
const save = () => { writeFileSync(evidenceFile + '.tmp', JSON.stringify(evidence, null, 2) + '\n'); renameSync(evidenceFile + '.tmp', evidenceFile) }
function wallet(file) {
  if ((statSync(file).mode & 0o777) !== 0o600) throw Error('Private wallet file must be mode 0600')
  return Wallet.fromSeed(readFileSync(file, 'utf8').trim())
}
async function entry(params) {
  try { return (await client.request({ command: 'ledger_entry', ledger_index: 'validated', ...params })).result }
  catch (e) { if (e.data?.error === 'entryNotFound') return undefined; throw e }
}
async function submit(signer, tx) {
  const prepared = await client.autofill({ ...tx, Account: signer.classicAddress })
  if (Number(prepared.Fee) > 2000) throw Error('Fee cap exceeded')
  const signed = signer.sign(prepared)
  const { result } = await client.submitAndWait(signed.tx_blob)
  if (!result.validated || result.meta?.TransactionResult !== 'tesSUCCESS') throw Error('Transaction did not validate successfully')
  evidence.transactions.push({ operation: tx.TransactionType, account: signer.classicAddress, subject: tx.Subject, destination: tx.Destination, hash: signed.hash, ledgerIndex: result.ledger_index, feeDrops: prepared.Fee })
  save()
  return result
}
try {
  await client.connect()
  if ((await client.request({ command: 'server_info' })).result.info.network_id !== 1) throw Error('Testnet network_id 1 required')
  if (Date.now() >= Date.parse('2026-11-30T00:00:00Z')) throw Error('Provisioning expiration has passed')
  if (!readOptional(issuerFile)) {
    const fresh = Wallet.generate()
    writeFileSync(issuerFile, fresh.seed, { mode: 0o600, flag: 'wx' })
  }
  const issuer = wallet(issuerFile)
  try { await client.request({ command: 'account_info', account: issuer.classicAddress, ledger_index: 'validated' }) }
  catch (e) { if (e.data?.error !== 'actNotFound') throw e; await client.fundWallet(issuer) }
  const writers = ['TEAM_BUILDER_NOTES', 'TEAM_XRPL_EXPLAINERS', 'OPEN_RECORDS'].map(name => ({ name, signer: wallet(join(state, `XRPL_PUBLISHER_${name}_SEED`)) }))
  if (new Set([issuer.classicAddress, ...writers.map(w => w.signer.classicAddress)]).size !== 4) throw Error('Distinct issuer and writers required')
  evidence.network = 'XRPL Testnet'; evidence.networkId = 1; evidence.issuer = issuer.classicAddress
  evidence.credentialTypeText = typeText; evidence.expiration = '2026-11-30T00:00:00Z'
  save()
  for (const { signer } of writers) {
    // Open Records is free-only and may never have needed an on-ledger account.
    try { await client.request({ command: 'account_info', account: signer.classicAddress, ledger_index: 'validated' }) }
    catch (e) { if (e.data?.error !== 'actNotFound') throw e; await submit(issuer, { TransactionType: 'Payment', Destination: signer.classicAddress, Amount: '2000000' }) }
    const params = { credential: { subject: signer.classicAddress, issuer: issuer.classicAddress, credential_type: credentialType } }
    let found = await entry(params)
    if (!found) { await submit(issuer, { TransactionType: 'CredentialCreate', Subject: signer.classicAddress, CredentialType: credentialType, Expiration: expiration }); found = await entry(params) }
    if (found?.node.Expiration !== expiration) throw Error('Existing credential has unexpected expiration')
    if (!(found.node.Flags & 0x10000)) await submit(signer, { TransactionType: 'CredentialAccept', Issuer: issuer.classicAddress, CredentialType: credentialType })
  }
  const accepted = [{ Credential: { Issuer: issuer.classicAddress, CredentialType: credentialType } }]
  const objects = (await client.request({ command: 'account_objects', account: issuer.classicAddress, ledger_index: 'validated', limit: 200 })).result
  if (objects.marker) throw Error('Issuer object list exceeds bound')
  const matches = o => o?.LedgerEntryType === 'PermissionedDomain' && o.AcceptedCredentials?.length === 1 && o.AcceptedCredentials[0].Credential?.Issuer === issuer.classicAddress && o.AcceptedCredentials[0].Credential?.CredentialType === credentialType
  const saved = evidence.domainId ? await entry({ index: evidence.domainId }) : undefined
  let domain = matches(saved?.node) ? { ...saved.node, index: saved.index } : objects.account_objects.find(matches)
  if (!domain) {
    const result = await submit(issuer, { TransactionType: 'PermissionedDomainSet', AcceptedCredentials: accepted })
    domain = result.meta.AffectedNodes.find(n => n.CreatedNode?.LedgerEntryType === 'PermissionedDomain')?.CreatedNode
    evidence.domainId = domain?.LedgerIndex; save()
  } else evidence.domainId = domain.index
  if (!evidence.domainId) throw Error('Domain ID unavailable')
  const header = (await client.request({ command: 'ledger', ledger_index: 'validated' })).result
  const pinned = { ledger_hash: header.ledger_hash }
  evidence.observedAt = new Date().toISOString(); evidence.ledgerIndex = header.ledger_index; evidence.ledgerHash = header.ledger_hash
  evidence.domain = (await client.request({ command: 'ledger_entry', index: evidence.domainId, ...pinned })).result
  evidence.writers = []
  for (const { name, signer } of writers) {
    const result = (await client.request({ command: 'account_objects', account: signer.classicAddress, type: 'credential', limit: 200, ...pinned })).result
    const credential = result.account_objects.find(o => o.LedgerEntryType === 'Credential' && o.Issuer === issuer.classicAddress && o.CredentialType === credentialType && o.Subject === signer.classicAddress)
    if (result.marker || !result.validated || !(credential?.Flags & 0x10000)) throw Error('Writer acceptance not observed')
    evidence.writers.push({ name, address: signer.classicAddress, credentialId: credential.index, accountObjects: result })
  }
  // Recover public transaction evidence after a crash between validation and the evidence write.
  for (const signer of [issuer, ...writers.map(w => w.signer)]) {
    const history = (await client.request({ command: 'account_tx', account: signer.classicAddress, ledger_index_min: -1, ledger_index_max: -1, limit: 200 })).result
    for (const row of history.transactions) {
      const tx = row.tx_json ?? row.tx
      if (!row.validated || !tx || !['CredentialCreate','CredentialAccept','PermissionedDomainSet','PermissionedDomainDelete'].includes(tx.TransactionType)) continue
      if (tx.Account !== issuer.classicAddress && tx.Issuer !== issuer.classicAddress) continue
      const hash = row.hash ?? tx.hash
      if (hash && !evidence.transactions.some(t => t.hash === hash)) evidence.transactions.push({ operation: tx.TransactionType, account: tx.Account, subject: tx.Subject, hash, ledgerIndex: row.ledger_index ?? tx.ledger_index, feeDrops: tx.Fee, result: row.meta?.TransactionResult })
    }
  }
  delete evidence.failure
  save()
  console.log(JSON.stringify({ issuer: evidence.issuer, writers: evidence.writers.map(w => w.address), hashes: evidence.transactions.map(t => t.hash), domainId: evidence.domainId }))
} catch (error) {
  // Public codes only, never a request or SDK message.
  evidence.failure = { code: /^[A-Za-z_]+$/.test(error.data?.error ?? '') ? error.data.error : 'setup_failed' }; save()
  // SDK errors can contain signed request data. Never serialize them.
  process.exitCode = 1
} finally { if (client.isConnected()) await client.disconnect() }

// Optional local evidence runner. The writer seeds are read only here and passed privately to the child.
if (!process.exitCode && process.argv.includes('--local-hosted')) {
  const env = { ...process.env, WRITER_CREDENTIAL_DOMAIN: evidence.domainId }
  for (const file of readdirSync('data/writers').filter(f => f.endsWith('.json'))) {
    const slug = JSON.parse(readFileSync(join('data/writers', file), 'utf8')).publisher.slug
    const key = `XRPL_PUBLISHER_${slug.toUpperCase().replaceAll('-', '_')}_SEED`
    env[key] = ['team-builder-notes','team-xrpl-explainers','open-records'].includes(slug) ? wallet(join(state, key)).seed : Wallet.generate().seed
  }
  const child = spawn(process.execPath, ['--import','tsx',join(dir,'local-hosted.ts')], { env, stdio: ['ignore','ignore','inherit'] })
  const stop = () => child.kill('SIGTERM')
  process.on('SIGTERM', stop); process.on('SIGINT', stop)
  const code = await new Promise(resolve => child.once('exit', resolve))
  if (code) process.exitCode = code
}
