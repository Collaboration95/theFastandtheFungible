// Budget kill switch for the hosted judge demo (owner request, 11 Nov 2026).
// Cloud Billing publishes the project's budget status to Pub/Sub several times a day. When the
// actual spend reaches the budget, this function stops the app VM. Stopping the VM ends compute
// charges; the Cloud Run front then serves the paused page. Disks and data are kept, and an
// operator can restart the VM. Forecasts never stop anything, and a message carrying the
// attribute dryRun=true only logs what it would do.
const functions = require('@google-cloud/functions-framework')
const { overBudget } = require('./decide.js')

const PROJECT = process.env.RA_PROJECT || 'researchagent-sff'
const ZONE = process.env.RA_ZONE || 'asia-southeast1-b'
const INSTANCE = process.env.RA_INSTANCE || 'ra-app'
const METADATA = 'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token'
const BASE = `https://compute.googleapis.com/compute/v1/projects/${PROJECT}/zones/${ZONE}/instances/${INSTANCE}`

async function token() {
  const response = await fetch(METADATA, { headers: { 'Metadata-Flavor': 'Google' } })
  if (!response.ok) throw Error(`metadata token ${response.status}`)
  return (await response.json()).access_token
}

async function stopInstance() {
  const auth = { Authorization: `Bearer ${await token()}` }
  const current = await fetch(BASE, { headers: auth })
  if (!current.ok) throw Error(`instance lookup ${current.status}`)
  const { status } = await current.json()
  if (status !== 'RUNNING') return `already ${status}`
  const stop = await fetch(`${BASE}/stop`, { method: 'POST', headers: auth })
  if (!stop.ok) throw Error(`instance stop ${stop.status}`)
  return 'stop requested'
}

functions.cloudEvent('stopOnBudget', async event => {
  const message = event.data?.message || {}
  const status = JSON.parse(Buffer.from(message.data || '', 'base64').toString('utf8') || '{}')
  const dryRun = message.attributes?.dryRun === 'true'
  const line = { budget: status.budgetDisplayName, cost: status.costAmount, amount: status.budgetAmount, currency: status.currencyCode, over: overBudget(status), dryRun }
  if (!line.over) { console.log(JSON.stringify({ ...line, action: 'none' })); return }
  if (dryRun) { console.log(JSON.stringify({ ...line, action: `would stop ${INSTANCE}` })); return }
  console.log(JSON.stringify({ ...line, action: await stopInstance() }))
})
