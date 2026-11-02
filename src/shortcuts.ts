/** Display the modifier accepted by the browser's native platform conventions. */
export const modifier = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl+'
