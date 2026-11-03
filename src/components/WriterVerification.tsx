import { credentialUrl, type WriterVerification as Verification } from '../../shared/writer-verification.js'
/** Advisory online identity observation; never a content-quality or payment badge. */
export function WriterVerification({ value }: { value?: Verification }) {
  if (value?.status !== 'verified') return <small>unverified writer{value?.status === 'check_failed' ? ' · check unavailable' : ''}</small>
  return <small><a className="ra-link" href={credentialUrl(value)} target="_blank" rel="noreferrer">Verified · {value.issuerLabel} · XRPL Credential</a></small>
}
