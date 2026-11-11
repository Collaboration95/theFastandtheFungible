import type { Request, Response } from 'express'
import { constants, createGzip, type Gzip } from 'node:zlib'

const streams = new WeakMap<Response, { gzip: Gzip; pending: number }>()
/** Negotiate only on hosted. EventSource decodes gzip; the local/desktop wire format stays plain. */
export function openSse(req: Request, res: Response, gzipEnabled: boolean) {
  res.set({ 'Content-Type': 'text/event-stream', Connection: 'keep-alive' })
  res.vary('Accept-Encoding')
  if (gzipEnabled && req.acceptsEncodings('gzip')) {
    const state = { gzip: createGzip({ flush: constants.Z_SYNC_FLUSH }), pending: 0 }
    streams.set(res, state)
    res.set('Content-Encoding', 'gzip')
    state.gzip.on('error', () => res.destroy())
    res.on('close', () => { state.gzip.destroy(); streams.delete(res) })
    state.gzip.pipe(res)
  }
  res.flushHeaders()
}

/** Count queued input before compression too: compression must not weaken the 256 KiB backpressure bound. */
export function sseBufferedBytes(res: Response) {
  const state = streams.get(res)
  return res.writableLength + (state ? state.pending + state.gzip.readableLength : 0)
}
export function writeSse(res: Response, frame: string) {
  const state = streams.get(res)
  if (!state) { res.write(frame); return }
  if (state.gzip.writableEnded || res.destroyed) return
  const bytes = Buffer.byteLength(frame)
  state.pending += bytes
  // Z_SYNC_FLUSH applies to every write, so a complete frame is visible without waiting for the next frame or EOF.
  state.gzip.write(frame, () => { state.pending -= bytes })
}
export function endSse(res: Response) {
  const state = streams.get(res)
  if (state) state.gzip.end() // pipe ends the response after the final frame and gzip trailer have drained
  else res.end()
}
