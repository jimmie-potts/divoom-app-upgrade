import {expect,it} from 'vitest';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../../apps/server/src/app.js';
import {multipart} from '../helpers/http-api.js';
const headers={'x-pixoo-request':'1'};
it('creates playlists and rejects a racing stale revision',async()=>{
 const dataDir=await mkdtemp(join(tmpdir(),'pixoo-api-'));
 const app=createApp({dataDir});try{
  const response=await app.inject({method:'POST',url:'/api/playlists',headers,payload:{name:'Test'}});
  expect(response.statusCode).toBe(201);const playlist=response.json();
  const responses=await Promise.all(['First','Second'].map(name=>app.inject({method:'PATCH',url:`/api/playlists/${playlist.id}`,headers,payload:{revision:1,name}})));
  expect(responses.map(r=>r.statusCode).sort()).toEqual([200,409]);
  expect(responses.find(r=>r.statusCode===409)!.json()).toMatchObject({error:{code:'revision-conflict',details:{actualRevision:2}}});
 }finally{await app.close();await rm(dataDir,{recursive:true,force:true});}
});

it('imports bounded media, serves effective previews and protects references',async()=>{
 const dataDir=await mkdtemp(join(tmpdir(),'pixoo-api-')),app=createApp({dataDir});try{
  const upload=await app.inject({method:'POST',url:'/api/assets',...multipart()});expect(upload.statusCode).toBe(201);
  const {asset,rendition}=upload.json();
  const listed=await app.inject('/api/assets?q=fixture&limit=1');expect(listed.json()).toMatchObject({total:1,items:[{id:asset.id}]});
  expect((await app.inject(`/api/renditions/${rendition.id}/frames/0.png`)).headers['content-type']).toContain('image/png');
  const p=(await app.inject({method:'POST',url:'/api/playlists',headers,payload:{name:'Refs'}})).json();
  const items=await app.inject({method:'PUT',url:`/api/playlists/${p.id}/items`,headers,payload:{revision:1,items:[{renditionId:rendition.id}]}});
  expect(items.statusCode).toBe(200);expect(items.json().items[0].playback).toEqual({mode:'duration',durationMs:30000});
  expect((await app.inject({method:'DELETE',url:`/api/assets/${asset.id}`,headers})).statusCode).toBe(409);
  expect((await app.inject({method:'POST',url:`/api/assets/${asset.id}/renditions`,headers,payload:{transform:{fit:'crop',scaling:'smooth',background:[1,2,3]}}})).json().status).toBe('complete');
  await app.inject({method:'DELETE',url:`/api/playlists/${p.id}`,headers,payload:{revision:2}});
  expect((await app.inject({method:'DELETE',url:`/api/assets/${asset.id}`,headers})).statusCode).toBe(204);
 }finally{await app.close();await rm(dataDir,{recursive:true,force:true});}
});
it('rejects extra multipart parts, invalid media and arbitrary paths without imports',async()=>{
 const dataDir=await mkdtemp(join(tmpdir(),'pixoo-api-')),app=createApp({dataDir});try{
  for(const input of [multipart(undefined,'fixture.gif',true),multipart(Buffer.from('invalid bytes')),multipart(Buffer.alloc(10*1024*1024+1))]){
   const response=await app.inject({method:'POST',url:'/api/assets',...input});expect(response.statusCode).toBeGreaterThanOrEqual(400);expect(response.json().error.code).toBeTypeOf('string');
   expect((await app.inject('/api/assets')).json().total).toBe(0);
  }
  for(const url of ['/api/renditions/..%2Fprivate/frames/0.png','/api/assets/%2e%2e%2fprivate','/api/files?path=/etc/passwd']){
   const response=await app.inject(url);expect(response.statusCode).toBeGreaterThanOrEqual(400);expect(response.body).not.toContain('root:');
  }
  expect((await app.inject({method:'POST',url:'/api/playlists',headers,payload:{name:'bad',rawCommand:{Command:'reset'}}})).statusCode).toBe(400);
 }finally{await app.close();await rm(dataDir,{recursive:true,force:true});}
});
it('deduplicates concurrent player commands and exposes captured session data',async()=>{
 const dataDir=await mkdtemp(join(tmpdir(),'pixoo-api-')),app=createApp({dataDir});try{
  const uploaded=(await app.inject({method:'POST',url:'/api/assets',...multipart()})).json();
  const playlist=(await app.inject({method:'POST',url:'/api/playlists',headers,payload:{name:'Play'}})).json();
  await app.inject({method:'PUT',url:`/api/playlists/${playlist.id}/items`,headers,payload:{revision:1,items:[{renditionId:uploaded.rendition.id}]}});
  const initial=await app.inject('/api/player');expect(initial.statusCode).toBe(200);
  const payload={requestId:initial.json().nextRequestId,command:'start',playlistId:playlist.id};
  const responses=await Promise.all([1,2].map(()=>app.inject({method:'POST',url:'/api/player/commands',headers,payload})));
  expect(responses.map(r=>r.statusCode)).toEqual([200,200]);expect(responses[0]!.json()).toEqual(responses[1]!.json());
  const active=(await app.inject('/api/player')).json();expect(active.session.playlist.revision).toBe(2);
  expect(active.player.sessionId).toBe(responses[0]!.json().player.sessionId);
  expect((await app.inject({method:'POST',url:'/api/player/commands',headers,payload:{requestId:payload.requestId,command:'stop'}})).statusCode).toBe(409);
 }finally{await app.close();await rm(dataDir,{recursive:true,force:true});}
});
it('saves explicit device settings without activating hardware and rejects arbitrary targets',async()=>{
 const dataDir=await mkdtemp(join(tmpdir(),'pixoo-api-'));let app=createApp({dataDir});try{
  const configuration={ip:'192.168.50.20',model:'Pixoo64',profile:'simulator-v1'};
  expect((await app.inject({method:'PUT',url:'/api/device',headers,payload:configuration})).statusCode).toBe(200);
  for(const payload of [{...configuration,ip:'8.8.8.8'},{...configuration,ip:'http://192.168.50.20/post'},{...configuration,url:'http://example.com'},{...configuration,port:8080},{...configuration,path:'/other'},{...configuration,ip:'localhost'}]){
   expect((await app.inject({method:'PUT',url:'/api/device',headers,payload})).statusCode).toBe(400);
  }
  const probe=await app.inject({method:'POST',url:'/api/device/probe',headers,payload:{}});expect(probe.json()).toMatchObject({mode:'simulator',connected:false,available:true});
  expect((await app.inject('/api/device')).json().availability).toBe('available');
  const id=(await app.inject('/api/player')).json().nextRequestId;
  const off=await app.inject({method:'PATCH',url:'/api/device/display',headers,payload:{requestId:id,screenOn:false}});expect(off.statusCode).toBe(200);expect(off.json().player.intent).toBe('paused');
  await app.close();app=createApp({dataDir});expect((await app.inject('/api/device')).json()).toMatchObject({configuration,mode:'simulator',connected:false});
  expect((await app.inject('/api/health')).json().device.connected).toBe(false);
 }finally{await app.close();await rm(dataDir,{recursive:true,force:true});}
});
it('rejects expired receipts and server epochs without replaying commands',async()=>{
 const dataDir=await mkdtemp(join(tmpdir(),'pixoo-api-'));let app=createApp({dataDir});try{
  const first=(await app.inject('/api/player')).json().nextRequestId;
  const failed=await app.inject({method:'POST',url:'/api/player/commands',headers,payload:{requestId:first,command:'resume'}});expect(failed.statusCode).toBe(409);
  expect((await app.inject({method:'POST',url:'/api/player/commands',headers,payload:{requestId:first,command:'resume'}})).body).toBe(failed.body);
  for(let i=0;i<257;i++){
   const id=(await app.inject('/api/player')).json().nextRequestId;
   expect((await app.inject({method:'POST',url:'/api/player/commands',headers,payload:{requestId:id,command:'stop'}})).statusCode).toBe(200);
  }
  expect((await app.inject({method:'POST',url:'/api/player/commands',headers,payload:{requestId:first,command:'resume'}})).statusCode).toBe(410);
  const old=(await app.inject('/api/player')).json().nextRequestId;
  await app.close();app=createApp({dataDir});
  expect((await app.inject({method:'POST',url:'/api/player/commands',headers,payload:{requestId:old,command:'stop'}})).statusCode).toBe(410);
 }finally{await app.close();await rm(dataDir,{recursive:true,force:true});}
});
it('restores the authoritative immutable session paused after API restart',async()=>{
 const dataDir=await mkdtemp(join(tmpdir(),'pixoo-api-'));let app=createApp({dataDir});try{
  const uploaded=(await app.inject({method:'POST',url:'/api/assets',...multipart()})).json();
  const playlist=(await app.inject({method:'POST',url:'/api/playlists',headers,payload:{name:'Restart'}})).json();
  await app.inject({method:'PUT',url:`/api/playlists/${playlist.id}/items`,headers,payload:{revision:1,items:[{renditionId:uploaded.rendition.id}]}});
  const requestId=(await app.inject('/api/player')).json().nextRequestId;
  const started=(await app.inject({method:'POST',url:'/api/player/commands',headers,payload:{requestId,command:'start',playlistId:playlist.id}})).json();
  await app.inject({method:'PATCH',url:`/api/playlists/${playlist.id}`,headers,payload:{revision:2,name:'Edited'}});
  await app.close();app=createApp({dataDir});
  const restored=(await app.inject('/api/player')).json();
  expect(restored.player).toMatchObject({state:'paused',intent:'paused',sessionId:started.player.sessionId,dwellDeadlineMs:null});
  expect(restored.session.playlist).toMatchObject({name:'Restart',revision:2});expect(restored.serverId).not.toBe(started.serverId);
  expect((await app.inject({method:'DELETE',url:`/api/assets/${uploaded.asset.id}`,headers})).statusCode).toBe(409);
 }finally{await app.close();await rm(dataDir,{recursive:true,force:true});}
});
it('authenticates streams and uploads before any request effects',async()=>{
 const dataDir=await mkdtemp(join(tmpdir(),'pixoo-api-')),app=createApp({dataDir,authenticate:r=>r.headers.authorization==='Bearer fixture'});try{
  expect((await app.inject('/api/events')).statusCode).toBe(401);
  expect((await app.inject({method:'POST',url:'/api/assets',...multipart()})).statusCode).toBe(401);
  expect((await app.inject({method:'POST',url:'/api/player/commands',headers,payload:{}})).statusCode).toBe(401);
  expect((await app.inject({url:'/api/assets',headers:{authorization:'Bearer fixture'}})).json().total).toBe(0);
 }finally{await app.close();await rm(dataDir,{recursive:true,force:true});}
});

it('samples the server monotonic clock alongside player deadlines',async()=>{
 const dataDir=await mkdtemp(join(tmpdir(),'pixoo-api-clock-')),app=createApp({dataDir});try{
  const before=performance.now();const state=(await app.inject('/api/player')).json();
  expect(state.sampledAtMs).toBeGreaterThanOrEqual(before);
  expect(state.sampledAtMs).toBeLessThanOrEqual(performance.now());
 }finally{await app.close();await rm(dataDir,{recursive:true,force:true});}
});
