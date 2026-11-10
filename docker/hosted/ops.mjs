// Operator-only command planner/executor. Dry-run does not invoke gcloud or Docker.
import { execFileSync } from 'node:child_process'
import { readdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
const [action, ...argv] = process.argv.slice(2)
const options = {}
for (let i = 0; i < argv.length; i++) {
  if (['--dry-run','--execute'].includes(argv[i])) options[argv[i].slice(2)] = true
  else if (['--project','--billing-account','--sha','--origin','--manifest','--notification-channel','--alert-email'].includes(argv[i]) && argv[i+1]) options[argv[i].slice(2)] = argv[++i]
  else throw Error('Unknown or incomplete argument')
}
if (!['deploy','teardown'].includes(action)) throw Error('Expected deploy or teardown')
if (options.execute && options['dry-run']) throw Error('Choose --execute or --dry-run')
const dry = !options.execute
const project = options.project
if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(project || '')) throw Error('--project requires the dedicated new project ID')
const region = 'asia-southeast1', zone = `${region}-b`, repo = 'researchagent', vm = 'ra-app', disk = 'ra-state', service = 'ra-front'
const registry = `${region}-docker.pkg.dev/${project}/${repo}`
const sa = `ra-vm@${project}.iam.gserviceaccount.com`, frontSa = `ra-front@${project}.iam.gserviceaccount.com`
const q = s => "'" + String(s).replaceAll("'", "'\\''") + "'"
const show = args => console.log(['gcloud', ...args].map(q).join(' '))
function gc(args, {quiet = false} = {}) {
  if (dry) { show(args); return '' }
  try { return execFileSync('gcloud', args, {encoding:'utf8', stdio:['ignore','pipe','pipe'], maxBuffer:16*1024*1024}).trim() }
  catch { if (!quiet) throw Error(`gcloud failed: ${args.slice(0,3).join(' ')} (inspect privately)`); throw Error('Cloud inventory failed') }
}
const p = [`--project=${project}`]
function ensure(describe, create) {
  if (dry) { show(describe); show(create); return }
  try { execFileSync('gcloud', describe, {stdio:['ignore','pipe','pipe']}); return }
  catch (e) { if (!/NOT_FOUND|not found|does not exist|was not found/i.test(String(e.stderr))) throw Error('Cloud inventory denied or unavailable; refusing mutation') }
  gc(create)
}
const git = args => execFileSync('git',args,{encoding:'utf8'}).trim()
const manifestPath = options.manifest && resolve(options.manifest)
if (!manifestPath) throw Error('--manifest requires a private path outside the repository')
const root = git(['rev-parse','--show-toplevel'])
if (manifestPath.startsWith(root + '/')) throw Error('Manifest must stay outside the checkout')
if (action === 'teardown') {
  let m
  if (existsSync(manifestPath)) m = JSON.parse(readFileSync(manifestPath))
  else if (!dry) throw Error('Missing deployment manifest')
  else m = {project, billingAccount:'BILLING_ACCOUNT', budget:'BUDGET_ID', uptime:'UPTIME_ID', alert:'ALERT_ID', secrets:['SECRET_ID']}
  if (m.project !== project) throw Error('Manifest/project mismatch')
  if (!dry && (Date.now() < Date.parse('2026-11-19T16:00:00Z') || m.pendingObligations !== 0 || m.archiveVerified !== true)) throw Error('Teardown needs 20 Nov SGT, pendingObligations=0 and archiveVerified=true')
  const snapshot = `ra-final-${m.sha?.slice(0,12) || 'release'}`
  if (dry) show(['compute','instances','stop',vm,...p,`--zone=${zone}`,'--quiet'])
  else {
    try { execFileSync('gcloud',['compute','instances','describe',vm,...p,`--zone=${zone}`],{stdio:['ignore','pipe','pipe']}); gc(['compute','instances','stop',vm,...p,`--zone=${zone}`,'--quiet']) }
    catch(e) { if(!/NOT_FOUND|not found|does not exist/i.test(String(e.stderr))) throw Error('VM stop/inventory failed') }
  }
  ensure(['compute','snapshots','describe',snapshot,...p], ['compute','disks','snapshot',disk,...p,`--zone=${zone}`,`--snapshot-names=${snapshot}`])
  gc(['compute','snapshots','describe',snapshot,...p,'--format=value(status)'])
  if (!dry && gc(['compute','snapshots','describe',snapshot,...p,'--format=value(status)']) !== 'READY') throw Error('Final snapshot not READY')
  // Idempotent delete: already missing resources are left missing.
  const remove = (describe, command) => {
    if (dry) { show(describe); show(command); return }
    try { execFileSync('gcloud',describe,{stdio:['ignore','pipe','pipe']}) }
    catch(e) { if (/NOT_FOUND|not found|does not exist/i.test(String(e.stderr))) return; throw Error('Inventory failed') }
    gc(command)
  }
  remove(['run','services','describe',service,...p,`--region=${region}`], ['run','services','delete',service,...p,`--region=${region}`,'--quiet'])
  remove(['compute','instances','describe',vm,...p,`--zone=${zone}`], ['compute','instances','delete',vm,...p,`--zone=${zone}`,'--quiet'])
  remove(['compute','disks','describe',disk,...p,`--zone=${zone}`], ['compute','disks','delete',disk,...p,`--zone=${zone}`,'--quiet'])
  remove(['compute','resource-policies','describe','ra-daily',...p,`--region=${region}`], ['compute','resource-policies','delete','ra-daily',...p,`--region=${region}`,'--quiet'])
  for (const rule of ['ra-front-app','ra-iap-ssh','ra-fallback']) remove(['compute','firewall-rules','describe',rule,...p],['compute','firewall-rules','delete',rule,...p,'--quiet'])
  // Front revisions release subnet addresses asynchronously; retry this same script later.
  remove(['compute','networks','subnets','describe','ra-egress',...p,`--region=${region}`],['compute','networks','subnets','delete','ra-egress',...p,`--region=${region}`,'--quiet'])
  remove(['compute','networks','describe','ra-vpc',...p],['compute','networks','delete','ra-vpc',...p,'--quiet'])
  for (const secret of m.secrets) remove(['secrets','describe',secret,...p],['secrets','delete',secret,...p,'--quiet'])
  remove(['artifacts','repositories','describe',repo,...p,`--location=${region}`],['artifacts','repositories','delete',repo,...p,`--location=${region}`,'--quiet'])
  for (const name of [sa,frontSa]) remove(['iam','service-accounts','describe',name,...p],['iam','service-accounts','delete',name,...p,'--quiet'])
  if (m.uptime) remove(['monitoring','uptime','describe',m.uptime,...p],['monitoring','uptime','delete',m.uptime,...p,'--quiet'])
  if (m.alert) remove(['alpha','monitoring','policies','describe',m.alert,...p],['alpha','monitoring','policies','delete',m.alert,...p,'--quiet'])
  if(m.ownsNotificationChannel && m.notificationChannel) remove(['beta','monitoring','channels','describe',m.notificationChannel,...p],['beta','monitoring','channels','delete',m.notificationChannel,...p,'--quiet'])
  if (m.budget) remove(['billing','budgets','describe',m.budget,`--billing-account=${m.billingAccount}`],['billing','budgets','delete',m.budget,`--billing-account=${m.billingAccount}`,'--quiet'])
  console.log(JSON.stringify({project,finalSnapshot:snapshot,state:dry?'planned':'retained-snapshot-project-and-billing-link'}))
  process.exit(0)
}
const billing = options['billing-account']
if (!/^[A-Fa-f0-9-]+$/.test(billing || '')) throw Error('--billing-account required')
const sha = git(['rev-parse','--verify',`${options.sha || 'HEAD'}^{commit}`])
const origin = options.origin || 'https://paused.invalid'
if (!/^https:\/\/[a-z0-9.-]+$/.test(origin)) throw Error('--origin must be an exact HTTPS origin')
let channel = options['notification-channel']
const email=options['alert-email']
if(channel && !/^projects\/[^/]+\/notificationChannels\/\d+$/.test(channel)) throw Error('Invalid notification channel')
if(!channel && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email||'')) throw Error('Supply --alert-email or --notification-channel')
const writerNames=readdirSync('data/writers').filter(f=>f.endsWith('.json')).map(f=>JSON.parse(readFileSync(join('data/writers',f))).publisher).filter(w=>Object.values(w.prices||{}).some(p=>Number(p)>0)).map(w=>'XRPL_PUBLISHER_'+w.slug.toUpperCase().replaceAll('-','_')+'_SEED')
const mappings = [...writerNames,'DEEPSEEK_API_KEY','OPENAI_API_KEY','PUBLISHER_SECRET','HOSTED_SESSION_KEY','HOSTED_IP_HMAC_KEY',...Object.keys(process.env).filter(n=>/^XRPL_(PAYER|PUBLISHER_[A-Z0-9_]+)_(SEED|ADDRESS)$/.test(n))]
if (!mappings.includes('XRPL_PAYER_SEED')) mappings.push('XRPL_PAYER_SEED')
const secretMap = mappings.map(name=>[name,`ra-${name.toLowerCase().replaceAll('_','-')}-${sha.slice(0,12)}`])
if(!dry) {
  if(Date.now()>=Date.parse('2026-11-19T16:00:00Z')) throw Error('Hosted admissions window expired')
  if(process.env.XRPL_RPC_URL && !/^wss:\/\/[a-z0-9.-]+\.rippletest\.net(?::\d+)?\/?$/.test(process.env.XRPL_RPC_URL)) throw Error('Only XRPL Testnet RPC is permitted')
  if(process.env.SETTLEMENT_RAIL && process.env.SETTLEMENT_RAIL!=='xrpl-testnet') throw Error('Deployment requires XRPL Testnet')
  for(const name of mappings) if(!process.env[name] || /[\r\n'$`]/.test(process.env[name])) throw Error(`Missing or unsafe secret variable: ${name}`)
}
if (!dry) {
  if (git(['status','--porcelain']) || git(['rev-parse','HEAD']) !== sha) throw Error('Deploy requires the clean selected HEAD')
  // Publish validates the clean current source receipt. No bypass for stale evidence.
  execFileSync('npm',['run','gate','--','--publish'],{stdio:'inherit'})
}
let existing = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath)) : undefined
if (existing && (existing.project !== project || existing.billingAccount !== billing)) throw Error('Manifest ownership mismatch')
if (!dry && !existing) {
  // A pre-existing project may only be adopted with a matching saved manifest.
  try { execFileSync('gcloud',['projects','describe',project],{stdio:['ignore','pipe','pipe']}); throw Error('Project already exists; refusing adoption') }
  catch(e) { if (!/NOT_FOUND|not found|does not exist|was not found/i.test(String(e.stderr))) throw Error('Cannot establish new-project ownership') }
  writeFileSync(manifestPath,JSON.stringify({project,billingAccount:billing,sha,secrets:[]},null,2),{flag:'wx',mode:0o600})
}
ensure(['projects','describe',project], ['projects','create',project,'--name=ResearchAgent SFF demo','--labels=purpose=sff-demo,expires=20261120'])
gc(['billing','projects','link',project,`--billing-account=${billing}`])
gc(['services','enable','compute.googleapis.com','run.googleapis.com','artifactregistry.googleapis.com','secretmanager.googleapis.com','monitoring.googleapis.com','logging.googleapis.com','iam.googleapis.com','billingbudgets.googleapis.com','cloudresourcemanager.googleapis.com',...p])
if(!channel) {
  channel=dry?'projects/'+project+'/notificationChannels/RESOLVED_CHANNEL':gc(['beta','monitoring','channels','list',...p,'--filter=displayName=ra-operator','--format=value(name)'])
  if(!channel||dry) channel=gc(['beta','monitoring','channels','create',...p,'--display-name=ra-operator','--type=email',`--channel-labels=email_address=${email}`,'--format=value(name)'])||channel
}
ensure(['artifacts','repositories','describe',repo,...p,`--location=${region}`],['artifacts','repositories','create',repo,...p,`--location=${region}`,'--repository-format=docker','--immutable-tags'])
for (const name of ['ra-vm','ra-front']) ensure(['iam','service-accounts','describe',`${name}@${project}.iam.gserviceaccount.com`,...p],['iam','service-accounts','create',name,...p])
gc(['artifacts','repositories','add-iam-policy-binding',repo,...p,`--location=${region}`,`--member=serviceAccount:${sa}`,'--role=roles/artifactregistry.reader'])
const scratch = dry ? '/PRIVATE_BUILD_DIRECTORY' : mkdtempSync(join(tmpdir(),'ra-hosted-'))
try {
  if (!dry) {
    execFileSync('tar',['-xf','-','-C',scratch],{input:execFileSync('git',['archive',sha],{maxBuffer:128*1024*1024})})
    gc(['auth','configure-docker',`${region}-docker.pkg.dev`,'--quiet'])
  }
  const digests = {}
  for (const target of ['api','publisher','web','front']) {
    const dockerfile = target === 'front' ? 'docker/hosted/front/Dockerfile' : 'docker/hosted/Dockerfile'
    const image = `${registry}/${target}:${sha}`
    if (dry) {
      console.log(`git archive ${sha} | tar -x -C ${q(scratch)}`)
      console.log(['docker','build','--platform=linux/amd64','-f',`${scratch}/${dockerfile}`,...(target==='front'?[]:['--target',target]),'-t',image,scratch].map(q).join(' '))
      console.log(`docker push ${q(image)}`)
      show(['artifacts','docker','images','describe',image,...p,'--format=value(image_summary.digest)'])
      digests[target]=`${registry}/${target}@sha256:RESOLVED_${target.toUpperCase()}_DIGEST`
    } else {
      let digest
      try { digest=execFileSync('gcloud',['artifacts','docker','images','describe',image,...p,'--format=value(image_summary.digest)'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim() } catch(e) { if (!/NOT_FOUND|not found/i.test(String(e.stderr))) throw Error('Image inventory failed') }
      if (!digest) {
        execFileSync('docker',['build','--platform=linux/amd64','-f',`${scratch}/${dockerfile}`,...(target==='front'?[]:['--target',target]),'--label',`org.opencontainers.image.revision=${sha}`,'-t',image,scratch],{stdio:['ignore','pipe','pipe']})
        execFileSync('docker',['push',image],{stdio:['ignore','pipe','pipe']})
        digest=gc(['artifacts','docker','images','describe',image,...p,'--format=value(image_summary.digest)'])
      }
      if (!/^sha256:[a-f0-9]{64}$/.test(digest)) throw Error('Missing immutable image digest')
      digests[target]=`${registry}/${target}@${digest}`
    }
  }
  for (const [name,secret] of secretMap) {
    if (!dry && (!process.env[name] || /[\r\n'$`]/.test(process.env[name]))) throw Error(`Missing or unsafe secret variable: ${name}`)
    const file=join(scratch,`secret-${name}`)
    if (!dry) writeFileSync(file,process.env[name],{mode:0o600})
    ensure(['secrets','describe',secret,...p],['secrets','create',secret,...p,'--replication-policy=automatic',`--data-file=${file}`])
    gc(['secrets','add-iam-policy-binding',secret,...p,`--member=serviceAccount:${sa}`,'--role=roles/secretmanager.secretAccessor'])
    if(!dry) { const current=JSON.parse(readFileSync(manifestPath));current.secrets=[...new Set([...(current.secrets||[]),secret])];writeFileSync(manifestPath,JSON.stringify(current,null,2)+'\n',{mode:0o600}) }
  }
  ensure(['compute','networks','describe','ra-vpc',...p],['compute','networks','create','ra-vpc',...p,'--subnet-mode=custom'])
  ensure(['compute','networks','subnets','describe','ra-egress',...p,`--region=${region}`],['compute','networks','subnets','create','ra-egress',...p,`--region=${region}`,'--network=ra-vpc','--range=10.77.0.0/24','--enable-private-ip-google-access'])
  for (const [name,range,port] of [['ra-front-app','10.77.0.0/24','8080'],['ra-iap-ssh','35.235.240.0/20','22']]) ensure(['compute','firewall-rules','describe',name,...p],['compute','firewall-rules','create',name,...p,'--network=ra-vpc',`--source-ranges=${range}`,`--allow=tcp:${port}`,'--target-tags=ra-app'])
  ensure(['compute','resource-policies','describe','ra-daily',...p,`--region=${region}`],['compute','resource-policies','create','snapshot-schedule','ra-daily',...p,`--region=${region}`,'--daily-schedule','--start-time=18:00','--max-retention-days=7','--on-source-disk-delete=keep-auto-snapshots'])
  ensure(['compute','disks','describe',disk,...p,`--zone=${zone}`],['compute','disks','create',disk,...p,`--zone=${zone}`,'--size=30GB','--type=pd-balanced','--resource-policies=ra-daily'])
  const bundleDir=join(scratch,'docker/hosted')
  if (!dry) {
    writeFileSync(join(bundleDir,'secrets.map'),secretMap.map(([n,s])=>`${n}=${s}`).join('\n')+'\n',{mode:0o600})
    writeFileSync(join(bundleDir,'images'),Object.entries(digests).filter(([n])=>n!=='front').map(([n,v])=>`${n.toUpperCase()}_IMAGE=${v}`).join('\n')+'\n',{mode:0o600})
    writeFileSync(join(scratch,'bundle.b64'),execFileSync('tar',['-czf','-','-C',bundleDir,'compose.yaml','update.sh','env.template','secrets.map','images']).toString('base64'))
  }
  const metadata=[`ra-registry=${registry}`,`ra-commit=${sha}`,`ra-origin=${origin}`].join(',')
  ensure(['compute','instances','describe',vm,...p,`--zone=${zone}`],['compute','instances','create',vm,...p,`--zone=${zone}`,'--machine-type=e2-standard-2','--image-family=debian-12','--image-project=debian-cloud','--boot-disk-size=20GB',`--disk=name=${disk},device-name=${disk},auto-delete=no`,'--subnet=ra-egress',`--private-network-ip=10.77.0.10`,'--tags=ra-app',`--service-account=${sa}`,'--scopes=cloud-platform',`--metadata=${metadata},enable-oslogin=TRUE,block-project-ssh-keys=TRUE`,`--metadata-from-file=startup-script=${scratch}/docker/hosted/startup.sh,ra-bundle=${scratch}/bundle.b64`])
  gc(['compute','instances','add-metadata',vm,...p,`--zone=${zone}`,`--metadata=${metadata}`,`--metadata-from-file=startup-script=${scratch}/docker/hosted/startup.sh,ra-bundle=${scratch}/bundle.b64`])
  gc(['compute','ssh',vm,...p,`--zone=${zone}`,'--tunnel-through-iap','--command=sudo systemctl restart google-startup-scripts.service'])
  gc(['run','deploy',service,...p,`--region=${region}`,`--image=${digests.front}`,`--service-account=${frontSa}`,'--network=ra-vpc','--subnet=ra-egress','--vpc-egress=private-ranges-only','--min=1','--max=2','--concurrency=32','--timeout=3600','--port=8080','--allow-unauthenticated','--set-env-vars=VM_UPSTREAM=10.77.0.10:8080','--startup-probe=httpGet.path=/startupz,httpGet.port=8080','--liveness-probe=httpGet.path=/livez,httpGet.port=8080','--quiet'])
  const url=dry?'https://RESOLVED_SERVICE.run.app':gc(['run','services','describe',service,...p,`--region=${region}`,'--format=value(status.url)'])
  // Record the canonical origin, then render secrets and restart while still paused.
  gc(['compute','instances','add-metadata',vm,...p,`--zone=${zone}`,`--metadata=ra-origin=${url}`])
  gc(['compute','ssh',vm,...p,`--zone=${zone}`,'--tunnel-through-iap','--command=sudo systemctl restart google-startup-scripts.service'])
  const host=new URL(url).hostname
  const uptimeName='ra-readyz'
  let uptime = dry ? 'UPTIME_ID' : gc(['monitoring','uptime','list-configs',...p,`--filter=displayName=${uptimeName}`,'--format=value(name)'])
  if (!uptime) uptime=gc(['monitoring','uptime','create',uptimeName,...p,'--resource-type=uptime-url',`--resource-labels=host=${host},project_id=${project}`,'--protocol=https','--port=443','--path=/readyz','--period=60','--timeout=10','--status-codes=200','--format=value(name)'])
  if(dry) show(['monitoring','uptime','create',uptimeName,...p,'--resource-type=uptime-url',`--resource-labels=host=${host},project_id=${project}`,'--protocol=https','--port=443','--path=/readyz','--period=60','--timeout=10','--status-codes=200','--format=value(name)'])
  const policy={displayName:'ra-readyz-failed',combiner:'OR',notificationChannels:[channel],conditions:[{displayName:'readiness unavailable',conditionThreshold:{filter:`metric.type="monitoring.googleapis.com/uptime_check/check_passed" AND resource.type="uptime_url" AND metric.label.check_id="${uptime.split('/').at(-1)}"`,comparison:'COMPARISON_GT',thresholdValue:1,duration:'120s',aggregations:[{alignmentPeriod:'60s',perSeriesAligner:'ALIGN_NEXT_OLDER',crossSeriesReducer:'REDUCE_COUNT_FALSE',groupByFields:['resource.label.host']}]}}]}
  if (!dry) writeFileSync(join(scratch,'alert.json'),JSON.stringify(policy))
  let alert=dry?'ALERT_ID':gc(['alpha','monitoring','policies','list',...p,'--filter=displayName=ra-readyz-failed','--format=value(name)'])
  if (!alert || dry) alert=gc(['alpha','monitoring','policies','create',...p,`--policy-from-file=${scratch}/alert.json`,'--format=value(name)']) || 'ALERT_ID'
  const number=dry?'PROJECT_NUMBER':gc(['projects','describe',project,'--format=value(projectNumber)'])
  let budget=dry?'':gc(['billing','budgets','list',`--billing-account=${billing}`,`--filter=displayName=ra-${project}`,'--format=value(name)'])
  if (!budget) budget=gc(['billing','budgets','create',`--billing-account=${billing}`,`--display-name=ra-${project}`,'--budget-amount=50USD',`--filter-projects=projects/${number}`,'--threshold-rule=percent=0.5,basis=current-spend','--threshold-rule=percent=0.9,basis=current-spend','--threshold-rule=percent=1,basis=current-spend',`--notifications-rule-monitoring-notification-channels=${channel}`,'--format=value(name)']) || 'BUDGET_ID'
  const m={project,notificationChannel:channel,ownsNotificationChannel:!options['notification-channel'],billingAccount:billing,sha,region,zone,vm,disk,service,url,digests,secrets:[...new Set([...(existing?.secrets||[]),...secretMap.map(([,s])=>s)])],uptime,alert,budget,pendingObligations:null,archiveVerified:false,teardownAt:'2026-11-20T00:00:00+08:00'}
  if (!dry) writeFileSync(manifestPath,JSON.stringify(m,null,2)+'\n',{mode:0o600})
  console.log(JSON.stringify({project,sha,url,state:dry?'planned':'deployed-paused'}))
} finally { if (!dry) rmSync(scratch,{recursive:true,force:true}) }
