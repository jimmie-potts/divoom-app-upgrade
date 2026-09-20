import {ControllerState} from '../../apps/server/src/controller-state.js';
import {ControlService} from '../../apps/server/src/control-service.js';
import {Commands} from '../../apps/server/src/commands.js';
import {Player} from '@pixoo/playback';
import {FakeDeviceAdapter} from '../../packages/device/src/index.js';
import type {Library} from '@pixoo/library';
import {MemoryPlaybackStore} from '../helpers/playback-store.js';
import {ManualClock} from '../helpers/manual-clock.js';
import {expect,it,vi} from 'vitest';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type {Transport} from '@modelcontextprotocol/sdk/shared/transport.js';
import {validate,type Snapshot,type Command} from '@jimmie-potts/device-contracts';
import type {DeviceTransport} from '@pixoo/device';
import {DeviceRequestError} from '../../packages/device/dist/http-transport.js';
import {createApp} from '../../apps/server/dist/app.js';
import {provisionCredential,revokeCredential} from '../../apps/server/src/mcp-config.js';
import {multipart} from '../helpers/http-api.js';
import {gifFixture} from '../helpers/media-fixtures.js';
async function fixture(transportForTests?:DeviceTransport){
 const dataDir=await mkdtemp(join(tmpdir(),'pixoo-controller-compat-'));
 const token=await provisionCredential(dataDir,'hub',['read','control']);
 if(transportForTests)await writeFile(join(dataDir,'device.json'),JSON.stringify({version:1,configuration:{ip:'192.168.50.20',profile:'pixoo64-smoke-2026-09-06'}}));
 const app=createApp({dataDir,controllerEnabled:true,mcpEnabled:true,...(transportForTests?{mode:'device' as const,transportForTests,deviceLockDirectoryForTests:dataDir}:{})});
 const base=await app.listen({host:'127.0.0.1',port:0}),headers={authorization:`Bearer ${token}`,host:new URL(base).host};
 const snapshot=async():Promise<Snapshot>=>{const response=await app.inject({url:'/controller/v1/snapshot',headers});expect(response.statusCode,response.body).toBe(200);expect(validate('snapshot',response.json())).toBe(true);return response.json();};
 const request=(s:Snapshot,command:Command)=>({apiVersion:'1.0' as const,controllerId:s.identity.controllerId,deviceId:s.identity.deviceId,requestId:s.nextRequestId,expectedConfigurationRevision:s.configurationRevision,expectedGeneration:s.generation,command});
 const post=(body:unknown,extra:Record<string,string>={})=>app.inject({method:'POST',url:'/controller/v1/commands',headers:{...headers,...extra},payload:body as object});
 return {app,dataDir,base,headers,token,snapshot,request,post,async close(){await app.close();await rm(dataDir,{recursive:true,force:true});}};
}
it('enforces native scopes, target validation, browser origin rules and revocation before cached results',async()=>{
 const f=await fixture();try{
  const s=await f.snapshot(),body=f.request(s,{kind:'brightness.set',percent:12});
  const read=await provisionCredential(f.dataDir,'reader',['read']);
  expect((await f.post(body,{authorization:`Bearer ${read}`})).statusCode).toBe(403);
  for(const extra of [{origin:'http://foreign.invalid'},{'sec-fetch-site':'cross-site'},{host:'foreign.invalid'}])expect((await f.post(body,extra)).statusCode).toBe(403);
  for(const bad of [{...body,path:'/tmp/file'},{...body,ip:'192.168.1.3'},{...body,apiVersion:'2.0'},{...body,command:{kind:'raw',Command:'Draw/ResetHttpGifId'}}])expect((await f.post(bad)).statusCode).toBe(400);
  expect((await f.post({...body,deviceId:'another-device'})).statusCode).toBe(404);
  expect((await f.snapshot()).nextRequestId).toEqual(s.nextRequestId);
  const receipt=await f.post(body);expect(receipt.statusCode).toBe(200);
  expect((await f.app.inject({method:'PATCH',url:'/api/device/display',headers:f.headers,payload:{requestId:'ignored',brightness:30}})).statusCode).toBe(403);
  const replacement=await provisionCredential(f.dataDir,'replacement',['read','control']);
  await revokeCredential(f.dataDir,'hub');
  expect((await f.post(body)).statusCode).toBe(401);
  expect((await f.post(body,{authorization:`Bearer ${replacement}`})).json()).toEqual(receipt.json());
 }finally{await f.close();}
});
it('joins in-flight native retries and cancels obsolete queued writes through the same browser and MCP owner',async()=>{
 let release=()=>{};const gate=new Promise<void>(resolve=>{release=resolve;});const calls:string[]=[];
 const f=await fixture(async body=>{calls.push(String(body.Command));if(calls.length===1)await gate;return {error_code:0};});
 const client=new Client({name:'hub-compat',version:'1'});
 try{
  await client.connect(new StreamableHTTPClientTransport(new URL(f.base+'/mcp'),{requestInit:{headers:{authorization:`Bearer ${f.token}`}}}) as Transport);
  const body=f.request(await f.snapshot(),{kind:'brightness.set',percent:25});
  const first=f.post(body).then(r=>r),duplicate=f.post({...body,command:{percent:25,kind:'brightness.set'}}).then(r=>r);
  await vi.waitFor(()=>expect(calls.length).toBe(1));
  const waiting=await f.snapshot();expect(waiting.state.pending).toHaveLength(1);
  const queuedBody=f.request(waiting,{kind:'brightness.set',percent:26});const queued=f.post(queuedBody).then(r=>r);
  await vi.waitFor(async()=>expect((await f.snapshot()).state.pending).toHaveLength(2));
  const browser=(await f.app.inject({url:'/api/player',headers:f.headers})).json();
  expect(browser.nextRequestId).toBe(`${(await f.snapshot()).nextRequestId.epoch}:${(await f.snapshot()).nextRequestId.sequence}`);
  const stop=await f.app.inject({method:'POST',url:'/api/player/commands',headers:{...f.headers,'x-pixoo-request':'1'},payload:{requestId:browser.nextRequestId,command:'stop'}});expect(stop.statusCode).toBe(200);
  release();expect((await first).json()).toEqual((await duplicate).json());
  const cancelled=await queued;expect(cancelled.json()).toMatchObject({outcome:'cancelled',priorEffects:'none',failure:{code:'stale-generation'}});expect(calls).toHaveLength(1);
  const status=await client.callTool({name:'get_status',arguments:{}}) as unknown as {structuredContent:{data:{nextRequestId:string}}};
  const mcp=await client.callTool({name:'set_brightness',arguments:{percent:31,request_id:status.structuredContent.data.nextRequestId}});
  expect(mcp.isError).not.toBe(true);expect(calls).toHaveLength(2);
  expect((await f.snapshot()).state.desired.brightness).toEqual({status:'known',value:31});
 }finally{release();await client.close();await f.close();}
},20000);
it('retains possible prior effects and the preceding successful send through retries and healthy reads',async()=>{
 let fail=false,calls=0;
 const f=await fixture(async()=>{calls++;if(fail)throw new DeviceRequestError('timeout');return {error_code:0};});
 try{
  expect((await f.post(f.request(await f.snapshot(),{kind:'brightness.set',percent:10}))).statusCode).toBe(200);
  const good=(await f.snapshot()).state.lastSuccessfulSend;fail=true;
  const body=f.request(await f.snapshot(),{kind:'brightness.set',percent:20}),bad=await f.post(body);
  expect(bad.statusCode).toBe(503);expect(bad.json()).toMatchObject({outcome:'uncertain',priorEffects:'possible',failure:{code:'uncertain-result'}});
  expect((await f.post(body)).json()).toEqual(bad.json());expect(calls).toBe(2);
  const state=await f.snapshot();expect(state.serviceHealth).toBe('ready');expect(state.state.lastOutcome).toEqual({status:'known',receipt:bad.json()});expect(state.state.lastSuccessfulSend).toEqual(good);expect(state.state.observation).toEqual({status:'unknown'});
  expect((await f.app.inject({url:'/api/player',headers:f.headers})).json().player.intent).toBe('paused');
 }finally{await f.close();}
});
it('guards catalog revisions and maps saved media with screen-on remaining paused',async()=>{
 const f=await fixture();try{
  const initial=await f.snapshot(),browserHeaders={...f.headers,'x-pixoo-request':'1'};
  const upload=await f.app.inject({method:'POST',url:'/api/assets',...multipart(),headers:{...multipart().headers,...f.headers}});expect(upload.statusCode).toBe(201);
  const playlist=(await f.app.inject({method:'POST',url:'/api/playlists',headers:browserHeaders,payload:{name:'private-title'}})).json();
  const edited=(await f.app.inject({method:'PUT',url:`/api/playlists/${playlist.id}/items`,headers:browserHeaders,payload:{revision:1,items:[{renditionId:upload.json().rendition.id}]}})).json();
  const current=await f.snapshot();expect(current.configurationRevision).toBeGreaterThan(initial.configurationRevision);expect(current.capabilities.media).toMatchObject({supported:true,playlistIds:[playlist.id]});expect(JSON.stringify(current)).not.toContain('private-title');
  await f.app.inject({method:'PATCH',url:`/api/playlists/${playlist.id}`,headers:browserHeaders,payload:{revision:edited.revision,name:'private-renamed'}});
  const stale=await f.post(f.request(current,{kind:'media.start',playlistId:playlist.id}));expect(stale.statusCode).toBe(409);expect(stale.json().failure.code).toBe('revision-conflict');
  expect((await f.post(f.request(await f.snapshot(),{kind:'media.start',playlistId:playlist.id}))).json().outcome).toBe('queued');
  expect((await f.post(f.request(await f.snapshot(),{kind:'power.set',on:false}))).statusCode).toBe(200);
  expect((await f.post(f.request(await f.snapshot(),{kind:'power.set',on:true}))).statusCode).toBe(200);
  expect((await f.app.inject({url:'/api/player',headers:f.headers})).json().player.intent).toBe('paused');
  const unsupported=await f.post(f.request(await f.snapshot(),{kind:'mode.set',mode:'Monitor'}));expect(unsupported.statusCode).toBe(422);expect(unsupported.json().failure.code).toBe('unsupported-capability');
 }finally{await f.close();}
},15000);
it('rejects stale generations, future and expired request identities, and bounds receipt retention',async()=>{
 const f=await fixture();try{
  const first=await f.snapshot(),oldBody=f.request(first,{kind:'brightness.set',percent:1});expect((await f.post(oldBody)).statusCode).toBe(200);
  let s=await f.snapshot();
  const stale=await f.post({...f.request(s,{kind:'power.set',on:true}),expectedGeneration:{...s.generation,sequence:s.generation.sequence+1}});expect(stale.json().failure.code).toBe('stale-generation');
  s=await f.snapshot();
  expect((await f.post({...f.request(s,{kind:'power.set',on:true}),requestId:{...s.nextRequestId,sequence:s.nextRequestId.sequence+1}})).statusCode).toBe(409);
  expect((await f.post({...f.request(s,{kind:'power.set',on:true}),requestId:{epoch:'old-epoch',sequence:1}})).statusCode).toBe(410);
  for(let i=0;i<257;i++){s=await f.snapshot();expect((await f.post(f.request(s,{kind:'brightness.set',percent:i%101}))).statusCode).toBe(200);}
  expect((await f.post(oldBody)).statusCode).toBe(410);
 }finally{await f.close();}
},20000);

