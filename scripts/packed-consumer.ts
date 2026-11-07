import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { withResourceScope, type ResourceScope } from '../shared/resource-scope.js'
import { processTransport, stopProcess } from './release-processes.js'

export function packedArtifact(path = 'dist/release/manifest.json') {
  const manifestFile = resolve(path), manifest = JSON.parse(readFileSync(manifestFile, 'utf8'))
  const file = (kind: string) => resolve(dirname(manifestFile), manifest.artifacts.find((a: { kind: string }) => a.kind === kind).file)
  return { manifestFile, manifest, file, tgz: file('mcp-tgz') }
}
export async function withPackedSession<T>(live: boolean, run: (session: { scope: ResourceScope; scratch: string; spawnPacked: (tgz: string, args: string[], env?: NodeJS.ProcessEnv) => ReturnType<ResourceScope['spawn']>; run: (cmd: string, args: string[]) => Promise<string> }) => Promise<T>) {
  if (live) assert.equal(process.env.RA_ACCEPT_TESTNET, '1', 'RA_ACCEPT_TESTNET=1 required')
  return withResourceScope(async scope => {
    const scratch = live ? scope.evidenceDir('ra-consumer-', 'Testnet wallets and signed obligations; manual reconciliation required') : scope.tempDir('ra-consumers-')
    const spawnPacked = (tgz: string, args: string[], env: NodeJS.ProcessEnv = {}) => scope.spawn('npx', ['-y', '--cache', join(scratch, 'npm-cache'), pathToFileURL(tgz).href, ...args], { cwd: scratch, env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, XDG_STATE_HOME: join(scratch, 'state'), ...env } })
    const runCommand = async (cmd: string, args: string[]) => {
      const child = scope.spawn(cmd, args, { cwd: scratch, env: process.env })
      let out = '', err = ''
      child.stdout.on('data', c => out += c); child.stderr.on('data', c => err += c)
      try {
        await new Promise<void>((done, fail) => { child.once('error', fail); child.once('exit', code => code === 0 ? done() : fail(Error(err))) })
        return out
      } finally { await stopProcess(child) }
    }
    return run({ scope, scratch, spawnPacked, run: runCommand })
  })
}
export async function packedStdio(scope: ResourceScope, child: ReturnType<ResourceScope['spawn']>, timeout = 180_000) {
  const client = scope.own(new Client({ name: 'packed-consumer', version: '1' }))
  await client.connect(processTransport(child))
  const call = async (name: string, args = {}) => {
    const r = await client.callTool({ name, arguments: args }, undefined, { timeout })
    assert(!r.isError, `${name} failed: ${JSON.stringify(r.content)}`)
    return JSON.parse((r.content as { text: string }[])[0].text)
  }
  return { client, call }
}
export async function validatedTransactions(hashes: (string | undefined)[], types = ['EscrowCreate', 'EscrowFinish', 'AccountSet']) {
  return Promise.all(hashes.map(async (hash, i) => {
    assert.match(hash || '', /^[A-F0-9]{64}$/)
    const response = await fetch('https://s.altnet.rippletest.net:51234/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ method: 'tx', params: [{ transaction: hash }] }), signal: AbortSignal.timeout(15000) })
    const { result } = await response.json(); assert.equal(result.validated, true); assert.equal(result.meta.TransactionResult, 'tesSUCCESS')
    const tx = result.tx_json ?? result; assert.equal(tx.TransactionType, types[i])
    return { hash, type: tx.TransactionType, feeDrops: Number(tx.Fee), ledgerIndex: result.ledger_index }
  }))
}
