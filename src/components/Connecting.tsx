import { useEffect, useState } from 'react'

export default function Connecting() {
  const video = import.meta.env.VITE_DEMO_VIDEO_URL
  const [slow, setSlow] = useState(false)
  useEffect(() => { const timer = setTimeout(() => setSlow(true), 5000); return () => clearTimeout(timer) }, [])
  return <main id="main" className="ra-home-wrap"><section className="ra-home ra-connecting" aria-label="Connecting to the demo">
    <h1>Connecting to the demo…</h1>
    <p role="status">{slow ? 'Your network is slow; still trying.' : 'Connecting to ResearchAgent…'}</p>
    <p><a href="https://collaboration95.github.io/theFastandtheFungible/demo/">Watch the recorded walkthrough</a></p>
    <p>{typeof video === 'string' && video.startsWith('https://') ? <a href={video}>Watch the demo video</a> : <a href="https://collaboration95.github.io/theFastandtheFungible/talk/">View the pitch</a>}</p>
  </section></main>
}
