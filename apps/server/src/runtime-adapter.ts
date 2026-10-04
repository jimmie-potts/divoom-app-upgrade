import {join,dirname,sep} from 'node:path';
import {z} from 'zod';
import {validateInstallReceipt} from '@jimmie-potts/install-contracts';
import {runtimeAssert,runtimeJson,runtimeOwned,runtimeWrite,withRuntimeLock} from './runtime-files.js';
import {canonicalRuntime,readRuntimeFile,runtimeHash} from './runtime-release.js';
import {planRuntime,assertNoRuntimeBarrier,selectedRuntime,type InstallPlan} from './runtime-plan.js';
import {LinuxRuntimeHost,sameRuntimeProcess,type RuntimeHost,type RuntimeHealth} from './runtime-host.js';
import {operateRuntime,type RuntimeReceipt} from './runtime-upgrade.js';
import {runtimeDeadline} from './runtime-command.js';
import {type InstallConfig} from './runtime-config.js';

export const RUNTIME_REPOSITORY='jimmie-potts/divoom-app-upgrade';
const requestSchema=z.object({schemaVersion:z.literal(1),operation:z.enum(['install','reconcile']),repository:z.literal(RUNTIME_REPOSITORY),issue:z.number().int().positive(),
 merge:z.string().regex(/^[a-f0-9]{40}$/),owner:z.string().min(1),deadline:z.number().finite(),evidenceDirectory:z.string().startsWith('/')}).strict();
