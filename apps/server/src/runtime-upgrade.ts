import {chmod,cp,lstat,mkdir,readdir,rename,rm,symlink} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {validateInstallReceipt} from '@jimmie-potts/install-contracts';
import {canonicalRuntime,runtimeHash,runtimeInventory,type RuntimeIdentity} from './runtime-release.js';
import {stageRuntimeBundle,verifyRuntimeBundle} from './runtime-bundle.js';
import {runtimeAssert,runtimeDirectory,runtimeExists,runtimeFence,runtimeJson,runtimeSync,runtimeWrite,withRuntimeLock} from './runtime-files.js';
import {runtimeConfigurationFacts,type InstallConfig} from './runtime-config.js';
import {LinuxRuntimeHost,runtimeTicks,type RuntimeHost} from './runtime-host.js';
import {assertNoRuntimeBarrier,checkRuntimePlan,runtimeRollbackTarget,selectedRuntime,verifyRuntimeSelection,type InstallPlan,type RuntimeSelection} from './runtime-plan.js';
import {runtimeCommand,runtimeDeadline} from './runtime-command.js';
import {backupRuntimeState,qualifyRuntimeState,reopenRuntimeState,runtimeStateDigest,snapshotRuntimeState,withRuntimeOwners} from './runtime-state.js';

export type RuntimeOutcome='in-progress'|'succeeded'|'refused'|'failed-before-switch'|'failed-rolled-back'|'rollback-failed'|'interrupted'|'receipt-finalization-failed';
interface Evidence {evidence:string|null}
export interface RuntimeReceipt {schemaVersion:'install-receipt/1.0';operationId:string;operation:'upgrade'|'rollback'|'migrate';runtime:'pixoo';installationId:'primary';startedAt:string;updatedAt:string;completedAt:string|null;requestedTarget:string;
 previous:RuntimeIdentity|null;target:RuntimeIdentity|null;approval:{planSha256:string;baselineSha256:string;configurationSha256:string}|null;
 compatibility:Evidence&{status:'compatible'|'unknown'};backup:{reference:string;sha256:string}|null;
 running:{identity:RuntimeIdentity;verification:'build-health'|'legacy-process-artifacts';evidence:string}|null;
 health:Evidence&{status:'healthy'|'unknown'|'not-checked'};failure:{phase:string;code:string;evidence:string|null}|null;
 rollback:Evidence&{status:'not-attempted'|'succeeded'|'failed'};statePreservation:Evidence&{strategy:'latest-durable-state'};outcome:RuntimeOutcome}
