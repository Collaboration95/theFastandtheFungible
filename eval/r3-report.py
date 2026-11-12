import json,statistics,collections,re,hashlib
from pathlib import Path
import sys
root=Path.cwd(); out=Path(sys.argv[1] if len(sys.argv)>1 else 'scratch/r3-real-200'); bank=json.loads((root/'eval/questions/r3-real.v1.json').read_text()); questions={q['id']:q for q in bank['questions']}
def family(q):
 t=q['question'].lower()
 if re.search(r'rlusd.*(?:supply|holders|concentration)|amm.*(?:statistics|liquidity|volume)|project.*account.*activity',t): return 'ledger analytics'
 if q['id']=='v3-V14' or re.search(r'x402|facilitator|http.*402',t): return 'x402'
 if re.search(r'xrpl|xrp ledger|xrp|escrow|trust line|rlusd|credential|stablecoin|amm|signer|master key|ledger|nft',t): return 'XRPL docs'
 return 'other'
def quant(xs,p):
 return sorted(xs)[int((len(xs)-1)*p)] if xs else None
def metrics(rs):
 return dict(n=len(rs),answered=sum(bool(r['answered']) for r in rs),correct=sum(bool(r['correct']) for r in rs),liveOnlyCorrect=sum(bool(r['correct'] and r['liveOnly']) for r in rs),citations=sum(r['citations'] for r in rs),validCitations=sum(r['validCitations'] for r in rs),gateViolations=sum(len(r['violations']) for r in rs),spendMinor=sum(r['spentMinor'] for r in rs),medianSpendMinor=quant([r['spentMinor'] for r in rs],.5),spendDistribution=dict(sorted(collections.Counter(r['spentMinor'] for r in rs).items())),latencyP50Ms=quant([r['latencyMs'] for r in rs],.5),latencyP90Ms=quant([r['latencyMs'] for r in rs],.9),plannerFallbacks=sum(r['plannerFallbacks'] for r in rs),writerFallbacks=sum(r['writerFallbacks'] for r in rs),fixtureAnswers=sum(r['fixtureAnswers'] for r in rs),phases=dict(collections.Counter(r['phase'] for r in rs)))
if not (out/'results.json').exists():
 print('Awaiting full run');raise SystemExit()
r=json.loads((out/'results.json').read_text());rs=r['results']
assert len({(x['id'],x['arm']) for x in rs})==len(rs)
report=dict(familyMembership={q['id']:family(q) for q in questions.values()},identity=r['identity'],n=len(rs),arms={a:metrics([x for x in rs if x['arm']==a]) for a in ['free','paid']},families={f:{a:metrics([x for x in rs if x['arm']==a and family(questions[x['id']])==f]) for a in ['free','paid']} for f in ['XRPL docs','x402','ledger analytics','other']},strata={s:{a:metrics([x for x in rs if x['arm']==a and questions[x['id']]['stratum']==s]) for a in ['free','paid']} for s in sorted({q['stratum'] for q in questions.values()})},costs=r['costs'])
by={a:{x['id']:x for x in rs if x['arm']==a} for a in ['free','paid']};paired=set(by['free'])&set(by['paid']);report['pairs']=dict(n=len(paired),bothCorrect=sum(by['free'][i]['correct'] and by['paid'][i]['correct'] for i in paired),paidOnlyCorrect=sum(not by['free'][i]['correct'] and by['paid'][i]['correct'] for i in paired),freeOnlyCorrect=sum(by['free'][i]['correct'] and not by['paid'][i]['correct'] for i in paired),neitherCorrect=sum(not by['free'][i]['correct'] and not by['paid'][i]['correct'] for i in paired))
dest=root/'docs/evidence/models/r3-real-200';dest.mkdir(exist_ok=True);(dest/'metrics.json').write_text(json.dumps(report,indent=2)+'\n');(dest/'results.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(report,indent=2))
