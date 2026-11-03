export const INSTRUCTION = /(?:AI agents?|assistant|ignore (?:all |previous )?instructions|system prompt|you (?:must|should))|(?:buy|purchase).*(?:immediately|now)/i

/** Defence in depth only: a model can still obey malicious data. Policy remains the spending authority. */
export function quotedText(text: string, limit: number) {
  return text.slice(0, limit * 4).split(/\r?\n|(?<=[.!?])\s+/)
    .filter(span => !INSTRUCTION.test(span)).join(' ').slice(0, limit)
}
