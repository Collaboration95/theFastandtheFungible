/** Synthetic identity projection for comparing unchanged fixture spending against main. No RPC. */
import { PublisherClient } from '../../server/publisher-client.js'
export { createApiApp } from '../../server/routes.js'
const original = PublisherClient.prototype.searchPublisher
PublisherClient.prototype.searchPublisher = async function (...args) {
  return (await original.apply(this, args)).map(hit => ({ ...hit, verification: {
    status: 'verified', issuerLabel: 'Fixture identity', issuer: 'rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV', credentialType: 'AB',
    credentialId: 'A'.repeat(64), ledgerIndex: 123, checkedAt: new Date().toISOString(),
  } }))
}
