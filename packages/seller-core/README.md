# Shared seller protocol core

Express and Hono use this package so protocol and retry checks stay identical.
It is an unpublished fourth supporting package, needed before either adapter
can be published. Its public types include Offer, Requirements and Envelope.

Install a locally packed core archive plus `xrpl`. Create `private` with mode
0700 first. Ten-line quickstart (returns an unpaid ciphertext challenge):

```js
import {Client, Wallet} from 'xrpl'; import {createSeller} from '@researchagent/seller-core'
const client = new Client('wss://s.altnet.rippletest.net:51233'); await client.connect()
const wallet = Wallet.fromSeed(process.env.TESTNET_SELLER_SEED)
const seller = createSeller({client, wallet, dbPath: './private/seller.db',
  resourceUrl: 'https://seller.example/article', content: () => 'Your article.'})
const request = {buyer: process.env.TESTNET_BUYER_ADDRESS, intent: 'article-001'}
const response = await seller.handle(request)
console.log(response.status, response.body)
seller.close()
await client.disconnect()
```


```sh
node --test packages/seller-core/test.mjs
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
ledger time for validation and should decline short remaining windows.


The current profile mirrors ciphertext in the JSON body and `PAYMENT-REQUIRED`
header. Hex plus base64 needs about 2.67 times the plaintext size, plus metadata.
Set an application payload cap and qualify response-header limits across the
server, proxy and buyer before serving long articles. The acceptance fixture
is short; it does not qualify large-article transport. A body-only or
content-addressed ciphertext profile would need a separate compatibility draft.

No mainnet support, IOU/RLUSD support, external facilitator or environment
wallet discovery. The signer verifies network_id=1; use dedicated Testnet
accounts because standard-network XRPL signatures omit NetworkID.

New finishes require more than eight seconds to expiry at validated-ledger
checks before and after autofill. This reduces stale reveals without promising
unconditional atomicity; recovery still uses the original signed finish only.
