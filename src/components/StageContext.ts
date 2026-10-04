import { createContext } from 'react'

export const StageContext = createContext<{ runId: string; question: string } | undefined>(undefined)
