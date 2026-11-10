/** Presentation only. Exact source bytes and citation bindings stay in receipts. */
export const findingText = (text: string) => text.replace(/^\s*```[\w+-]*\s*$/gm, '').replace(/\s*\[\d+(?:[,–-]\s*\d+)*\]/g, '').replace(/^\s*(?:[-*+]\s+|#{1,6}\s+|(?:>\s*)+)/gm, '').replace(/`+|\*\*/g, '').replace(/(?<!\w)([*_])(\S(?:[^\n]*?\S)?)\1(?!\w)/g, '$2').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim()
