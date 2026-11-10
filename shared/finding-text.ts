/** Numeric citation markers a model sometimes leaves in prose ("… settled. [1] [2]"); citations live in bindings. */
export const stripCitationMarkers = (text: string) => text.replace(/(?:\s+|(?<=[.,;:!?)]))\[\d+(?:[,–-]\s*\d+)*\]/g, '').trim()
/** Presentation only. Exact source bytes and citation bindings stay in receipts. */
export const findingText = (text: string) => stripCitationMarkers(text.replace(/^\s*```[\w+-]*\s*$/gm, '')).replace(/^\s*(?:[-*+]\s+|#{1,6}\s+|(?:>\s*)+)/gm, '').replace(/`+|\*\*/g, '').replace(/(?<!\w)([*_])(\S(?:[^\n]*?\S)?)\1(?!\w)/g, '$2').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim()
