import {canonicalRuntime} from './runtime-release.js';
import {assertNoRuntimeBarrier,parseRuntimePlan,selectedRuntime,type InstallPlan,type RuntimeSelection} from './runtime-plan.js';
import {LinuxRuntimeHost,sameRuntimeProcess,type RuntimeHost,type RuntimeHealth} from './runtime-host.js';
import {type InstallConfig} from './runtime-config.js';
import {runtimeRemoteMain} from './runtime-source.js';
import {runtimeAssert} from './runtime-files.js';

/** Observation only: never creates locks, removes barriers or starts a service. */
export async function statusRuntime(config:InstallConfig,host:RuntimeHost=new LinuxRuntimeHost(config),readMain=runtimeRemoteMain){
 const observe=()=>host.observeService?host.observeService():host.service().then(service=>({...service,needsDaemonReload:false}));
 const service=await observe();
 let inspectionRequired=service.needsDaemonReload;try{await assertNoRuntimeBarrier(config);}catch{inspectionRequired=true;}
 let selected:RuntimeSelection|null=null;try{selected=await selectedRuntime(config,service);}catch(error){if(!inspectionRequired)throw error;}
 let health:RuntimeHealth|null=null;
 if(selected&&!service.needsDaemonReload&&service.active==='active'&&service.process)try{health=await host.health(selected.identity,selected.program,0);}catch{inspectionRequired=true;}
 const after=await observe();runtimeAssert(service.needsDaemonReload===after.needsDaemonReload&&service.unitSha256===after.unitSha256&&service.active===after.active&&(sameRuntimeProcess(service.process,after.process)||!service.process&&!after.process),'runtime-changed-during-status');
 if(selected)runtimeAssert(canonicalRuntime(selected)===canonicalRuntime(await selectedRuntime(config,after)),'runtime-changed-during-status');
 const mergedMain=readMain(config.sourceRoot);
 runtimeAssert(mergedMain===null||/^[a-f0-9]{40}$/.test(mergedMain),'remote-main-unavailable');
 return {schemaVersion:1,installed:selected?.identity??null,runningBuild:health&&selected?.identity.kind==='release'?{sourceRevision:selected.identity.sourceRevision,version:selected.identity.version}:null,
  serviceState:service.active,needsDaemonReload:service.needsDaemonReload,runningProcess:health?.process??null,health:health?'healthy':service.active==='active'?'unknown':'not-running',mergedMain,inspectionRequired,clientAcceptance:false,physicalAcceptance:false};
}
export async function statusRuntimePlan(config:InstallConfig,plan:InstallPlan,host:RuntimeHost=new LinuxRuntimeHost(config),readMain=runtimeRemoteMain){
 parseRuntimePlan(plan,config);return statusRuntime(config,host,readMain);
}
