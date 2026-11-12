// Compile the canonical, pure helpers without importing engine/schema runtime into static pages.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import ts from 'typescript'
import { transformSync } from 'esbuild'
export function sitePresentation() {
  const select = (file, names) => {
    const code = readFileSync(file, 'utf8'), source = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true)
    return source.statements.filter(n => ts.isVariableStatement(n) && n.declarationList.declarations.some(d => names.includes(d.name.getText(source)))).map(n => n.getText(source)).join('\n')
  }
  const code = select('shared/execution-labels.ts', ['buyingLabels']) + '\n' + select('shared/presentation.ts', ['money', 'ENV', 'shortTx', 'dateSGT', 'whenSGT'])
  return '// Generated from shared/presentation.ts. Run node scripts/site-presentation.mjs; do not edit.\n' + transformSync(code, { loader: 'ts', format: 'esm', target: 'es2022' }).code
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) writeFileSync('site/brand/presentation.js', sitePresentation())
