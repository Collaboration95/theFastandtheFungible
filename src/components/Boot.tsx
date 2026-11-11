import { useEffect, useState } from 'react'
import App from '../App'
import { detectHosted } from '../api'
import Connecting from './Connecting'

// Resolve the environment before mounting App: only a server answer may select local UI on a hosted origin.
export default function Boot() {
  const [result, setResult] = useState<Awaited<ReturnType<typeof detectHosted>>>()
  useEffect(() => {
    let cancelled = false
    const connect = async () => {
      while (!cancelled) {
        const next = await detectHosted()
        if (!next.failed) {
          if (cancelled) return
          // Record mode is an owner tool, never available to a hosted visitor.
          if (next.status && document.documentElement.dataset.record) {
            delete document.documentElement.dataset.record
            const url = new URL(location.href); url.searchParams.delete('record'); history.replaceState(null, '', url)
          }
          setResult(next); return
        }
        await new Promise(resolve => setTimeout(resolve, 15000))
      }
    }
    void connect()
    return () => { cancelled = true }
  }, [])
  if (!result) return <Connecting />
  return <App hosted={result.status} />
}
