import './writer-provenance.css'

/** Keep the publisher's full recorded disclosure reachable without repeating it in the headline. */
export default function WriterProvenance({ publisher, testnet = /Testnet/i.test(publisher) }: { publisher: string; testnet?: boolean }) {
  const authorship = /team-authored/i.test(publisher) ? 'Team-authored' : /fictional/i.test(publisher) ? 'Fictional writer' : 'Writer details'
  return <details className="ra-provenance">
    <summary>{authorship}{testnet && ' · Testnet'}</summary>
    <p>{publisher}</p>
  </details>
}
