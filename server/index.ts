import 'dotenv/config'
import { createApiApp } from './routes.js'
const api = await createApiApp()
const port = Number(process.env.PORT ?? 8788)
const server = api.app.listen(port, process.env.HOST ?? '127.0.0.1', () => console.log(`ResearchAgent API listening on http://127.0.0.1:${port} · SIMULATED SGD · no real funds`))
const shutdown = () => { server.close(() => { api.close(); process.exit(0) }); setTimeout(() => process.exit(0), 3000).unref() }
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
