/** Presentation only. Exact source bytes and citation bindings stay in receipts. */
export const findingText = (text: string) => text.replace(/\s*\[\d+(?:[,–-]\s*\d+)*\]/g, '').replace(/^\s*(?:[-*+]\s+|#{1,6}\s+)/gm, '').replace(/`+|\*\*/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim()
