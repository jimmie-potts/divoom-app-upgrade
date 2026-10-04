import {canonicalRuntime} from './runtime-release.js';
import {assertNoRuntimeBarrier,selectedRuntime} from './runtime-plan.js';
import {LinuxRuntimeHost,sameRuntimeProcess,type RuntimeHost} from './runtime-host.js';
import {type InstallConfig} from './runtime-config.js';
import {runtimeGit} from './runtime-source.js';
import {runtimeAssert} from './runtime-files.js';

/** Observation only: never creates locks, removes barriers or starts a service. */
export async function statusRuntime(config:InstallConfig,host:RuntimeHost=new LinuxRuntimeHost(config)){
 const service=await host.service(),selected=await selectedRuntime(config,service);
 let inspectionRequired=false;try{await assertNoRuntimeBarrier(config);}catch{inspectionRequired=true;}
 const health=service.active==='active'&&service.process?await host.health(selected.identity,selected.program,0):null;
 const after=await host.service();runtimeAssert(sameRuntimeProcess(service.process,after.process)||!service.process&&!after.process,'runtime-changed-during-status');
 runtimeAssert(canonicalRuntime(selected)===canonicalRuntime(await selectedRuntime(config,after)),'runtime-changed-during-status');
 const mergedMain=runtimeGit(config.sourceRoot,['ls-remote','--exit-code','origin','refs/heads/main']).split(/\s/)[0];
 runtimeAssert(mergedMain&&/^[a-f0-9]{40}$/.test(mergedMain),'remote-main-unavailable');
 return {schemaVersion:1,installed:selected.identity,runningBuild:health&&selected.identity.kind==='release'?{sourceRevision:selected.identity.sourceRevision,version:selected.identity.version}:null,
  serviceState:service.active,runningProcess:health?.process??null,health:health?'healthy':'not-running',mergedMain,inspectionRequired,clientAcceptance:false,physicalAcceptance:false};
}
