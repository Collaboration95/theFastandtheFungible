// Copy the production dependency closure, retaining only this platform's ONNX CPU
// binaries. Run in the Linux image build, never against a user's installed tree.
import { cpSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
const dest = 'model-runtime'
const seen = new Set()
function copy(name) {
  if (seen.has(name)) return
  seen.add(name)
  const src = join('node_modules', name)
  if (!existsSync(src)) return
  const p = JSON.parse(readFileSync(join(src, 'package.json')))
  const allowed = (values, actual) => !values || values.includes(actual)
  if (!allowed(p.os, process.platform) || !allowed(p.cpu, process.arch) || !allowed(p.libc, 'glibc')) return
  const target = join(dest, name)
  mkdirSync(target, {recursive:true})
  if (name === '@huggingface/transformers') {
    cpSync(join(src,'package.json'),join(target,'package.json'))
    mkdirSync(join(target,'dist'),{recursive:true})
    cpSync(join(src,'dist/transformers.node.mjs'),join(target,'dist/transformers.node.mjs'))
  } else if (name === 'onnxruntime-node') {
    cpSync(join(src,'package.json'),join(target,'package.json'))
    cpSync(join(src,'dist'),join(target,'dist'),{recursive:true})
    const native = `bin/napi-v3/${process.platform}/${process.arch}`
    cpSync(join(src,native),join(target,native),{recursive:true,filter:f=>!f.includes('cuda')&&!f.includes('tensorrt')})
  } else cpSync(src,target,{recursive:true})
  for (const dep of Object.keys({...p.dependencies,...p.optionalDependencies})) copy(dep)
}
copy('@huggingface/transformers')
