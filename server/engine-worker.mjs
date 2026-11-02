import { register } from 'tsx/esm/api'
import { parentPort, workerData } from 'node:worker_threads'
import { once } from 'node:events'
register()
const { startPublisher } = await import('../publisher/server.ts')
const publisher = await startPublisher({ host: '127.0.0.1' })
const publisherUrl = `http://127.0.0.1:${publisher.address().port}`
process.env.PUBLISHER_URL = publisherUrl
const { createApiApp } = await import('./routes.ts')
let api
let server
const closeServer = server => new Promise((done, fail) => {
  server.close(error => error ? fail(error) : done())
  server.closeAllConnections()
})
try {
  api = await createApiApp()
  server = api.app.listen(workerData.apiPort, '127.0.0.1')
  await once(server, 'listening')
  parentPort.postMessage({ apiUrl: `http://127.0.0.1:${server.address().port}`, publisherUrl })
} catch (error) {
  if (server) await closeServer(server)
  api?.close()
  await closeServer(publisher)
  throw error
}
parentPort.once('message', async () => {
  await api.drain()
  await closeServer(server)
  api.close()
  await closeServer(publisher)
  parentPort.close()
})
