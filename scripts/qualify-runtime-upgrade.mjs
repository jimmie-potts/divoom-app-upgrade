// Exact packaged simulator qualification. Never operates systemd or real devices.
import {parseArgs} from 'node:util';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {cp,lstat,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {homedir} from 'node:os';
import {setTimeout as delay} from 'node:timers/promises';
import {once} from 'node:events';
import {Library} from '@pixoo/library';
import {privatePath} from '../apps/server/dist/config.js';
import {runtimeAssert,runtimeOwned,runtimeWrite} from '../apps/server/dist/runtime-files.js';
import {canonicalRuntime,runtimeHash,runtimeFileHash} from '../apps/server/dist/runtime-release.js';
import {verifyRuntimeBundle} from '../apps/server/dist/runtime-bundle.js';
import {LinuxRuntimeHost,inspectRuntimeUnit,runtimeProcess} from '../apps/server/dist/runtime-host.js';
import {runtimeConfigurationFacts} from '../apps/server/dist/runtime-config.js';
import {identifyLegacy} from '../apps/server/dist/runtime-plan.js';
import {qualifyRuntimeState,reopenRuntimeState,snapshotRuntimeState} from '../apps/server/dist/runtime-state.js';
import {transitionRuntime} from '../apps/server/dist/runtime-upgrade.js';
import {inspectRuntimeDelivery} from '../apps/server/dist/runtime-adapter.js';

class IsolatedSimulator extends LinuxRuntimeHost{
 child=null;failCandidate=false;candidateWrite=null;
 async service(){
  const unit=await readFile(this.config.unitFile,'utf8'),running=this.child&&this.child.exitCode===null?await runtimeProcess(this.child.pid):null;
  return {active:running?'active':'inactive',unit,unitSha256:runtimeHash(unit),unitMode:(await lstat(this.config.unitFile)).mode&0o777,program:inspectRuntimeUnit(unit,this.config),process:running};
 }
 async start(){
  runtimeAssert(!this.child,'fixture-child-already-active');const program=(await this.service()).program;
  this.child=spawn(this.config.node,[join(program,'apps/server/dist/main.js')],{cwd:homedir(),stdio:['ignore','ignore','ignore'],env:{PATH:process.env.PATH,HOME:process.env.HOME,PIXOO_DATA_DIR:this.config.dataDirectory,PIXOO_MODE:'simulator',PIXOO_PORT:String(this.port),PIXOO_OBSERVABILITY_ENABLED:'0'}});
  await once(this.child,'spawn');
 }
 async stop(roots=[]){
  if(this.child){const child=this.child;this.child=null;if(child.exitCode===null){const ended=once(child,'exit');child.kill('SIGTERM');await Promise.race([ended,delay(10000,undefined,{ref:false}).then(()=>{if(child.exitCode===null)child.kill('SIGKILL');})]);}}
  for(let attempt=0;attempt<100;attempt++){if(!(await this.writers(roots)).length)return;await delay(100);}throw Error('fixture-writer-not-drained');
 }
 async reload(){}async verifyUnit(path){inspectRuntimeUnit(await readFile(path,'utf8'),this.config);}
 async health(identity,program,startedAfter){
  const health=await super.health(identity,program,startedAfter);
  if(this.failCandidate&&identity.kind==='release'){
   const url='http://127.0.0.1:'+this.port;
   const response=await fetch(url+'/api/playlists',{method:'POST',headers:{'content-type':'application/json','x-pixoo-request':'1',origin:url},body:JSON.stringify({name:'Candidate durable record'}),signal:AbortSignal.timeout(5000)});
   runtimeAssert(response.ok,'fixture-candidate-write-failed');this.candidateWrite=await response.json();throw Error('fixture-candidate-health-failure');
  }
  return health;
 }
}
async function freePort(){const server=createServer();await new Promise(resolve_=>server.listen(0,'127.0.0.1',resolve_));const port=server.address().port;await new Promise(resolve_=>server.close(resolve_));return port;}

const {values}=parseArgs({options:{bundle:{type:'string'},scratch:{type:'string'},evidence:{type:'string'}}});
runtimeAssert(values.bundle&&values.scratch&&values.evidence,'usage-bundle-scratch-evidence');
const bundle=resolve(values.bundle),scratch=await privatePath(values.scratch),evidence=resolve(values.evidence);
await runtimeOwned(evidence,true,true);await mkdir(scratch,{mode:0o700});
const manifest=JSON.parse(await readFile(join(bundle,'manifest.json'),'utf8'));
const identity={kind:'release',sourceRevision:manifest.sourceRevision,version:manifest.version,archiveSha256:await runtimeFileHash(join(bundle,'runtime.tgz'),1024*1024*1024),manifestSha256:await runtimeFileHash(join(bundle,'manifest.json'))};
await verifyRuntimeBundle(bundle,identity);
const candidate={directory:bundle,program:join(bundle,'runtime'),identity,legacyOriginal:false},results=[];
try{
 for(const scenario of ['success','recovery']){
  const root=join(scratch,scenario);await mkdir(root,{mode:0o700});
  const runtimeRoot=join(root,'installed'),dataDirectory=join(root,'data');await mkdir(runtimeRoot,{mode:0o700});
  const record=join(evidence,scenario);await mkdir(record,{mode:0o700});
  const old=join(runtimeRoot,'a'.repeat(40));await cp(candidate.program,old,{recursive:true,verbatimSymlinks:true,preserveTimestamps:true});
  const compatibility=await qualifyRuntimeState(old,candidate.program,process.execPath,dataDirectory);
  await snapshotRuntimeState(dataDirectory,join(root,'snapshot'));await reopenRuntimeState(old,candidate.program,process.execPath,join(root,'snapshot'));
  const config={schemaVersion:1,owner:'packaged-fixture',runtimeRoot,sourceRoot:process.cwd(),dataDirectory,evidenceRoot:record,unitFile:join(root,'pixoo-playlist-controller.service'),environmentFile:join(root,'service.env'),node:process.execPath,npm:resolve(process.execPath,'../../lib/node_modules/npm/bin/npm-cli.js'),controllerTokenFile:null,controllerRegistration:null,inactiveStartReason:null,transitionReserveSeconds:600};
  const port=await freePort();await writeFile(config.environmentFile,`PIXOO_MODE=simulator\nPIXOO_DATA_DIR=${dataDirectory}\nPIXOO_PORT=${port}\n`,{mode:0o600});
  await writeFile(config.unitFile,`[Unit]\nDescription=disposable packaged fixture\nStartLimitIntervalSec=120\nStartLimitBurst=3\n[Service]\nType=simple\nEnvironmentFile=${config.environmentFile}\nWorkingDirectory=${homedir()}\nExecStart="${config.node}" "${old}/apps/server/dist/main.js"\nUMask=0077\nRestart=on-failure\nRestartSec=10\nKillSignal=SIGTERM\nTimeoutStopSec=30\n[Install]\nWantedBy=default.target\n`,{mode:0o600});
  const host=new IsolatedSimulator(config);host.port=port;
  try{
   await host.start();const previous={directory:old,program:old,identity:(await identifyLegacy(old)).identity,legacyOriginal:true};await host.health(previous.identity,old,0);
   const {process:running,...service}=await host.service();
   const plan={schemaVersion:1,operation:'upgrade',requestedTarget:identity.sourceRevision,targetRevision:identity.sourceRevision,config,configuration:await runtimeConfigurationFacts(config),previous,service,running,source:{repository:process.cwd(),head:identity.sourceRevision,target:identity.sourceRevision,mergedMain:'source-only-unmerged-candidate',clean:true,comparison:{status:'unknown',reason:'disposable-legacy-fixture'},commits:[],removedCommits:[],components:[]},sourceTree:'disposable-fake-service',startupEffect:'simulator-only',backupScope:'full fixture state',recovery:'latest durable state',blockers:[],planSha256:''};
   plan.planSha256=runtimeHash(canonicalRuntime(plan));await runtimeWrite(join(record,'compatibility.json'),compatibility);
   host.failCandidate=scenario==='recovery';
   const receipt=await transitionRuntime(plan,candidate,join(record,'compatibility.json'),{host,recheck:async()=>{await verifyRuntimeBundle(bundle,identity);}});
   runtimeAssert(receipt.outcome===(scenario==='success'?'succeeded':'failed-rolled-back'),'packaged-transition-outcome');
   const readback=await inspectRuntimeDelivery(config,{schemaVersion:1,operation:'reconcile',repository:'jimmie-potts/divoom-app-upgrade',issue:115,merge:identity.sourceRevision,owner:config.owner,deadline:Date.now()/1000+120,evidenceDirectory:record},host);
   await host.stop([runtimeRoot]);
   if(scenario==='recovery'){
    const library=await Library.open({directory:join(dataDirectory,'library')});try{runtimeAssert((await library.listPlaylists()).some(item=>item.name==='Candidate durable record'),'packaged-latest-state-lost');}finally{await library.close();}
   }
   for(const name of ['records','receipts','backups'])await cp(join(runtimeRoot,name),join(record,name),{recursive:true,verbatimSymlinks:true});
   await runtimeWrite(join(record,'receipt.json'),receipt);results.push({scenario,outcome:receipt.outcome,readback,latestCandidateRecordRetained:scenario==='recovery'});
  }finally{await host.stop([runtimeRoot]);}
  await rm(root,{recursive:true});
 }
 await runtimeWrite(join(evidence,'qualification.json'),{schemaVersion:1,identity,results,sourceOnly:true,installedAcceptance:false,physicalAcceptance:false,scratchRemoved:true});
 console.log(JSON.stringify({identity,scenarios:results.map(result=>({scenario:result.scenario,outcome:result.outcome})),sourceOnly:true}));
}finally{await rm(scratch,{recursive:true,force:true});}
