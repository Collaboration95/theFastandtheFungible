// Evaluated before the verifier's module graph (first import of ./browser): the globals it expects from Node.
import { BrowserBuffer } from './shims/buffer'
const scope = globalThis as unknown as { Buffer?: unknown; process?: { env: Record<string, string | undefined> } }
scope.Buffer ??= BrowserBuffer
scope.process ??= { env: {} }
