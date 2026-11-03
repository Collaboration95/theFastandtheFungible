import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import { z } from 'zod'
import { BUDGET } from '../shared/contracts/run.js'
import { spendPolicy } from './spend-policy.js'

export class AgentDenied extends Error {}
export const AgentInput = z.object({ name: z.string().trim().min(1).max(80).regex(/^[\w .-]+$/),
  maxMinor: z.number().int().min(0).max(BUDGET.maxMinor), dailyMinor: z.number().int().nonnegative() }).strict()
export type AgentKey = { id: string; name: string; maxMinor: number; dailyMinor: number; paused: boolean; revoked: boolean; createdAt: string }
type Row = AgentKey & { digest: string }
export const keyDigest = (key: string) => createHash('sha256').update(key).digest()
const publicKey = ({ digest: _digest, ...key }: Row): AgentKey => ({ ...key, paused: Boolean(key.paused), revoked: Boolean(key.revoked) })
/** Identity/config only. All money is accounted for in admissions/intents, never here. */
export class AgentKeys {
  constructor(private readonly db: DatabaseSync) {
    db.exec(`CREATE TABLE IF NOT EXISTS agent_keys (id TEXT PRIMARY KEY, name TEXT NOT NULL, digest TEXT UNIQUE NOT NULL,
      maxMinor INTEGER NOT NULL, dailyMinor INTEGER NOT NULL, paused INTEGER NOT NULL DEFAULT 0,
      revoked INTEGER NOT NULL DEFAULT 0, createdAt TEXT NOT NULL);`)
  }
  add(input: z.infer<typeof AgentInput>) {
    const parsed = AgentInput.parse(input)
    if (parsed.dailyMinor > spendPolicy().walletDailyMinor || parsed.maxMinor > parsed.dailyMinor) throw new Error('Agent caps must fit beneath wallet caps')
    const token = `ra_agent_${randomBytes(32).toString('hex')}`
    const key: AgentKey = { ...parsed, id: randomUUID(), paused: false, revoked: false, createdAt: new Date().toISOString() }
    this.db.prepare('INSERT INTO agent_keys VALUES (?,?,?,?,?,0,0,?)').run(key.id, key.name, keyDigest(token).toString('hex'), key.maxMinor, key.dailyMinor, key.createdAt)
    return { ...key, token }
  }
  list(): AgentKey[] { return (this.db.prepare('SELECT * FROM agent_keys ORDER BY createdAt, id').all() as unknown as Row[]).map(publicKey) }
  get(id: string): AgentKey | undefined {
    const row = this.db.prepare('SELECT * FROM agent_keys WHERE id=?').get(id) as unknown as Row | undefined
    return row && publicKey(row)
  }
  authenticate(token: string): AgentKey | undefined {
    const digest = keyDigest(token)
    // Compare fixed-length digests, including revoked keys; never compare raw keys.
    const rows = this.db.prepare('SELECT * FROM agent_keys').all() as unknown as Row[]
    let found: Row | undefined
    for (const row of rows) if (timingSafeEqual(digest, Buffer.from(row.digest, 'hex'))) found = row
    return found && !found.revoked ? publicKey(found) : undefined
  }
  control(id: string, paused: boolean, revoke = false) {
    const key = this.get(id)
    if (!key) throw new AgentDenied('Agent key not found')
    if (key.revoked && !paused) throw new AgentDenied('Revocation is permanent; create a new key')
    this.db.prepare('UPDATE agent_keys SET paused=?, revoked=? WHERE id=?').run(Number(paused), Number(key.revoked || revoke), id)
    return this.get(id)!
  }
}
