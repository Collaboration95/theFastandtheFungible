import 'dotenv/config'
import { startTelemetry } from './telemetry.js'
// Start tracing before the app so the first run is captured; a no-op unless LANGFUSE_ENABLED=1.
const stopTelemetry = await startTelemetry()
const { createApiApp } = await import('./routes.js')
const api = await createApiApp()
const port = Number(process.env.PORT ?? 8788)
const server = api.app.listen(port, process.env.HOST ?? '127.0.0.1', () => console.log(`ResearchAgent API listening on http://127.0.0.1:${port} · SIMULATED SGD · no real funds`))
const shutdown = () => { server.close(() => { api.close(); void stopTelemetry().finally(() => process.exit(0)) }); setTimeout(() => process.exit(0), 3000).unref() }
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
