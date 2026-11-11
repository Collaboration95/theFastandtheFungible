import React from 'react'
import { createRoot } from 'react-dom/client'
import ShowWork from '../src/components/ShowWork'
import { ucRuns } from '../src/fixtures/run'
import '../src/styles.css'
import '../src/hosted.css'
import '../src/phone-targets.css'
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
const run = structuredClone(ucRuns.UC1)
run.events.splice(-1, 0, { id: 90, runId: run.runId, type: 'MODEL_FALLBACK', label: 'LLM fallback (guard) · labelled fixture', at: run.events.at(-1)!.at, data: { fallback: true, reason: 'guard' } })
createRoot(document.getElementById('root')!).render(<ShowWork run={run} onClose={() => {}} />)
