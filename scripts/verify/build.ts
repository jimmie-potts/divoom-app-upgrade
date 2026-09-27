// The plug-in's `prepare`: build the checkout before a run launches it.
import {spawn} from 'node:child_process';

/**
 * A fixed failure line. The core records it in the receipt, events and result,
 * so it never carries build output, which can hold paths or secrets.
 */
export function buildFailure(code:number|null,signal:NodeJS.Signals|null):string {
 return signal?`npm run build ended by ${signal}; run it in the checkout to see why`:`npm run build exited ${code}; run it in the checkout to see why`;
}

/** Run the build with its output discarded, and settle with a fixed line on failure. */
export function runBuild(root:string,signal:AbortSignal,command:readonly [string,...string[]]=['npm','run','build']):Promise<void> {
 return new Promise((resolve,reject)=>{
  const child=spawn(command[0],command.slice(1),{cwd:root,signal,stdio:'ignore'});
  child.once('error',error=>reject(new Error((error as NodeJS.ErrnoException).name==='AbortError'?'npm run build was cancelled':'npm run build could not start')));
  child.once('close',(code,killed)=>code===0?resolve():reject(new Error(buildFailure(code,killed))));
 });
}
