import './writer-provenance.css'

/** Keep the publisher's full recorded disclosure reachable without repeating it in the headline. */
export default function WriterProvenance({ publisher, nameShown = false }: { publisher: string; testnet?: boolean; nameShown?: boolean }) {
  const authorship = /team-authored/i.test(publisher) ? 'Team-authored' : /documentation/i.test(publisher) ? 'Public documentation' : /fictional/i.test(publisher) ? 'Fictional writer' : 'Writer details'
  // A plain name already in the heading has no additional provenance to disclose.
  if (nameShown && authorship === 'Writer details' && !publisher.includes(' · ')) return null
  return <details className="ra-provenance">
    <summary>{authorship}</summary>
    <p>{publisher}</p>
  </details>
}