it('projects asynchronous media uncertainty without changing its original queued receipt',async()=>{
 const f=await fixture(async body=>{if(body.Command==='Draw/SendHttpGif')throw new DeviceRequestError('timeout');return {error_code:0,PicId:1};});
 try{
  const part=multipart(gifFixture(1,1,[{width:1,height:1,pixels:[1],delay:50}]));
  const upload=await f.app.inject({method:'POST',url:'/api/assets',...part,headers:{...part.headers,...f.headers}});expect(upload.statusCode,upload.body).toBe(201);
  const headers={...f.headers,'x-pixoo-request':'1'};
  const playlist=(await f.app.inject({method:'POST',url:'/api/playlists',headers,payload:{name:'Synthetic'}})).json();
  expect((await f.app.inject({method:'PUT',url:`/api/playlists/${playlist.id}/items`,headers,payload:{revision:1,items:[{renditionId:upload.json().rendition.id}]}})).statusCode).toBe(200);
  const body=f.request(await f.snapshot(),{kind:'media.start',playlistId:playlist.id}),receipt=await f.post(body);expect(receipt.json().outcome).toBe('queued');
  await vi.waitFor(async()=>expect((await f.snapshot()).state.lastOutcome).toMatchObject({status:'known',receipt:{requestId:body.requestId,outcome:'uncertain',priorEffects:'possible'}}));
  expect((await f.post(body)).json()).toEqual(receipt.json());
 }finally{await f.close();}
},15000);

