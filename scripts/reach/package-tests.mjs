// Verify the unpublished package archives as an independent consumer, without editing root dependencies.
import {execFileSync} from 'node:child_process'
import {readFileSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {register} from 'tsx/esm/api'
register()
const {ResourceScope}=await import('../../shared/resource-scope.ts')
const scope=new ResourceScope()
const root=fileURLToPath(new URL('../..',import.meta.url)),dir=scope.tempDir('reach-packages-')
const run=(cmd,args,output='pipe')=>execFileSync(cmd,args,{cwd:dir,stdio:output,maxBuffer:8*1024*1024})
try{
 writeFileSync(join(dir,'package.json'),JSON.stringify({private:true,type:'module'}))
 const archives=[]
 for(const name of ['seller-core','seller-express','seller-hono']){
  const output=JSON.parse(run('npm',['pack',join(root,'packages',name),'--json']));archives.push(join(dir,output[0].filename))
  const source=readFileSync(join(root,'packages',name,'test.mjs'),'utf8').replace("from './index.mjs'",`from '@researchagent/${name}'`)
  writeFileSync(join(dir,name+'.test.mjs'),source)
 }
 run('npm',['install','--no-audit','--no-fund',...archives,'express','hono','@hono/node-server','@types/express','@types/node','typescript'])
 run(process.execPath,['--test',...['seller-core','seller-express','seller-hono'].map(n=>join(dir,n+'.test.mjs'))],'inherit')
 writeFileSync(join(dir,'types.ts'),`import {testnetPurchase} from '@researchagent/seller-core/testnet';void testnetPurchase;import express from 'express';import {Hono} from 'hono';import {Client,Wallet} from 'xrpl';import {keyReveal as e} from '@researchagent/seller-express';import {keyReveal as h} from '@researchagent/seller-hono';import type {SellerOptions,Offer} from '@researchagent/seller-core';const options:SellerOptions={client:new Client('wss://s.altnet.rippletest.net:51233'),wallet:Wallet.generate(),dbPath:':memory:',resourceUrl:'http://localhost/article',content:()=> 'article'};express().get('/article',e(options).middleware);new Hono().get('/article',h(options).middleware);const scheme:Offer['accepts'][0]['scheme']='key-reveal-escrow';console.log(scheme);`)
 run(process.execPath,[join(dir,'node_modules/typescript/bin/tsc'),'--noEmit','--module','nodenext','--moduleResolution','nodenext','--target','es2022','--skipLibCheck','--strict','types.ts'],'inherit')
 console.log('Package archives: offline tests and public TypeScript imports PASS')
}finally{await scope.close()}