const timestamp=()=>new Date().toISOString().replace(/\.\d{3}Z$/,'Z');
export function runtimeReceipt(plan:InstallPlan,target:RuntimeIdentity|null,compatibility:string|null):RuntimeReceipt{
 const now=timestamp();return {schemaVersion:'install-receipt/1.0',operationId:'pixoo-'+randomUUID(),operation:plan.previous.legacyOriginal?'migrate':plan.operation,runtime:'pixoo',installationId:'primary',
  startedAt:now,updatedAt:now,completedAt:null,requestedTarget:plan.requestedTarget,previous:plan.previous.identity,target,
  approval:{planSha256:plan.planSha256,baselineSha256:runtimeHash(canonicalRuntime(plan.previous.identity)),configurationSha256:runtimeHash(canonicalRuntime(plan.configuration))},
  compatibility:{status:compatibility?'compatible':'unknown',evidence:compatibility},backup:null,running:null,health:{status:'not-checked',evidence:null},failure:null,rollback:{status:'not-attempted',evidence:null},statePreservation:{strategy:'latest-durable-state',evidence:null},outcome:'in-progress'};
}
export async function persistRuntimeReceipt(path:string,value:RuntimeReceipt):Promise<void>{
 runtimeAssert(validateInstallReceipt(value),'invalid-generated-runtime-receipt');await runtimeWrite(path,value);
 runtimeAssert(canonicalRuntime(await runtimeJson(path))===canonicalRuntime(value),'runtime-receipt-readback-failed');
}
export class RuntimeFinalizationFailure extends Error{constructor(readonly receipt:RuntimeReceipt){super('runtime-receipt-finalization-uncertain');}}
async function finalizeRuntimeReceipt(path:string,value:RuntimeReceipt,writer:typeof persistRuntimeReceipt):Promise<void>{
 value.updatedAt=timestamp();value.completedAt=value.outcome==='interrupted'?null:value.updatedAt;
 try{await writer(path,value);}catch{
  value.outcome='receipt-finalization-failed';value.completedAt=null;value.failure={phase:'receipt-finalization',code:'runtime-receipt-finalization-uncertain',evidence:dirname(path)};
  runtimeAssert(validateInstallReceipt(value),'invalid-finalization-diagnostic');throw new RuntimeFinalizationFailure(value);
 }
}
async function syncRuntimeTree(root:string):Promise<void>{
 for(const entry of (await runtimeInventory(root)).entries)if(entry.kind==='file')await runtimeSync(join(root,entry.path));
 for(const entry of (await runtimeInventory(root)).entries.reverse())if(entry.kind==='directory')await runtimeSync(join(root,entry.path));
 await runtimeSync(root);
}
async function switchRuntime(config:InstallConfig,target:RuntimeSelection):Promise<void>{
 runtimeAssert(dirname(target.directory)===join(config.runtimeRoot,target.identity.kind==='release'?'releases':'legacy'),'switch-outside-runtime-owner');
 const link=join(config.runtimeRoot,'.current-'+randomUUID());
 try{await symlink((target.identity.kind==='release'?'releases/':'legacy/')+(target.identity.kind==='release'?target.identity.sourceRevision:target.identity.legacyId),link);await rename(link,join(config.runtimeRoot,'current'));await runtimeSync(config.runtimeRoot);}
 finally{await rm(link,{force:true});}
}
async function retainRuntime(config:InstallConfig,target:RuntimeSelection):Promise<RuntimeSelection>{
 const parent=join(config.runtimeRoot,target.identity.kind==='release'?'releases':'legacy');await runtimeDirectory(parent);
 const directory=join(parent,target.identity.kind==='release'?target.identity.sourceRevision:target.identity.legacyId);
 if(!await runtimeExists(directory)){
  if(target.legacyOriginal){await mkdir(directory,{mode:0o700});await cp(target.program,join(directory,'runtime'),{recursive:true,verbatimSymlinks:true,preserveTimestamps:true,errorOnExist:true,force:false});}
  else await cp(target.directory,directory,{recursive:true,verbatimSymlinks:true,preserveTimestamps:true,errorOnExist:true,force:false});
  await runtimeWrite(join(directory,'release.json'),target.identity);await syncRuntimeTree(directory);await runtimeSync(parent);
 }
 const result={directory,program:join(directory,'runtime'),identity:target.identity,legacyOriginal:false};await verifyRuntimeSelection(result);
 runtimeAssert(canonicalRuntime(await runtimeJson(join(directory,'release.json')))===canonicalRuntime(target.identity),'conflicting-runtime-release');return result;
}
interface SuccessMarker {operationId:string;history:string[]}
async function runtimeSuccess(config:InstallConfig,receipt:RuntimeReceipt):Promise<void>{
 const path=join(config.runtimeRoot,'records/latest-success.json');let history:string[]=[];
 if(await runtimeExists(path)){const previous=await runtimeJson(path) as SuccessMarker;runtimeAssert(Array.isArray(previous.history)&&previous.history.every(sha=>/^[a-f0-9]{40}$/.test(sha)),'invalid-runtime-history');history=previous.history;}
 if(receipt.target?.kind==='release')history=[receipt.target.sourceRevision,...history.filter(sha=>sha!==receipt.target!.sourceRevision)];
 await runtimeWrite(path,{operationId:receipt.operationId,history:history.slice(0,4)});
}
async function pruneRuntime(config:InstallConfig,host:RuntimeHost):Promise<void>{
 await assertNoRuntimeBarrier(config);const marker=await runtimeJson(join(config.runtimeRoot,'records/latest-success.json')) as SuccessMarker;
 const keep=new Set(marker.history),selected=await selectedRuntime(config,await host.service());
 if(selected.identity.kind==='release')keep.add(selected.identity.sourceRevision);
 for(const name of await readdir(join(config.runtimeRoot,'releases'))){
  if(!/^[a-f0-9]{40}$/.test(name)||keep.has(name))continue;
  const directory=join(config.runtimeRoot,'releases',name);if((await lstat(directory)).isSymbolicLink())continue;
  const identity=await runtimeJson(join(directory,'release.json')) as RuntimeIdentity;
  if(identity.kind!=='release'||identity.sourceRevision!==name)continue;
  // Only a successful native receipt establishes this updater's deletion ownership.
  let owned=false;
  for(const file of await readdir(join(config.runtimeRoot,'receipts')))if(/^pixoo-[a-f0-9-]{36}\.json$/.test(file)){
   const receipt=await runtimeJson(join(config.runtimeRoot,'receipts',file)) as RuntimeReceipt;
   if(validateInstallReceipt(receipt)&&receipt.runtime==='pixoo'&&receipt.outcome==='succeeded'&&canonicalRuntime(receipt.target)===canonicalRuntime(identity))owned=true;
  }
  if(owned){await verifyRuntimeBundle(directory,identity);await rm(directory,{recursive:true});}
 }
 await runtimeSync(join(config.runtimeRoot,'releases'));
}
export interface RuntimeTransitionOptions {host:RuntimeHost;recheck:()=>Promise<void>;beforeStop?:()=>Promise<void>;checkpoint?:(step:string)=>Promise<void>;backup?:typeof backupRuntimeState;finalWriter?:typeof persistRuntimeReceipt;prune?:()=>Promise<void>}

