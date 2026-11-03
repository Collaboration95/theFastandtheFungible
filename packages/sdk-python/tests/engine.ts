// Real engine, synthetic providers and simulated settlement; ephemeral listeners only.
import { startEngine } from '../../../server/engine.js'
const engine = await startEngine({ dataDir: process.argv[2] })
console.log(JSON.stringify({ url: engine.apiUrl, token: engine.apiToken }))
process.stdin.resume()
process.stdin.on('data', () => { void engine.close().then(() => process.exit(0)) })
