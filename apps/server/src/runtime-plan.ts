import {lstat,readlink,realpath} from 'node:fs/promises';
import {basename,dirname,join} from 'node:path';
import {z} from 'zod';
import {runtimeAssert,runtimeExists,runtimeJson} from './runtime-files.js';
import {runtimeConfigurationFacts,runtimeEnvironment,runtimeControllerToken,type InstallConfig} from './runtime-config.js';
import {canonicalRuntime,runtimeHash,runtimeInventory,type RuntimeIdentity,type RuntimeInventory,type RuntimeLegacy} from './runtime-release.js';
import {verifyRuntimeBundle} from './runtime-bundle.js';
import {inspectRuntimeSource,runtimeGit,type RuntimeSource} from './runtime-source.js';
import {LinuxRuntimeHost,type RuntimeHost,type RuntimeProcess,type RuntimeService} from './runtime-host.js';
import {runtimeStatePaths} from './runtime-state.js';
import {validateInstallReceipt} from '@jimmie-potts/install-contracts';

const digest=z.string().regex(/^[a-f0-9]{64}$/),sha=z.string().regex(/^[a-f0-9]{40}$/);
export const runtimeIdentitySchema=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('release'),sourceRevision:sha,version:z.string().min(1),archiveSha256:digest,manifestSha256:digest}).strict(),
 z.object({kind:z.literal('legacy'),sourceRevision:z.literal('unknown'),legacyId:z.string().regex(/^legacy-[a-f0-9]{16}$/),contentSha256:digest,manifestSha256:digest}).strict()
]);
export async function identifyLegacy(program:string):Promise<{identity:RuntimeLegacy;inventory:RuntimeInventory}>{
 for(const path of ['apps/server/dist/main.js','apps/web/dist/index.html','node_modules'])await lstat(join(program,path));
 const inventory=await runtimeInventory(program),manifest={format:1,kind:'pixoo-legacy',inventory};
 return {identity:{kind:'legacy',sourceRevision:'unknown',legacyId:'legacy-'+inventory.sha256.slice(0,16),contentSha256:inventory.sha256,manifestSha256:runtimeHash(canonicalRuntime(manifest))},inventory};
}
export interface RuntimeSelection {directory:string;program:string;identity:RuntimeIdentity;legacyOriginal:boolean}
export async function verifyRuntimeSelection(selection:RuntimeSelection):Promise<void>{
 if(selection.identity.kind==='release')await verifyRuntimeBundle(selection.directory,selection.identity);
 else runtimeAssert(canonicalRuntime((await identifyLegacy(selection.program)).identity)===canonicalRuntime(selection.identity),'legacy-runtime-inventory-changed');
}
export async function selectedRuntime(config:InstallConfig,service:RuntimeService):Promise<RuntimeSelection>{
 const current=join(config.runtimeRoot,'current');
 if(await runtimeExists(current)){
  runtimeAssert((await lstat(current)).isSymbolicLink(),'runtime-current-not-link');
  const link=await readlink(current);runtimeAssert(/^(releases\/[a-f0-9]{40}|legacy\/legacy-[a-f0-9]{16})$/.test(link),'runtime-current-outside-owner');
  const directory=join(config.runtimeRoot,link);runtimeAssert(await realpath(directory)===directory,'linked-runtime-release');
  const identity=runtimeIdentitySchema.parse(await runtimeJson(join(directory,'release.json')));
  runtimeAssert(basename(directory)===(identity.kind==='release'?identity.sourceRevision:identity.legacyId),'runtime-selection-identity-mismatch');
  const result={directory,program:join(directory,'runtime'),identity,legacyOriginal:false};await verifyRuntimeSelection(result);
  runtimeAssert(service.program===join(current,'runtime'),'partial-runtime-adoption');return result;
 }
 runtimeAssert(dirname(service.program)===config.runtimeRoot&&/^[a-f0-9]{40}$/.test(basename(service.program))&&await realpath(service.program)===service.program,'unsupported-legacy-runtime');
 return {directory:service.program,program:service.program,identity:(await identifyLegacy(service.program)).identity,legacyOriginal:true};
}
export async function assertNoRuntimeBarrier(config:InstallConfig):Promise<void>{
 runtimeAssert(!await runtimeExists(join(config.runtimeRoot,'records/active.json')),'unresolved-runtime-operation');
 const receipts=join(config.runtimeRoot,'receipts');if(!await runtimeExists(receipts))return;
 const {runtimeOwned}=await import('./runtime-files.js');await runtimeOwned(receipts,true,true);
 const {readdir}=await import('node:fs/promises');
 for(const name of await readdir(receipts))if(/^pixoo-[a-f0-9-]{36}\.json$/.test(name)){
  const value=await runtimeJson(join(receipts,name));runtimeAssert(validateInstallReceipt(value),'invalid-runtime-receipt');
  const receipt=value as {runtime:string;operationId:string;outcome:string};
  runtimeAssert(receipt.runtime==='pixoo'&&receipt.operationId+'.json'===name,'foreign-runtime-receipt');
  runtimeAssert(!['in-progress','interrupted','rollback-failed','receipt-finalization-failed','failed-before-switch'].includes(receipt.outcome),'unresolved-runtime-operation');
 }
}
export async function runtimeRollbackTarget(config:InstallConfig,requested:string):Promise<RuntimeSelection>{
 let identity:RuntimeIdentity;
 if(requested==='previous'){
  const marker=await runtimeJson(join(config.runtimeRoot,'records/latest-success.json')) as {operationId:string};runtimeAssert(/^pixoo-[a-f0-9-]{36}$/.test(marker.operationId),'invalid-runtime-success-marker');
  const value=await runtimeJson(join(config.runtimeRoot,'receipts',marker.operationId+'.json'));runtimeAssert(validateInstallReceipt(value),'invalid-runtime-success-receipt');
  const receipt=value as {outcome:string;operationId:string;previous:unknown};runtimeAssert(receipt.outcome==='succeeded'&&receipt.operationId===marker.operationId,'invalid-runtime-success-receipt');identity=runtimeIdentitySchema.parse(receipt.previous);
 }else{runtimeAssert(/^[a-f0-9]{40}$/.test(requested),'full-runtime-revision-required');identity=runtimeIdentitySchema.parse(await runtimeJson(join(config.runtimeRoot,'releases',requested,'release.json')));runtimeAssert(identity.kind==='release'&&identity.sourceRevision===requested,'runtime-rollback-identity-mismatch');}
 const directory=join(config.runtimeRoot,identity.kind==='release'?'releases':'legacy',identity.kind==='release'?identity.sourceRevision:identity.legacyId),selection={directory,program:join(directory,'runtime'),identity,legacyOriginal:false};
 await verifyRuntimeSelection(selection);return selection;
}
export interface InstallPlan {schemaVersion:1;operation:'upgrade'|'rollback';requestedTarget:string;targetRevision:string;config:InstallConfig;configuration:Record<string,string>;previous:RuntimeSelection;service:Omit<RuntimeService,'process'>;running:RuntimeProcess|null;source:RuntimeSource;sourceTree:string;startupEffect:string;backupScope:string;recovery:string;blockers:string[];planSha256:string}
export async function planRuntime(config:InstallConfig,target:string,operation:'upgrade'|'rollback'='upgrade',host:RuntimeHost=new LinuxRuntimeHost(config),sourceReader=inspectRuntimeSource):Promise<InstallPlan>{
 await assertNoRuntimeBarrier(config);const service=await host.service(),previous=await selectedRuntime(config,service),environment=await runtimeEnvironment(config);
 await host.qualify([service.program,previous.program]);await runtimeStatePaths(config.dataDirectory);
 if(environment.PIXOO_CONTROLLER_ENABLED==='1'&&(config.controllerTokenFile||config.controllerRegistration))await runtimeControllerToken(config,environment);
 const rollback=operation==='rollback'?await runtimeRollbackTarget(config,target):null;
 const source=sourceReader(config.sourceRoot,rollback?.identity.kind==='release'?rollback.identity.sourceRevision:rollback?runtimeGit(config.sourceRoot,['rev-parse','HEAD']):target,previous.identity.kind==='release'?previous.identity.sourceRevision:null);
 const {process:running,...contract}=service;
 const value:InstallPlan={schemaVersion:1,operation,requestedTarget:target,targetRevision:rollback?(rollback.identity.kind==='release'?rollback.identity.sourceRevision:rollback.identity.legacyId):target,config,configuration:await runtimeConfigurationFacts(config),previous,service:contract,running,source,
  sourceTree:runtimeGit(config.sourceRoot,['rev-parse',source.target+'^{tree}']),
  startupEffect:environment.PIXOO_MODE==='device'?'Starts the existing configured device mode. Saved Monitor selection can restore display content; media context remains paused.':'Starts the existing simulator; sends no physical device commands.',
  backupScope:'Verified offline library backup plus complete named library/media, monitor state, credentials, settings and external environment/unit evidence; excludes owner locks and transient staging.',
  recovery:'Only qualified previous code reopens latest durable state; no automatic backup restore. Unknown compatibility refuses before outage.',blockers:[
   ...(environment.PIXOO_CONTROLLER_ENABLED==='1'&&!config.controllerTokenFile&&!config.controllerRegistration?['controller-read-token-required']:[]),
   ...(service.active!=='active'&&!config.inactiveStartReason?['runtime-inactive-start-unqualified']:[])],planSha256:''};
 value.planSha256=runtimeHash(canonicalRuntime(value));
 return value;
}
export function runtimePlanBinding(value:InstallPlan):string{return canonicalRuntime(Object.fromEntries(Object.entries(value).filter(([key])=>key!=='running'&&key!=='planSha256')));}
export async function checkRuntimePlan(value:InstallPlan,host:RuntimeHost):Promise<void>{
 runtimeAssert(value.planSha256===runtimeHash(canonicalRuntime({...value,planSha256:''})),'runtime-plan-changed');
 const fresh=await planRuntime(value.config,value.requestedTarget,value.operation,host);
 runtimeAssert(runtimePlanBinding(value)===runtimePlanBinding(fresh),'runtime-plan-drift');
}
