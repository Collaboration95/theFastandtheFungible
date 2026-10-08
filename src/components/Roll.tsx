import type { CSSProperties } from 'react'

/** An amount whose digits roll like an odometer when they change; the plain text sits in a screen-reader-only span. */
export default function Roll({ text }: { text: string }) {
  return <span className="ra-roll">
    <span className="ra-sr">{text}</span>
    <span aria-hidden="true">{[...text].map((char, index) => /\d/.test(char)
      // Keyed from the right, so a digit keeps its column as the amount changes.
      ? <span key={text.length - index} className="ra-roll-d"><span style={{ '--d': Number(char) } as CSSProperties}>{[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(digit => <i key={digit}>{digit}</i>)}</span></span>
      : <span key={text.length - index}>{char}</span>)}</span>
  </span>
}
