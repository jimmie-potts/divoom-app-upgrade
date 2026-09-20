import {mkdir,lstat,open,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {validateExport} from '@jimmie-potts/agent-state';
import {assertRuntimeDirectory} from './operations.js';
import {privatePath} from './config.js';
import {MonitorStorage} from './monitor-storage.js';
import {readMonitorJson} from './monitor-source.js';
import {provisionCredential,revokeCredential} from './mcp-config.js';
/** Offline operations acquire the same owner lease. No automatic stale-lock removal. */
export async function monitorOperation(operation:string,dataDir:string,argument?:string):Promise<string|undefined>{
 const root=await privatePath(dataDir),directory=join(root,'agent-monitor');
 await assertRuntimeDirectory(root);await mkdir(directory,{recursive:true,mode:0o700});
 if(operation==='add-read'||operation==='add-control'){
  if(!argument)throw new Error('invalid-operation');
  return provisionCredential(directory,argument,operation==='add-read'?['read']:['read','control']);
 }
 if(operation==='revoke'){if(!argument)throw new Error('invalid-operation');await revokeCredential(directory,argument);return;}
 const lease=await new MonitorStorage(join(directory,'state')).acquire('offline',new AbortController().signal);
 try{
  if(operation==='resume'){
   // Explicit operator assertion: the replacement owner is stopped and this copy is current.
   if(argument!=='replacement-stopped-and-state-current')throw new Error('confirmation-required');
   await lstat(join(directory,'quiesced.json'));await rm(join(directory,'quiesced.json'));return;
  }
  if(operation==='import'){
   if(!argument||await lease.load(new AbortController().signal)!==null)throw new Error('occupied-or-invalid-destination');
   const input=await readMonitorJson(await privatePath(argument),16*1024*1024),checked=validateExport(input);
   if(!checked.ok)throw new Error('invalid-import');
   // Reserve the input exclusively; startup applies it under the owner's lease.
   const file=await open(join(directory,'import.json'),'wx',0o600);
   try{await file.writeFile(JSON.stringify(checked.value));await file.sync();}finally{await file.close();}
   return;
  }
  throw new Error('invalid-operation');
 }finally{await lease.release();}
}
if(process.argv[1]?.endsWith('/monitor-cli.js')||process.argv[1]?.endsWith('\\monitor-cli.js')){
 const [, ,operation,directory,argument,...extra]=process.argv;
 try{if(!operation||!directory||extra.length)throw new Error('invalid-operation');const output=await monitorOperation(operation,directory,argument);if(output)process.stdout.write(output+'\n');}
 catch{process.stderr.write('Monitor operation failed. Check private configuration, ownership and arguments.\n');process.exitCode=1;}
}
