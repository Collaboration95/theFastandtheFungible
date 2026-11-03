/** Bound dependency probes even when a websocket/node never answers. */
export async function bounded<T>(task: Promise<T>, ms = 3000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try { return await Promise.race([task, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Dependency timeout')), ms) })]) }
  finally { clearTimeout(timer) }
}
