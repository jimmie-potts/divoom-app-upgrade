import {spawn} from 'node:child_process';
import {AsyncLocalStorage} from 'node:async_hooks';
import {runtimeAssert} from './runtime-files.js';
export const runtimeDeadline=new AsyncLocalStorage<number>();
export function runtimeRemaining(maximum:number):number{
 const deadline=runtimeDeadline.getStore();if(deadline===undefined)return maximum;
 const remaining=deadline-Date.now();runtimeAssert(remaining>0,'runtime-preflight-deadline');return Math.min(maximum,remaining);
}
export async function runtimeCommand(command:string,args:string[],options:{cwd?:string;env?:NodeJS.ProcessEnv;timeout?:number;maximum?:number}={}):Promise<Buffer>{
 const timeout=runtimeRemaining(options.timeout??30000),maximum=options.maximum??4*1024*1024;
 return new Promise((resolve,reject)=>{
  const child=spawn(command,args,{...options,stdio:['ignore','pipe','pipe'],detached:true});let output=Buffer.alloc(0),errorBytes=0,failed=false;
  const stop=()=>{failed=true;try{process.kill(-child.pid!,'SIGKILL');}catch{/* Already exited. */}};
  const timer=setTimeout(stop,timeout);
  child.stdout.on('data',(data:Buffer)=>{if(output.length+data.length>maximum)stop();else output=Buffer.concat([output,data]);});
  child.stderr.on('data',(data:Buffer)=>{errorBytes+=data.length;if(errorBytes>maximum)stop();});
  child.once('error',()=>{clearTimeout(timer);reject(new Error('runtime-command-unavailable'));});
  child.once('close',code=>{clearTimeout(timer);if(failed||code!==0)reject(new Error('runtime-command-failed'));else resolve(output);});
 });
}