it.each(['browser','MCP'])('attributes %s media output to its own request after an earlier native pause',async clientKind=>{
 const f=await fixture(),client=new Client({name:'media-evidence',version:'1'});try{
  await f.post(f.request(await f.snapshot(),{kind:'media.control',action:'pause'}));
  const part=multipart(),upload=await f.app.inject({method:'POST',url:'/api/assets',...part,headers:{...part.headers,...f.headers}});
  const headers={...f.headers,'x-pixoo-request':'1'};
  const playlist=(await f.app.inject({method:'POST',url:'/api/playlists',headers,payload:{name:'Synthetic'}})).json();
  const edited=(await f.app.inject({method:'PUT',url:`/api/playlists/${playlist.id}/items`,headers,payload:{revision:1,items:[{renditionId:upload.json().rendition.id}]}})).json();
  const id=(await f.snapshot()).nextRequestId;
  if(clientKind==='browser')expect((await f.app.inject({method:'POST',url:'/api/player/commands',headers,payload:{requestId:`${id.epoch}:${id.sequence}`,command:'start',playlistId:playlist.id,revision:edited.revision}})).statusCode).toBe(200);
  else{
   await client.connect(new StreamableHTTPClientTransport(new URL(f.base+'/mcp'),{requestInit:{headers:{authorization:`Bearer ${f.token}`}}}) as Transport);
   expect((await client.callTool({name:'play_playlist',arguments:{playlist_id:playlist.id,revision:edited.revision,request_id:`${id.epoch}:${id.sequence}`}})).isError).not.toBe(true);
  }
  await vi.waitFor(async()=>expect((await f.snapshot()).state.lastSuccessfulSend).toMatchObject({status:'known',requestId:id,operationIds:['media']}));
 }finally{await client.close();await f.close();}
},15000);

