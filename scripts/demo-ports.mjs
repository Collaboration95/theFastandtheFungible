import { createServer } from 'node:net'
import { once } from 'node:events'

/** Ask the OS for three distinct ports; hold all reservations until allocation is complete. */
export async function allocateDemoPorts() {
  const reservations = []
  try {
    const ports = {}
    for (const name of ['web', 'api', 'pub']) {
      const server = createServer()
      reservations.push(server)
      server.listen(0, '127.0.0.1')
      await once(server, 'listening')
      ports[name] = server.address().port
    }
    return ports
  } finally {
    await Promise.all(reservations.map(server => new Promise((done, reject) => server.close(error => error ? reject(error) : done()))))
  }
}
