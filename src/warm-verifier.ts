/** Called only after DONE. Failed speculative loads remain retryable by the explicit verifier action. */
export function warmVerifier(): () => void {
  const load = () => { void import('./verify/browser').catch(() => undefined) }
  if ('requestIdleCallback' in window) {
    const id = window.requestIdleCallback(load)
    return () => window.cancelIdleCallback(id)
  }
  const id = setTimeout(load, 0)
  return () => clearTimeout(id)
}
