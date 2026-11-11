import { expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { ENV, money, shortTx, whenSGT, xrpAmount, dropsAmount, environmentLabel, modelsLabel } from '../shared/presentation'

it('formats every minor-unit amount from 0 through 500 with exactly two decimals', () => {
  for (let minor = 0; minor <= 500; minor++) expect(money(minor)).toMatch(/^S\$\d+\.\d{2}$/)
})
it('formats ledger amounts, fingerprints and Singapore dates independently of the caller locale', () => {
  expect(xrpAmount('40000')).toBe('0.04 XRP')
  expect(xrpAmount('1000000001')).toBe('1,000.000001 XRP')
  expect(xrpAmount('0')).toBe('0 XRP')
  expect(xrpAmount('9007199254740993')).toBe('9,007,199,254.740993 XRP')
  expect(xrpAmount('-40000')).toBe('-0.04 XRP')
  expect(dropsAmount('9007199254740993')).toBe('9,007,199,254,740,993')
  expect(shortTx('abcdef0123456789'.repeat(4))).toBe('ABCDEF01…23456789')
  expect(shortTx('abcdef01')).toBe('ABCDEF01')
  expect(whenSGT('2026-11-11T07:06:05Z')).toBe('11 Nov 2026, 15:06 SGT')
  expect(ENV.replay('11 Nov 2026')).toBe('Replay · XRPL Testnet, recorded 11 Nov 2026 · fictional writers · no real value')
})

it('keeps live, fixture and mixed provider modes truthful on either payment rail', () => {
  for (const [research, decision, label] of [
    ['fixture · extracts', 'fixture · rules', 'fixture models'],
    ['deepseek', 'fixture · rules', 'live answers, rule-based buying'],
    ['fixture · extracts', 'openai', 'fixture answers, live buying'],
    ['deepseek', 'openai', 'live models'],
  ]) {
    expect(modelsLabel(research, decision)).toBe(label)
    expect(environmentLabel('XRPL TESTNET', label)).toBe(`XRPL Testnet demo · ${label} · no real value`)
    expect(environmentLabel('SIMULATED', label)).toBe(`Simulated demo · ${label} · no real value`)
  }
})

/** Parse code, not comments or recorded source prose. Account addresses have their separate 6…4 rule. */
function violations(code: string) {
  const source = ts.createSourceFile('renderer.tsx', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const found: string[] = []
  const visit = (node: ts.Node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isJsxText(node) || ts.isTemplateSpan(node) || ts.isTemplateHead(node)) {
      const text = ts.isTemplateSpan(node) ? node.literal.text : node.text
      for (const amount of text.matchAll(/S\$(\d+(?:\.\d+)?)/g)) if (!/^\d+\.\d{2}$/.test(amount[1])) found.push(`money: ${amount[0]}`)
      for (const hash of text.matchAll(/\b([A-Fa-f0-9]{6,})(…|\.{3})([A-Fa-f0-9]*)(?![A-Za-z0-9])/g)) if (hash[1].length !== 8 || hash[3].length !== 8 || hash[2] !== '…' || hash[0] !== hash[0].toUpperCase()) found.push('fingerprints must use shortTx')
    }
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && /^(slice|substring|substr)$/.test(node.expression.name.text) && /hash|invoice|fingerprint|\btx\b/i.test(node.expression.expression.getText(source))) found.push('fingerprints must use shortTx')
    if (ts.isBinaryExpression(node) && /…|\.\.\./.test(node.getText(source)) && (node.getText(source).match(/\.(?:slice|substring|substr)\(/g) ?? []).length >= 2) found.push('fingerprints must use shortTx')
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken && ts.isStringLiteral(node.left) && node.left.text.endsWith('S$') && !/\.toFixed\(2\)$/.test(node.right.getText(source))) found.push('dynamic money must retain two decimals')
    if (ts.isJsxElement(node) || ts.isJsxFragment(node)) {
      node.children.forEach((child, index) => {
        const next = node.children[index + 1]
        if (ts.isJsxText(child) && /S\$$/.test(child.text) && next && ts.isJsxExpression(next) && next.expression && !/\.toFixed\(2\)$/.test(next.expression.getText(source))) found.push('dynamic money must retain two decimals')
        if (ts.isJsxText(child) && /…|\.\.\./.test(child.text) && node.children.some(sibling => ts.isJsxExpression(sibling) && /\.(?:slice|substring|substr)\(/.test(sibling.getText(source)))) found.push('fingerprints must use shortTx')
      })
    }
    if (ts.isTemplateExpression(node)) {
      for (let i = 0; i < node.templateSpans.length; i++) {
        const prefix = i === 0 ? node.head.text : node.templateSpans[i - 1].literal.text
        if (prefix.endsWith('S$') && !/\.toFixed\(2\)$/.test(node.templateSpans[i].expression.getText(source))) found.push('dynamic money must retain two decimals')
      }
      const text = node.getText(source)
      const slicedEnds = (text.match(/\.(?:slice|substring|substr)\(/g) ?? []).length >= 2
      // KEY owns this existing key/condition formatter; its exact 8…8 rule is already canonical.
      const canonicalKeyHex = text === '`${upper(hex.slice(0, 8))}…${upper(hex.slice(-8))}`'
      if (/…|\.\.\./.test(text) && slicedEnds && !canonicalKeyHex && !/^`\$\{address\.slice\(0, 6\)\}…\$\{address\.slice\(-4\)\}`$/.test(text)) found.push('fingerprints must use shortTx')
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}
function htmlViolations(html: string) {
  const content = html.replace(/<!--[\s\S]*?-->/g, '')
  const found = violations(JSON.stringify(content))
  for (const script of content.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) found.push(...violations(script[1]))
  return found
}
it('rejects bad money and alternative hash rules, including deliberately broken renderers', () => {
  expect(violations('<p>S$0.5</p>')).toContain('money: S$0.5')
  expect(violations('<p>ABCDEF…12345</p>')).toContain('fingerprints must use shortTx')
  expect(violations('<p>ABCDEF01…</p>')).toContain('fingerprints must use shortTx')
  expect(violations('<p>abcdef01…23456789</p>')).toContain('fingerprints must use shortTx')
  expect(violations('<p>ABCDEF01...23456789</p>')).toContain('fingerprints must use shortTx')
  expect(violations('<p>ABCDEF01…23456789</p>')).toEqual([])
  expect(violations('const price = `S$${minor / 100}`')).toContain('dynamic money must retain two decimals')
  expect(violations("const price = 'S$' + minor / 100")).toContain('dynamic money must retain two decimals')
  expect(violations('<p>S${minor / 100}</p>')).toContain('dynamic money must retain two decimals')
  expect(violations('const hash = `${tx.slice(0, 6)}…${tx.slice(-5)}`')).toContain('fingerprints must use shortTx')
  expect(violations('const hash = `${tx.substring(0, 8)}…${tx.substring(56)}`')).toContain('fingerprints must use shortTx')
  expect(violations('<p>{txHash.slice(0, 6)}…{txHash.slice(-5)}</p>')).toContain('fingerprints must use shortTx')
  expect(violations('<p>{h.slice(0, 6)}…{h.slice(-5)}</p>')).toContain('fingerprints must use shortTx')
  expect(violations("const fingerprint = h.slice(0, 6) + '…' + h.slice(-5)")).toContain('fingerprints must use shortTx')
  expect(violations('const clippedQuery = `${query.slice(0, 59).trimEnd()}…`')).toEqual([])
  expect(violations('const shortHex = `${upper(hex.slice(0, 8))}…${upper(hex.slice(-8))}`')).toEqual([])
  expect(violations('const shortHex = `${upper(hex.slice(0, 6))}…${upper(hex.slice(-8))}`')).toContain('fingerprints must use shortTx')
  expect(violations('<p>{money(price)} {shortTx(hash)}</p>')).toEqual([])
  expect(htmlViolations('<span>S$0.5</span>')).toContain('money: S$0.5')
  expect(htmlViolations('<code>ABCDEF…12345</code>')).toContain('fingerprints must use shortTx')
  expect(htmlViolations('<script>node.textContent = txHash.slice(0, 6)</script>')).toContain('fingerprints must use shortTx')
})
it('guards every src/ and demo/ renderer against money and fingerprint drift', () => {
  const files = (root: string): string[] => readdirSync(root, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(join(root, entry.name)) : /\.(?:[jt]sx?|html)$/.test(entry.name) && !/\.test\./.test(entry.name) ? [join(root, entry.name)] : [])
  const found = [...files('src'), ...files('demo')].filter(file => !file.startsWith('src/fixtures/')).flatMap(file => (file.endsWith('.html') ? htmlViolations : violations)(readFileSync(file, 'utf8')).map(issue => `${file}: ${issue}`))
  expect(found).toEqual([])
})
