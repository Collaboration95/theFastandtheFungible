import os, subprocess, pathlib, json, shutil, concurrent.futures, hashlib
root=pathlib.Path.cwd(); out=root/'docs/evidence/p1-threshold'; private=pathlib.Path('/tmp/p1-threshold-private'); private.mkdir(exist_ok=True,mode=0o700)
grid=[.10,.15,.20,.26,.281,.30]
source=root/'server/agents/decision.ts'; original=source.read_text()
def cmd(args,log,env=None):
 with open(log,'w') as f:return subprocess.run(args,cwd=root,env=env,stdout=f,stderr=subprocess.STDOUT).returncode
try:
 assert cmd(['npm','run','build:sdk'],out/'build-sdk.log')==0
 for t in grid:
  tag=f'{t:.3f}'; d=private/tag; d.mkdir(exist_ok=True)
  source.write_text(original.replace("readonly model = 'metadata-fixture'","readonly model = 'metadata-fixture@2'").replace("(model.endsWith('/clef') ?",f"(model === 'metadata-fixture@2' ? {t} : model.endsWith('/clef') ?"))
  assert cmd(['node','scripts/release-artifacts.mjs'],out/f'build-{tag}.log')==0
  shutil.copy2(root/'dist/release/researchagent-mcp-1.0.0.tgz',d/'mcp.tgz')
  print('BUILT',tag,flush=True)
finally: source.write_text(original)
def run(job):
 t,b=job; tag=f'{t:.3f}'; d=out/f'{tag}-{b}'; d.mkdir(exist_ok=True); state=private/f'state-{tag}-{b}'; state.mkdir(exist_ok=True,mode=0o700)
 env={**os.environ,'RA_ACCEPT_TESTNET':'1','JUDGE_BANK':f'eval/questions/judge-xrpl.{b}.json','JUDGE_OUT_DIR':str(d),'J1_STATE_DIR':str(state),'JUDGE_INTENT_PREFIX':f'p1-{tag}-'}
 code=cmd(['node_modules/.bin/tsx','scripts/judge-bank-testnet.ts',str(private/tag/'mcp.tgz')],d/'runner.log',env)
 audit=cmd(['node_modules/.bin/tsx','scripts/gate-audit.ts','--db',str(state/'researchagent/testnet/app.db')],d/'full-state.gate-audit.json')
 (d/'exit.json').write_text(json.dumps({'runner':code,'gateAudit':audit})+'\n');print('FINISHED',tag,b,code,flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:list(pool.map(run,[(t,b) for t in grid for b in ['v1','v2','v3','v3-dev','v3-negatives']]))
