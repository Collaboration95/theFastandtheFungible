// The evidence harness omits server/index.ts's advisory credential prewarm.
// Warm the same real public-node cache before filming; signed search metadata
// must still bind each displayed writer to its wallet. No setup transactions.
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Wallet } from 'xrpl'

await import('../../../docs/evidence/writer-credentials-nov12/local-hosted.ts')
const { prewarmWriterVerification, writerVerification } = await import('../../../server/writer-credentials.ts')
await prewarmWriterVerification()
const subjects = ['TEAM_BUILDER_NOTES', 'TEAM_XRPL_EXPLAINERS', 'OPEN_RECORDS'].map(slug => {
  const seed = process.env[`XRPL_PUBLISHER_${slug}_SEED`]
  if (!seed) throw new Error('Missing private writer identity configuration')
  return Wallet.fromSeed(seed).address
})
const deadline = Date.now() + 90_000
while (Date.now() < deadline) {
  const values = await Promise.all(subjects.map(subject => writerVerification(subject)))
  if (values.every(value => value.status === 'verified')) {
    writeFileSync(join(process.env.HOSTED_STACK_DIR, 'identity-ready.json'), JSON.stringify({ verifiedWriters: values.length }))
    break
  }
  await new Promise(done => setTimeout(done, 500))
}
