// Produce copy-review captions without media or synthetic audio. Owner assembly replaces estimates.
import { readFileSync, writeFileSync } from 'node:fs'
import { splitSentences, splitSubtitles, timeCues, toSrt } from './lib/timeline.mjs'
const dir = 'docs/submission/video'
const spec = JSON.parse(readFileSync(`${dir}/shots.json`, 'utf8'))
let start = 0
const cues = []
const shots = spec.shots.filter(s => s.enabled).map(s => {
  const words = s.vo.split(/\s+/).length
  const duration = Math.max(s.minSeconds, words / 2.5 + 1)
  const sentences = splitSentences(s.vo).map(text => {
    const seconds = text.split(/\s+/).length / 2.5
    const cue = { start, end: start + seconds, text }
    start += seconds
    cues.push(...timeCues(splitSubtitles(text), cue.start, seconds))
    return cue
  })
  const begin = sentences[0].start
  start = begin + duration
  return { id: s.id, title: s.title, start: begin, end: start, words, sentences }
})
writeFileSync(`${dir}/voiceover.txt`, spec.shots.map(s => `# ${s.id} · ${s.title}\n${s.vo}\n`).join('\n'))
writeFileSync(`${dir}/captions.srt`, toSrt(cues))
writeFileSync(`${dir}/timing.json`, JSON.stringify({ mode: 'planning-estimate', wordsPerMinute: 150, note: 'No media or owner audio measured; reassemble with real owner takes.', shots }, null, 2) + '\n')
writeFileSync(`${dir}/timing.csv`, 'shot,title,start,end,words\n' + shots.map(s => [s.id,s.title,s.start.toFixed(2),s.end.toFixed(2),s.words].join(',')).join('\n') + '\n')
