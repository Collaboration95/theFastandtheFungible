import { parseCommand } from '../shared/startup-plan.ts'
// MCPB booleans interpolate as strings; the engine deliberately accepts only 1.
process.env.RA_LIVE = ['true', '1'].includes(process.env.RA_LIVE) ? '1' : '0'
// Never inherit a remote backend or remote signing authority from the host shell.
delete process.env.RA_BACKEND_URL
delete process.env.XRPL_CALLER_SEED
// `verify <receipts.json|report.pdf> [--ledger] [--json]`: the TypeScript receipt verifier, offline unless --ledger
// (read-only Testnet lookups, no keys). It never starts an engine or opens a wallet.
const command = process.argv[2] === 'verify' ? { kind: 'verify' } : parseCommand(process.argv.slice(2))
if (command.kind === 'verify') {
  process.argv.splice(2, 1)
  await import('../scripts/verify-answer.ts')
} else if (command.kind === 'app') {
  await (await import('./app.js')).runApp(process.argv.slice(3))
} else if (command.kind === 'try') {
  await (await import('./try.ts')).runTry(process.argv.slice(3))
} else if (command.kind === 'init') {
  const { initMain } = await import('../scripts/publish-site.js')
  await initMain(process.argv.slice(3))
} else if (command.kind === 'publish') {
  const { main } = await import('../scripts/publish-site.js')
  await main(process.argv.slice(3))
} else await import('./server.ts')
