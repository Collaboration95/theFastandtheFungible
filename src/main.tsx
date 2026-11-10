import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { detectHosted } from './api'
import './styles.css'
import './hosted.css'

if (new URLSearchParams(window.location.search).get('record') === '1') document.documentElement.dataset.record = 'true'

// The server decides whether this is the hosted judge demo (GET /api/demo/status; 404 = local or desktop). Asking
// first, alone, also gives a hosted visitor one session cookie before any other request, and no owner UI ever flashes.
// The recorded replay and the Mac app (app:) are never hosted.
const boot = import.meta.env.MODE === 'browser-demo' || window.location.protocol === 'app:' ? Promise.resolve({ status: undefined, failed: false }) : detectHosted()
void boot.then(({ status, failed }) => {
  // Record mode is an owner tool: a hosted visitor never gets it, even from a crafted link.
  if (status && document.documentElement.dataset.record) { delete document.documentElement.dataset.record; const url = new URL(location.href); url.searchParams.delete('record'); history.replaceState(null, '', url) }
  createRoot(document.getElementById('root')!).render(<App hosted={status} bootFailed={failed} />)
})
