// Offline by default. Never loads .env, a database or signing keys.
import { parseArgs } from 'node:util'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { verifyAnswer, verificationText } from '../sdk/verify.js'

try {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { testnet: { type: 'boolean', default: false }, 'expect-head': { type: 'string' }, json: { type: 'boolean', default: false } } })
  if (positionals.length !== 1) throw new Error('Usage: npm run verify -- <report.pdf|report.json|receipts.json> [--testnet] [--expect-head HASH] [--json]')
  const bytes = readFileSync(positionals[0])
  let input: unknown
  if (bytes.subarray(0, 5).toString() === '%PDF-') {
    const marker = Buffer.from('\n%RA-RECEIPTS-V1:')
    const at = bytes.lastIndexOf(marker)
    if (at < 0) throw new Error('Legacy PDF has no receipt bundle; export again with this version.')
    const attached = JSON.parse(Buffer.from(bytes.subarray(at + marker.length).toString().trim(), 'base64').toString())
    if (createHash('sha256').update(bytes.subarray(0, at)).digest('hex') !== attached.pdfSha256) throw new Error('PDF byte hash differs from its receipt attachment.')
    input = attached.export
  } else input = JSON.parse(bytes.toString('utf8'))
  const result = await verifyAnswer(input, { testnet: values.testnet, expectHead: values['expect-head'] })
  console.log(values.json ? JSON.stringify(result, null, 2) : verificationText(result))
  process.exitCode = result.ok ? 0 : 1
} catch (error) {
  console.error(error instanceof SyntaxError ? 'Invalid report JSON or PDF receipt attachment.' : error instanceof Error ? error.message : 'Cannot read report.')
  process.exitCode = 2
}
