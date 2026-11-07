import { ReadBuffer, serializeMessage } from '@modelcontextprotocol/sdk/shared/stdio.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import type { ChildProcessWithoutNullStreams } from 'node:child_process'
import { stopProcess } from '../shared/resource-scope.js'
import { ResourceScope, groupMembers } from '../shared/resource-scope.js'
export { stopProcess } from '../shared/resource-scope.js'
const scope = new ResourceScope(), groups = new Set<number>()
export function managedSpawn(...args: Parameters<ResourceScope['spawn']>) {
  const child = scope.spawn(...args)
  if (child.pid) groups.add(child.pid)
  return child
}
export async function assertNoProcesses() {
  for (const group of groups) if (groupMembers(group).length) throw Error(`Owned group ${group} survived cleanup`)
}

/** MCP adapter for an already owned group; keep provisioning and secrets at the caller. */
export function processTransport(child: ChildProcessWithoutNullStreams): Transport {
  const buffer = new ReadBuffer()
  const transport: Transport = {
    async start() {
      child.stderr.resume()
      child.on('error', error => transport.onerror?.(error))
      child.once('exit', () => transport.onclose?.())
      child.stdout.on('data', chunk => {
        try {
          buffer.append(chunk)
          let message
          while ((message = buffer.readMessage()) !== null) transport.onmessage?.(message)
        } catch (error) { transport.onerror?.(error as Error) }
      })
    },
    async send(message) { await new Promise<void>((done, fail) => child.stdin.write(serializeMessage(message), error => error ? fail(error) : done())) },
    async close() { try { await stopProcess(child) } finally { buffer.clear() } },
  }
  return transport
}
