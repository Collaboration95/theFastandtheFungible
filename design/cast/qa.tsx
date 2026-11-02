import { createRoot } from 'react-dom/client'
import Cast, { type CastProps } from '../../src/components/Cast'
import manifest from '../../src/assets/cast/manifest.json'
import '../../src/styles.css'

createRoot(document.getElementById('root')!).render(<main style={{ padding: 24 }}>
  <h1>ResearchAgent cast</h1>
  <p>Illustrated states. Eight fictional writers. SIMULATED artwork is not a payment receipt; Ledger is Testnet artwork, not a live clock. Locked Purse is a future escrow illustration.</p>
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
    {manifest.map(asset => <figure key={asset.file} style={{ margin: 0 }}>
      <Cast {...({ who: asset.who, pose: asset.pose } as CastProps)} size={160} motion />
      <figcaption>{asset.name} · {asset.pose}</figcaption>
    </figure>)}
  </div>
</main>)
