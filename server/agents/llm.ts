export const researchModel = () => process.env.LLM_MODEL || 'llama-3.3-70b-versatile'
export const isGroqConfigured = () => process.env.LLM_PROVIDER === 'groq' && Boolean(process.env.GROQ_API_KEY)
export async function streamJson(_system: string, _input: unknown, _onToken?: (delta: string) => void): Promise<unknown> { throw new Error('TODO(W1-RESEARCH)') }
