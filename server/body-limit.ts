/** Count delivered bytes, including chunked responses with no Content-Length. */
export async function boundedBody(response: Response, limit: number): Promise<Buffer> {
  const reader = response.body?.getReader()
  if (!reader) return Buffer.alloc(0)
  const chunks: Buffer[] = []
  let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) return Buffer.concat(chunks, size)
      size += value.byteLength
      if (size > limit) throw new Error('Publisher response exceeds byte limit')
      chunks.push(Buffer.from(value))
    }
  } finally { await reader.cancel().catch(() => undefined); reader.releaseLock() }
}

/** Recognize parser failures without exposing request bytes or parser details. */
export function requestBodyStatus(error: unknown): 400 | 413 | undefined {
  if (!error || typeof error !== 'object') return undefined
  const e = error as { type?: string; status?: number }
  if (e.type === 'entity.too.large' && e.status === 413) return 413
  if (e.type === 'entity.parse.failed' && e.status === 400) return 400
}
