/** Explicit opt-in only: ephemeral faucet wallets and hard-coded XRPL Testnet endpoints. */
import { interop } from './interop/starter-kit.js'
if (!process.argv.includes('--testnet')) throw new Error('Pass --testnet to authorize faucet-only Testnet proof')
process.stdout.write(`${JSON.stringify(await interop(true), null, 2)}\n`)
