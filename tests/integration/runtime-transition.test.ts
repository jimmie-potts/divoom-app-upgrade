import {afterEach,expect,it} from 'vitest';
import {rm,readFile,writeFile,mkdir,readlink,readdir,cp,lstat} from 'node:fs/promises';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {Library} from '@pixoo/library';
import {validateInstallReceipt} from '@jimmie-potts/install-contracts';
import {runtimeFixture} from '../helpers/runtime-fixture.js';
import {transitionRuntime,RuntimeFinalizationFailure} from '../../apps/server/src/runtime-upgrade.js';
import {assertNoRuntimeBarrier,planRuntime,runtimeRollbackTarget,selectedRuntime} from '../../apps/server/src/runtime-plan.js';
import {inspectRuntimeDelivery,executeRuntimeRequest,type RuntimeAdapterNative} from '../../apps/server/src/runtime-adapter.js';
import {backupData} from '../../apps/server/src/operations.js';
import {inspectRuntimeUnit,LinuxRuntimeHost} from '../../apps/server/src/runtime-host.js';
import {canonicalRuntime,runtimeHash} from '../../apps/server/src/runtime-release.js';
import {statusRuntimePlan} from '../../apps/server/src/runtime-status.js';
import {stageRuntimeBundle} from '../../apps/server/src/runtime-bundle.js';
const roots:string[]=[];
afterEach(async()=>{for(const root of roots.splice(0))await rm(root,{recursive:true,force:true});});
async function fixture(){const value=await runtimeFixture();roots.push(value.root);return value;}
const recheck=async()=>{};
it('observes an owned unit-written interruption requiring daemon reload without qualifying mutation',async()=>{
 const f=await fixture();const receipt=await transitionRuntime(f.plan,f.candidate,'fixture-compatibility',{host:f.host,recheck,checkpoint:async step=>{if(step==='unit-written')throw Error('interrupted');}});
 expect(receipt.outcome).toBe('interrupted');const barrier=join(f.config.runtimeRoot,'records/active.json');
 const unit=await readFile(f.config.unitFile),intent=await readFile(barrier),entries=await readdir(f.config.runtimeRoot);let reads=0;
 let properties=`FragmentPath=${f.config.unitFile}\nDropInPaths=\nMainPID=0\nActiveState=inactive\nUser=\nAmbientCapabilities=\nNeedDaemonReload=yes\n`;
 const host=new LinuxRuntimeHost(f.config,async()=>{reads++;return properties;});
 const observed=await statusRuntimePlan(f.config,f.plan,host,()=>f.plan.targetRevision);
 expect(observed).toMatchObject({serviceState:'inactive',inspectionRequired:true,needsDaemonReload:true,runningBuild:null,runningProcess:null,health:'not-running'});
 expect(reads).toBe(2);expect(await readFile(f.config.unitFile)).toEqual(unit);expect(await readFile(barrier)).toEqual(intent);expect(await readdir(f.config.runtimeRoot)).toEqual(entries);
 await expect(host.service()).rejects.toThrow('unsupported-service-ownership');
 await expect(planRuntime(f.config,f.plan.targetRevision,'upgrade',host)).rejects.toThrow('unresolved-runtime-operation');
 properties=properties.replace('FragmentPath='+f.config.unitFile,'FragmentPath=/foreign/other.service');
 await expect(statusRuntimePlan(f.config,f.plan,host,()=>f.plan.targetRevision)).rejects.toThrow('unsupported-service-ownership');
});
it('retains current plus three prior successful releases, active recovery code and unrelated history',async()=>{
 const f=await fixture(),releases=join(f.config.runtimeRoot,'releases');await mkdir(releases,{mode:0o700});
 const unrelated=join(releases,'other-owner');await mkdir(unrelated);await writeFile(join(unrelated,'keep'),'untouched');
 const executing=join(releases,f.candidate.identity.sourceRevision);let active=true;
 f.host.writers=async roots=>active&&roots.includes(executing)?[f.host.process()]:[];
 for(const revision of ['b','c','d','e','f'].map(character=>character.repeat(40))){
  await writeFile(join(f.config.sourceRoot,'apps/server/dist/build.json'),JSON.stringify({sourceRevision:revision,version:'0.0.0'}));
  const directory=join(f.root,'release-'+revision),identity=await stageRuntimeBundle(f.config.sourceRoot,directory,revision);
  const {process:running,...service}=await f.host.service();
  const plan={...f.plan,requestedTarget:revision,targetRevision:revision,previous:await selectedRuntime(f.config,await f.host.service()),service,running,planSha256:''};plan.planSha256=runtimeHash(canonicalRuntime(plan));
  expect((await transitionRuntime(plan,{directory,program:join(directory,'runtime'),identity,legacyOriginal:false},'fixture',{host:f.host,recheck})).outcome).toBe('succeeded');
 }
 expect(await readdir(releases)).toContain('b'.repeat(40));active=false;
 const revision='1'.repeat(40);await writeFile(join(f.config.sourceRoot,'apps/server/dist/build.json'),JSON.stringify({sourceRevision:revision,version:'0.0.0'}));
 const directory=join(f.root,'last-release'),identity=await stageRuntimeBundle(f.config.sourceRoot,directory,revision),{process:running,...service}=await f.host.service();
 const plan={...f.plan,requestedTarget:revision,targetRevision:revision,previous:await selectedRuntime(f.config,await f.host.service()),service,running,planSha256:''};plan.planSha256=runtimeHash(canonicalRuntime(plan));
 expect((await transitionRuntime(plan,{directory,program:join(directory,'runtime'),identity,legacyOriginal:false},'fixture',{host:f.host,recheck})).outcome).toBe('succeeded');
 expect((await readdir(releases)).sort()).toEqual([revision,'d'.repeat(40),'e'.repeat(40),'f'.repeat(40),'other-owner']);
 expect(await readFile(join(unrelated,'keep'),'utf8')).toBe('untouched');expect(await readdir(join(f.config.runtimeRoot,'legacy'))).toHaveLength(1);
 expect(await readdir(join(f.config.runtimeRoot,'backups'))).toHaveLength(6);expect(await readdir(join(f.config.runtimeRoot,'receipts'))).toHaveLength(6);
},30000);
it('plans legacy rollback without invented source provenance and preserves newer state on explicit rollback',async()=>{
 const f=await fixture();await transitionRuntime(f.plan,f.candidate,'fixture-compatibility',{host:f.host,recheck});
 const git=(...args:string[])=>execFileSync('git',args,{cwd:f.config.sourceRoot,encoding:'utf8'}).trim();
 git('init','--quiet');git('config','user.email','fixture@example.invalid');git('config','user.name','Fixture');git('add','.');git('commit','--quiet','-m','Source fixture');
 const head=git('rev-parse','HEAD');
 const rollback=await planRuntime(f.config,'previous','rollback',f.host,()=>({...f.plan.source,head,target:head,mergedMain:head,comparison:{status:'complete'}}));
 expect(rollback.source.comparison).toEqual({status:'unknown',reason:'legacy-source-unknown'});expect(rollback.source.target).toBe('unknown');expect(rollback.sourceTree).toBe('unknown');
 expect(rollback.source.commits).toEqual([]);expect(rollback.source.removedCommits).toEqual([]);expect(rollback.source.components).toEqual([]);
 const library=await Library.open({directory:join(f.config.dataDirectory,'library')});await library.createPlaylist('after upgrade');await library.close();
 const receipt=await transitionRuntime(rollback,await runtimeRollbackTarget(f.config,'previous'),'fixture-compatible-rollback',{host:f.host,recheck});
 expect(receipt).toMatchObject({operation:'rollback',outcome:'succeeded',target:f.plan.previous.identity});expect(validateInstallReceipt(receipt)).toBe(true);
 expect(await readlink(join(f.config.runtimeRoot,'current'))).toBe('legacy/'+(f.plan.previous.identity.kind==='legacy'?f.plan.previous.identity.legacyId:''));
 const reopened=await Library.open({directory:join(f.config.dataDirectory,'library')});try{expect((await reopened.listPlaylists()).map(item=>item.name)).toContain('after upgrade');}finally{await reopened.close();}
});
it('uses the original plan for read-only unresolved status and status after successful installation',async()=>{
 const f=await fixture(),records=join(f.config.runtimeRoot,'records');await mkdir(records,{mode:0o700});
 const barrier=join(records,'active.json');await writeFile(barrier,JSON.stringify({operationId:'pixoo-11111111-1111-1111-1111-111111111111'}),{mode:0o600});
 const before=await readFile(barrier),entries=await readdir(f.config.runtimeRoot);
 const unresolved=await statusRuntimePlan(f.config,f.plan,f.host,()=>f.plan.targetRevision);expect(unresolved.inspectionRequired).toBe(true);
 expect(await readFile(barrier)).toEqual(before);expect(await readdir(f.config.runtimeRoot)).toEqual(entries);expect(f.host.stops).toBe(0);
 await rm(barrier);await transitionRuntime(f.plan,f.candidate,'fixture-compatibility',{host:f.host,recheck});
 const observed=await statusRuntimePlan(f.config,f.plan,f.host,()=>f.plan.targetRevision);
 expect(observed.inspectionRequired).toBe(false);expect(observed.installed).toEqual(f.candidate.identity);
 expect(f.host.stops).toBe(1);expect(f.host.starts).toBe(1);
 await expect(statusRuntimePlan(f.config,{...f.plan,planSha256:'0'.repeat(64)},f.host,()=>f.plan.targetRevision)).rejects.toThrow('runtime-plan-changed');
});
it('adopts an indented entrypoint and verifies its intended current path before stopping',async()=>{
 const f=await fixture(),original=(await readFile(f.config.unitFile,'utf8')).replace('ExecStart=',' \tExecStart=');
 await writeFile(f.config.unitFile,original);const {process:running,...service}=await f.host.service();f.plan.service=service;f.plan.running=running;
 f.plan.planSha256=runtimeHash(canonicalRuntime({...f.plan,planSha256:''}));let verified=false;
 f.host.verifyUnit=async(path:string)=>{expect(f.host.stops).toBe(0);expect(inspectRuntimeUnit(await readFile(path,'utf8'),f.config)).toBe(join(f.config.runtimeRoot,'current/runtime'));verified=true;};
 const receipt=await transitionRuntime(f.plan,f.candidate,'fixture-compatibility',{host:f.host,recheck});
 expect(verified).toBe(true);expect(receipt.outcome).toBe('succeeded');
 const adopted=await readFile(f.config.unitFile,'utf8');expect(adopted).toContain(' \tExecStart=');
 expect(adopted.replace(/^\s*ExecStart=.*$/m,'ExecStart=')).toBe(original.replace(/^\s*ExecStart=.*$/m,'ExecStart='));
});
it('retains the existing library lease until the selection callback completes',async()=>{
 const f=await fixture();let reached=false;
 await backupData(f.config.dataDirectory,join(f.root,'backup'),async()=>{reached=true;await expect(Library.open({directory:join(f.config.dataDirectory,'library')})).rejects.toThrow();});
 expect(reached).toBe(true);const reopened=await Library.open({directory:join(f.config.dataDirectory,'library')});await reopened.close();
});
it('retains exact external environment and original unit bytes in the private bound backup',async()=>{
 const f=await fixture(),environment=await readFile(f.config.environmentFile),unit=await readFile(f.config.unitFile);
 const receipt=await transitionRuntime(f.plan,f.candidate,'fixture-compatibility',{host:f.host,recheck});expect(receipt.outcome).toBe('succeeded');
 const root=receipt.backup!.reference,env=join(root,'configuration/service.env'),service=join(root,'configuration/pixoo-playlist-controller.service');
 expect(await readFile(env)).toEqual(environment);expect(await readFile(service)).toEqual(unit);
 expect((await lstat(env)).mode&0o777).toBe(0o600);expect((await lstat(service)).mode&0o777).toBe(0o600);
 const manifest=await readFile(join(root,'manifest.json'));expect(runtimeHash(manifest)).toBe(receipt.backup!.sha256);
 expect(JSON.parse(manifest.toString()).configuration.map((entry:{sha256:string})=>entry.sha256)).toEqual([runtimeHash(environment),runtimeHash(unit)]);
});
it('adopts a legacy closure, preserves other history and emits validated installed readback',async()=>{
 const f=await fixture(),history=join(f.config.runtimeRoot,'older-other-owner');await mkdir(history);await writeFile(join(history,'keep'),'original');
 const environment=await readFile(f.config.environmentFile);
 const receipt=await transitionRuntime(f.plan,f.candidate,'fixture-compatibility',{host:f.host,recheck});
 expect(receipt.outcome).toBe('succeeded');expect(validateInstallReceipt(receipt)).toBe(true);expect(f.host.reloads).toBe(1);
 expect(await readlink(join(f.config.runtimeRoot,'current'))).toBe('releases/'+f.candidate.identity.sourceRevision);
 expect(await readFile(join(history,'keep'),'utf8')).toBe('original');expect(await readFile(f.config.environmentFile)).toEqual(environment);
 await assertNoRuntimeBarrier(f.config);
 const evidence=join(f.config.evidenceRoot,'request');await mkdir(evidence,{mode:0o700});
 const response=await inspectRuntimeDelivery(f.config,{schemaVersion:1,operation:'reconcile',repository:'jimmie-potts/divoom-app-upgrade',owner:'fixture',issue:115,merge:f.plan.targetRevision,deadline:Date.now()/1000+60,evidenceDirectory:evidence},f.host);
 expect(response.status).toBe('installed');expect(response.runningRevision).toBe(f.plan.targetRevision);
 const nativeHealth=f.host.health.bind(f.host);f.host.health=async identity=>({...await nativeHealth(identity),health:{build:{sourceRevision:'c'.repeat(40),version:'0.0.0'}}});
 await expect(inspectRuntimeDelivery(f.config,{schemaVersion:1,operation:'reconcile',repository:'jimmie-potts/divoom-app-upgrade',owner:'fixture',issue:115,merge:f.plan.targetRevision,deadline:Date.now()/1000+60,evidenceDirectory:evidence},f.host)).rejects.toThrow('fresh-running-build-mismatch');
});
it('recovers previous code over newer durable records rather than restoring backup',async()=>{
 const f=await fixture();f.host.healthHook=async identity=>{
  if(identity.kind!=='release')return;const library=await Library.open({directory:join(f.config.dataDirectory,'library')});
  try{await library.createPlaylist('newer candidate record');}finally{await library.close();}throw Error('candidate-unhealthy');
 };
 const receipt=await transitionRuntime(f.plan,f.candidate,'fixture-compatibility',{host:f.host,recheck});
 expect(receipt.outcome).toBe('failed-rolled-back');expect(validateInstallReceipt(receipt)).toBe(true);await assertNoRuntimeBarrier(f.config);
 const library=await Library.open({directory:join(f.config.dataDirectory,'library')});try{expect((await library.listPlaylists()).map(item=>item.name)).toContain('newer candidate record');}finally{await library.close();}
 const evidence=join(f.config.evidenceRoot,'request');await mkdir(evidence,{mode:0o700});
 const response=await inspectRuntimeDelivery(f.config,{schemaVersion:1,operation:'reconcile',repository:'jimmie-potts/divoom-app-upgrade',owner:'fixture',issue:115,merge:f.plan.targetRevision,deadline:Date.now()/1000+60,evidenceDirectory:evidence},f.host);
 expect(response).toMatchObject({status:'blocked',outcome:'failed-rolled-back',effects:'reconciled',locksClear:true,barriersClear:true,baselineIdentity:f.plan.previous.identity});
});
it.each(['before-current','current-selected','unit-written','unit-reloaded'])('retains an interruption barrier after adoption boundary %s',async boundary=>{
 const f=await fixture(),original=await readFile(f.config.unitFile,'utf8');
 const receipt=await transitionRuntime(f.plan,f.candidate,'fixture-compatibility',{host:f.host,recheck,checkpoint:async step=>{if(step===boundary)throw Error('interrupted');}});
 expect(receipt.outcome).toBe('interrupted');expect(validateInstallReceipt(receipt)).toBe(true);expect(f.host.starts).toBe(0);
 await expect(assertNoRuntimeBarrier(f.config)).rejects.toThrow('unresolved-runtime-operation');
 expect((await statusRuntimePlan(f.config,f.plan,f.host,()=>f.plan.targetRevision)).inspectionRequired).toBe(true);
 expect(JSON.parse(await readFile(join(f.config.runtimeRoot,'records',receipt.operationId,'original-unit.json'),'utf8')).unit).toBe(original);
});
it('does not switch after stop failure and blocks replay',async()=>{
 const f=await fixture();f.host.failStop=true;
 const receipt=await transitionRuntime(f.plan,f.candidate,'fixture-compatibility',{host:f.host,recheck});expect(receipt.outcome).toBe('failed-before-switch');
 expect((await readdir(f.config.runtimeRoot))).not.toContain('current');await expect(assertNoRuntimeBarrier(f.config)).rejects.toThrow();
});
it('does not select candidate code when a complete backup cannot be made',async()=>{
 const f=await fixture();const receipt=await transitionRuntime(f.plan,f.candidate,'fixture',{host:f.host,recheck,backup:async()=>{throw Error('disk-full');}});
 expect(receipt.outcome).toBe('failed-before-switch');expect(receipt.failure?.phase).toBe('backup');expect(validateInstallReceipt(receipt)).toBe(true);
 expect(await readdir(f.config.runtimeRoot)).not.toContain('current');expect(f.host.starts).toBe(0);await expect(assertNoRuntimeBarrier(f.config)).rejects.toThrow();
});
it('does not claim success or prune after uncertain final receipt durability',async()=>{
 const f=await fixture();let pruned=false;
 await expect(transitionRuntime(f.plan,f.candidate,'fixture-compatibility',{host:f.host,recheck,prune:async()=>{pruned=true;},finalWriter:async()=>{throw Error('disk-full');}})).rejects.toBeInstanceOf(RuntimeFinalizationFailure);
 expect(pruned).toBe(false);await expect(assertNoRuntimeBarrier(f.config)).rejects.toThrow();
});
it('retains the barrier when both candidate and recovery health fail',async()=>{
 const f=await fixture();f.host.failHealth=true;
 const receipt=await transitionRuntime(f.plan,f.candidate,'fixture-compatibility',{host:f.host,recheck});expect(receipt.outcome).toBe('rollback-failed');expect(validateInstallReceipt(receipt)).toBe(true);
 await expect(assertNoRuntimeBarrier(f.config)).rejects.toThrow();
 expect(await statusRuntimePlan(f.config,f.plan,f.host,()=>f.plan.targetRevision)).toMatchObject({inspectionRequired:true,health:'unknown',runningBuild:null});
});
it('refuses changed configuration before stopping',async()=>{
 const f=await fixture();await writeFile(f.config.environmentFile,'PIXOO_DATA_DIR=/foreign\n');
 await expect(transitionRuntime(f.plan,f.candidate,'fixture',{host:f.host,recheck})).rejects.toThrow('configuration-drift');expect(f.host.stops).toBe(0);
});
it('refuses conflicting bytes already retained for the same source revision',async()=>{
 const f=await fixture(),directory=join(f.config.runtimeRoot,'releases',f.plan.targetRevision);await mkdir(join(f.config.runtimeRoot,'releases'),{mode:0o700});await cp(f.candidate.directory,directory,{recursive:true});
 await writeFile(join(directory,'runtime/apps/server/dist/main.js'),'conflicting bytes');
 await expect(transitionRuntime(f.plan,f.candidate,'fixture',{host:f.host,recheck})).rejects.toThrow('inventory-changed');expect(f.host.stops).toBe(0);
});
it('runs the fixed adapter through native transition/readback and never mutates on reconcile',async()=>{
 const f=await fixture(),evidence=join(f.config.evidenceRoot,'adapter');await mkdir(evidence,{mode:0o700});let operations=0;
 const native:RuntimeAdapterNative={plan:async()=>f.plan,operate:async(plan,beforeStop)=>{operations++;return transitionRuntime(plan,f.candidate,'fixture',{host:f.host,recheck,beforeStop:beforeStop??recheck});},inspect:(config,request)=>inspectRuntimeDelivery(config,request,f.host)};
 const request={schemaVersion:1,operation:'install',repository:'jimmie-potts/divoom-app-upgrade',owner:'fixture',issue:115,merge:f.plan.targetRevision,deadline:Date.now()/1000+900,evidenceDirectory:evidence};
 expect(await executeRuntimeRequest(f.config,request,recheck,native)).toMatchObject({status:'installed',installedRevision:f.plan.targetRevision});
 expect(await executeRuntimeRequest(f.config,{...request,operation:'reconcile'},recheck,native)).toMatchObject({status:'installed'});expect(operations).toBe(1);
 await writeFile(join(f.config.runtimeRoot,'records/active.json'),'{}');
 expect(await executeRuntimeRequest(f.config,{...request,operation:'reconcile'},recheck,native)).toMatchObject({status:'uncertain'});expect(operations).toBe(1);
});
it('retains uncertainty when authority changes before stop, and refuses insufficient reserve before dispatch',async()=>{
 const f=await fixture(),evidence=join(f.config.evidenceRoot,'adapter');await mkdir(evidence,{mode:0o700});let calls=0,guards=0;
 const native:RuntimeAdapterNative={plan:async()=>f.plan,operate:async(plan,beforeStop)=>{calls++;return transitionRuntime(plan,f.candidate,'fixture',{host:f.host,recheck,beforeStop:beforeStop??recheck});},inspect:(config,request)=>inspectRuntimeDelivery(config,request,f.host)};
 const request={schemaVersion:1,operation:'install',repository:'jimmie-potts/divoom-app-upgrade',owner:'fixture',issue:115,merge:f.plan.targetRevision,deadline:Date.now()/1000+1,evidenceDirectory:evidence};
 expect(await executeRuntimeRequest(f.config,request,recheck,native)).toMatchObject({status:'uncertain'});expect(calls).toBe(0);
 expect(await executeRuntimeRequest(f.config,{...request,deadline:Date.now()/1000+900},async()=>{if(++guards===2)throw Error('owner-binding-changed');},native)).toMatchObject({status:'uncertain'});expect(f.host.stops).toBe(0);
});
