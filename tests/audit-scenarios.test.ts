// #288 acceptance: a fixture UC2 + UC3 run (separate API and publisher processes, SIMULATED rail) leaves an audit chain
// that `audit:verify` passes; editing one audit row fails it at that seq; the export matches the run snapshots to the drop.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { startScenario } from './scenarios/harness.js'
import { RECEIPT_COLUMNS, type ReceiptRow } from '../server/audit.js'
import { SIMULATED_LABEL, type RunSnapshot } from '../shared/contracts/index.js'

type Harness = Awaited<ReturnType<typeof startScenario>>
const cli = (script: string, ...args: string[]) => spawnSync(process.execPath, ['--import', 'tsx', `scripts/${script}`, ...args], { encoding: 'utf8', env: { ...process.env, APP_DB: '' } })

describe('audit trail over fixture UC2 + UC3 (#288)', () => {
  let h: Harness, dir: string, uc2: RunSnapshot, uc3: RunSnapshot
  beforeAll(async () => {
    h = await startScenario()
    dir = mkdtempSync(join(tmpdir(), 'audit-uc-'))
    uc2 = await h.until(await h.ask('UC2'))
    uc3 = await h.until(await h.ask('UC3'))
  }, 60_000)
  afterAll(async () => { await h?.stop(); rmSync(dir, { recursive: true, force: true }) })
  const snapshot = (name: string) => {
    const source = new DatabaseSync(h.db, { readOnly: true }), copy = join(dir, name)
    source.exec(`VACUUM INTO '${copy}'`); source.close()
    return copy
  }

  it('the API verifies the chain and covers every receipt, signed payment and refund', async () => {
    const verified = await (await fetch(`${h.base}/api/audit/verify`)).json() as { ok: boolean; entries: number; coverage: Record<string, number>; failures: unknown[] }
    expect(verified).toMatchObject({ ok: true, failures: [], coverage: { receipts: 3, signed: 3, refunds: 1 } })
    expect(uc3.intents.map(i => i.status)).toEqual([`REFUNDED`, `VERIFIED`])
  })

  it('exports one row per charge that matches the run snapshots to the drop, UC3 refund tx included', async () => {
    const response = await fetch(`${h.base}/api/audit/receipts.jsonl`)
    expect(response.headers.get('content-type')).toContain('ndjson')
    expect(response.headers.get('x-export-label')).toContain('SIMULATED')
    const rows = (await response.text()).trim().split('\n').map(line => JSON.parse(line) as ReceiptRow)
    for (const run of [uc2, uc3]) {
      const mine = rows.filter(r => r.runId === run.runId)
      expect(mine.map(r => r.intentId).sort()).toEqual(run.receipts.map(r => r.intentId).sort())
      expect(mine.reduce((n, r) => n + r.amountMinor, 0)).toBe(run.spentMinor)
      for (const row of mine) {
        const intent = run.intents.find(i => i.intentId === row.intentId)!, receipt = run.receipts.find(r => r.intentId === row.intentId)!
        expect(row).toMatchObject({ label: SIMULATED_LABEL, surface: 'web', policyVersion: 'wallet-v1', amountMinor: receipt.amountMinor, amountDrops: String(receipt.amountMinor * 1000), txHash: intent.txHash, status: intent.status, settledAt: receipt.settledAt })
      }
    }
    const refunded = rows.find(r => r.status === 'REFUNDED')!
    expect(refunded.refundTxHash).toBe(uc3.intents.find(i => i.status === 'REFUNDED')!.refund!.txHash)
    expect(rows.reduce((n, r) => n + Number(r.refundAmountMinor || 0), 0)).toBe(uc3.refundedMinor)
    const csv = await (await fetch(`${h.base}/api/audit/receipts.csv`)).text()
    expect(csv.split('\r\n')[0]).toBe(RECEIPT_COLUMNS.join(','))
    expect(csv.trim().split('\r\n')).toHaveLength(rows.length + 1)
    expect((await fetch(`${h.base}/api/audit/receipts.csv?from=nonsense`)).status).toBe(400)
  })

  it('npm run audit:verify passes on the run, and fails at the edited seq after one audit row is changed', async () => {
    const good = snapshot('good.db')
    const ok = cli('audit-verify.ts', '--db', good)
    expect(ok.status, ok.stdout + ok.stderr).toBe(0)
    expect(ok.stdout).toMatch(/AUDIT CHAIN\s+OK/)
    expect(ok.stdout).toContain('3 receipts, 3 signed payments, 1 refunds')
    expect(ok.stdout).toContain('not checked')
    const bad = snapshot('bad.db')
    const raw = new DatabaseSync(bad)
    const seq = (raw.prepare("SELECT seq FROM audit_log WHERE kind='settle' ORDER BY seq LIMIT 1").get() as { seq: number }).seq
    raw.exec('DROP TRIGGER audit_log_no_update')
    raw.exec(`UPDATE audit_log SET principal='someone-else' WHERE seq=${seq}`); raw.close()
    const failed = cli('audit-verify.ts', '--db', bad)
    expect(failed.status).toBe(1)
    expect(failed.stdout).toContain(`at seq ${seq}: hash does not match`)
    expect(failed.stdout).toContain('RESULT        FAIL')
  })

  it('npm run audit:export prints the same CSV as the API, and can export the chain', async () => {
    const copy = snapshot('export.db')
    const fromCli = cli('audit-export.ts', '--db', copy)
    expect(fromCli.status, fromCli.stderr).toBe(0)
    expect(fromCli.stdout).toBe(await (await fetch(`${h.base}/api/audit/receipts.csv`)).text())
    const log = cli('audit-export.ts', '--db', copy, '--log')
    const entries = log.stdout.trim().split('\n').map(l => JSON.parse(l) as { kind: string; prevHash: string })
    expect(entries.map(e => e.kind)).toEqual(expect.arrayContaining(['admission', 'decision', 'reserve', 'sign', 'settle', 'deliver', 'proof', 'challenge', 'refund']))
    expect(cli('audit-export.ts', '--db', copy, '--format', 'xml').status).toBe(2)
  })

  it('npm run data:prune removes content but the chain and receipts survive', () => {
    const copy = snapshot('prune.db')
    const result = cli('data-prune.ts', '--db', copy, '--older-than', '0d', '--reports', join(dir, 'none'))
    expect(result.status, result.stdout + result.stderr).toBe(0)
    expect(result.stdout).toContain('Pruned 2 finished run(s)')
    const after = cli('audit-verify.ts', '--db', copy)
    expect(after.status, after.stdout).toBe(0)
    expect(after.stdout).toContain('3 receipts, 3 signed payments, 1 refunds')
    const db = new DatabaseSync(copy, { readOnly: true })
    expect((db.prepare('SELECT COUNT(*) AS n FROM grants').get() as { n: number }).n).toBe(0)
    expect((db.prepare('SELECT COUNT(*) AS n FROM receipts').get() as { n: number }).n).toBe(3)
    db.close()
  })
})
