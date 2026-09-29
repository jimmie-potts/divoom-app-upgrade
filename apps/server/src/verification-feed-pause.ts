// Private coordination for disposable paired runs. Only the verification preload
// supplies the context; ordinary server startup never reads an activation variable.
import {constants,closeSync,fstatSync,fsyncSync,lstatSync,openSync,readSync,realpathSync,renameSync,unlinkSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {basename,dirname,isAbsolute,join} from 'node:path';

export type FeedPauseControl={version:1;runId:string;nonce:string};
export type FeedPauseControlState={kind:'absent'}|{kind:'invalid'}|{kind:'valid';value:FeedPauseControl};
const contextKey=Symbol.for('pixoo.verificationFeedPause');
type Context={directory:string;runId:string};

/** Bounded, private, owned regular files only. No application/build imports. */
export function readFeedPauseControl(runtimeDir:string,name:'request'|'release'):FeedPauseControlState {
 const path=join(runtimeDir,`feed-pause.${name}`);
 let fd:number|undefined;
 try{
  // lstat distinguishes a dangling symlink from an absent request.
  const link=lstatSync(path);
  if(!link.isFile()||link.isSymbolicLink())return {kind:'invalid'};
  fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  const info=fstatSync(fd);
  if(!info.isFile()||(info.mode&0o077)||info.uid!==process.getuid?.()||info.nlink!==1||info.size>4096)return {kind:'invalid'};
  const bytes=Buffer.alloc(4097);let size=0;
  while(size<bytes.length){const count=readSync(fd,bytes,size,bytes.length-size,null);if(!count)break;size+=count;}
  if(size===0||size>4096)return {kind:'invalid'};
  const value:unknown=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(0,size)));
  if(!value||typeof value!=='object'||Array.isArray(value))return {kind:'invalid'};
  const fields=value as Record<string,unknown>;
  if(Object.keys(fields).sort().join(',')!=='nonce,runId,version'||fields.version!==1||
   typeof fields.runId!=='string'||!/^[A-Za-z0-9_-]{1,120}$/.test(fields.runId)||
   typeof fields.nonce!=='string'||!/^[0-9a-f]{32}$/.test(fields.nonce))return {kind:'invalid'};
  return {kind:'valid',value:fields as FeedPauseControl};
 }catch(error){return (error as NodeJS.ErrnoException).code==='ENOENT'?{kind:'absent'}:{kind:'invalid'};}
 finally{if(fd!==undefined)closeSync(fd);}
}

export function validateFeedPauseContext(directory:string,runId:string,dataDir:string):void {
 const info=lstatSync(directory);
 if(!isAbsolute(directory)||!info.isDirectory()||info.isSymbolicLink()||(info.mode&0o077)||
  info.uid!==process.getuid?.()||realpathSync(directory)!==directory||dirname(realpathSync(dataDir))!==directory||
  basename(directory)!==runId||!/^[A-Za-z0-9_-]{1,120}$/.test(runId))throw new Error('Invalid feed pause run context');
}

export interface FeedPauseGate {enter():undefined|(()=>void);close():void}
export function verificationFeedPause():FeedPauseGate|undefined {
 const context=(globalThis as Record<symbol,unknown>)[contextKey] as Context|undefined;
 if(!context)return undefined;
 const {directory,runId}=context;
 let active=0,closed=false,lastNonce:string|undefined;
 const request=()=>{
  const state=readFeedPauseControl(directory,'request');
  return state.kind==='valid'&&state.value.runId!==runId?{kind:'invalid'} as const:state;
 };
 const acknowledge=()=>{
  if(closed)return;
  const state=request();
  if(state.kind!=='valid'){
   lastNonce=undefined;
   try{unlinkSync(join(directory,'feed-pause.ack'));}catch{/* Invalid requests stay blocked without a success acknowledgment. */}
   return;
  }
  if(active||state.value.nonce===lastNonce)return;
  const temporary=join(directory,`.feed-pause-${randomUUID()}`);
  try{
   const fd=openSync(temporary,'wx',0o600);
   try{writeFileSync(fd,JSON.stringify({...state.value,pid:process.pid}));fsyncSync(fd);}finally{closeSync(fd);}
   const current=request();
   if(current.kind==='valid'&&current.value.nonce===state.value.nonce){
    renameSync(temporary,join(directory,'feed-pause.ack'));lastNonce=state.value.nonce;
   }
  }catch{/* Failed acknowledgement keeps admission closed; the coordinator times out. */}
  finally{try{unlinkSync(temporary);}catch{/* Renamed or unavailable. */}}
 };
 const timer=setInterval(acknowledge,25);timer.unref();
 return {
  enter(){
   if(closed)return undefined;
   if(request().kind!=='absent'){acknowledge();return undefined;}
   active++;let left=false;
   return ()=>{if(left)return;left=true;active--;acknowledge();};
  },
  close(){closed=true;clearInterval(timer);},
 };
}
