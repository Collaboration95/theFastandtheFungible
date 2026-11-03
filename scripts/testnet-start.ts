import { spawn } from 'node:child_process'
import { prepare } from './testnet-wallets.js'
const started = Date.now()
const { env, fallback } = await prepare()
if (fallback) console.warn('SIMULATED fallback · public Testnet faucet/network unavailable · no ledger transactions')
env.TESTNET_STARTED_AT = String(started)
const captureOnly = process.argv.includes('--capture')
const args = captureOnly ? ['--import','tsx','scripts/capture-browser-demo.ts', ...(!fallback?['--testnet']:[])] : ['scripts/demo.mjs']
if (!captureOnly) { env.DEMO_PORT_OFFSET = process.env.DEMO_PORT_OFFSET || '1800'; console.log(`Ask the Malaysia packaging lead times example (UC3). ${!fallback?'XRPL Testnet · no real value':'SIMULATED fallback · no real funds'}`) }
const child = spawn(process.execPath,args,{env,stdio:'inherit'})
for(const signal of ['SIGINT','SIGTERM'] as const) process.on(signal,()=>child.kill(signal))
child.on('exit',code=>process.exit(code ?? 1))
