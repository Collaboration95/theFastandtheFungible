# Portable receipt format and offline verification

Specification derived from `sdk/verify.ts`, `shared/contracts/receipts.ts`,
`shared/manifest.ts`, `server/audit.ts` and `shared/contribution.ts` on 4 November
2026. TypeScript behavior is the reference, including the limitations below.
This is an evidence consistency protocol, not proof of truth, legal identity,
semantic value or ledger settlement. No verification authorizes spending.

## Wire fields and validation

The complete field-by-field, nested type, required/optional, enum, literal,
length, numeric range and regex inventory is the packaged
[bundle schema](../packages/sdk-python/src/researchagent/bundle-schema.json) and
[report schema](../packages/sdk-python/src/researchagent/report-schema.json).
These are input JSON Schema snapshots of the Zod contracts. Regenerate with
`node --import tsx scripts/receipt-conformance.ts`; a TS regression detects drift.
Python interprets the schemas locally without third-party JSON Schema packages.
Zod refinements not expressible in these snapshots are normative too: manifest
claim covers require manifest schemaVersion 2; an RLUSD issuer must carry the
correct real-Testnet or substitute label. Source identities and fact covers are
strict objects; other typed objects strip unknown fields before verification.
Audit data is arbitrary JSON and retains its unknown keys. Missing optional
values stay missing, distinct from JSON null. All numbers must be finite.

| Bundle field | Meaning and checks |
|---|---|
| schemaVersion | Literal 1, 2 or 3; selects contribution dispatch below |
| identityVersion | Optional literal 1 or 2; mandatory in v3 |
| contributions | Optional structural-v1 evidence; mandatory in v3 |
| requirements | Optional requested facts r1–r5, not independently assessed |
| runId, label | Strings identifying run and disclosed execution mode |
| answers | Nonempty list of versioned conclusions, claims, citations and gaps |
| sources | Accessible bodies and spans, profile/resource/article version identity |
| candidates | Public tier, price, writer, licensing, routing and optional manifest |
| intents | Lifecycle, quote, receipt/tx links, refund and escrow evidence |
| grants | Run, intent, resource/version, root digest and grant time |
| receipts | Labelled charge, run, intent, resource/version, amount and optional ledger proof |
| payments | Exported payment/refund/escrow rows; all row fields in schema are retained |
| proofs | Resource/version, optional routing/intent, signed manifest and ordered salts |
| audit | Anchor seq/hash, entries and head hash |

Input may instead be `{verification: bundle, report?: report}`. A present report
must parse, have access.runId equal to the bundle run, and have identical parsed
sources, receipts and refund projection. Findings, firstFindings and finalFindings
are checked as extra claim groups. Refund projection is intentId, resourceId,
version, amountMinor and txHash, in intent order (the reference omits source).

## Version dispatch and source identity

v1/v2 reject contributions or identityVersion extensions. v3 requires both and
recomputes contributions exactly. Identity dispatch uses identityVersion when
present, otherwise schemaVersion. Identity 1 forbids routing source objects on
sources, candidates, intents, quotes, grants, receipts, proofs and answer citations.
Its key is `resourceId + "@" + version`; historical origin remains unresolved.

Identity 2 requires source on every such reference. source has schemaVersion 1,
origin URL, sellerKey, profileId, resourceId and version. Local resource/version
and any local profileId must match the routing object. Key is compact JSON of
`[origin,sellerKey,profileId,resourceId,version]`, with no origin normalization.
A reservation audit entry must bind intent and source key, and the quote must
have that key. Alternatively SKIPPED may have a matching refusal audit entry,
no tx/receipt/escrow, no associated payment/receipt/grant, no sign/escrow-sign/
settle/ESCROW_CREATE event, and absent or matching quote.
Sources, proofs, intent IDs and payment intent IDs must each be unique.

## Canonical bytes, hashes and signatures

Hash is lowercase SHA-256 hex of UTF-8. Canonical JSON recursively sorts object
keys by JavaScript UTF-16 code unit order, omits undefined object properties,
preserves array order, emits compact JSON strings without ASCII escaping, and
uses ECMAScript JSON number spelling (negative zero is zero). JSON null is
retained. Receipt input is JSON, so undefined cannot be supplied.

A passage leaf is SHA-256 of salt, zero-based decimal index, passage ID and exact
passage text joined by U+001F. Root is SHA-256 of the concatenated lowercase
hex leaves, not a binary Merkle tree. Every text must occur literally in body;
leaf count, ordered hashes, root, salt count and unique passage IDs must match.
Word count uses Unicode letter/number tokens, allowing an apostrophe followed
by letters. Claim leaf must identify a delivered passage; its kind checker must
pass there. Dated-figure requires a recognized date and another digit in the same
sentence; named-source uses attributed name/quote patterns; numeric-series needs
three unit/currency numbers. These lexical checks follow `shared/manifest.ts`.
Fact covers check normalized entity, measure, optional period/comparison phrases
on that passage. Normalization lowercases, removes possessive/apostrophes and
collapses non-ASCII-alphanumeric boundaries; period substitutes years 2023–2030
with spelled-out menu years. These are lexical promises, not semantic truth.

