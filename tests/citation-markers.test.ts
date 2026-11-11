import { expect, it } from 'vitest'
import { findingText, stripCitationMarkers } from '../shared/finding-text'

// H8-20: MCP and SDK callers read claim text verbatim; numeric markers belong to citation bindings, not prose.
it('drops numeric citation markers from claim text and keeps everything else', () => {
  expect(stripCitationMarkers('An HTTP 402 response offers payment requirements in PAYMENT-REQUIRED. [1] [2]')).toBe('An HTTP 402 response offers payment requirements in PAYMENT-REQUIRED.')
  expect(stripCitationMarkers('Fees are 12 drops [1,2] and 423 drops [3–4].')).toBe('Fees are 12 drops and 423 drops.')
  expect(stripCitationMarkers('Final once validated.[1]')).toBe('Final once validated.')
  expect(stripCitationMarkers('Arrays like x[0] and [RFC 9110] stay.')).toBe('Arrays like x[0] and [RFC 9110] stay.')
  expect(findingText('**Settled** only when validated [1].')).toBe('Settled only when validated.')
})
