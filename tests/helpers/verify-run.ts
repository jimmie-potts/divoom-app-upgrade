import {spawn,type ChildProcess} from 'node:child_process';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join} from 'node:path';
import {createInterface} from 'node:readline';
import type {AddressInfo,Server} from 'node:net';
import {installedPorts} from '../../scripts/verify/installed-ports.ts';
import {readyLine} from '../../scripts/verify/readiness.ts';
import type {LaunchSpec} from '../../scripts/verify/run-environment.ts';

/** The directories the shared core creates for a run: `<state>/<run-id>/` (0700) with an empty `data/`, `tmp/` and `home/`. */
export async function makeRun(runId='pixoo-20260927T000000Z-b0b0b0'){
 const state=await mkdtemp(join(tmpdir(),'verify-state-')),runtimeDir=join(state,runId),dataDir=join(runtimeDir,'data');
 await mkdir(dataDir,{recursive:true,mode:0o700});await mkdir(join(runtimeDir,'tmp'),{mode:0o700});await mkdir(join(runtimeDir,'home'),{mode:0o700});
 return {runId,runtimeDir,dataDir,root:process.cwd(),remove:()=>rm(state,{recursive:true,force:true})};
}

export interface LaunchedRun {child:ChildProcess;url:string;port:number;stdout:string[];stderr:string[];stop():Promise<void>}
/** A start failure with the process's stderr lines, as the core would read them. */
export class StartError extends Error {constructor(message:string,readonly stderr:string[]){super(message);}}
/**
 * Stands in for the supervisor in source tests: run the exact launch spec as
 * the core does, with `ambient` as the user manager's environment beneath the
 * core's private TMPDIR and HOME, and wait for the ready line.
 */
export async function launch(spec:LaunchSpec,ambient:NodeJS.ProcessEnv,timeoutMs=20000):Promise<LaunchedRun> {
 const runtimeDir=dirname(spec.env.PIXOO_DATA_DIR!);
 const env={...ambient,TMPDIR:join(runtimeDir,'tmp'),HOME:join(runtimeDir,'home'),...spec.env};
 const child=spawn(spec.argv[0]!,spec.argv.slice(1),{cwd:spec.cwd,env,stdio:['ignore','pipe','pipe']});
 const stdout:string[]=[],stderr:string[]=[];
 createInterface({input:child.stderr!}).on('line',line=>stderr.push(line));
 const exited=new Promise<void>(resolve=>child.once('exit',()=>resolve()));
 const stop=async()=>{if(child.exitCode===null&&child.signalCode===null){child.kill('SIGTERM');await exited;}};
 try{
  const url=await new Promise<string>((resolve,reject)=>{
   const timer=setTimeout(()=>reject(new Error('readiness timeout')),timeoutMs);
   createInterface({input:child.stdout!}).on('line',line=>{stdout.push(line);const ready=readyLine(line);if(ready){clearTimeout(timer);resolve(ready.url);}});
   // 'close' follows the end of stdout and stderr, so the failure carries all of stderr.
   child.once('close',code=>{clearTimeout(timer);reject(new StartError(`exited ${code}: ${stderr.join(' | ')}`,stderr));});
  });
  return {child,url,port:Number(new URL(url).port),stdout,stderr,stop};
 }catch(error){await stop();throw error;}
}

/**
 * Listen on an ephemeral 127.0.0.1 port outside the installed services' ports.
 * The kernel's ephemeral range includes 41230 and 41231, and a paired Hub
 * port or `hub-feed` origin is refused on those, so a stand-in must avoid them.
 */
export async function listenLoopback(server:Server):Promise<number> {
 for(let attempt=0;attempt<20;attempt++){
  await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>{server.off('error',reject);resolve();});});
  const port=(server.address() as AddressInfo).port;
  if(!installedPorts.includes(port))return port;
  await new Promise<void>(resolve=>server.close(()=>resolve()));
 }
 throw new Error('no ephemeral loopback port outside the installed ports');
}
