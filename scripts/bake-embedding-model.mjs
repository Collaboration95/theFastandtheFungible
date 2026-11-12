// Explicit build-time network acquisition, pinned to a model repository revision.
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { LOCAL_MODEL, LOCAL_MODELS, modelRoot } from '../server/embeddings/local.ts'
const model = process.argv[2] || LOCAL_MODEL
const revision = LOCAL_MODELS[model]
if (!revision) throw new Error('Unsupported embedding model')
const files = ['config.json', 'tokenizer.json', 'tokenizer_config.json', 'special_tokens_map.json', 'onnx/model_quantized.onnx']
const hashes = {}
for (const file of files) {
  const target = join(modelRoot(), model, file)
  await mkdir(join(target, '..'), { recursive: true })
  const response = await fetch(`https://huggingface.co/${model}/resolve/${revision}/${file}`)
  if (!response.ok) throw new Error(`Model build download failed (${response.status}): ${file}`)
  await writeFile(target, Buffer.from(await response.arrayBuffer()))
  hashes[file] = createHash('sha256').update(await readFile(target)).digest('hex')
}
await writeFile(join(modelRoot(), model, 'manifest.json'), JSON.stringify({ model, revision, dtype: 'q8', hashes }, null, 2) + '\n')
console.log(`Baked ${model}@${revision}`)
