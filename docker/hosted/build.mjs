import {execFileSync} from 'node:child_process'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
const sha=execFileSync('git',['rev-parse','--verify',`${process.argv[2]||'HEAD'}^{commit}`],{encoding:'utf8'}).trim()
const execute=process.argv.includes('--execute')&&!process.argv.includes('--dry-run')
const directory=execute?mkdtempSync(join(tmpdir(),'ra-hosted-build-')):'/PRIVATE_BUILD_DIRECTORY'
try {
  if(execute) execFileSync('tar',['-xf','-','-C',directory],{input:execFileSync('git',['archive',sha],{maxBuffer:128*1024*1024})})
  if(execute) execFileSync(process.execPath,['scripts/build-public-docs.mjs'],{cwd:directory,stdio:'inherit'})
  else console.log(JSON.stringify({command:'node',args:['scripts/build-public-docs.mjs'],cwd:directory}))
  for(const target of ['api','publisher','web','front']) {
    const file=target==='front'?'docker/hosted/front/Dockerfile':'docker/hosted/Dockerfile'
    const args=['build','--platform=linux/amd64','-f',`${directory}/${file}`,...(target==='front'?[]:['--target',target]),'--label',`org.opencontainers.image.revision=${sha}`,'-t',`researchagent-hosted-${target}:local`,'-t',`researchagent-hosted-${target}:${sha}`,directory]
    if(execute) execFileSync('docker',args,{stdio:'inherit'})
    else console.log(JSON.stringify({command:'docker',args,source:`git archive ${sha}`}))
  }
} finally {if(execute) rmSync(directory,{recursive:true,force:true})}
