/** Called only after DONE. A failed load is reported by the explicit verifier, whose reload action clears the browser's failed-import cache. */
export function warmVerifier(): () => void {
  const load = () => { if (navigator.onLine) void import('./verify/browser').catch(() => undefined) }
  if ('requestIdleCallback' in window) {
    const id = window.requestIdleCallback(load)
    return () => window.cancelIdleCallback(id)
  }
  const id = setTimeout(load, 0)
  return () => clearTimeout(id)
}
