// ANSI → HTML for the terminal scenes. Pure functions, unit-tested (tests/video-kit.test.js).
// The input is what `tmux capture-pane -e` returns: SGR colour/attribute codes and, for links, OSC 8 sequences.

/** 16 base colours of the terminal theme; 16–255 follow the xterm cube and grey ramp. */
export const THEMES = {
  dark: { bg: '#1c1b1a', fg: '#e9e5dd', dim: 0.62, cursor: '#e9e5dd', base: ['#1c1b1a', '#e5736a', '#8fc27a', '#e0b85c', '#78a9e8', '#c58ae0', '#6cc4c0', '#cfcac2', '#6f6b66', '#f2958d', '#a9d996', '#ecd085', '#9bc0f0', '#d8a8ec', '#92d8d4', '#f6f3ee'] },
  light: { bg: '#fdfcf9', fg: '#26231f', dim: 0.58, cursor: '#26231f', base: ['#26231f', '#b4372c', '#2f7a3a', '#8a6414', '#2a5cb0', '#8a3fa8', '#1c7c78', '#6a655e', '#8c867e', '#d04a3d', '#3f9a4c', '#a67c1c', '#3c74d0', '#a458c4', '#2a9a96', '#3a3631'] },
}

export function paletteColor(n, theme = THEMES.dark) {
  if (n < 16) return theme.base[n]
  if (n >= 232) { const v = 8 + (n - 232) * 10; return `rgb(${v},${v},${v})` }
  const i = n - 16, steps = [0, 95, 135, 175, 215, 255]
  return `rgb(${steps[Math.floor(i / 36)]},${steps[Math.floor(i / 6) % 6]},${steps[i % 6]})`
}

const esc = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const ANSI = /\x1b\[([0-9;:]*)m|\x1b\]8;[^\x07\x1b]*(?:\x07|\x1b\\)|\x1b\[[0-9;?]*[A-Za-ln-z]/g // eslint-disable-line no-control-regex

/** Strip every escape sequence: the text a viewer can read. */
export function plain(line) { return line.replace(ANSI, '') }

/** Parse one captured line into styled runs [{text, fg, bg, bold, dim, italic, underline, reverse, strike}]. */
export function parseLine(line) {
  const runs = []
  let style = {}, last = 0, match
  ANSI.lastIndex = 0
  const push = text => { if (text) runs.push({ text, ...style }) }
  while ((match = ANSI.exec(line))) {
    push(line.slice(last, match.index)); last = ANSI.lastIndex
    if (match[1] === undefined) continue // OSC 8 or a non-colour CSI: dropped
    const codes = match[1] === '' ? [0] : match[1].split(/[;:]/).map(Number)
    for (let i = 0; i < codes.length; i++) {
      const c = codes[i]
      if (c === 0) style = {}
      else if (c === 1) style = { ...style, bold: true }
      else if (c === 2) style = { ...style, dim: true }
      else if (c === 3) style = { ...style, italic: true }
      else if (c === 4) style = { ...style, underline: true }
      else if (c === 7) style = { ...style, reverse: true }
      else if (c === 9) style = { ...style, strike: true }
      else if (c === 22) style = { ...style, bold: false, dim: false }
      else if (c === 23) style = { ...style, italic: false }
      else if (c === 24) style = { ...style, underline: false }
      else if (c === 27) style = { ...style, reverse: false }
      else if (c === 29) style = { ...style, strike: false }
      else if (c >= 30 && c <= 37) style = { ...style, fg: { n: c - 30 } }
      else if (c >= 90 && c <= 97) style = { ...style, fg: { n: c - 90 + 8 } }
      else if (c >= 40 && c <= 47) style = { ...style, bg: { n: c - 40 } }
      else if (c >= 100 && c <= 107) style = { ...style, bg: { n: c - 100 + 8 } }
      else if (c === 39) style = { ...style, fg: undefined }
      else if (c === 49) style = { ...style, bg: undefined }
      else if (c === 38 || c === 48) {
        const key = c === 38 ? 'fg' : 'bg'
        if (codes[i + 1] === 5) { style = { ...style, [key]: { n: codes[i + 2] } }; i += 2 }
        else if (codes[i + 1] === 2) { style = { ...style, [key]: { rgb: [codes[i + 2], codes[i + 3], codes[i + 4]] } }; i += 4 }
      }
    }
  }
  push(line.slice(last))
  return runs
}

const colour = (value, theme) => !value ? undefined : value.rgb ? `rgb(${value.rgb.join(',')})` : paletteColor(value.n, theme)

/** One line as HTML. `cursorAt` (a column) paints a block cursor. */
export function lineHtml(line, theme = THEMES.dark, cursorAt = -1) {
  const runs = parseLine(line)
  let col = 0, html = ''
  for (const run of runs) {
    let text = run.text, before = '', cursor = ''
    if (cursorAt >= col && cursorAt < col + [...text].length) {
      const chars = [...text], at = cursorAt - col
      before = chars.slice(0, at).join(''); cursor = chars[at]; text = chars.slice(at + 1).join('')
    }
    const styled = (t, extra = '') => {
      if (!t) return ''
      let fg = colour(run.fg, theme) ?? theme.fg, bg = colour(run.bg, theme)
      if (run.reverse) [fg, bg] = [bg ?? theme.bg, fg]
      const css = [`color:${fg}`, bg ? `background:${bg}` : '', run.bold ? 'font-weight:650' : '', run.dim ? `opacity:${theme.dim}` : '', run.italic ? 'font-style:italic' : '',
        run.underline ? 'text-decoration:underline' : '', run.strike ? 'text-decoration:line-through' : '', extra].filter(Boolean).join(';')
      return `<span style="${css}">${esc(t)}</span>`
    }
    html += styled(before) + (cursor ? styled(cursor, `background:${theme.cursor};color:${theme.bg}`) : '') + styled(text)
    col += [...run.text].length
  }
  if (cursorAt >= col) html += `<span style="background:${theme.cursor}">${' '.repeat(Math.max(0, cursorAt - col))}&nbsp;</span>`
  return html
}

/** Apply the scene's redactions to a captured line: home directory → "~", and rows that show personal usage are blanked. */
export function redactLine(line, { home, user, blankRows = [] } = {}) {
  const text = plain(line)
  if (blankRows.some(pattern => pattern.test(text))) return ''
  let out = line
  if (home) out = out.split(home).join('~')
  if (user) out = out.split(`/Users/${user}`).join('~')
  return out
}
