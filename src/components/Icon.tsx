import type { CSSProperties } from 'react'
/** One 20-unit grid and 1.5-unit stroke, at 16–24 px. Decorative; controls supply their own names. */
const paths = {
  panel: 'M7 3v14M3 3h14v14H3Z', plus: 'M10 4v12M4 10h12', settings: 'M4 5h12M4 10h12M4 15h12M7 3v4M13 8v4M8 13v4',
  down: 'm5 7 5 5 5-5', right: 'm7 5 5 5-5 5', left: 'm12 5-5 5 5 5', close: 'm5 5 10 10M15 5 5 15', external: 'M11 3h6v6M17 3l-9 9M8 4H3v13h13v-5',
  check: 'm4 10 4 4 8-8', refund: 'M7 4 3 8l4 4M3 8h9a5 5 0 0 1 0 10', search: 'M14 14l4 4M15 8.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0',
  copy: 'M7 7h10v10H7ZM3 13V3h10', more: 'M3.5 10h1M9.5 10h1M15.5 10h1', send: 'M10 17V3M4 9l6-6 6 6', coin: 'M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0M10 6v8M12 7H9a2 2 0 0 0 0 3h2a2 2 0 0 1 0 3H8',
  clock: 'M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0M10 6v4l3 2', lock: 'M4 9h12v8H4ZM6 9V6a4 4 0 0 1 8 0v3', stop: 'M5 5h10v10H5Z', circle: 'M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0', info: 'M10 9v5M9.5 6h1M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0',
} as const
export type IconName = keyof typeof paths
export default function Icon({ name, size = 20, style }: { name: IconName; size?: 16 | 20 | 24; style?: CSSProperties }) {
  return <svg className="ra-icon" width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" style={style}><path d={paths[name]} /></svg>
}