export type RuntimeRequest=z.infer<typeof requestSchema>;
export function runtimeRequestJson(text:string):unknown{
 const value:unknown=JSON.parse(text),keys=new Set<string>();
 for(const match of text.matchAll(/("(?:\\.|[^"\\])*")\s*:/g)){const key=JSON.parse(match[1]!) as string;runtimeAssert(!keys.has(key),'duplicate-request-key');keys.add(key);}
 return value;
}
export function parseRuntimeRequest(value:unknown,owner:string):RuntimeRequest{const request=requestSchema.parse(value);runtimeAssert(request.owner===owner,'installation-authority-mismatch');return request;}
export function runtimeReserve(deadline:number,seconds:number):void{runtimeAssert(deadline-Date.now()/1000>=seconds,'insufficient-installation-deadline-reserve');}

export async function inspectRuntimeDelivery(config:InstallConfig,request:RuntimeRequest,host:RuntimeHost=new LinuxRuntimeHost(config)):Promise<Record<string,unknown>>{
 return withRuntimeLock(config.runtimeRoot,async()=>{
  await assertNoRuntimeBarrier(config);await host.qualify([(await host.service()).program]);
  const selected=await selectedRuntime(config,await host.service());
  const marker=await runtimeJson(join(config.runtimeRoot,'records/latest-terminal.json')) as {operationId:unknown};
  runtimeAssert(typeof marker.operationId==='string'&&/^pixoo-[a-f0-9-]{36}$/.test(marker.operationId),'invalid-terminal-marker');
  const path=join(config.runtimeRoot,'receipts',marker.operationId+'.json');await runtimeOwned(path,false,true);
  const raw=await readRuntimeFile(path),receipt=JSON.parse(raw.toString()) as RuntimeReceipt;
  runtimeAssert(validateInstallReceipt(receipt)&&receipt.operationId===marker.operationId&&receipt.runtime==='pixoo'&&receipt.installationId==='primary'&&receipt.operation!=='rollback'&&receipt.requestedTarget===request.merge,'exact-terminal-receipt-required');
  const succeeded=receipt.outcome==='succeeded',failed=receipt.outcome==='refused'||receipt.outcome==='failed-rolled-back';
  runtimeAssert(succeeded||failed,'unresolved-runtime-operation');
  runtimeAssert(canonicalRuntime(selected.identity)===canonicalRuntime(succeeded?receipt.target:receipt.previous),'terminal-selected-identity-mismatch');
  if(succeeded)runtimeAssert(selected.identity.kind==='release'&&selected.identity.sourceRevision===request.merge,'selected-revision-mismatch');
  let startedAfter=0;
  if(receipt.outcome!=='refused'){
   const healthPath=join(config.runtimeRoot,'records',receipt.operationId,succeeded?'health.json':'recovery.json');
   runtimeAssert(receipt.running?.evidence===healthPath&&receipt.health.evidence===healthPath,'terminal-health-reference-mismatch');await runtimeOwned(healthPath,false,true);
   const prior=await runtimeJson(healthPath) as RuntimeHealth;runtimeAssert(Number.isSafeInteger(prior.process?.startTicks)&&prior.process.startTicks>0,'terminal-process-evidence-missing');startedAfter=prior.process.startTicks;
  }
  const health=await host.health(selected.identity,selected.program,startedAfter),service=await host.service();
  runtimeAssert(sameRuntimeProcess(health.process,service.process)&&canonicalRuntime(selected)===canonicalRuntime(await selectedRuntime(config,service)),'fresh-running-readback-mismatch');
  if(succeeded)runtimeAssert(canonicalRuntime((health.health as {build?:unknown}).build)===canonicalRuntime({sourceRevision:request.merge,version:selected.identity.kind==='release'?selected.identity.version:''}),'fresh-running-build-mismatch');
  await assertNoRuntimeBarrier(config);runtimeAssert(raw.equals(await readRuntimeFile(path)),'terminal-receipt-changed');
  await runtimeWrite(join(request.evidenceDirectory,'readback.json'),{installed:selected.identity,health,clientAcceptance:false,physicalAcceptance:false});
  const proof={health:'healthy',receipt:{path,sha256:runtimeHash(raw)}};
  return succeeded?{status:'installed',installedRevision:request.merge,runningRevision:request.merge,...proof}:
   {status:'blocked',effects:receipt.outcome==='refused'?'none':'reconciled',outcome:receipt.outcome,baselineIdentity:selected.identity,runningIdentity:selected.identity,locksClear:true,barriersClear:true,...proof};
 },true);
}
export interface RuntimeAdapterNative{plan:(config:InstallConfig,target:string)=>Promise<InstallPlan>;operate:typeof operateRuntime;inspect:typeof inspectRuntimeDelivery}
export async function executeRuntimeRequest(config:InstallConfig,input:unknown,guard:()=>Promise<void>,native:RuntimeAdapterNative={plan:planRuntime,operate:operateRuntime,inspect:inspectRuntimeDelivery}):Promise<Record<string,unknown>>{
 const request=parseRuntimeRequest(input,config.owner),response={schemaVersion:1,repository:request.repository,issue:request.issue,merge:request.merge,owner:request.owner};let dispatched=false;
 try{
  await runtimeOwned(request.evidenceDirectory,true,true);runtimeAssert(request.evidenceDirectory.startsWith(config.evidenceRoot+sep),'evidence-outside-configured-root');
  for(let parent=dirname(request.evidenceDirectory);parent.startsWith(config.evidenceRoot);parent=dirname(parent))await runtimeOwned(parent,true,true);
  runtimeReserve(request.deadline,1);await guard();
  if(request.operation==='install'){
   runtimeReserve(request.deadline,config.transitionReserveSeconds+30);
   const preparedDeadline=(request.deadline-config.transitionReserveSeconds)*1000;
   const plan=await runtimeDeadline.run(preparedDeadline,()=>native.plan(config,request.merge));
   runtimeAssert(plan.operation==='upgrade'&&plan.targetRevision===request.merge&&canonicalRuntime(plan.config)===canonicalRuntime(config),'native-plan-request-mismatch');
   const path=join(request.evidenceDirectory,'plan.json');await runtimeWrite(path,plan);runtimeAssert(canonicalRuntime(await runtimeJson(path))===canonicalRuntime(plan),'plan-readback-mismatch');
   dispatched=true;
   const receipt=await runtimeDeadline.run(preparedDeadline,()=>native.operate(plan,async()=>{await guard();runtimeReserve(request.deadline,config.transitionReserveSeconds);}));
   runtimeAssert(validateInstallReceipt(receipt)&&['succeeded','refused','failed-rolled-back'].includes(receipt.outcome),'native-operation-unresolved');
  }
  await guard();const result=await runtimeDeadline.run(request.deadline*1000,()=>native.inspect(config,request));runtimeReserve(request.deadline,0);return {...response,...result};
 }catch{
  // No invented healthy baseline. Reconciliation only observes retained evidence.
  return {...response,status:'uncertain',reason:dispatched||request.operation==='reconcile'?'native-installation-unresolved':'installation-preflight-unqualified'};
 }
}
