// Acceptance changes research providers only; settlement still uses the Keychain Testnet seed.
import { startEngine } from '../server/engine.js'
if (process.env.RA_ACCEPT_TESTNET === '1') {
  process.env.LLM_PROVIDER = 'fixture'; process.env.DECISION_PROVIDER = 'fixture'
}
const engine = await startEngine({ dataDir: process.env.RA_DATA_DIR, live: process.env.RA_LIVE === '1' })
process.parentPort.postMessage({ ...engine, close: undefined, versions: process.versions })
process.parentPort.once('message', async () => { await engine.close(); process.exit(0) })
