import {expect,it,vi} from 'vitest';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {validate,type FeedEvent,type Snapshot} from '@jimmie-potts/device-contracts';
import {createApp} from '../../apps/server/src/app.js';
import {provisionCredential} from '../../apps/server/src/mcp-config.js';
import type {ServerResponse} from 'node:http';
async function stream(base:string,token:string,last?:string){
 const abort=new AbortController();
 const response=await fetch(base+'/controller/v1/events',{headers:{authorization:`Bearer ${token}`,...(last?{'last-event-id':last}:{})},signal:abort.signal});
 if(response.status!==200){abort.abort();throw new Error(`Stream status ${response.status}`);}
 const reader=response.body!.getReader();let pending='';
 return {close:()=>abort.abort(),async next():Promise<{id:string;event:FeedEvent}>{
  for(;;){const end=pending.indexOf('\n\n');if(end>=0){const block=pending.slice(0,end);pending=pending.slice(end+2);if(block.startsWith(':'))continue;const lines=block.split('\n'),event=JSON.parse(lines.find(line=>line.startsWith('data: '))!.slice(6));expect(validate('feed',event)).toBe(true);return {id:lines.find(line=>line.startsWith('id: '))!.slice(4),event};}
   const chunk=await reader.read();if(chunk.done)throw new Error('Stream ended');pending+=new TextDecoder().decode(chunk.value);
  }
 }};
}
it('replays only later snapshots, resyncs invalid cursors, bounds streams and closes them on shutdown',async()=>{
 const dataDir=await mkdtemp(join(tmpdir(),'pixoo-hub-feed-')),token=await provisionCredential(dataDir,'hub',['read','control']);
 const app=createApp({dataDir,controllerEnabled:true}),clients:Awaited<ReturnType<typeof stream>>[]=[];
 try{
  const base=await app.listen({host:'127.0.0.1',port:0}),headers={authorization:`Bearer ${token}`,host:new URL(base).host};
  const first=await stream(base,token);clients.push(first);const initial=await first.next();expect(initial.event.kind).toBe('resync');
  const send=async(percent:number)=>{
   const s=(await app.inject({url:'/controller/v1/snapshot',headers})).json() as Snapshot;
   const response=await app.inject({method:'POST',url:'/controller/v1/commands',headers,payload:{apiVersion:'1.0',controllerId:s.identity.controllerId,deviceId:s.identity.deviceId,requestId:s.nextRequestId,expectedConfigurationRevision:s.configurationRevision,expectedGeneration:s.generation,command:{kind:'brightness.set',percent}}});expect(response.statusCode).toBe(200);
  };
  await send(12);let changed=await first.next();while(changed.event.snapshot.state.lastOutcome.status!=='known')changed=await first.next();
  first.close();await send(13);
  const replay=await stream(base,token,changed.id);clients.push(replay);const next=await replay.next();expect(next.event.kind).toBe('change');expect(next.event.cursor.sequence).toBeGreaterThan(changed.event.cursor.sequence);replay.close();
  for(const cursor of ['bad',`${changed.event.cursor.epoch}:9007199254740991`,'old:1']){const invalid=await stream(base,token,cursor);clients.push(invalid);expect((await invalid.next()).event.kind).toBe('resync');invalid.close();}
  for(let i=0;i<20;i++)await send(i);
  const expired=await stream(base,token,initial.id);clients.push(expired);expect((await expired.next()).event.kind).toBe('resync');expired.close();
  await new Promise(resolve=>setTimeout(resolve,30));clients.length=0;
  for(let i=0;i<16;i++){const item=await stream(base,token);clients.push(item);await item.next();}
  const over=await fetch(base+'/controller/v1/events',{headers});expect(over.status).toBe(429);await over.arrayBuffer();
  await app.close();await expect(clients[0]!.next()).rejects.toThrow();
 }finally{for(const client of clients)client.close();await app.close();await rm(dataDir,{recursive:true,force:true});}
},15000);
it('disconnects a stalled native stream without delaying command completion',async()=>{
 const dataDir=await mkdtemp(join(tmpdir(),'pixoo-hub-slow-')),token=await provisionCredential(dataDir,'hub',['read','control']);
 const app=createApp({dataDir,controllerEnabled:true});let raw:ServerResponse|undefined;
 app.addHook('onRequest',async(request,reply)=>{if(request.url==='/controller/v1/events')raw=reply.raw;});
 let client:Awaited<ReturnType<typeof stream>>|undefined;
 try{
  const base=await app.listen({host:'127.0.0.1',port:0}),headers={authorization:`Bearer ${token}`,host:new URL(base).host};client=await stream(base,token);await client.next();
  const write=vi.spyOn(raw!,'write').mockReturnValue(false);
  const before=(await app.inject({url:'/controller/v1/snapshot',headers})).json() as Snapshot;
  const command=await app.inject({method:'POST',url:'/controller/v1/commands',headers,payload:{apiVersion:'1.0',controllerId:before.identity.controllerId,deviceId:before.identity.deviceId,requestId:before.nextRequestId,expectedConfigurationRevision:before.configurationRevision,expectedGeneration:before.generation,command:{kind:'brightness.set',percent:40}}});expect(command.statusCode).toBe(200);
  await vi.waitFor(()=>expect(raw!.destroyed).toBe(true),{timeout:2500});write.mockRestore();
  expect((await app.inject({url:'/api/health',headers})).statusCode).toBe(200);
 }finally{client?.close();await app.close();await rm(dataDir,{recursive:true,force:true});}
},10000);
