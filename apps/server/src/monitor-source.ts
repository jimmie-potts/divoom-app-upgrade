import {open,lstat,access,rename,rm} from 'node:fs/promises';
import {constants} from 'node:fs';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {createAgentState,validateSnapshot,type Snapshot,type Outcome,type Identity,type DurableState} from '@jimmie-potts/agent-state';
import {MonitorStorage} from './monitor-storage.js';
import {Commands} from './commands.js';
import {ApiError} from './security.js';
const id=z.string().regex(/^[A-Za-z0-9_.-]{1,128}$/);
const consumers=z.array(z.object({id,clearOnNewTurn:z.boolean()}).strict()).min(1).max(16).refine(value=>new Set(value.map(c=>c.id)).size===value.length);
const base={version:z.literal(1),ownerId:id};
const configuration=z.discriminatedUnion('mode',[
 z.object({...base,mode:z.literal('embedded'),consumers}).strict(),
 z.object({...base,mode:z.literal('remote'),endpoint:z.string().max(256),token:z.string().regex(/^[A-Za-z0-9_-]{43}$/)}).strict()
]);
export type MonitorConfig=z.infer<typeof configuration>;
export const monitorIdentity=z.object({provider:z.enum(['codex','claude']),client:z.enum(['cli','desktop','code']),hostId:id,sourceId:id,sessionId:id}).strict();
export const monitorCommand=z.discriminatedUnion('operation',[
 z.object({operation:z.literal('label'),requestId:z.string().max(100),identity:monitorIdentity,label:z.string().max(160).nullable()}).strict(),
 z.object({operation:z.literal('acknowledge'),requestId:z.string().max(100),identity:monitorIdentity,noticeId:id,consumerId:id}).strict(),
 z.object({operation:z.literal('quiesce'),requestId:z.string().max(100)}).strict()
]);
export type MonitorCommand=z.infer<typeof monitorCommand>;
export type MonitorView={apiVersion:'1.0';ownerId:string;connection:'current'|'stale'|'unavailable';snapshot:Snapshot|null;admissionRejected:number;nextRequestId:string|null};
export async function readMonitorJson(path:string,maximum=8192):Promise<unknown>{
 if(!(await lstat(path)).isFile())throw new Error('invalid-monitor-file');
 const file=await open(path,constants.O_RDONLY|constants.O_NONBLOCK|(process.platform==='win32'?0:constants.O_NOFOLLOW));
 try{
  if((await file.stat()).size>maximum)throw new Error('invalid-monitor-file');
  const bytes=Buffer.alloc(maximum+1);let used=0;
  while(used<bytes.length){const read=await file.read(bytes,used,bytes.length-used,null);if(!read.bytesRead)break;used+=read.bytesRead;}
  if(used>maximum)throw new Error('invalid-monitor-file');return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(0,used)));
 }finally{await file.close();}
}
export async function loadMonitorConfig(directory:string):Promise<MonitorConfig>{
 try{const config=configuration.parse(await readMonitorJson(join(directory,'config.json')));
  if(config.mode==='remote'){
   const url=new URL(config.endpoint);
   if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||!url.port||url.username||url.password||url.search||url.hash||url.pathname!=='/api/monitor/v1')throw new Error('invalid-endpoint');
  }
  return config;
 }catch{throw new Error('Monitor configuration is unavailable or invalid');}
}
export async function writeMonitorJson(path:string,value:unknown):Promise<void>{
 const temporary=`${path}.${randomUUID()}.tmp`;
 try{const file=await open(temporary,'wx',0o600);try{await file.writeFile(JSON.stringify(value));await file.sync();}finally{await file.close();}await rename(temporary,path);}
 finally{await rm(temporary,{force:true});}
}
export interface SessionSource {
 view(version?:Snapshot['apiVersion']):MonitorView;
 refresh():Promise<void>;
 ingest(event:unknown):Promise<Outcome>;
 command(command:MonitorCommand):Promise<Outcome|DurableState>;
 close():Promise<void>;
}
export async function createSessionSource(directory:string,config:MonitorConfig,clock?:()=>number):Promise<SessionSource>{
 if(config.mode==='remote')return remoteSource(config);
 try{await access(join(directory,'quiesced.json'));throw new Error('monitor-owner-quiesced');}
 catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
 let imported:unknown;
 try{imported=await readMonitorJson(join(directory,'import.json'),16*1024*1024);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
 const owner=await createAgentState({storage:new MonitorStorage(join(directory,'state')),ownerId:config.ownerId,consumers:config.consumers,...(clock?{clock}:{}),...(imported===undefined?{}:{importState:imported})});
 if(imported!==undefined){try{await rm(join(directory,'import.json'));}catch(error){await owner.shutdown();throw error;}}
 const commands=new Commands<{monitor:{input:MonitorCommand;result:Outcome|DurableState}}>();
 return {
  view:(version='1.2')=>({apiVersion:'1.0',ownerId:config.ownerId,connection:'current',admissionRejected:0,snapshot:owner.snapshot(version),nextRequestId:commands.nextRequestId}),
  refresh:async()=>{},
  ingest:event=>owner.ingest(event),
  command:input=>commands.execute(input.requestId,input,{kind:'monitor',input},async()=>{
   if(input.operation==='label')return owner.setLabel(input.identity as Identity,input.label);
   if(input.operation==='acknowledge')return owner.acknowledge(input.identity as Identity,input.noticeId,input.consumerId);
   const state=await owner.exportState();await writeMonitorJson(join(directory,'quiesced.json'),{version:1,ownerId:config.ownerId,revision:state.revision});return state;
  }),
  close:()=>owner.shutdown()
 };
}
function remoteSource(config:Extract<MonitorConfig,{mode:'remote'}>):SessionSource {
 let current:MonitorView={apiVersion:'1.0',ownerId:config.ownerId,connection:'unavailable',admissionRejected:0,snapshot:null,nextRequestId:null};
 let refreshing:Promise<void>|undefined,closed=false;
 const controllers=new Set<AbortController>();
 async function request(path:string,body?:unknown):Promise<unknown>{
  if(closed)throw new ApiError('monitor-unavailable',503);
  const controller=new AbortController();controllers.add(controller);const timer=setTimeout(()=>controller.abort(),2500);
  try{
   const response=await fetch(`${config.endpoint}${path}`,{method:body===undefined?'GET':'POST',redirect:'error',signal:controller.signal,
    headers:{authorization:`Bearer ${config.token}`,'x-pixoo-request':'1','content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
   if(!response.body)throw new Error('remote-unavailable');
   const reader=response.body.getReader(),parts:Uint8Array[]=[];let size=0;
   for(;;){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.length;if(size>16*1024*1024){await reader.cancel();throw new Error('remote-limit');}parts.push(chunk.value);}
   const value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(parts)));
   if(!response.ok){
    const code=value?.error?.code;
    const errors:Record<string,number>={'invalid-input':400,'request-conflict':409,'request-expired':410,'request-order':409};
    if(typeof code==='string'&&errors[code]===response.status)throw new ApiError(code,response.status);
    throw new Error('remote-unavailable');
   }
   return value;
  }catch(error){if(error instanceof ApiError&&error.status<500)throw error;current={...current,connection:current.snapshot?'stale':'unavailable',nextRequestId:null};throw new ApiError('monitor-unavailable',503);}
  finally{clearTimeout(timer);controllers.delete(controller);}
 }
 return {
  view:(version='1.2')=>{
   const view=structuredClone(current);
   if(view.snapshot&&version!==view.snapshot.apiVersion){
    // Old readers receive the shared contract's legacy projection.
    view.snapshot.apiVersion=version;
    for(const session of view.snapshot.sessions){
     if(version==='1.0')delete session.generation;
     if(session.labelOrigin==='agent')delete session.label;
     delete session.title;delete session.project;delete session.labelOrigin;
    }
   }
   return view;
  },
  refresh:()=>refreshing??(refreshing=(async()=>{
   try{
    const value=await request('/sessions?snapshotVersion=1.2') as MonitorView;
    const checked=validateSnapshot(value.snapshot);
    if(value.apiVersion!=='1.0'||value.ownerId!==config.ownerId||value.connection!=='current'||!checked.ok||checked.value.apiVersion!=='1.2'||typeof value.nextRequestId!=='string'||value.nextRequestId.length>100||!Number.isSafeInteger(value.admissionRejected)||value.admissionRejected<0)throw new Error('invalid-remote');
    if(current.snapshot&&checked.value.revision<current.snapshot.revision)throw new Error('remote-revision-regression');
    current={apiVersion:'1.0',ownerId:config.ownerId,connection:'current',snapshot:checked.value,admissionRejected:value.admissionRejected,nextRequestId:value.nextRequestId};
   }catch{current={...current,connection:current.snapshot?'stale':'unavailable',nextRequestId:null};}
   finally{refreshing=undefined;}
  })()),
  ingest:async()=>({ok:false,code:'unavailable'}),
  command:async input=>{
   // Keep the selected owner's request identity even when a response is lost.
   // No generated replacement identity and no automatic retry.
   if(current.connection!=='current')throw new ApiError('monitor-unavailable',503);
   if(input.operation==='quiesce')throw new ApiError('owner-operation-required',409);
   const result=await request('/commands',input);
   const outcome=z.union([z.object({ok:z.literal(true),revision:z.number().int().nonnegative(),outcome:z.enum(['applied','duplicate','stale','ambiguous'])}).strict(),z.object({ok:z.literal(false),code:z.enum(['invalid-event','invalid-operation','capacity','unavailable','storage-failed'])}).strict()]).safeParse(result);
   if(!outcome.success){current={...current,connection:current.snapshot?'stale':'unavailable',nextRequestId:null};throw new ApiError('monitor-unavailable',503);}return outcome.data;
  },
  close:async()=>{closed=true;for(const controller of controllers)controller.abort();await refreshing;}
 };
}
