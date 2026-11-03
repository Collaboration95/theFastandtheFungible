// Rebuild the 19 s README refund scene from the v0.6.0 release clip.
// gh release download v0.6.0 --pattern uc3-2026-11-03.mp4 --dir /tmp/readme-272-assets
// node scripts/readme-media.mjs /tmp/readme-272-assets/uc3-2026-11-03.mp4
import { execFileSync } from 'node:child_process'
import { mkdirSync, statSync } from 'node:fs'
const source = process.argv[2]
if (!source) throw new Error('Supply the v0.6.0 UC3 MP4 path')
mkdirSync('docs/media', { recursive: true })
const output = 'docs/media/refund-demo.gif'
execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', '1', '-i', source, '-t', '19', '-filter_complex', 'fps=6,scale=720:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=64:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4', '-loop', '0', output])
const bytes = statSync(output).size
if (bytes > 4_000_000) throw new Error(`Demo exceeds 4 MB: ${bytes}`)
console.log(`${output}: ${bytes} bytes`)
