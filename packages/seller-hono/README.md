# x402 key-reveal seller for Hono

Local install (Node 22.13+), before publication:

```sh
npm pack ./packages/seller-core --pack-destination /tmp
npm pack ./packages/seller-hono --pack-destination /tmp
npm install /tmp/researchagent-seller-core-0.1.0.tgz /tmp/researchagent-seller-hono-0.1.0.tgz hono @hono/node-server xrpl
```

Create the private journal directory before starting: `mkdir -p private && chmod 700 private`.

The 10-line quickstart below assumes a connected Testnet client and wallet
provided by the operator; no signing key is logged.

```js
import {Hono} from 'hono'
import {serve} from '@hono/node-server'
import {Client, Wallet} from 'xrpl'; import {keyReveal} from '@researchagent/seller-hono'
const client = new Client('wss://s.altnet.rippletest.net:51233'); await client.connect()
const wallet = Wallet.fromSeed(process.env.TESTNET_SELLER_SEED)
const seller = keyReveal({client, wallet, dbPath: './private/seller.db',
  resourceUrl: 'https://seller.example/article', content: () => 'Your article.'})
const app = new Hono()
app.get('/article', seller.middleware)
serve({fetch: app.fetch, port: 8080})
```

Unpublished source, version 0.1.0. The owner publishes these packages. No registry
publication or hosted deployment is part of this change. Testnet only (`xrpl:1`),
native XRP, scheme `key-reveal-escrow`, x402 v2 headers. It preserves the example's
`extra.invoiceId`, `buyer`, `condition`, `cancelAfter` and `extensions.keyReveal`
(ciphertext, iv, tag, plaintextHash). It does not implement the separate exact
paid-answer API. No plaintext or key is returned over HTTP.

Use a unique seller wallet and a private persistent journal per process. The
journal contains unrevealed keys and signed finish blobs: protect the directory
(mode 0700), backups and disk, and never log it. The package sets its DB file to
0600. One process must own a journal and wallet; horizontally scaled writers
need an external atomic journal and sequence allocator before adopting this
implementation. Configure ingress rate limits and content authorization before
exposing it. The offer table is bounded (default 1000); it refuses new invoices
at capacity instead of discarding recovery records.

The buyer supplies `?buyer=<classic-address>&intent=<stable-key>` and receives a
402 with the same challenge in `PAYMENT-REQUIRED` and JSON. The buyer verifies
its policy budget and terms, creates and validates EscrowCreate with a MemoData
SHA-256 commitment to canonical JSON of the complete challenge, then sends
`PAYMENT-SIGNATURE` containing `{x402Version:2,accepted,payload:{signedTxBlob}}`.
The seller independently verifies the validated create and live escrow before
signing EscrowFinish. It persists the original signed finish before submitting;
retries reuse it and return the same finish hash. **Never create another escrow
after an uncertain response.** Read the original ledger transaction and retry
the same intent and signed create only. An uncertain finish blocks new finish signatures for other invoices until its
original outcome is reconciled. An expired/failed finish needs operator
reconciliation; the package does not silently sign a replacement.

The buyer reads the validated finish from Testnet, verifies the escrow owner,
sequence, successful result, Condition and Fulfillment, computes sha256(key),
and decrypts/checks AES-GCM plus plaintextHash. Read-only crypto helpers do not
verify ledger finality for you. Ciphertext may be served before settlement;
plaintext must remain quarantined until these checks succeed. Ciphertext
quality is not guaranteed by key revelation. Keys become public after reveal:
use a fresh per-invoice key, and do not claim per-buyer DRM.

On withholding, CancelAfter permits **an explicit EscrowCancel** to return
principal. It is not an automatic refund and network fees are not refunded.
The default expiry is 60 seconds, configurable 24–300; callers need enough
ledger time for validation and should decline short remaining windows. Before a
new finish is signed, the reference implementation checks the latest validated
ledger both before and after autofill and requires more than eight seconds to
expiry. This reduces stale reveals; it cannot remove a later validation race.


The current profile mirrors ciphertext in the JSON body and `PAYMENT-REQUIRED`
header. Hex plus base64 needs about 2.67 times the plaintext size, plus metadata.
Set an application payload cap and qualify response-header limits across the
server, proxy and buyer before serving long articles. The acceptance fixture
is short; it does not qualify large-article transport. A body-only or
content-addressed ciphertext profile would need a separate compatibility draft.

No mainnet support, IOU/RLUSD support, external facilitator or environment
wallet discovery. The signer verifies network_id=1; use dedicated Testnet
accounts because standard-network XRPL signatures omit NetworkID.

Tests: `npm test --prefix packages/seller-hono` after installing its local core and peer
packages. `XRPL_KEY_REVEAL_TESTNET=1 npm test --prefix packages/seller-hono` opts into
a faucet-funded real Testnet purchase and prints its create/finish hashes.
The cross-stack acceptance runner is `scripts/reach/acceptance.mjs` in the source
repository. Close the HTTP server, then `seller.close()` and `client.disconnect()`
on shutdown; do not close the journal while a finish is in flight.
