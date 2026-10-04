import type { Report, RunSnapshot } from '../../shared/contracts/index.js'
export async function buildReport(_run: RunSnapshot): Promise<Report> { throw new Error('TODO(W1-REPORT)') }
export async function renderReport(_report: Report, _outputPath: string): Promise<{ format: 'PDF' | 'HTML'; path: string }> { throw new Error('TODO(W1-REPORT)') }
