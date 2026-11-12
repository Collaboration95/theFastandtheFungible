import qrcode from 'qrcode-generator'
import { writeFileSync } from 'node:fs'
const url = process.argv[2]
if (!url || new URL(url).protocol !== 'https:' || !new URL(url).searchParams.has('writers')) throw Error('Usage: node scripts/publishing-qr.mjs https://host/?writers=1')
const qr=qrcode(0,'M');qr.addData(url);qr.make()
writeFileSync('docs/evidence/publish/qr.svg',qr.createSvgTag({cellSize:4,margin:16,scalable:true,alt:'Publish a note in ResearchAgent'})+'\n')
