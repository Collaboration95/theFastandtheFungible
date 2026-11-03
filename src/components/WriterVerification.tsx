import { credentialUrl, type WriterVerification as Verification } from '../../shared/writer-verification.js'
// Committed round2-n observations bind these credential object IDs to create transactions.
const creates: Record<string, string> = {
  A87F7C16204141846A1133741D101C86EBE7996CC7F53E22634BEE7520A27087: '225F19ED4BF1C206AE140D5286BE352F2F6E7A7A05A317D949DAEE876E98DAC6',
  D6688F106DD57B1886EB668F8D0A8B5BB54186DD6CBFCADB3EA72DAF2E20F613: '837A67A953660428F667319B10247CD4ED371428CA8AC806670CFEB49721FFEC',
}
/** Advisory online identity observation; never a content-quality or payment badge. */
export function WriterVerification({ value }: { value?: Verification }) {
  if (value?.status !== 'verified') return <small>unverified writer{value?.status === 'check_failed' ? ' · check unavailable' : ''}</small>
  return <small><a className="ra-link" title={`Identity issuer: ${value.issuerLabel}; not a content endorsement`} href={creates[value.credentialId] ? `https://testnet.xrpl.org/transactions/${creates[value.credentialId]}` : credentialUrl(value)} target="_blank" rel="noreferrer">Verified writer · XRPL Credential</a></small>
}
