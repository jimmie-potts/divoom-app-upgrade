import {open,rename,rm,lstat} from 'node:fs/promises';
import {constants} from 'node:fs';
import {join} from 'node:path';
import {createHash,randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
import {z} from 'zod';
import type {MachinePrincipal} from '@jimmie-potts/device-mcp';
export const MCP_DEVICE_ID='pixoo-local';
const principal=z.object({id:z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),enabled:z.boolean(),digest:z.string().regex(/^[a-f0-9]{64}$/),scopes:z.array(z.enum(['read','control'])).min(1).max(2).refine(v=>new Set(v).size===v.length)}).strict();
const credentials=z.object({version:z.literal(1),principals:z.array(principal).max(32)}).strict().refine(v=>new Set(v.principals.map(p=>p.id)).size===v.principals.length&&new Set(v.principals.map(p=>p.digest)).size===v.principals.length);
type Credentials=z.infer<typeof credentials>;
const failure=()=>new Error('MCP credential configuration is unavailable or invalid');
async function read(directory:string):Promise<Credentials>{
 const path=join(directory,'mcp-credentials.json');
 if(!(await lstat(path)).isFile())throw failure();
 const handle=await open(path,constants.O_RDONLY|constants.O_NONBLOCK|(process.platform==='win32'?0:constants.O_NOFOLLOW));
 try{
  const info=await handle.stat();if(!info.isFile()||info.size>65536)throw failure();
  const buffer=Buffer.alloc(65537);let used=0;
  for(;;){const {bytesRead}=await handle.read(buffer,used,buffer.length-used,null);if(!bytesRead)break;used+=bytesRead;if(used>65536)throw failure();}
  return credentials.parse(JSON.parse(buffer.subarray(0,used).toString('utf8')));
 }finally{await handle.close();}
}
export async function validateMcpConfiguration(directory:string):Promise<void>{try{await read(directory);}catch{throw failure();}}
export async function authenticateCredential(directory:string,bearer:string):Promise<MachinePrincipal|null>{
 if(!/^[A-Za-z0-9_-]{43}$/.test(bearer))return null;
 try{
  const state=await read(directory),digest=createHash('sha256').update(bearer).digest();
  const match=state.principals.find(p=>timingSafeEqual(Buffer.from(p.digest,'hex'),digest));
  return match?.enabled?{id:match.id,credential:{kind:'machine',status:'active',declared:true,devices:[MCP_DEVICE_ID],scopes:match.scopes}}:null;
 }catch{return null;}
}
async function update(directory:string,change:(state:Credentials)=>Credentials):Promise<void>{
 const lockPath=join(directory,'mcp-credentials.lock'),temporary=join(directory,`.mcp-${randomUUID()}.tmp`);
 let lock:Awaited<ReturnType<typeof open>>|undefined;
 try{
  lock=await open(lockPath,'wx',0o600);
  let state:Credentials;try{state=await read(directory);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;state={version:1,principals:[]};}
  const next=credentials.parse(change(state));
  const file=await open(temporary,'wx',0o600);try{await file.writeFile(JSON.stringify(next));await file.sync();}finally{await file.close();}
  await rename(temporary,join(directory,'mcp-credentials.json'));
 }catch{throw failure();}finally{await rm(temporary,{force:true});if(lock){await lock.close();await rm(lockPath,{force:true});}}
}
export async function provisionCredential(directory:string,id:string,scopes:('read'|'control')[]):Promise<string>{
 const token=randomBytes(32).toString('base64url'),entry=principal.parse({id,enabled:true,digest:createHash('sha256').update(token).digest('hex'),scopes});
 await update(directory,state=>{if(state.principals.some(p=>p.id===id))throw failure();return {...state,principals:[...state.principals,entry]};});return token;
}
export async function revokeCredential(directory:string,id:string):Promise<void>{
 await update(directory,state=>{if(!state.principals.some(p=>p.id===id))throw failure();return {...state,principals:state.principals.map(p=>p.id===id?{...p,enabled:false}:p)};});
}
