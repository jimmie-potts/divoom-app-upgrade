import {lstat,readFile,readdir,readlink,realpath} from 'node:fs/promises';
import {basename,join,resolve,sep} from 'node:path';
import {homedir} from 'node:os';
import {setTimeout as delay} from 'node:timers/promises';
import {healthSchema} from '@pixoo/core';
import {validate} from '@jimmie-potts/device-contracts';
import {runtimeAssert,runtimeOwned} from './runtime-files.js';
import {runtimeCommand,runtimeRemaining,runtimeDeadline} from './runtime-command.js';
import {readRuntimeFile,runtimeHash,canonicalRuntime,type RuntimeIdentity} from './runtime-release.js';
import {runtimeEnvironment,runtimeControllerToken,type InstallConfig} from './runtime-config.js';

export const UNIT='pixoo-playlist-controller.service';
export interface RuntimeProcess {pid:number;startTicks:number;uid:number;capabilities:string;argv:string[];executable:string;state:string}
export interface RuntimeService {active:string;unitSha256:string;unitMode:number;unit:string;program:string;process:RuntimeProcess|null}
export interface RuntimeHealth {process:RuntimeProcess;health:unknown;controller:unknown;indexSha256:string;verifiedAt:string}
export async function runtimeProcess(pid:number):Promise<RuntimeProcess|null>{
 try{
  const root='/proc/'+pid,status=await readFile(join(root,'status'),'utf8'),stat=(await readFile(join(root,'stat'),'utf8')).split(') ').slice(1).join(') ').split(/\s+/);
  const uid=Number(/^Uid:\s+\d+\s+(\d+)/m.exec(status)?.[1]),capabilities=/^CapEff:\s+(\w+)/m.exec(status)?.[1];runtimeAssert(capabilities&&Number.isSafeInteger(uid),'invalid-process-identity');
  return {pid,startTicks:Number(stat[19]),uid,capabilities,argv:(await readFile(join(root,'cmdline'))).toString().split('\0').filter(Boolean),executable:await readlink(join(root,'exe')),state:stat[0]!};
 }catch(error){if(['ENOENT','ESRCH'].includes((error as NodeJS.ErrnoException).code??''))return null;throw error;}
}
export const sameRuntimeProcess=(left:RuntimeProcess|null,right:RuntimeProcess|null):boolean=>Boolean(left&&right&&['pid','startTicks','uid','executable','argv'].every(key=>canonicalRuntime(left[key as keyof RuntimeProcess])===canonicalRuntime(right[key as keyof RuntimeProcess])));
export function ordinaryRuntimeProcess(value:RuntimeProcess):void{runtimeAssert(value.uid===process.getuid!()&&value.uid!==0&&(BigInt('0x'+value.capabilities)&6n)===0n,'runtime-permission-bypass');}
function commandWords(value:string):string[]{
 const words=value.match(/"[^"\n]*"|'[^'\n]*'|[^\s]+/g)??[];
 runtimeAssert(!/[\\$`%]/.test(value),'unsupported-service-command');
 return words.map(word=>word.startsWith('"')||word.startsWith("'")?word.slice(1,-1):word);
}
export function inspectRuntimeUnit(text:string,config:InstallConfig):string{
 const allowed:Record<string,Set<string>>={Unit:new Set(['Description','Documentation','StartLimitIntervalSec','StartLimitBurst']),
 Service:new Set(['Type','EnvironmentFile','WorkingDirectory','ExecStart','UMask','Restart','RestartSec','KillSignal','TimeoutStopSec']),Install:new Set(['WantedBy'])};
 const fields:Record<string,string>={};let section='';
 for(const raw of text.split('\n')){
  const line=raw.trim();if(!line||line.startsWith('#')||line.startsWith(';'))continue;
  if(/^\[.*\]$/.test(line)){section=line.slice(1,-1);runtimeAssert(allowed[section],'unsupported-service-section');continue;}
  const index=line.indexOf('='),key=line.slice(0,index);runtimeAssert(index>0&&allowed[section]?.has(key)&&fields[section+'/'+key]===undefined,'unsupported-service-effects');fields[section+'/'+key]=line.slice(index+1);
 }
 const fixed:Record<string,string>={'Unit/StartLimitIntervalSec':'120','Unit/StartLimitBurst':'3','Service/Type':'simple','Service/UMask':'0077','Service/Restart':'on-failure','Service/RestartSec':'10','Service/KillSignal':'SIGTERM','Service/TimeoutStopSec':'30','Install/WantedBy':'default.target'};
 for(const [key,value] of Object.entries(fixed))runtimeAssert(fields[key]===value,'unsupported-service-effects');
 const expand=(value:string|undefined)=>value?.replace(/^%h(?=\/|$)/,homedir());
 runtimeAssert(expand(fields['Service/EnvironmentFile'])===config.environmentFile&&expand(fields['Service/WorkingDirectory'])===homedir(),'unsupported-service-path');
 const argv=commandWords(fields['Service/ExecStart']??'');runtimeAssert(argv.length===2&&argv[0]===config.node&&argv[1]!.endsWith('/apps/server/dist/main.js'),'unsupported-service-command');
 const program=argv[1]!.slice(0,-'/apps/server/dist/main.js'.length);
 runtimeAssert(program.startsWith(config.runtimeRoot+sep),'foreign-service-program');return program;
}

export interface RuntimeHost {
 service():Promise<RuntimeService>;qualify(roots:string[]):Promise<void>;writers(roots:string[]):Promise<RuntimeProcess[]>;
 stop(roots:string[]):Promise<void>;start():Promise<void>;reload():Promise<void>;
 verifyUnit(path:string):Promise<void>;health(identity:RuntimeIdentity,program:string,startedAfter:number):Promise<RuntimeHealth>;
}
export class LinuxRuntimeHost implements RuntimeHost{
 constructor(readonly config:InstallConfig){}
 async service():Promise<RuntimeService>{
  const output=(await runtimeCommand('systemctl',['--user','show',UNIT,'--property=FragmentPath,DropInPaths,MainPID,ActiveState,User,AmbientCapabilities,NeedDaemonReload'],{timeout:15000})).toString();
  const fields=Object.fromEntries(output.trim().split('\n').map(line=>{const i=line.indexOf('=');return [line.slice(0,i),line.slice(i+1)];}));
  runtimeAssert(fields.FragmentPath===this.config.unitFile&&!fields.DropInPaths&&!fields.AmbientCapabilities&&fields.NeedDaemonReload==='no'&&(!fields.User||fields.User===String(process.getuid!())),'unsupported-service-ownership');
  await runtimeOwned(this.config.unitFile);const unit=(await readRuntimeFile(this.config.unitFile,16384)).toString(),program=inspectRuntimeUnit(unit,this.config);
  const processIdentity=Number(fields.MainPID)?await runtimeProcess(Number(fields.MainPID)):null;
  if(processIdentity){ordinaryRuntimeProcess(processIdentity);runtimeAssert(processIdentity.argv.length===2&&processIdentity.argv[0]===this.config.node&&processIdentity.argv[1]===join(program,'apps/server/dist/main.js')&&processIdentity.executable===this.config.node,'service-process-mismatch');}
  return {active:fields.ActiveState!,unit,unitSha256:runtimeHash(unit),unitMode:(await lstat(this.config.unitFile)).mode&0o777,program,process:processIdentity};
 }
 async writers(roots:string[]):Promise<RuntimeProcess[]>{
  const result:RuntimeProcess[]=[];
  for(const name of await readdir('/proc')){
   if(!/^\d+$/.test(name)||Number(name)===process.pid)continue;
   let info:RuntimeProcess|null;try{info=await runtimeProcess(Number(name));}catch(error){if((error as NodeJS.ErrnoException).code==='EACCES')continue;throw error;}
   if(!info||info.state==='Z'||basename(info.argv[0]??'')!=='node')continue;
   // Supported server and CLI entrypoints may follow Node flags. Inspect every
   // path argument, including --import=path, without executing its contents.
   let cwd:string;try{cwd=await readlink('/proc/'+name+'/cwd');}catch{throw new Error('runtime-writer-entrypoint-unreadable');}
   const arguments_=info.argv.slice(1).map(argument=>argument.replace(/^--(?:import|require)=/,''));
   const paths=arguments_.filter(argument=>!argument.startsWith('-')).map(argument=>resolve(cwd,argument));
   if(roots.some(root=>paths.some(path=>path.startsWith(root+sep))||cwd===root||cwd.startsWith(root+sep))){ordinaryRuntimeProcess(info);result.push(info);}
  }
  return result;
 }
 async qualify(roots:string[]):Promise<void>{
  const own=await runtimeProcess(process.pid);runtimeAssert(own,'installer-process-unknown');ordinaryRuntimeProcess(own);
  const info=await lstat(this.config.node);runtimeAssert(!(info.mode&0o6000)&&!(await runtimeCommand('getcap',[this.config.node])).toString().trim(),'privileged-node-executable');
  await this.service();
  const known=new Set((await this.writers(roots)).map(writer=>writer.pid));
  runtimeAssert((await this.writers([this.config.runtimeRoot])).every(writer=>known.has(writer.pid)),'unselected-runtime-writer');
 }
 async stop(roots:string[]):Promise<void>{
  await runtimeCommand('systemctl',['--user','stop',UNIT],{timeout:45000});let quiet=0;
  for(let attempt=0;attempt<100;attempt++){
   if(!(await this.writers(roots)).length){if(++quiet===2){const service=await this.service();runtimeAssert(['inactive','failed'].includes(service.active)&&service.process===null,'service-stop-unverified');return;}}else quiet=0;
   await delay(100);
  }
  throw new Error('runtime-writers-not-drained');
 }
 async start():Promise<void>{await runtimeCommand('systemctl',['--user','start',UNIT],{timeout:45000});}
 async reload():Promise<void>{await runtimeCommand('systemctl',['--user','daemon-reload']);}
 async verifyUnit(path:string):Promise<void>{await runtimeCommand('systemd-analyze',['--user','verify',path]);}
 private async read(port:number,path:string,token?:string):Promise<Buffer>{
  const response=await fetch('http://127.0.0.1:'+port+path,{redirect:'error',signal:AbortSignal.timeout(Math.max(1,Math.floor(runtimeRemaining(2000)))),...(token?{headers:{authorization:'Bearer '+token}}:{})});
  runtimeAssert(response.ok&&response.body,'runtime-health-http');let data=Buffer.alloc(0);
  for await(const chunk of response.body){runtimeAssert(data.length+chunk.length<2*1024*1024,'runtime-health-size');data=Buffer.concat([data,chunk]);}return data;
 }
 async health(identity:RuntimeIdentity,program:string,startedAfter:number):Promise<RuntimeHealth>{
  const environment=await runtimeEnvironment(this.config),port=Number(environment.PIXOO_PORT??8787),deadline=Date.now()+45000;
  return runtimeDeadline.run(Math.min(deadline,runtimeDeadline.getStore()??Infinity),async()=>{
  for(let attempt=0;attempt<20&&Date.now()<deadline;attempt++)try{
   const service=await this.service();runtimeAssert(service.active==='active'&&service.process&&service.process.startTicks>=startedAfter&&await realpath(service.program)===await realpath(program),'runtime-running-process-mismatch');
   const sockets=new Set<string>();
   for(const file of await readdir('/proc/'+service.process.pid+'/fd'))try{const link=await readlink('/proc/'+service.process.pid+'/fd/'+file);if(link.startsWith('socket:['))sockets.add(link.slice(8,-1));}catch{/* A closing descriptor is not evidence. */}
   const listener=(await readFile('/proc/net/tcp','utf8')).trim().split('\n').slice(1).some(line=>{const row=line.trim().split(/\s+/);return row[1]==='0100007F:'+port.toString(16).toUpperCase().padStart(4,'0')&&row[3]==='0A'&&sockets.has(row[9]!);});
   runtimeAssert(listener,'health-listener-owner-mismatch');
   const body=JSON.parse((await this.read(port,'/api/health')).toString()) as Record<string,unknown>;
   if(identity.kind==='release')runtimeAssert(canonicalRuntime(healthSchema.parse(body).build)===canonicalRuntime({sourceRevision:identity.sourceRevision,version:identity.version}),'runtime-build-mismatch');
   runtimeAssert(body.status==='ready'&&body.mode===(environment.PIXOO_MODE??'simulator'),'runtime-health-not-ready');
   const device=body.device as {connected?:unknown};runtimeAssert(device&&(body.mode==='simulator'?device.connected===false:device.connected===true),'runtime-device-connectivity-unverified');
   const index=await this.read(port,'/');runtimeAssert(runtimeHash(index)===runtimeHash(await readRuntimeFile(join(program,'apps/web/dist/index.html'))),'runtime-served-artifact-mismatch');
   let controller:unknown=null;
   if(environment.PIXOO_CONTROLLER_ENABLED==='1'){
    const token=await runtimeControllerToken(this.config,environment);
    controller=JSON.parse((await this.read(port,'/controller/v1/snapshot',token)).toString());runtimeAssert(validate('snapshot',controller),'runtime-controller-health');
   }
   runtimeAssert(sameRuntimeProcess(service.process,(await this.service()).process),'runtime-process-changed-during-health');
   return {process:service.process,health:body,controller,indexSha256:runtimeHash(index),verifiedAt:new Date().toISOString()};
  }catch{await delay(250);}
  throw new Error('bounded-runtime-health-failure');
  });
 }
}
export async function runtimeTicks():Promise<number>{const ticks=Number((await runtimeCommand('getconf',['CLK_TCK'])).toString().trim());runtimeAssert(Number.isSafeInteger(ticks)&&ticks>0,'unknown-clock-ticks');return Math.floor(Number((await readFile('/proc/uptime','utf8')).split(' ')[0])*ticks);}
