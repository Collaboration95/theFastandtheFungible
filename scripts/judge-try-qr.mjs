// Dev-only qrcode-generator produces the committed, vector QR; no runtime dependency.
import qrcode from 'qrcode-generator'
import { mkdirSync, writeFileSync } from 'node:fs'
export const TRY_URL = 'https://collaboration95.github.io/theFastandtheFungible/try/'
const qr = qrcode(0, 'M')
qr.addData(TRY_URL)
qr.make()
mkdirSync('site/try', { recursive: true })
writeFileSync('site/try/qr.svg', qr.createSvgTag({ cellSize: 4, margin: 16, scalable: true, alt: 'Open ResearchAgent hosted demo' }) + '\n')