it('keeps media pending and preserves possible effects when a browser stop retires its generation',async()=>{
 let release=()=>{},sending=false;const gate=new Promise<void>(resolve=>{release=resolve;});
 const f=await fixture(async body=>{if(body.Command==='Draw/SendHttpGif'){sending=true;await gate;}return {error_code:0,PicId:1};});
 try{
  const part=multipart(gifFixture(1,1,[{width:1,height:1,pixels:[1],delay:50}]));
  const upload=await f.app.inject({method:'POST',url:'/api/assets',...part,headers:{...part.headers,...f.headers}});
  const headers={...f.headers,'x-pixoo-request':'1'};
  const playlist=(await f.app.inject({method:'POST',url:'/api/playlists',headers,payload:{name:'Synthetic'}})).json();
  await f.app.inject({method:'PUT',url:`/api/playlists/${playlist.id}/items`,headers,payload:{revision:1,items:[{renditionId:upload.json().rendition.id}]}});
  const body=f.request(await f.snapshot(),{kind:'media.start',playlistId:playlist.id}),queued=(await f.post(body)).json();
  await vi.waitFor(()=>expect(sending).toBe(true));
  expect((await f.snapshot()).state.pending).toContainEqual(expect.objectContaining({requestId:body.requestId}));
  const id=(await f.snapshot()).nextRequestId;
  await f.app.inject({method:'POST',url:'/api/player/commands',headers,payload:{requestId:`${id.epoch}:${id.sequence}`,command:'stop'}});
  release();
  await vi.waitFor(async()=>expect((await f.snapshot()).state.lastOutcome).toMatchObject({status:'known',receipt:{requestId:body.requestId,outcome:'uncertain',priorEffects:'possible'}}));
  expect((await f.snapshot()).state.pending).toHaveLength(0);
  expect((await f.post(body)).json()).toEqual(queued);
 }finally{release();await f.close();}
},15000);


