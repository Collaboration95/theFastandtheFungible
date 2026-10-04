import type { Answer, Citation, ContentEnvelope } from '../../shared/contracts/index.js'
export function resolveCitation(citation: Citation, contents: ContentEnvelope[]) { const content = contents.find(c => c.resourceId === citation.resourceId && c.version === citation.version); return content?.spans.find(s => s.id === citation.spanId && content.body.includes(s.text)) }
export function validateAnswer(_answer: Answer, _contents: ContentEnvelope[]): Answer { throw new Error('TODO(W1-RESEARCH)') }
