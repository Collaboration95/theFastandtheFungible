import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import './hosted.css'
import './phone-targets.css'
import Boot from './components/Boot'

if (new URLSearchParams(window.location.search).get('record') === '1') document.documentElement.dataset.record = 'true'

const local = import.meta.env.MODE === 'browser-demo' || window.location.protocol === 'app:'
createRoot(document.getElementById('root')!).render(local ? <App /> : <Boot />)
