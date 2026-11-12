import { useEffect, useState } from 'react'
export default function PendingTime({ since }: { since?: string }) {
  const [start] = useState(() => since ? Date.parse(since) : Date.now())
  const [now, setNow] = useState(Date.now)
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer) }, [])
  return <p role="status">Waiting for ledger confirmation · {Math.max(0, Math.floor((now - start) / 1000))} s. Confirmation can take a moment.</p>
}
