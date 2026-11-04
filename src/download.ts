/** Save JSON the page already holds (or can fetch from its own API) as a file. */
export function saveJson(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2) + '\n'], { type: 'application/json' }))
  const link = document.createElement('a'); link.href = url; link.download = name; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export async function saveReceipts(runId: string, name = 'receipts.json', pick?: (bundle: Record<string, unknown>) => unknown) {
  const response = await fetch(`/runs/${encodeURIComponent(runId)}/receipts.json`)
  if (!response.ok) throw new Error('receipts unavailable')
  const bundle = await response.json(), data = pick ? pick(bundle) : bundle
  if (data !== undefined) saveJson(name, data)
}
