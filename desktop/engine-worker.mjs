import { parentPort, workerData } from 'node:worker_threads'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { startPublisher } from '../publisher/server.js'
import { createApiApp } from '../server/routes.js'
import { localRequest } from './policy.mjs'
const publisher = await startPublisher({ host: '127.0.0.1' })
const publisherUrl = `http://127.0.0.1:${publisher.address().port}`
const api = await createApiApp({ publisherUrl })
const server = createServer((req, res) => {
  if (!localRequest(req, server.address().port)) { res.writeHead(403); res.end(); return }
  if (process.env.RA_PAUSED === '1' && !['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(403); res.end(); return
  }
  api.app(req, res)
})
server.listen(workerData.apiPort, '127.0.0.1')
await once(server, 'listening')
parentPort.postMessage({ apiUrl: `http://127.0.0.1:${server.address().port}`, publisherUrl })
parentPort.once('message', async () => {
  await api.drain()
  for (const item of [server, publisher]) { item.close(); item.closeAllConnections(); await once(item, 'close') }
  api.close()
  parentPort.close()
})
