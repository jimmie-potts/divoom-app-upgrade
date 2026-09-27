import {spawn,type ChildProcess} from 'node:child_process';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createInterface} from 'node:readline';
import {readyLine} from '../../scripts/verify/readiness.ts';
import type {LaunchSpec} from '../../scripts/verify/run-environment.ts';

/** The directories the shared core creates for a run: `<state>/<run-id>/` (0700) with an empty `data/` and `tmp/`. */
export async function makeRun(runId='pixoo-20260927T000000Z-b0b0b0'){
 const state=await mkdtemp(join(tmpdir(),'verify-state-')),runtimeDir=join(state,runId),dataDir=join(runtimeDir,'data');
 await mkdir(dataDir,{recursive:true,mode:0o700});await mkdir(join(runtimeDir,'tmp'),{mode:0o700});
 return {runId,runtimeDir,dataDir,root:process.cwd(),remove:()=>rm(state,{recursive:true,force:true})};
}

export interface LaunchedRun {child:ChildProcess;url:string;port:number;stdout:string[];stderr:string[];stop():Promise<void>}
/**
 * Stands in for the supervisor in source tests: run the exact launch spec with
 * `ambient` beneath it, as a user manager's environment would be, and wait for
 * the ready line.
 */
export async function launch(spec:LaunchSpec,ambient:NodeJS.ProcessEnv,timeoutMs=20000):Promise<LaunchedRun> {
 const child=spawn(spec.argv[0]!,spec.argv.slice(1),{cwd:spec.cwd,env:{...ambient,...spec.env},stdio:['ignore','pipe','pipe']});
 const stdout:string[]=[],stderr:string[]=[];
 createInterface({input:child.stderr!}).on('line',line=>stderr.push(line));
 const exited=new Promise<void>(resolve=>child.once('exit',()=>resolve()));
 const stop=async()=>{if(child.exitCode===null&&child.signalCode===null){child.kill('SIGTERM');await exited;}};
 try{
  const url=await new Promise<string>((resolve,reject)=>{
   const timer=setTimeout(()=>reject(new Error('readiness timeout')),timeoutMs);
   createInterface({input:child.stdout!}).on('line',line=>{stdout.push(line);const ready=readyLine(line);if(ready){clearTimeout(timer);resolve(ready.url);}});
   child.once('exit',code=>{clearTimeout(timer);setTimeout(()=>reject(new Error(`exited ${code}: ${stderr.join(' | ')}`)),50);});
  });
  return {child,url,port:Number(new URL(url).port),stdout,stderr,stop};
 }catch(error){await stop();throw error;}
}