/** The only owned switch path, reused by CLI and supervisor. No database restore. */
export async function transitionRuntime(plan:InstallPlan,prepared:RuntimeSelection,compatibility:string,options:RuntimeTransitionOptions):Promise<RuntimeReceipt>{
 const {config}=plan,host=options.host,checkpoint=options.checkpoint??(async()=>{});
 return withRuntimeLock(config.runtimeRoot,async()=>{
  await assertNoRuntimeBarrier(config);await options.recheck();
  runtimeAssert(canonicalRuntime(await runtimeConfigurationFacts(config))===canonicalRuntime(plan.configuration),'runtime-configuration-drift');
  const observed=await selectedRuntime(config,await host.service());runtimeAssert(canonicalRuntime(observed)===canonicalRuntime(plan.previous),'runtime-baseline-drift');
  const target=await retainRuntime(config,prepared),previous=await retainRuntime(config,plan.previous);
  const receipt=runtimeReceipt(plan,target.identity,compatibility),records=join(config.runtimeRoot,'records'),receipts=join(config.runtimeRoot,'receipts');
  await runtimeDirectory(records);await runtimeDirectory(receipts);const record=join(records,receipt.operationId);await runtimeDirectory(record);
  await runtimeWrite(join(record,'plan.json'),plan);await runtimeWrite(join(record,'original-unit.json'),{unit:plan.service.unit,mode:plan.service.unitMode});
  const newUnit=plan.service.unit.replace(/^ExecStart=.*$/m,'ExecStart="'+config.node+'" "'+join(config.runtimeRoot,'current/runtime/apps/server/dist/main.js')+'"');
  const unitCandidate=join(record,'pixoo-playlist-controller.service');
  // Unit verification occurs before outage and preserves every other directive.
  const {writeFile}=await import('node:fs/promises');await writeFile(unitCandidate,newUnit,{mode:plan.service.unitMode,flag:'wx'});await host.verifyUnit(unitCandidate);
  await options.beforeStop?.();
  const receiptPath=join(receipts,receipt.operationId+'.json'),barrier=join(records,'active.json');
  await runtimeWrite(barrier,{operationId:receipt.operationId,planSha256:plan.planSha256,receipt:receiptPath});await persistRuntimeReceipt(receiptPath,receipt);
  let phase='stop',switched=false,adopting=false;
  const roots=[plan.service.program,plan.previous.program,target.program,previous.program];
  try{
   await runtimeFence([...new Set([plan.previous.program,target.program,previous.program])],join(record,'fence.json'),async()=>{
    await host.stop(roots);
    await withRuntimeOwners(config,async()=>{
     runtimeAssert(canonicalRuntime(await runtimeConfigurationFacts(config))===canonicalRuntime(plan.configuration),'runtime-configuration-drift-during-stop');
     phase='backup';const backups=join(config.runtimeRoot,'backups');await runtimeDirectory(backups);
     const backup=join(backups,receipt.operationId);
     await (options.backup??backupRuntimeState)(config.dataDirectory,backup,async sha256=>{
     receipt.backup={reference:backup,sha256};await persistRuntimeReceipt(receiptPath,receipt);
     phase='switch';adopting=plan.previous.legacyOriginal;
     await checkpoint('before-current');await switchRuntime(config,target);await checkpoint('current-selected');
     if(adopting){
      // The retained unit and originals survive any interruption in this adoption.
      await rename(unitCandidate,config.unitFile);await chmod(config.unitFile,plan.service.unitMode);await runtimeSync(config.unitFile);await runtimeSync(dirname(config.unitFile));
      await checkpoint('unit-written');await host.reload();await checkpoint('unit-reloaded');
     }
     adopting=false;switched=true;
     });
    });
   });
   phase='start';const started=await runtimeTicks();await host.start();phase='health';const health=await host.health(target.identity,target.program,started);
   await verifyRuntimeSelection(target);runtimeAssert(canonicalRuntime(await runtimeConfigurationFacts(config))===canonicalRuntime(plan.configuration),'runtime-protected-configuration-changed');
   await runtimeWrite(join(record,'health.json'),health);await runtimeWrite(join(record,'state.json'),{strategy:'latest-durable-state',restoredBackup:false,sha256:await runtimeStateDigest(config.dataDirectory)});
   receipt.outcome='succeeded';receipt.running={identity:target.identity,verification:target.identity.kind==='release'?'build-health':'legacy-process-artifacts',evidence:join(record,'health.json')};receipt.health={status:'healthy',evidence:join(record,'health.json')};receipt.statePreservation.evidence=join(record,'state.json');
  }catch{
   receipt.failure={phase,code:'runtime-'+phase+'-failed',evidence:record};
   if(adopting){receipt.outcome='interrupted';receipt.failure={phase:'recovery',code:'runtime-partial-adoption',evidence:record};}
   else if(!switched){receipt.outcome='failed-before-switch';if(await runtimeExists(join(config.runtimeRoot,'current'))&&await import('node:fs/promises').then(fs=>fs.realpath(join(config.runtimeRoot,'current'))).catch(()=>null)===target.directory){receipt.outcome='interrupted';receipt.failure={phase:'recovery',code:'runtime-switch-durability-unknown',evidence:record};}}
   else try{
    await runtimeFence([target.program,previous.program],join(record,'recovery-fence.json'),async()=>{
     await host.stop(roots);await withRuntimeOwners(config,async()=>{
      const latest=await runtimeStateDigest(config.dataDirectory);await switchRuntime(config,previous);runtimeAssert(latest===await runtimeStateDigest(config.dataDirectory),'runtime-recovery-replaced-state');
     },true);
    });
    const started=await runtimeTicks();await host.start();const health=await host.health(previous.identity,previous.program,started);
    await verifyRuntimeSelection(previous);runtimeAssert(canonicalRuntime(await runtimeConfigurationFacts(config))===canonicalRuntime(plan.configuration),'runtime-recovery-configuration-drift');
    await runtimeWrite(join(record,'recovery.json'),health);await runtimeWrite(join(record,'state.json'),{strategy:'latest-durable-state',restoredBackup:false,sha256:await runtimeStateDigest(config.dataDirectory)});
    receipt.outcome='failed-rolled-back';receipt.rollback={status:'succeeded',evidence:join(record,'recovery.json')};receipt.health={status:'healthy',evidence:join(record,'recovery.json')};receipt.running={identity:previous.identity,verification:previous.identity.kind==='release'?'build-health':'legacy-process-artifacts',evidence:join(record,'recovery.json')};receipt.statePreservation.evidence=join(record,'state.json');
   }catch{receipt.outcome='rollback-failed';receipt.rollback={status:'failed',evidence:record};receipt.health={status:'unknown',evidence:record};receipt.failure={phase:'rollback',code:'runtime-recovery-unverified',evidence:record};}
  }
  await finalizeRuntimeReceipt(receiptPath,receipt,async(path,value)=>{await (options.finalWriter??persistRuntimeReceipt)(path,value);if(value.outcome==='succeeded')await runtimeSuccess(config,value);});
  if(['succeeded','failed-rolled-back'].includes(receipt.outcome)){
   await runtimeWrite(join(records,'latest-terminal.json'),{operationId:receipt.operationId});await rm(barrier);await runtimeSync(records);
  }
  if(receipt.outcome==='succeeded')try{await (options.prune??(()=>pruneRuntime(config,host)))();}catch{await runtimeWrite(join(record,'retention.json'),{status:'inspection-required',reason:'runtime-retention-incomplete'});}
  return receipt;
 });
}