it.each(['uploading','playing'])('keeps %s media within the shared 32-request admission limit',async phase=>{
 const clock=new ManualClock(),store=new MemoryPlaybackStore(),device=new FakeDeviceAdapter({clock,latencyMs:1000});
 const player=await Player.open({store,device,clock}),commands=new Commands();
 const library={queryPlaylists:async()=>({items:[{id:store.playlist.id,revision:1}]})} as unknown as Library;
 const service=new ControlService(player,commands,'simulator',library),state=new ControllerState(service,{controllerId:'pixoo-controller',deviceId:'pixoo-local',sourceId:'pixoo',controllerEpoch:commands.epoch});
 const request=(command:Command)=>{const s=state.snapshot();return {apiVersion:'1.0',controllerId:s.identity.controllerId,deviceId:s.identity.deviceId,requestId:s.nextRequestId,expectedConfigurationRevision:s.configurationRevision,expectedGeneration:s.generation,command};};
 const flush=async()=>{for(let i=0;i<40;i++)await Promise.resolve();},pending:Promise<unknown>[]=[];
 try{
  await state.refreshCatalog();await state.execute(request({kind:'media.start',playlistId:store.playlist.id}));await flush();
  if(phase==='playing'){for(let i=0;i<2;i++){clock.advance(1000);await flush();}clock.advance(0);await flush();expect(player.getState().state).toBe('playing');}
  for(let i=0;i<31;i++){pending.push(state.execute(request({kind:'brightness.set',percent:i})));await flush();}
  expect(state.snapshot().state.pending).toHaveLength(phase==='playing'?31:32);expect(validate('snapshot',state.snapshot())).toBe(true);
  const id=commands.nextRequestId;
  const overflow=state.execute(request({kind:'brightness.set',percent:32}));pending.push(overflow.catch(()=>{}));
  await expect(Promise.race([overflow,new Promise(resolve=>setTimeout(()=>resolve('still pending'),50))])).rejects.toMatchObject({code:'capacity'});
  expect(commands.nextRequestId).toBe(id);
 }finally{await player.close();await Promise.all(pending);state.close();}
});

it('retains the playback request when an external health probe triggers recovery',async()=>{
 const store=new MemoryPlaybackStore(),device=new FakeDeviceAdapter();
 const player=await Player.open({store,device,retryBaseMs:10}),commands=new Commands();
 const library={queryPlaylists:async()=>({items:[{id:store.playlist.id,revision:1}]})} as unknown as Library;
 const service=new ControlService(player,commands,'simulator',library),state=new ControllerState(service,{controllerId:'pixoo-controller',deviceId:'pixoo-local',sourceId:'pixoo',controllerEpoch:commands.epoch});
 try{
  await state.refreshCatalog();const initial=state.snapshot(),requestId=initial.nextRequestId;
  await state.execute({apiVersion:'1.0',controllerId:initial.identity.controllerId,deviceId:initial.identity.deviceId,requestId,expectedConfigurationRevision:initial.configurationRevision,expectedGeneration:initial.generation,command:{kind:'media.start',playlistId:store.playlist.id}});
  await vi.waitFor(()=>expect(player.getState().state).toBe('playing'));
  const first=state.snapshot().state.lastSuccessfulSend;expect(first.status).toBe('known');if(first.status!=='known')throw new Error('missing first send');
  device.setOnline(false);await player.probe();device.setOnline(true);
  await vi.waitFor(()=>{
   const latest=state.snapshot().state.lastSuccessfulSend;
   expect(latest).toMatchObject({status:'known',requestId});if(latest.status!=='known')throw new Error('missing recovered send');
   expect(latest.clock.sampledAtMs).toBeGreaterThan(first.clock.sampledAtMs);
  });
  expect(validate('snapshot',state.snapshot())).toBe(true);
 }finally{await player.close();state.close();}
});
