// Render the README hero from a recording of the default /demo/ Testnet UC3 replay.
// node scripts/readme-media.mjs <video> [start-seconds=1] [length-seconds=26]
// The key-reveal replay finishes in about 10 s: node scripts/readme-media.mjs uc3.webm 0.3 12
import { execFileSync } from 'node:child_process'
import { mkdirSync, statSync } from 'node:fs'
const source = process.argv[2]
if (!source) throw new Error('Supply the Testnet UC3 replay video path')
mkdirSync('docs/media', { recursive: true })
const [, , , start = '1', length = '26'] = process.argv
const output = 'docs/media/refund-demo.gif'
execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', start, '-i', source, '-t', length, '-filter_complex', 'fps=6,scale=720:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=64:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4', '-loop', '0', output])
const bytes = statSync(output).size
if (bytes > 4_000_000) throw new Error(`Demo exceeds 4 MB: ${bytes}`)
console.log(`${output}: ${bytes} bytes`)
