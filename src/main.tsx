import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

if (new URLSearchParams(window.location.search).get('record') === '1') document.documentElement.dataset.record = 'true'

createRoot(document.getElementById('root')!).render(<App />)
