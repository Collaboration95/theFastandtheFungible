import type { ReactNode } from 'react'
export default function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'error' | 'warn' }) {
  return <div className={`ra-notice is-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>{children}</div>
}
