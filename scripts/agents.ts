// Local operator CLI: raw token goes only to an explicitly chosen private file, never stdout/stderr.
import 'dotenv/config'
import { writeFileSync, unlinkSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { Store } from '../server/store.js'

const { values, positionals } = parseArgs({ allowPositionals: true, options: {
  db: { type: 'string' }, name: { type: 'string' }, 'max-minor': { type: 'string' }, 'daily-minor': { type: 'string' },
  'token-file': { type: 'string' }, resume: { type: 'boolean' },
} })
let store: Store | undefined
let createdFile = false
try {
  const [command, id] = positionals
  if (!['add', 'list', 'revoke', 'pause'].includes(command) || (['pause', 'revoke'].includes(command) && !id)) throw new Error('Usage: agents add --name NAME --max-minor N --daily-minor N --token-file PATH | list | revoke ID | pause ID [--resume]; optional --db PATH')
  if (command === 'add') {
    if (!values['token-file']) throw new Error('add requires --token-file PATH (new private file; key is never logged)')
    writeFileSync(values['token-file'], '', { mode: 0o600, flag: 'wx' }); createdFile = true
  }
  store = new Store(values.db ?? process.env.APP_DB ?? 'data/app.db')
  if (command === 'add') {
    const { token, ...key } = store.addAgent({ name: values.name ?? '', maxMinor: Number(values['max-minor']), dailyMinor: Number(values['daily-minor']) })
    try { writeFileSync(values['token-file']!, token + '\n', { mode: 0o600 }) }
    catch { store.setAgentPaused(key.id, true, true); throw new Error('Private key write failed; newly created agent revoked') }
    console.log(JSON.stringify({ ...key, credential: 'Created once in the private token file; move to client secret storage.' }))
  } else if (command === 'list') console.log(JSON.stringify(store.agentKeys.list().map(key => store!.agentStatus(key.id)), null, 2))
  else console.log(JSON.stringify(store.setAgentPaused(id, command === 'revoke' || !values.resume, command === 'revoke')))
} catch {
  if (createdFile && values['token-file']) unlinkSync(values['token-file'])
  console.error('Agent command failed. Check command, caps, database and new token-file path. No credentials logged.')
  process.exitCode = 1
} finally { store?.close() }
