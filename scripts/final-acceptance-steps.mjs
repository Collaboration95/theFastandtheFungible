export function createStepRunner(report, save, failFast=false) {
return async function step(name, action, dependencies=[]) {
  const row={name,dependencies,pass:false};report.gates.push(row)
  if(dependencies.some(name=>!report.gates.find(r=>r.name===name)?.pass)){row.status='skipped (dependency)';save();return}
  row.startedAt=new Date().toISOString()
  try {await action(row);row.pass=true;row.status='PASS'}
  catch(error){row.error=error.message;row.status='FAIL';if(failFast)throw error}
  finally{row.finishedAt=new Date().toISOString();save()}
}
}

// A successful quick rehearsal cannot establish full acceptance.
export function acceptanceOutcome(gates, quick) {
  const checksPass=gates.every(row=>row.pass)
  return {checksPass,acceptanceEligible:!quick,pass:checksPass&&!quick}
}
