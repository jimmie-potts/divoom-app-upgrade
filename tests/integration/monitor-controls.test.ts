import type {IntegrationSnapshot} from '@pixoo/core';
import {expect,it} from 'vitest';
import {mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../../apps/server/src/app.js';
import {provisionCredential,revokeCredential} from '../../apps/server/src/mcp-config.js';
const headers={'x-pixoo-request':'1'},prefix='/api/integration/v1';
async function setup(){
 const directory=await mkdtemp(join(tmpdir(),'monitor-controls-'));await mkdir(join(directory,'agent-monitor'));
 await writeFile(join(directory,'agent-monitor','config.json'),JSON.stringify({version:1,mode:'embedded',ownerId:'owner',consumers:[{id:'pixoo',clearOnNewTurn:true}]}));
 await provisionCredential(join(directory,'agent-monitor'),'writer',['read','control']);
 return directory;
}
const command=(snapshot:IntegrationSnapshot,action:unknown)=>({apiVersion:'pixoo-integration/1.0',requestId:snapshot.nextRequestId,expectedConfigurationRevision:snapshot.configurationRevision,expectedGeneration:snapshot.generation,action});
it('shares mode, filtered preview and guarded command identity across clients without startup writes',async()=>{
 const directory=await setup();let app=createApp({dataDir:directory,monitorEnabled:true});
 try{
  const initial=await app.inject(prefix+'/snapshot');expect(initial.statusCode).toBe(200);expect(initial.json()).toMatchObject({configuration:{mode:'media',cadenceMs:1000},participating:false});
  const payload=command(initial.json(),{operation:'mode',mode:'monitor'});
  const send=(body:Record<string,unknown>)=>app.inject({method:'POST',url:prefix+'/commands',headers,payload:body});
  const first=await send(payload);expect(first.statusCode).toBe(200);expect(first.json().participating).toBe(true);
  expect((await send(payload)).json()).toEqual(first.json());expect((await send({...payload,action:{operation:'mode',mode:'media'}})).statusCode).toBe(409);
  const latest=(await app.inject(prefix+'/snapshot')).json();expect((await send({...command(latest,{operation:'mode',mode:'media'}),expectedConfigurationRevision:0})).statusCode).toBe(409);
  await app.close();app=createApp({dataDir:directory,monitorEnabled:true});
  expect((await app.inject(prefix+'/snapshot')).json()).toMatchObject({configuration:{mode:'monitor'},participating:false});
  expect((await app.inject('/api/player')).json().player.intent).not.toBe('active');
 }finally{await app.close();await rm(directory,{recursive:true,force:true});}
});
it('protects the finite native extension and shares browser request receipts without widening v1',async()=>{
 const directory=await setup(),token=await provisionCredential(directory,'native',['read','control']),reader=await provisionCredential(directory,'reader',['read']);
 const app=createApp({dataDir:directory,monitorEnabled:true,controllerEnabled:true});const native='/controller/pixoo-integration/v1',auth={authorization:`Bearer ${token}`};
 try{
  expect((await app.inject(native+'/snapshot')).statusCode).toBe(401);
  const snapshot=(await app.inject({url:native+'/snapshot',headers:auth})).json();expect(snapshot.identity.deviceId).toBe('pixoo-local');
  const payload={...command(snapshot,{operation:'mode',mode:'monitor'}),controllerId:snapshot.identity.controllerId,deviceId:snapshot.identity.deviceId};
  expect((await app.inject({method:'POST',url:native+'/commands',headers:{authorization:`Bearer ${reader}`},payload})).statusCode).toBe(403);
  expect((await app.inject({method:'POST',url:native+'/commands',headers:{...auth,origin:'https://foreign.test'},payload})).statusCode).toBe(403);
  expect((await app.inject({method:'POST',url:native+'/commands',headers:auth,payload:{...payload,deviceId:'other'}})).statusCode).toBe(404);
  expect((await app.inject({method:'POST',url:native+'/commands',headers:auth,payload:{...payload,rawCommand:'reset'}})).statusCode).toBe(400);
  const result=await app.inject({method:'POST',url:native+'/commands',headers:auth,payload});expect(result.statusCode).toBe(200);
  const replay=await app.inject({method:'POST',url:prefix+'/commands',headers,payload:command(snapshot,{operation:'mode',mode:'monitor'})});expect(replay.json()).toEqual(result.json());
  const v1=(await app.inject({url:'/controller/v1/snapshot',headers:auth})).json();expect(v1.capabilities.modes.supported).toBe(false);
  expect(JSON.stringify(snapshot)).not.toMatch(/token|endpoint|192\.168|directory/);
 }finally{await app.close();await rm(directory,{recursive:true,force:true});}
});
it('routes explicit labels and notice dismissal through the shared owner and filters exact preview',async()=>{
 const directory=await setup(),token=await provisionCredential(join(directory,'agent-monitor'),'events',['control']);
 const app=createApp({dataDir:directory,monitorEnabled:true,monitorRenderCadenceMs:1});
 const identity={provider:'codex',client:'cli',hostId:'host',sourceId:'source',sessionId:'chosen'} as const;
 try{
  const ingest=await app.inject({method:'POST',url:'/api/monitor/v1/events',headers:{...headers,authorization:`Bearer ${token}`},payload:{apiVersion:'1.0',identity,projectId:'project-one',turn:{status:'known',id:'turn'},parent:{status:'top-level'},event:{kind:'turn.ended'},ordering:{status:'known',epoch:'epoch',sequence:1},observedAtMs:Date.now()}});
  expect(ingest.json().ok).toBe(true);
  let source=(await app.inject(prefix+'/sessions')).json();
  const label={operation:'label',identity,label:'My project',requestId:source.nextRequestId};
  expect((await app.inject({method:'POST',url:prefix+'/shared-actions',headers,payload:label})).json().ok).toBe(true);
  expect((await app.inject({method:'POST',url:prefix+'/shared-actions',headers,payload:label})).json().ok).toBe(true);
  source=(await app.inject(prefix+'/sessions')).json();const notice=source.snapshot.sessions[0].notices[0];
  expect((await app.inject({method:'POST',url:prefix+'/shared-actions',headers,payload:{operation:'acknowledge',identity,noticeId:notice.id,requestId:source.nextRequestId}})).json().ok).toBe(true);
  source=(await app.inject(prefix+'/sessions')).json();expect(source.snapshot.sessions[0].read).toBe('unknown');expect(source.snapshot.sessions[0].label).toBe('My project');
  const snapshot=(await app.inject(prefix+'/snapshot')).json();
  expect((await app.inject({method:'POST',url:prefix+'/commands',headers,payload:command(snapshot,{operation:'view',filter:{projectId:'different'},cadenceMs:1000})})).statusCode).toBe(200);
  await new Promise(resolve=>setTimeout(resolve,5));
  const rendition=(await app.inject(prefix+'/rendition')).json();expect(rendition.rendition.layout.matched).toBe(0);expect(rendition.rendition.layout.total).toBe(1);
  expect((await app.inject({method:'POST',url:prefix+'/shared-actions',headers,payload:{...label,operation:'quiesce'}})).statusCode).toBe(400);
 }finally{await app.close();await rm(directory,{recursive:true,force:true});}
});
it('resyncs native integration events and closes an idle stream when its credential is revoked',async()=>{
 const directory=await setup(),token=await provisionCredential(directory,'native',['read']);
 const app=createApp({dataDir:directory,monitorEnabled:true,controllerEnabled:true});const abort=new AbortController();
 try{
  const address=await app.listen({host:'127.0.0.1',port:0});
  const response=await fetch(address+'/controller/pixoo-integration/v1/events',{headers:{authorization:`Bearer ${token}`,'last-event-id':'retired:99'},signal:abort.signal});expect(response.status).toBe(200);
  const reader=response.body!.getReader();const first=new TextDecoder().decode((await reader.read()).value);
  expect(first).toContain('event: resync');expect(first).toContain('"apiVersion":"pixoo-integration/1.0"');expect(first).not.toContain(token);
  await revokeCredential(directory,'native');
  await expect(Promise.race([reader.read().then(result=>{if(result.done)throw new Error('revoked');return result;}),new Promise((_,reject)=>setTimeout(()=>reject(new Error('timeout')),3000).unref())])).rejects.not.toThrow('timeout');
  expect((await fetch(address+'/controller/pixoo-integration/v1/snapshot',{headers:{authorization:`Bearer ${token}`}})).status).toBe(401);
 }finally{abort.abort();await app.close();await rm(directory,{recursive:true,force:true});}
},10000);
it('rejects competing clients at execution time and preserves the winning view',async()=>{
 const directory=await setup(),app=createApp({dataDir:directory,monitorEnabled:true});
 try{
  const initial=(await app.inject(prefix+'/snapshot')).json() as IntegrationSnapshot;
  const first=command(initial,{operation:'view',filter:{projectId:'first'},cadenceMs:1000});
  const second={...command(initial,{operation:'view',filter:{projectId:'second'},cadenceMs:1000}),requestId:initial.nextRequestId.replace(/:\d+$/,':2')};
  const results=await Promise.all([first,second].map(payload=>app.inject({method:'POST',url:prefix+'/commands',headers,payload})));
  expect(results.map(result=>result.statusCode)).toEqual([200,409]);
  expect((await app.inject(prefix+'/snapshot')).json().configuration.filter).toEqual({projectId:'first'});
 }finally{await app.close();await rm(directory,{recursive:true,force:true});}
});
