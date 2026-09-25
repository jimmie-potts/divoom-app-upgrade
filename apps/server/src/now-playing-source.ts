import {join} from 'node:path';
import {z} from 'zod';
import {readMonitorJson} from './monitor-source.js';
import {nowPlayingView,parsePlaybackSnapshot,type NowPlayingView,type PlaybackSnapshot} from './now-playing.js';
// Opt-in reader for the hub's shared playback snapshot. It holds no device authority:
// the presentation decides what, if anything, to draw from its view.
const configuration=z.object({
 version:z.literal(1),
 endpoint:z.string().max(256).regex(/^http:\/\/127\.0\.0\.1:[1-9][0-9]{0,4}\/api\/playback\/v1\/snapshot$/),
 token:z.string().regex(/^[A-Za-z0-9_-]{43}$/),
 sourceId:z.string().regex(/^[A-Za-z0-9_.-]{1,128}$/),
}).strict();
export type PlaybackConfig=z.infer<typeof configuration>;
const MAX_BYTES=64*1024;
/** The private `playback.json` in the monitor directory, or undefined when it does not exist. */
export async function loadPlaybackConfig(directory:string):Promise<PlaybackConfig|undefined>{
 let value:unknown;
 try{value=await readMonitorJson(join(directory,'playback.json'));}
 catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return undefined;throw new Error('Playback configuration is invalid',{cause:error});}
 const parsed=configuration.safeParse(value);
 if(!parsed.success||Number(new URL(parsed.data.endpoint).port)>65535)throw new Error('Playback configuration is invalid');
 return parsed.data;
}
export type PlaybackSourceStatus={source:'current'|'stale'|'unavailable';view:NowPlayingView};
export class PlaybackReader {
 private last:{snapshot:PlaybackSnapshot;receivedAtMs:number}|undefined;
 private readOk=false;
 private reading:Promise<void>|undefined;
 private closed=false;
 private readonly controllers=new Set<AbortController>();
 private readonly clock:()=>number;
 private readonly timeoutMs:number;
 constructor(private readonly config:PlaybackConfig,options:{clock?:()=>number;timeoutMs?:number}={}){
  this.clock=options.clock??(()=>performance.now());this.timeoutMs=options.timeoutMs??1500;
 }
 /** One read at a time; a call while a read runs shares it. */
 refresh():Promise<void>{
  if(this.closed)return Promise.resolve();
  return this.reading??=this.read().finally(()=>{this.reading=undefined;});
 }
 status():PlaybackSourceStatus{
  const last=this.last;
  const ageMs=last?(last.snapshot.ageMs??0)+Math.max(0,this.clock()-last.receivedAtMs):0;
  return {source:!last?'unavailable':this.readOk?'current':'stale',view:nowPlayingView(last?.snapshot,{readOk:this.readOk,ageMs})};
 }
 close():void{this.closed=true;for(const controller of this.controllers)controller.abort();}
 private async read():Promise<void>{
  const controller=new AbortController();this.controllers.add(controller);const timer=setTimeout(()=>controller.abort(),this.timeoutMs);
  try{
   const response=await fetch(this.config.endpoint,{redirect:'error',signal:controller.signal,headers:{authorization:`Bearer ${this.config.token}`}});
   if(!response.ok||!response.body)throw new Error('playback-unavailable');
   const reader=response.body.getReader(),parts:Uint8Array[]=[];let size=0;
   for(;;){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.length;if(size>MAX_BYTES){await reader.cancel();throw new Error('playback-limit');}parts.push(chunk.value);}
   const snapshot=parsePlaybackSnapshot(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(parts))),this.config.sourceId);
   if(!snapshot)throw new Error('playback-invalid');
   if(this.closed)return;
   this.last={snapshot,receivedAtMs:this.clock()};this.readOk=true;
  }catch{if(!this.closed)this.readOk=false;}
  finally{clearTimeout(timer);this.controllers.delete(controller);}
 }
}
