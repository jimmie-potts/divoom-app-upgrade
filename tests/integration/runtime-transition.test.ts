import {afterEach,expect,it} from 'vitest';
import {rm,readFile,writeFile,mkdir,readlink,readdir,cp} from 'node:fs/promises';
import {join} from 'node:path';
import {Library} from '@pixoo/library';
import {validateInstallReceipt} from '@jimmie-potts/install-contracts';
import {runtimeFixture} from '../helpers/runtime-fixture.js';
import {transitionRuntime,RuntimeFinalizationFailure} from '../../apps/server/src/runtime-upgrade.js';
import {assertNoRuntimeBarrier} from '../../apps/server/src/runtime-plan.js';
import {inspectRuntimeDelivery,executeRuntimeRequest,type RuntimeAdapterNative} from '../../apps/server/src/runtime-adapter.js';
import {backupData} from '../../apps/server/src/operations.js';
const roots:string[]=[];
afterEach(async()=>{for(const root of roots.splice(0))await rm(root,{recursive:true,force:true});});
async function fixture(){const value=await runtimeFixture();roots.push(value.root);return value;}
const recheck=async()=>{};
it('retains the existing library lease until the selection callback completes',async()=>{
 const f=await fixture();let reached=false;
 await backupData(f.config.dataDirectory,join(f.root,'backup'),async()=>{reached=true;await expect(Library.open({directory:join(f.config.dataDirectory,'library')})).rejects.toThrow();});
 expect(reached).toBe(true);const reopened=await Library.open({directory:join(f.config.dataDirectory,'library')});await reopened.close();
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
