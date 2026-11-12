/** Presentation drift checks. Scan executable/rendered strings rather than comments or archived input data. */
import ts from 'typescript'
import { createRequire } from 'node:module'
const { JSDOM } = createRequire(import.meta.url)('jsdom') as { JSDOM: new (code: string) => { window: { document: Document } } }
import { ENV } from '../shared/presentation.js'
import { buyingLabels } from '../shared/execution-labels.js'
export type Drift = { rule: string; text: string }
const canonical = new Set<string>([...Object.values(ENV).filter(value => typeof value === 'string'), ENV.replayShort(true), ENV.replayShort(false)])
for (const buying of Object.keys(buyingLabels) as (keyof typeof buyingLabels)[]) for (const testnet of [true, false]) canonical.add(ENV.hostedConfigured(testnet, buying))
const escapePattern = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const environmentPatterns = [
  ...[ENV.localTestnet('MODELS'), ENV.localSimulated('MODELS')].map(value => new RegExp(`^${escapePattern(value).replace('MODELS', '[^·]+')}$`)),
  ...[true, false].map(testnet => new RegExp(`^${escapePattern(ENV.replay('DATE', testnet)).replace('DATE', '\\d{1,2} [A-Z][a-z]{2,3} \\d{4}')}$`)),
]
for (const state of ['offline', 'paused', 'ended']) for (const testnet of [true, false]) {
  canonical.add((testnet ? ENV.testnetShort : ENV.simulatedShort).replace(' · no real value', ` · ${state} · no real value`))
  canonical.add(ENV.hostedConfigured(testnet, 'fixture').replace(/ · [^·]+ · no real value$/, ` · ${state} · no real value`))
}
const canonicalEnvironment = (value: string) => canonical.has(value) || environmentPatterns.some(pattern => pattern.test(value))
export function presentationDrift(code: string, file: string, headingClasses = new Set<string>()): Drift[] {
  const found: Drift[] = []
  const add = (rule: string, text: string) => { if (!found.some(v => v.rule === rule && v.text === text)) found.push({ rule, text }) }
  const text = (value: string, visible = false) => {
    // Static Pages use one short network indicator; deployment limits live in the judge pack.
    // App and receipt labels retain their existing canonical contract.
    const validEnvironment = canonicalEnvironment(value.trim()) || (file.startsWith('site/') && value.trim() === 'XRPL Testnet demo')
    if (visible) for (const m of value.matchAll(/\b\d{4}-\d{2}-\d{2}(?:T[\d:.]+Z)?\b/g)) add('date', m[0])
    for (const m of value.matchAll(/S\$(-?\d+(?:\.\d+)?)/g)) if (!/^-?\d+\.\d{2}$/.test(m[1])) add('money', m[0])
    for (const m of value.matchAll(/\b([a-f0-9]{4,})(…|\.{3})([a-f0-9]*)(?![a-z0-9])/gi)) if (m[1].length !== 8 || m[3].length !== 8 || m[2] !== '…' || m[0] !== m[0].toUpperCase()) add('hash', m[0])
    if (/^(?:Shared (?:XRPL Testnet demo|demo ·)|XRPL Testnet demo|Testnet demo|Simulated demo|Simulated ·|Replay ·)/.test(value.trim()) && !validEnvironment && !/no real value$/.test(value.trim())) add('environment', value.trim())
    if (/no real (?:value|funds)/i.test(value) && /(?:testnet|simulated|demo|replay|sandbox).*·/i.test(value) && !validEnvironment) add('environment', value.trim())
  }
  const css = (value: string) => {
    for (const m of value.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const [, selector, body] = m
      for (const d of body.matchAll(/(?:^|;)\s*(font-family|--f-ui|--f-mono|--f-brand|--f-read|--f-display|--ui|--mono|font)\s*:\s*([^;]+)/g)) {
        let family = d[2].trim().replace(/clamp\([^)]*\)/g, '16px')
        if (d[1] === 'font') { if (!/\d(?:px|rem|em|%)\b/.test(family)) continue; family = family.replace(/^.*?\d(?:px|rem|em|%)(?:\s*\/\s*[\d.]+(?:px|rem|em|%)?)?\s+/, '') }
        if (/^(?:inherit|var\(--(?:f-ui|f-mono|f-brand|f-read|f-display|ui|mono|font-sans|font-mono)[,)])/.test(family)) continue
        if (!/^["']?(?:Replay )?Geist(?: Variable| Mono(?: Variable)?)?["']?(?:\s*,|$)/.test(family)) add('font', d[0].trim())
      }
      if (selector.includes('@font-face')) {
        if (/https?:|\/\//.test(body)) add('font', 'remote font source')
        continue
      }
      const heading = selector.split(',').some(part => { const last = part.trim().split(/[ >+~]+/).at(-1) ?? ''; return /^h[1-6]\b/.test(last) || [...last.matchAll(/\.([\w-]+)/g)].some(m => headingClasses.has(m[1])) })
      if (heading) {
        const weights = [...body.matchAll(/(?:font-weight\s*:\s*([^;]+)|font\s*:\s*(\d{3}|bold|normal)\b)/g)]
        const d = weights.at(-1)
        if (d && (d[1] ?? d[2]).trim() !== '600') add('heading', `${selector.trim()} { ${d[0]} }`)
      }
      if (/eyebrow|kick|kicker/.test(selector) && /text-transform\s*:\s*uppercase/.test(body)) add('eyebrow', selector.trim())
    }
    if (/fonts\.(?:googleapis|gstatic)\.com|@import\s*(?:url\(\s*)?["']?(?:https?:)?\/\//.test(value)) add('font', 'remote font source')
  }
  const javascript = (value: string, kind = ts.ScriptKind.TSX) => {
    const source = ts.createSourceFile(file, value, ts.ScriptTarget.Latest, true, kind)
    const visit = (n: ts.Node) => {
      if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isJsxText(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) text(n.text, ts.isJsxText(n) || ts.isJsxExpression(n.parent) && !ts.isJsxAttribute(n.parent.parent))
      if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
        const name = n.expression.name.text, target = n.expression.expression.getText(source)
        if (/^(slice|substring|substr)$/.test(name) && /^(?!location\.)[^]*?(?:hash|fingerprint|\btx\b|\.head$)/i.test(target)) add('hash', n.getText(source))
        if (/^(toLocaleDateString|toLocaleTimeString|toDateString|toTimeString|toUTCString|get(?:UTC)?(?:Date|Month|FullYear|Hours|Minutes))$/.test(name)) add('date', n.getText(source))
        if (name === 'toLocaleString' && /(?:Date\(|date|time|stamp)/i.test(target)) add('date', n.getText(source))
        if (name === 'DateTimeFormat') add('date', n.getText(source))
      }
      if (ts.isNewExpression(n) && /DateTimeFormat/.test(n.expression.getText(source))) add('date', n.getText(source))
      if (ts.isTemplateExpression(n) && /S\$/.test(n.getText(source)) && n.templateSpans.some((span, i) => (i ? n.templateSpans[i-1].literal.text : n.head.text).endsWith('S$'))) add('money', n.getText(source))
      if (ts.isTemplateExpression(n)) for (const span of n.templateSpans) if (ts.isPropertyAccessExpression(span.expression) && /^(date|snapshotDate|settledAt|createdAt|readAt)$/.test(span.expression.name.text)) add('date', span.expression.getText(source))
      if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken && /['"]S\$['"]/.test(n.left.getText(source))) add('money', n.getText(source))
      if (ts.isJsxElement(n) || ts.isJsxFragment(n)) n.children.forEach((child, i) => {
        if (ts.isJsxText(child) && /S\$$/.test(child.text) && ts.isJsxExpression(n.children[i+1])) add('money', n.getText(source))
      })
      if (ts.isTemplateExpression(n) && /…|\.\.\./.test(n.getText(source)) && (n.getText(source).match(/\.(?:slice|substring|substr)\(/g) ?? []).length >= 2) {
        if (!/^`\$\{address\.slice\(0, 6\)\}…\$\{address\.slice\(-4\)\}`$/.test(n.getText(source))) add('hash', n.getText(source))
      }
      if (ts.isBinaryExpression(n) && /…|\.\.\./.test(n.getText(source)) && (n.getText(source).match(/\.(?:slice|substring|substr)\(/g) ?? []).length >= 2) add('hash', n.getText(source))
      if (ts.isJsxExpression(n) && !ts.isJsxAttribute(n.parent) && n.expression && ts.isPropertyAccessExpression(n.expression) && /^(date|snapshotDate|settledAt|createdAt|readAt)$/.test(n.expression.name.text)) add('date', n.getText(source))
      if (ts.isPropertyAssignment(n) && n.name.getText(source) === 'fontFamily') css(`body{font-family:${n.initializer.getText(source).replace(/^['"]|['"]$/g, '')}}`)
      if (ts.isPropertyAssignment(n) && n.name.getText(source) === 'fontWeight') {
        const attribute = n.parent.parent?.parent
        if (attribute && ts.isJsxAttribute(attribute) && attribute.name.getText(source) === 'style' && ts.isJsxOpeningElement(attribute.parent.parent) && /^h[1-6]$/.test(attribute.parent.parent.tagName.getText(source)) && !/^['"]?600['"]?$/.test(n.initializer.getText(source))) add('heading', n.getText(source))
      }
      // Raw timestamps inside semantic time elements must be formatted, while dateTime retains ISO.
      if (ts.isJsxElement(n) && n.openingElement.tagName.getText(source) === 'time') for (const child of n.children) {
        if (ts.isJsxExpression(child) && child.expression && !/\b(?:whenSGT|dateSGT)\(/.test(child.expression.getText(source))) add('date', child.getText(source))
      }
      ts.forEachChild(n, visit)
    }
    visit(source)
    // Server HTML/CSS strings and CSS-in-TS are scanned as well.
    css(value)
  }
  if (/\.css$/.test(file)) css(code)
  else if (/\.html$/.test(file)) {
    const doc = new JSDOM(code).window.document
    headingClasses = new Set([...doc.querySelectorAll('h1,h2,h3,h4,h5,h6')].flatMap(n => [...n.classList]))
    doc.querySelectorAll('style').forEach(n => css(n.textContent ?? ''))
    doc.querySelectorAll('script').forEach(n => { if (!n.type || /(?:javascript|module)/.test(n.type)) javascript(n.textContent ?? '', ts.ScriptKind.JS); n.remove() })
    doc.querySelectorAll('[style]').forEach(n => css(`${n.tagName.toLowerCase()}{${n.getAttribute('style')}}`))
    doc.querySelectorAll('link[href]').forEach(n => { if (/fonts\.(?:googleapis|gstatic)\.com/.test(n.getAttribute('href') ?? '')) add('font', 'remote font source') })
    const walker = doc.createTreeWalker(doc.body, 4)
    while (walker.nextNode()) (walker.currentNode.textContent ?? '').split(/\. (?=[A-Z])/).forEach(value => text(value, true))

    doc.defaultView?.close()
  } else javascript(code)
  return found
}
