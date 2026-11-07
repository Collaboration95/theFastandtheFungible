import { applyOwnerConfig } from './owner-config.js'
import { loadConfig } from './config.js'
import 'dotenv/config'
import { startTelemetry } from './telemetry.js'
import { SIMULATED_LABEL, XRPL_LABEL } from '../shared/contracts/index.js'
// Start tracing before the app so the first run is captured; a no-op unless LANGFUSE_ENABLED=1.
applyOwnerConfig(process.env)
const stopTelemetry = await startTelemetry()
const { createApiApp } = await import('./routes.js')
const api = await createApiApp()
const config = loadConfig()
const port = Number(config.PORT ?? 8788)
const server = api.app.listen(port, config.HOST ?? '127.0.0.1', () => console.log(`ResearchAgent API listening on http://127.0.0.1:${port} · ${config.SETTLEMENT_RAIL === 'xrpl-testnet' && config.XRPL_PAYER_SEED ? XRPL_LABEL : SIMULATED_LABEL}`))
const shutdown = () => { server.closeAllConnections(); server.close(() => { void api.close().finally(() => stopTelemetry().finally(() => process.exit(0))) }); setTimeout(() => process.exit(0), 3000).unref() }
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
