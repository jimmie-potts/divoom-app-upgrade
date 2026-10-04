import {mkdtemp,mkdir,writeFile,readFile,lstat} from 'node:fs/promises';
import {join} from 'node:path';
import {homedir,tmpdir} from 'node:os';
import {Library} from '@pixoo/library';
import {stageRuntimeBundle} from '../../apps/server/src/runtime-bundle.js';
import {identifyLegacy,type InstallPlan,type RuntimeSelection} from '../../apps/server/src/runtime-plan.js';
import {runtimeConfigurationFacts,type InstallConfig} from '../../apps/server/src/runtime-config.js';
import {runtimeHash,canonicalRuntime,type RuntimeIdentity} from '../../apps/server/src/runtime-release.js';
import {inspectRuntimeUnit,type RuntimeHost,type RuntimeHealth,type RuntimeService} from '../../apps/server/src/runtime-host.js';
export class FakeRuntimeHost implements RuntimeHost{
 active='active';stops=0;starts=0;reloads=0;failStop=false;failHealth=false;healthHook:((identity:RuntimeIdentity)=>Promise<void>)|undefined;
 constructor(readonly config:InstallConfig){}
 async service():Promise<RuntimeService>{const unit=await readFile(this.config.unitFile,'utf8');return {active:this.active,program:inspectRuntimeUnit(unit,this.config),unit,unitMode:(await lstat(this.config.unitFile)).mode&0o777,unitSha256:runtimeHash(unit),process:this.active==='active'?this.process():null};}
 process(){return {pid:123,startTicks:1e12,uid:process.getuid!(),capabilities:'0',argv:[this.config.node,'fixture'],executable:this.config.node,state:'S'};}
 async qualify(){}async writers(){return [];}
 async stop(){this.stops++;if(this.failStop)throw Error('fake-stop-failed');this.active='inactive';}
 async start(){this.starts++;this.active='active';}async reload(){this.reloads++;}async verifyUnit(){}
 async health(identity:RuntimeIdentity):Promise<RuntimeHealth>{await this.healthHook?.(identity);if(this.failHealth)throw Error('fake-health-failed');return {process:this.process(),health:{status:'ready',mode:'simulator',device:{connected:false},...(identity.kind==='release'?{build:{sourceRevision:identity.sourceRevision,version:identity.version}}:{})},controller:null,indexSha256:runtimeHash('fixture'),verifiedAt:new Date().toISOString()};}
}
export async function runtimeFixture(){
 const root=await mkdtemp(join(tmpdir(),'pixoo-transition-')),runtimeRoot=join(root,'installed'),sourceRoot=join(root,'source'),dataDirectory=join(root,'data'),evidenceRoot=join(root,'evidence');
 for(const directory of [runtimeRoot,sourceRoot,dataDirectory,evidenceRoot])await mkdir(directory,{mode:0o700});
 const config:InstallConfig={schemaVersion:1,owner:'fixture',runtimeRoot,sourceRoot,dataDirectory,evidenceRoot,unitFile:join(root,'pixoo-playlist-controller.service'),environmentFile:join(root,'service.env'),node:process.execPath,npm:join(root,'npm.js'),controllerTokenFile:null,controllerRegistration:null,inactiveStartReason:null,transitionReserveSeconds:600};
 await writeFile(config.environmentFile,'PIXOO_MODE=simulator\nPIXOO_DATA_DIR='+dataDirectory+'\n',{mode:0o600});await writeFile(config.npm,'',{mode:0o600});
 const library=await Library.open({directory:join(dataDirectory,'library')});const playlist=await library.createPlaylist('before');await library.close();
 const old=join(runtimeRoot,'a'.repeat(40));
 for(const program of [old,sourceRoot]){
  for(const directory of ['apps/server/dist','apps/web/dist','packages','node_modules'])await mkdir(join(program,directory),{recursive:true});
  await writeFile(join(program,'package.json'),'{}');await writeFile(join(program,'apps/server/package.json'),'{}');await writeFile(join(program,'apps/web/package.json'),'{}');
  await writeFile(join(program,'apps/server/dist/main.js'),'export {};');await writeFile(join(program,'apps/web/dist/index.html'),'fixture');
 }
 await writeFile(join(sourceRoot,'apps/server/dist/build.json'),JSON.stringify({sourceRevision:'b'.repeat(40),version:'0.0.0'}));
 const directory=join(root,'candidate'),identity=await stageRuntimeBundle(sourceRoot,directory,'b'.repeat(40));
 const candidate:RuntimeSelection={directory,program:join(directory,'runtime'),identity,legacyOriginal:false};
 const previous:RuntimeSelection={directory:old,program:old,identity:(await identifyLegacy(old)).identity,legacyOriginal:true};
 await writeFile(config.unitFile,`[Unit]\nDescription=fixture\nStartLimitIntervalSec=120\nStartLimitBurst=3\n[Service]\nType=simple\nEnvironmentFile=${config.environmentFile}\nWorkingDirectory=${homedir()}\nExecStart="${config.node}" "${old}/apps/server/dist/main.js"\nUMask=0077\nRestart=on-failure\nRestartSec=10\nKillSignal=SIGTERM\nTimeoutStopSec=30\n[Install]\nWantedBy=default.target\n`,{mode:0o600});
 const host=new FakeRuntimeHost(config),{process:running,...service}=await host.service();
 const plan:InstallPlan={schemaVersion:1,operation:'upgrade',requestedTarget:identity.sourceRevision,targetRevision:identity.sourceRevision,config,configuration:await runtimeConfigurationFacts(config),previous,service,running,source:{repository:sourceRoot,head:identity.sourceRevision,target:identity.sourceRevision,mergedMain:identity.sourceRevision,clean:true,comparison:{status:'unknown',reason:'fixture'},commits:[],removedCommits:[],components:[]},sourceTree:'c'.repeat(40),startupEffect:'fixture',backupScope:'fixture',recovery:'fixture',blockers:[],planSha256:''};
 plan.planSha256=runtimeHash(canonicalRuntime(plan));return {root,config,host,plan,candidate,playlist};
}
