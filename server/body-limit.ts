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
