import {expect,it} from 'vitest';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../../apps/server/src/app.js';
import {provisionCredential} from '../../apps/server/src/mcp-config.js';
it('shares the stream capacity budget, preserves admission and resyncs expired monitor cursors',async()=>{
 const dataDir=await mkdtemp(join(tmpdir(),'monitor-events-')),directory=join(dataDir,'agent-monitor');await mkdir(directory);
 await writeFile(join(directory,'config.json'),JSON.stringify({version:1,mode:'embedded',ownerId:'owner',consumers:[{id:'pixoo',clearOnNewTurn:true},{id:'nanoleaf',clearOnNewTurn:false}]}));
 const token=await provisionCredential(directory,'reader',['control']);const app=createApp({dataDir,monitorEnabled:true}),connections:AbortController[]=[];
 try{
  const address=await app.listen({host:'127.0.0.1',port:0}),headers={authorization:`Bearer ${token}`};
  const connect=async(path:string,last?:string)=>{
   const controller=new AbortController();connections.push(controller);
   const response=await fetch(address+path,{signal:controller.signal,headers:{...headers,...(last?{'last-event-id':last}:{})}});
   expect(response.status).toBe(200);const reader=response.body!.getReader();return {reader,first:new TextDecoder().decode((await reader.read()).value),close:()=>controller.abort()};
  };
  const first=await connect('/api/monitor/v1/changes');expect(first.first).toContain('event: resync');
  const healthy=await connect('/api/monitor/v1/changes');
  for(let i=0;i<14;i++)await connect('/api/events');
  expect((await fetch(address+'/api/monitor/v1/changes',{headers})).status).toBe(503);
  const response=await fetch(address+'/api/monitor/v1/events',{method:'POST',headers:{...headers,'x-pixoo-request':'1','content-type':'application/json'},body:JSON.stringify({apiVersion:'1.0',identity:{provider:'codex',client:'cli',hostId:'host',sourceId:'source',sessionId:'session'},turn:{status:'unknown'},parent:{status:'unknown'},event:{kind:'session.started'},ordering:{status:'unknown'},observedAtMs:1000})});
  expect(response.status).toBe(200);expect(new TextDecoder().decode((await healthy.reader.read()).value)).toContain('"revision":1');
  first.close();await new Promise(resolve=>setTimeout(resolve,30));
  const reconnect=await connect('/api/monitor/v1/changes','expired:1');expect(reconnect.first).toContain('event: resync');expect(reconnect.first).toContain('"revision":1');
 }finally{for(const controller of connections)controller.abort();await app.close();await rm(dataDir,{recursive:true,force:true});}
});
it('notifies core capacity loss even when the durable revision does not change',async()=>{
 const dataDir=await mkdtemp(join(tmpdir(),'monitor-loss-')),directory=join(dataDir,'agent-monitor');await mkdir(directory);
 await writeFile(join(directory,'config.json'),JSON.stringify({version:1,mode:'embedded',ownerId:'owner',consumers:[{id:'pixoo',clearOnNewTurn:true}]}));
 const token=await provisionCredential(directory,'reader',['control']),app=createApp({dataDir,monitorEnabled:true}),controller=new AbortController();
 try{
  const address=await app.listen({host:'127.0.0.1',port:0}),headers={authorization:`Bearer ${token}`,'content-type':'application/json','x-pixoo-request':'1'};
  const event=(sessionId:string)=>({apiVersion:'1.0',identity:{provider:'codex',client:'cli',hostId:'host',sourceId:'source',sessionId},turn:{status:'unknown'},parent:{status:'unknown'},event:{kind:'session.started'},ordering:{status:'unknown'},observedAtMs:1000});
  for(let i=0;i<128;i++)expect((await(await fetch(address+'/api/monitor/v1/events',{method:'POST',headers,body:JSON.stringify(event('session-'+i))})).json()).ok).toBe(true);
  const response=await fetch(address+'/api/monitor/v1/changes',{headers,signal:controller.signal});const reader=response.body!.getReader();await reader.read();
  expect(await(await fetch(address+'/api/monitor/v1/events',{method:'POST',headers,body:JSON.stringify(event('excess'))})).json()).toMatchObject({ok:false,code:'capacity'});
  const result=await Promise.race([reader.read(),new Promise<never>((_,reject)=>setTimeout(()=>reject(new Error('missing-loss-notification')),2000).unref())]);
  const body=new TextDecoder().decode(result.value);expect(body).toContain('"revision":128');expect(body).toContain('"lossCount":1');
 }finally{controller.abort();await app.close();await rm(dataDir,{recursive:true,force:true});}
});
it('disconnects a backpressured monitor socket while admitting events and serving healthy consumers',async()=>{
 const {get}=await import('node:http');
 const dataDir=await mkdtemp(join(tmpdir(),'monitor-slow-')),directory=join(dataDir,'agent-monitor');await mkdir(directory);
 await writeFile(join(directory,'config.json'),JSON.stringify({version:1,mode:'embedded',ownerId:'owner',consumers:[{id:'pixoo',clearOnNewTurn:true}]}));
 const token=await provisionCredential(directory,'consumer',['control']),app=createApp({dataDir,monitorEnabled:true});
 let response:import('node:http').ServerResponse|undefined,incoming:import('node:http').IncomingMessage|undefined;
 app.addHook('onRequest',async(request,reply)=>{if(request.url==='/api/monitor/v1/changes')response=reply.raw;});
 try{
  const url=await app.listen({host:'127.0.0.1',port:0}),headers={authorization:`Bearer ${token}`};
  incoming=await new Promise((resolve,reject)=>{const request=get(url+'/api/monitor/v1/changes',{headers},res=>{res.on('error',()=>{});res.pause();resolve(res);});request.on('error',reject);});
  // Fill the actual socket buffer before monitor publication tests its drain result.
  response!.write(':'+ 'x'.repeat(32*1024*1024)+'\n\n');expect(response!.writableNeedDrain).toBe(true);
  const closed=new Promise<void>(resolve=>response!.once('close',resolve));
  for(let sequence=1;sequence<=2;sequence++){
   const event={apiVersion:'1.0',identity:{provider:'codex',client:'cli',hostId:'host',sourceId:'source',sessionId:'session'},turn:{status:'known',id:'turn'},parent:{status:'unknown'},event:{kind:'activity.observed'},ordering:{status:'known',epoch:'epoch',sequence},observedAtMs:1000};
   expect(await(await fetch(url+'/api/monitor/v1/events',{method:'POST',headers:{...headers,'content-type':'application/json','x-pixoo-request':'1'},body:JSON.stringify(event)})).json()).toMatchObject({ok:true});
  }
  await Promise.race([closed,new Promise<never>((_,reject)=>setTimeout(()=>reject(new Error('slow-client-not-closed')),6000).unref())]);
  expect(response!.destroyed).toBe(true);
  expect(await(await fetch(url+'/api/monitor/v1/sessions',{headers})).json()).toMatchObject({connection:'current',snapshot:{revision:2}});
 }finally{incoming?.destroy();await app.close();await rm(dataDir,{recursive:true,force:true});}
},10000);
