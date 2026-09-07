import {expect,it} from 'vitest';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../../apps/server/src/app.js';
async function stream(url:string,last?:string){
 const controller=new AbortController();
 const response=await fetch(url+'/api/events',{signal:controller.signal,headers:last?{'last-event-id':last}:{}});
 expect(response.status).toBe(200);
 const reader=response.body!.getReader();let pending='';
 return {close:()=>controller.abort(),async next(){
  for(;;){const index=pending.indexOf('\n\n');if(index>=0){const block=pending.slice(0,index);pending=pending.slice(index+2);if(block.startsWith(':'))continue;const lines=block.split('\n');return {id:lines.find(s=>s.startsWith('id: '))!.slice(4),event:lines.find(s=>s.startsWith('event: '))!.slice(7),data:JSON.parse(lines.find(s=>s.startsWith('data: '))!.slice(6))};}
   const chunk=await reader.read();if(chunk.done)throw new Error('Stream ended');pending+=new TextDecoder().decode(chunk.value);
  }
 }};
}
it('streams snapshots and replays or resyncs using Last-Event-ID',async()=>{
 const dataDir=await mkdtemp(join(tmpdir(),'pixoo-events-')),app=createApp({dataDir});
 const streams:Awaited<ReturnType<typeof stream>>[]=[];
 try{
  const url=await app.listen({host:'127.0.0.1',port:0});
  const first=await stream(url);streams.push(first);const initial=await first.next();expect(initial.event).toBe('resync');
  const command=async(name:string)=>{
   const state=await (await fetch(url+'/api/player')).json();
   const response=await fetch(url+'/api/player/commands',{method:'POST',headers:{'content-type':'application/json','x-pixoo-request':'1'},body:JSON.stringify({requestId:state.nextRequestId,command:name})});expect(response.status).toBe(200);
  };
  await command('pause');const paused=await first.next();expect(paused.data.player.state).toBe('paused');first.close();
  await command('stop');const resumed=await stream(url,paused.id);streams.push(resumed);expect((await resumed.next()).data.player.state).toBe('idle');resumed.close();
  const unknown=await stream(url,'00000000-0000-4000-8000-000000000001:1');streams.push(unknown);expect((await unknown.next()).event).toBe('resync');unknown.close();
  for(let i=0;i<35;i++)await command(i%2?'stop':'pause');
  const expired=await stream(url,initial.id);streams.push(expired);expect((await expired.next()).event).toBe('resync');
 }finally{for(const item of streams)item.close();await app.close();await rm(dataDir,{recursive:true,force:true});}
},15000);
it('bounds stream clients, releases disconnected clients and closes live streams on shutdown',async()=>{
 const dataDir=await mkdtemp(join(tmpdir(),'pixoo-events-')),app=createApp({dataDir});const streams:Awaited<ReturnType<typeof stream>>[]=[];
 try{
  const url=await app.listen({host:'127.0.0.1',port:0});
  for(let i=0;i<16;i++){const item=await stream(url);streams.push(item);await item.next();}
  const excess=await fetch(url+'/api/events');expect(excess.status).toBe(503);await excess.arrayBuffer();
  for(const item of streams.splice(0))item.close();
  for(let i=0;i<35;i++){const item=await stream(url);await item.next();item.close();}
  const last=await stream(url);streams.push(last);await last.next();
  await app.close();await expect(last.next()).rejects.toThrow('Stream ended');
 }finally{for(const item of streams)item.close();await app.close();await rm(dataDir,{recursive:true,force:true});}
},20000);
