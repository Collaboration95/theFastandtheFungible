export function createStepRunner(report, save, failFast=false) {
return async function step(name, action, dependencies=[]) {
  const row={name,dependencies,pass:false};report.gates.push(row)
  if(dependencies.some(name=>!report.gates.find(r=>r.name===name)?.pass)){row.status='skipped (dependency)';save();return}
  row.startedAt=new Date().toISOString()
  try {await action(row);row.pass=true;row.status='PASS'}
  catch(error){row.error=error.message;row.status='FAIL';if(failFast)throw error}
  finally{row.finishedAt=new Date().toISOString();row.durationMs=Date.parse(row.finishedAt)-Date.parse(row.startedAt);save()}
}
}

// A successful quick rehearsal cannot establish full acceptance.
export function acceptanceOutcome(gates, quick) {
  const checksPass=gates.every(row=>row.pass)
  return {checksPass,acceptanceEligible:!quick,pass:checksPass&&!quick}
}

/** Ordering edges serialize shared output writers. Semantic dependencies remain
 * in createStepRunner, so an unrelated failure does not suppress other evidence.
 * Drain every started task before returning, including on fail-fast. */
export async function runGraph(tasks, { concurrency = 4, failFast = false } = {}) {
  if (!Number.isSafeInteger(concurrency) || concurrency < 1) throw Error('Invalid graph concurrency')
  const names = new Set(tasks.map(task => task.name))
  if (names.size !== tasks.length || tasks.some(task => (task.after ?? []).some(name => !names.has(name)))) throw Error('Duplicate or unknown graph dependency')
  const pending = [...tasks], active = new Map(), finished = new Set(), errors = []
  while (pending.length || active.size) {
    while (active.size < concurrency && !(failFast && errors.length)) {
      const index = pending.findIndex(task => (task.after ?? []).every(name => finished.has(name)))
      if (index < 0) break
      const [task] = pending.splice(index, 1)
      active.set(task.name, Promise.resolve().then(task.run).catch(error => errors.push(error)).finally(() => {
        active.delete(task.name); finished.add(task.name)
      }))
    }
    if (!active.size) {
      if (errors.length) break
      throw Error('Cyclic acceptance graph')
    }
    await Promise.race(active.values())
  }
  if (errors.length) throw new AggregateError(errors, errors.map(error => error.message).join('; '))
}