export async function prepareRuntimeBundle(plan:InstallPlan,scratch:string):Promise<RuntimeSelection>{
 const source=join(scratch,'source');await runtimeCommand('git',['clone','--shared','--no-checkout','--quiet',plan.config.sourceRoot,source],{timeout:60000});
 await runtimeCommand('git',['checkout','--detach',plan.targetRevision],{cwd:source});
 const node=plan.config.node,version=(await runtimeCommand(node,['--version'])).toString().trim();runtimeAssert(/^v24\.(?:[5-9]|[1-9]\d+)\.\d+$/.test(version),'runtime-node-24-required');
 const env={...process.env,PATH:dirname(node)+':'+(process.env.PATH??''),TMPDIR:scratch,PIXOO_MODE:'simulator'};
 await runtimeCommand(node,[plan.config.npm,'ci','--ignore-scripts','--no-audit','--no-fund'],{cwd:source,env,timeout:300000});
 await runtimeCommand(node,[plan.config.npm,'run','build'],{cwd:source,env,timeout:120000});
 const directory=join(scratch,'bundle'),identity=await stageRuntimeBundle(source,directory,plan.targetRevision);return {directory,program:join(directory,'runtime'),identity,legacyOriginal:false};
}
export async function operateRuntime(plan:InstallPlan,beforeStop:()=>Promise<void>=async()=>{}):Promise<RuntimeReceipt>{
 runtimeAssert(plan.blockers.length===0,'runtime-plan-has-blockers');
 const host=new LinuxRuntimeHost(plan.config);await checkRuntimePlan(plan,host);
 const staging=join(plan.config.runtimeRoot,'staging');await runtimeDirectory(staging);const scratch=join(staging,randomUUID());await runtimeDirectory(scratch);
 let admitted=false;
 try{
  const candidate=plan.operation==='rollback'?await runtimeRollbackTarget(plan.config,plan.requestedTarget):await prepareRuntimeBundle(plan,scratch);
  const compatibility=await qualifyRuntimeState(plan.previous.program,candidate.program,plan.config.node,join(scratch,'compatibility-state'));
  await snapshotRuntimeState(plan.config.dataDirectory,join(scratch,'current-state'));
  const currentState=await reopenRuntimeState(plan.previous.program,candidate.program,plan.config.node,join(scratch,'current-state'));
  const records=join(plan.config.runtimeRoot,'records');await runtimeDirectory(records);const qualification=join(records,'qualification-'+randomUUID());await runtimeDirectory(qualification);
  const evidence=join(qualification,'compatibility.json');await runtimeWrite(evidence,{...compatibility,currentState});
  // Preparation may obey an outer deadline; the admitted native switch cannot be cancelled by it.
  return await runtimeDeadline.run(Infinity,()=>transitionRuntime(plan,candidate,evidence,{host,recheck:()=>checkRuntimePlan(plan,host),beforeStop:async()=>{await beforeStop();admitted=true;}}));
 }catch(error){
  if(admitted)throw error;
  return await withRuntimeLock(plan.config.runtimeRoot,async()=>{
   await assertNoRuntimeBarrier(plan.config);
   const selected=await selectedRuntime(plan.config,await host.service());runtimeAssert(canonicalRuntime(selected.identity)===canonicalRuntime(plan.previous.identity),'refused-baseline-changed');
   const receipt=runtimeReceipt(plan,null,null);receipt.outcome='refused';receipt.failure={phase:'staging',code:'runtime-preflight-refused',evidence:null};
   receipt.completedAt=receipt.updatedAt=timestamp();
   await runtimeDirectory(join(plan.config.runtimeRoot,'receipts'));await runtimeDirectory(join(plan.config.runtimeRoot,'records'));
   await persistRuntimeReceipt(join(plan.config.runtimeRoot,'receipts',receipt.operationId+'.json'),receipt);
   await runtimeWrite(join(plan.config.runtimeRoot,'records/latest-terminal.json'),{operationId:receipt.operationId});return receipt;
  });
 }finally{await rm(scratch,{recursive:true,force:true});}
}
