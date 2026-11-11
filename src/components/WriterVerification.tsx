import Icon from './Icon'
import { credentialUrl, credentialDomainUrl, type WriterVerification as Verification } from '../../shared/writer-verification.js'
// Committed round2-n observations bind these credential object IDs to create transactions.
const creates: Record<string, string> = {
  A87F7C16204141846A1133741D101C86EBE7996CC7F53E22634BEE7520A27087: '225F19ED4BF1C206AE140D5286BE352F2F6E7A7A05A317D949DAEE876E98DAC6',
  D6688F106DD57B1886EB668F8D0A8B5BB54186DD6CBFCADB3EA72DAF2E20F613: '837A67A953660428F667319B10247CD4ED371428CA8AC806670CFEB49721FFEC',
}
/** Advisory online identity observation; never a content-quality or payment badge. */
export function WriterVerification({ value }: { value?: Verification }) {
  if (value?.status !== 'verified') return <small>{value?.status === 'check_pending' ? 'check pending' : value?.status === 'check_failed' ? 'check unavailable' : 'unverified writer'}</small>
  const tx = value.credentialTxHash ?? creates[value.credentialId]
  const domain = credentialDomainUrl(value)
  return <small title="Identity, not quality"><a className="ra-link" title="Identity, not quality" href={tx ? `https://testnet.xrpl.org/transactions/${tx}` : credentialUrl(value)} target="_blank" rel="noreferrer">XRPL Credential · issued by {value.issuerLabel} (Testnet, identity only, not KYC)</a>{domain && <> · <a className="ra-link" title="Identity, not quality" href={domain} target="_blank" rel="noreferrer">domain <Icon name="external" size={16} /></a></>}</small>
}
