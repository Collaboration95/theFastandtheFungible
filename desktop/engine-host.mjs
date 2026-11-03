import { startEngine } from '../server/engine.js'
const engine = await startEngine({ dataDir: process.env.RA_DATA_DIR, live: process.env.RA_LIVE === '1' })
process.parentPort.postMessage({ ...engine, close: undefined, versions: process.versions })
process.parentPort.once('message', async () => { await engine.close(); process.exit(0) })