Manifest includes publisherSlug, articleId, article version, wallet, pubKey,
priceMinor, leaves, root, claims, wordCount, publishedAt, relevance, sig and
optional schemaVersion 2. Signing message is UTF-8 of
`researchagent-manifest-v1:` plus canonical manifest with sig removed, or
`researchagent-manifest-v2:` when its schemaVersion is 2. Article version is
unrelated to receipt or manifest schemaVersion.
Wallet must equal XRPL classic address derived from RIPEMD160(SHA256(public
key bytes)), prefixed with account byte 0, suffixed with first four bytes of
double-SHA256 checksum, encoded in Ripple base58 alphabet.
For compressed secp256k1 keys, verify strict DER ECDSA against SHA512Half(message),
rejecting high-S. ED-prefixed Ed25519 keys verify the original message using
canonical RFC8032 point encodings, scalar below group order, non-small-order
public key and the cofactored group equation (noble zip215=false behavior).
Python uses vendored MIT ecdsa 0.19.1 and six 1.17.0 for curve operations; no
signature check is skipped or delegated. Vendor origins, licenses and wheel
hashes are in `_vendor/NOTICE.md`. No external runtime dependency is required.

A source requires exactly one proof and candidate. Manifest article/version/
publisher must match source identity, sellerKey (when present) must equal pubKey,
candidate profile must match, tier PAID requires positive manifest price and FREE
requires zero. Optional candidate wallet must match. Citation identifies source
key plus spanId: exact text occurrence, signed leaf at that index, root and source
signature must all pass. No semantic entailment is claimed.

## Audit and financial links

Genesis is 64 zeros. Anchor sequence zero requires genesis hash. Every entry
increments sequence by one and names prior hash. Full entry hash is SHA-256 of
compact JSON `[seq,at,prevHash,runId,intentId,surface,principal,kind,canonical(data)]`.
Other runs can be opaque `{seq,prevHash,hash,commitment:true}` links: their contents
are not authenticated. At least one entry is required; final hash must equal head
and optional independently supplied expect_head. Without that head a wholesale
rewrite/truncation cannot be detected. The audit does not commit answer bodies.

PAID source proof intent must be VERIFIED, with grant in this run, root digest
and source key matching; intent profile/amount and payment payee match manifest.
A proof audit entry must say verified=true and matching contentDigest, or scheme
escrow-v1 for escrow. For each receipted/refunded/VERIFIED intent:

- Exactly one payment row and a receipt; receipt routing key matches when present.
- Payment run/writer/resource/version, amount, label, status and transaction agree
  with intent/receipt; tx uses receipt.xrpl.txHash when present, otherwise intent tx.
- Candidate is PAID with a valid signed manifest matching article/version/profile,
  quote root/payTo and intent amount.
- Quote payment invoiceId equals quoteHash and payment invoiceId. Non-escrow also
  requires uppercase SHA256(quoteId). Its parsed invoice article/version/payTo/
  amount/root/asset must equal intent and row (missing invoice/row asset defaults XRP).
- Payment asset equals quote payment asset, including missing vs present semantics.
  XRP amount is amountMinor*1000 decimal drops; issued asset is amountMinor/100
  with two decimals. These are labelled demo units, not an FX promise.
- Settle audit entry for this run binds txHash, amountMinor, and quote payTo;
  non-escrow additionally requires a matching sign event.
- Escrow terms canonical JSON equals quoteId; row state equals intent state,
  root/amount/payer agree. CANCELLED charges zero, amountDrops "0", pays back payer;
  otherwise pays quote payTo. Offline verification does not prove ledger execution.
- Refund row hash/amount equal intent refund, or empty strings if absent; refund
  event binds refund tx, amount and original payment tx.

Receipt count equals purchase-row count, every receipt has an intent, and every
settle/refund audit event has a matching payment row/hash. This is exactly the
reference coverage check; offline verification does not re-run budget policy or
prove historical ordering of delivery against grant issuance.

## v3 structural contribution recomputation

In receipt order find its intent, same-source grant and delivered source. Only
VERIFIED with both grant and source creates links. Visit answers/claims/citations
in order, deduplicating citation key `[sourceKey,spanId]` within each claim.
A delivered matching span yields answerVersion, claimId, claim text, citation key,
spanId, passage, grant digest, grantIntentId, retained. Retained means final answer
has identical claim ID/text and citation identity. Final means last array element,
not highest version. Gross is receipt amount; refund is recorded intent refund
or zero; net is gross minus refund. Refund status is recorded verified refund,
pending (candidate or CHALLENGED), refused (CHALLENGE_REFUSED/REJECTED), else none.
Structural use is cited if any link has final answer version, else none.
Assessment stays not assessed; semanticStatus stays not independently verified.
All fields must canonical-compare equal to exported contributions.
Changing legacy claim text alone can remain valid; v3 detects inconsistency with
saved links, but coordinated rewriting of answers and links is not authenticated.
Retention is a v3 concept; v1/v2 reject contribution extensions.

Network ledger checks are opt-in in TS and absent in Python: Python always reports
testnet SKIP. Offline success verifies evidence consistency, never ledger finality.
The legacy Node wrapper remains explicitly selected by Client.verify(repo_dir=...).
