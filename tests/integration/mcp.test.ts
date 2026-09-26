import {expect,it,vi} from 'vitest';
import {mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {InjectOptions} from 'fastify';
import type {Transport} from '@modelcontextprotocol/sdk/shared/transport.js';
import {request as httpRequest} from 'node:http';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {createApp} from '../../apps/server/dist/app.js';
import {multipart} from '../helpers/http-api.js';
import {gifFixture} from '../helpers/media-fixtures.js';
import {Library} from '@pixoo/library';
import type {DeviceTransport} from '@pixoo/device';
import {provisionCredential,revokeCredential} from '../../apps/server/src/mcp-config.js';
async function fixture(transportForTests?:DeviceTransport,prepare?:(dataDir:string)=>Promise<void>,monitor=false){
 const dataDir=await mkdtemp(join(tmpdir(),'pixoo-mcp-'));
 if(prepare)await prepare(dataDir);
 const token=await provisionCredential(dataDir,'codex',['read','control']);
 if(transportForTests)await writeFile(join(dataDir,'device.json'),JSON.stringify({version:1,configuration:{ip:'192.168.50.20',profile:'pixoo64-smoke-2026-09-06'}}));
 if(monitor){await mkdir(join(dataDir,'agent-monitor'));await writeFile(join(dataDir,'agent-monitor','config.json'),JSON.stringify({version:1,mode:'embedded',ownerId:'owner',consumers:[{id:'pixoo',clearOnNewTurn:true}]}));await provisionCredential(join(dataDir,'agent-monitor'),'writer',['read','control']);}
 const app=createApp({dataDir,mcpEnabled:true,...(monitor?{monitorEnabled:true,monitorRenderCadenceMs:1}:{}),...(transportForTests?{mode:'device' as const,transportForTests,deviceLockDirectoryForTests:dataDir}:{})});
 await app.listen({host:'127.0.0.1',port:0});
 const address=app.server.address();if(!address||typeof address==='string')throw new Error('No listener');
 const base=`http://127.0.0.1:${address.port}`;
 const transport=new StreamableHTTPClientTransport(new URL(`${base}/mcp`),{requestInit:{headers:{authorization:`Bearer ${token}`}}});
 const client=new Client({name:'pixoo-test',version:'1.0.0'});
 // SDK 1.30.0 declares sessionId as string | undefined rather than an exact optional.
 await client.connect(transport as Transport);
 return {app,client,base,token,dataDir,inject(options:InjectOptions|string){const input=typeof options==='string'?{url:options}:options;return app.inject({...input,headers:{...input.headers,host:new URL(base).host}});},async close(){await client.close();await app.close();await rm(dataDir,{recursive:true,force:true});}};
}
function data(result:unknown){return (result as {structuredContent:{data:Record<string,unknown>}}).structuredContent.data;}
it('serves fixed tools from the built application and preserves cross-transport display replay',async()=>{
 const f=await fixture();try{
  expect((await f.client.listTools()).tools.map(t=>t.name).sort()).toEqual(['control_playback','get_status','list_media','list_playlists','play_playlist','set_brightness','set_screen','show_media']);
  const status=data(await f.client.callTool({name:'get_status',arguments:{}}));
  expect(status).toMatchObject({ready:true,mode:'simulator',connected:false});
  const request_id=status.nextRequestId;
  for(const args of [{percent:101,request_id},{percent:2.5,request_id},{percent:42,request_id,path:'/private/file'},{percent:42,request_id,url:'http://192.168.1.1'}])expect((await f.client.callTool({name:'set_brightness',arguments:args})).isError).toBe(true);
  expect((await f.client.callTool({name:'set_screen',arguments:{on:'true',request_id}})).isError).toBe(true);
  const outcome=data(await f.client.callTool({name:'set_brightness',arguments:{percent:42,request_id}}));
  expect(outcome).toMatchObject({ok:true,requestId:request_id,priorEffects:'none',timing:{completedAtMs:expect.any(Number)}});
  const replay=await fetch(`${f.base}/api/device/display`,{method:'PATCH',headers:{'x-pixoo-request':'1','content-type':'application/json'},body:JSON.stringify({requestId:request_id,brightness:42})});
  expect(replay.status).toBe(200);expect(await replay.json()).toMatchObject(outcome.snapshot as object);
  const conflict=await fetch(`${f.base}/api/device/display`,{method:'PATCH',headers:{'x-pixoo-request':'1','content-type':'application/json'},body:JSON.stringify({requestId:request_id,brightness:43})});expect(conflict.status).toBe(409);
  for(let n=0;n<40;n++)expect(data(await f.client.callTool({name:'get_status',arguments:{}})).connected).toBe(false);
  await f.client.close();expect((await fetch(`${f.base}/api/health`)).status).toBe(200);
 }finally{await f.close();}
},20000);
it('keeps status valid and honest after an explicitly activated dashboard upload',async()=>{
 const f=await fixture(undefined,undefined,true);try{
  const prefix='/api/integration/v1',headers={'x-pixoo-request':'1'};
  const snapshot=(await f.inject(prefix+'/snapshot')).json();
  const activated=await f.inject({method:'POST',url:prefix+'/commands',headers,payload:{apiVersion:'pixoo-integration/1.0',requestId:snapshot.nextRequestId,expectedConfigurationRevision:snapshot.configurationRevision,expectedGeneration:snapshot.generation,action:{operation:'mode',mode:'monitor'}}});
  expect(activated.statusCode,activated.body).toBe(200);
  await vi.waitFor(async()=>expect((await f.inject(prefix+'/snapshot')).json().lastOutcome).toMatchObject({status:'sent'}),{timeout:5000});
  // Listing tools makes the SDK client validate each result against the advertised output schema.
  expect((await f.client.listTools()).tools.find(tool=>tool.name==='get_status')?.outputSchema).toBeDefined();
  const reads=[];for(let n=0;n<3;n++)reads.push(await f.client.callTool({name:'get_status',arguments:{}}));
  for(const read of reads)expect(read.isError,JSON.stringify(read.content)).toBeFalsy();
  const [first,...rest]=reads.map(data);
  expect(first).toMatchObject({mode:'simulator',connected:false,display:{requestedScreenOn:true,brightness:{acknowledged:null,observed:null},screen:{acknowledged:null,observed:null},transport:{source:'upload',ok:true,priorEffects:'none'}}});
  for(const later of rest){expect(later.display).toEqual(first!.display);expect(later.player).toEqual(first!.player);}
  expect(JSON.stringify(reads)).not.toMatch(/dashboard|192\.168|agent-monitor/);
 }finally{await f.close();}
},20000);
it('revokes existing sessions and keeps native access separate from browser API authorization',async()=>{
 const f=await fixture();try{
  expect((await fetch(`${f.base}/api/device/display`,{method:'PATCH',headers:{authorization:`Bearer ${f.token}`,'content-type':'application/json'},body:'{}'})).status).toBe(403);
  for(const headers of [{authorization:'Bearer invalid'},{authorization:`Bearer ${f.token}`,origin:'http://foreign.invalid'},{authorization:`Bearer ${f.token}`,'sec-fetch-site':'cross-site'}]){
   const response=await fetch(`${f.base}/mcp`,{method:'POST',headers:{...headers,'content-type':'application/json'},body:'{}'});expect([401,403]).toContain(response.status);
  }
  const foreignHost=await new Promise<number|undefined>((resolve,reject)=>{const request=httpRequest(`${f.base}/mcp`,{method:'POST',headers:{host:'foreign.invalid',authorization:`Bearer ${f.token}`,'content-type':'application/json'}},response=>{response.resume();response.on('end',()=>resolve(response.statusCode));});request.on('error',reject);request.end('{}');});expect(foreignHost).toBe(403);
  await revokeCredential(f.dataDir,'codex');await expect(f.client.callTool({name:'get_status',arguments:{}})).rejects.toThrow();
 }finally{await f.close();}
},20000);

async function startPrivatePlaylist(f:Awaited<ReturnType<typeof fixture>>,physical=false){
 const bytes=gifFixture(1,1,[{width:1,height:1,pixels:[1],delay:50},{width:1,height:1,pixels:[2],delay:50}]);
 const uploaded=await f.inject({method:'POST',url:'/api/assets',...multipart(physical?bytes:undefined,'private-photo.gif')});
 expect(uploaded.statusCode,uploaded.body).toBe(201);const asset=uploaded.json();
 const headers={'x-pixoo-request':'1'};
 const playlist=(await f.inject({method:'POST',url:'/api/playlists',headers,payload:{name:'private-vacation'}})).json();
 await f.inject({method:'PUT',url:`/api/playlists/${playlist.id}/items`,headers,payload:{revision:1,items:[{renditionId:asset.rendition.id}]}});
 const requestId=(await f.inject('/api/player')).json().nextRequestId;
 expect((await f.inject({method:'POST',url:'/api/player/commands',headers,payload:{requestId,command:'start',playlistId:playlist.id}})).statusCode).toBe(200);
}
it('keeps private playlist data out of tools and preserves off/on semantics with HTTP-first replay',async()=>{
 const f=await fixture();try{
  await startPrivatePlaylist(f);
  const state=data(await f.client.callTool({name:'get_status',arguments:{}}));
  const requestId=state.nextRequestId;
  const http=await f.inject({method:'PATCH',url:'/api/device/display',headers:{'x-pixoo-request':'1'},payload:{requestId,screenOn:false}});
  expect(http.statusCode).toBe(200);expect(http.body).toContain('private-vacation');
  const off=await f.client.callTool({name:'set_screen',arguments:{request_id:requestId,on:false}});
  expect(data(off)).toMatchObject({ok:true,snapshot:{player:{intent:'paused',requestedScreenOn:false}}});
  expect(JSON.stringify(off)).not.toContain('private-');expect(JSON.stringify(state)).not.toContain('private-');
  const next=data(await f.client.callTool({name:'get_status',arguments:{}})).nextRequestId;
  expect(data(await f.client.callTool({name:'set_screen',arguments:{request_id:next,on:true}}))).toMatchObject({ok:true,snapshot:{player:{intent:'paused',requestedScreenOn:true}}});
 }finally{await f.close();}
},20000);
it('keeps the upload transaction intact when an MCP control is queued',async()=>{
 const commands:string[]=[];let release=()=>{};
 const gate=new Promise<void>(resolve=>{release=resolve;});
 const f=await fixture(async body=>{commands.push(String(body.Command));if(body.Command==='Draw/SendHttpGif'&&body.PicOffset===0)await gate;return {error_code:0,PicId:1};});
 try{
  await startPrivatePlaylist(f,true);await vi.waitFor(()=>expect(commands).toContain('Draw/SendHttpGif'));
  const request_id=data(await f.client.callTool({name:'get_status',arguments:{}})).nextRequestId;
  const control=f.client.callTool({name:'set_brightness',arguments:{percent:33,request_id}});
  await vi.waitFor(async()=>expect(data(await f.client.callTool({name:'get_status',arguments:{}})).nextRequestId).not.toBe(request_id));
  expect(commands).toEqual(['Draw/GetHttpGifId','Draw/SendHttpGif']);release();
  expect(data(await control).ok).toBe(true);expect(commands.slice(0,4)).toEqual(['Draw/GetHttpGifId','Draw/SendHttpGif','Draw/SendHttpGif','Channel/SetBrightness']);
 }finally{release();await f.close();}
},20000);

it('initializes native MCP with canonical default-port authorities',async()=>{
 const dataDir=await mkdtemp(join(tmpdir(),'pixoo-mcp-default-port-'));
 const token=await provisionCredential(dataDir,'codex',['read']);
 const app=createApp({dataDir,mcpEnabled:true});
 try{
  for(const host of ['localhost','127.0.0.1']){
   const response=await app.inject({method:'POST',url:'/mcp',headers:{host,authorization:`Bearer ${token}`,accept:'application/json, text/event-stream','content-type':'application/json'},payload:{jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'default-port-test',version:'1.0.0'}}}});
   expect(response.statusCode,response.body).toBe(200);
  }
  const denied=await app.inject({method:'POST',url:'/mcp',headers:{host:'localhost:81',authorization:`Bearer ${token}`},payload:{}});expect(denied.statusCode).toBe(403);
 }finally{await app.close();await rm(dataDir,{recursive:true,force:true});}
});
it('selects bounded media and playlists with shared immutable player receipts',async()=>{
 const f=await fixture();try{
  await startPrivatePlaylist(f);
  const media=data(await f.client.callTool({name:'list_media',arguments:{q:'private',limit:1}}));
  expect(media).toMatchObject({total:1,limit:1,offset:0});
  const row=(media.items as Record<string,unknown>[])[0]!;
  expect(Object.keys(row).sort()).toEqual(['asset_id','compatible','duration_ms','format','frame_count','name','rendition_id']);
  const playlists=data(await f.client.callTool({name:'list_playlists',arguments:{limit:1}}));
  const playlist=(playlists.items as Record<string,unknown>[])[0]!;
  let request_id=data(await f.client.callTool({name:'get_status',arguments:{}})).nextRequestId;
  for(const args of [{rendition_id:row.rendition_id,request_id,path:'private'},{rendition_id:row.rendition_id,request_id,policy:{mode:'duration',durationMs:0}}])expect((await f.client.callTool({name:'show_media',arguments:args})).isError).toBe(true);
  expect(data(await f.client.callTool({name:'get_status',arguments:{}})).nextRequestId).toBe(request_id);
  const shown=data(await f.client.callTool({name:'show_media',arguments:{rendition_id:row.rendition_id,request_id}}));
  expect(shown).toMatchObject({ok:true,timing:null,context:{source:{kind:'media',assetId:row.asset_id,renditionId:row.rendition_id}},snapshot:{player:{playlistId:null,playlistRevision:null}}});
  expect(JSON.stringify(shown)).not.toContain('private-photo');
  const replay=await f.inject({method:'POST',url:'/api/player/commands',headers:{'x-pixoo-request':'1'},payload:{requestId:request_id,command:'show-media',renditionId:row.rendition_id}});
  expect(replay.statusCode).toBe(200);expect(replay.json()).toMatchObject(shown.snapshot as object);
  request_id=data(await f.client.callTool({name:'get_status',arguments:{}})).nextRequestId;
  const paused=await f.inject({method:'POST',url:'/api/player/commands',headers:{'x-pixoo-request':'1'},payload:{requestId:request_id,command:'pause'}});
  const pause=data(await f.client.callTool({name:'control_playback',arguments:{action:'pause',request_id}}));
  expect(pause).toMatchObject({ok:true,snapshot:{player:{intent:'paused'}}});expect(paused.json()).toMatchObject(pause.snapshot as object);
  request_id=data(await f.client.callTool({name:'get_status',arguments:{}})).nextRequestId;
  const stale=data(await f.client.callTool({name:'play_playlist',arguments:{playlist_id:playlist.id,revision:(playlist.revision as number)+1,request_id}}));
  expect(stale).toMatchObject({ok:false,code:'revision-conflict',details:{expected:(playlist.revision as number)+1,actual:playlist.revision}});
  expect(data(await f.client.callTool({name:'play_playlist',arguments:{playlist_id:playlist.id,revision:(playlist.revision as number)+1,request_id}}))).toEqual(stale);
  const status=data(await f.client.callTool({name:'get_status',arguments:{}}));expect(JSON.stringify(status)).not.toContain('private-photo');
  const started=data(await f.client.callTool({name:'play_playlist',arguments:{playlist_id:playlist.id,revision:playlist.revision,request_id:status.nextRequestId}}));
  expect(started).toMatchObject({ok:true,context:{source:{kind:'playlist'}},snapshot:{player:{playlistId:playlist.id,playlistRevision:playlist.revision}}});
 }finally{await f.close();}
},20000);

it('keeps admitted media loading and playback alive after MCP disconnect',async()=>{
 const writes:string[]=[];let release=()=>{};
 const gate=new Promise<void>(resolve=>{release=resolve;});
 const f=await fixture(async body=>{writes.push(String(body.Command));if(body.Command==='Draw/SendHttpGif'&&body.PicOffset===0)await gate;return {error_code:0,PicId:1};});
 try{
  const bytes=gifFixture(1,1,[{width:1,height:1,pixels:[1],delay:50},{width:1,height:1,pixels:[2],delay:50}]);
  const upload=await f.inject({method:'POST',url:'/api/assets',...multipart(bytes,'disconnect-animation.gif')});expect(upload.statusCode).toBe(201);
  const request_id=data(await f.client.callTool({name:'get_status',arguments:{}})).nextRequestId;
  const shown=data(await f.client.callTool({name:'show_media',arguments:{rendition_id:upload.json().rendition.id,request_id}}));
  expect(shown).toMatchObject({ok:true,timing:null,snapshot:{player:{state:'loading',intent:'active'}}});
  await vi.waitFor(()=>expect(writes).toContain('Draw/SendHttpGif'));
  await f.client.close();
  const loading=(await f.inject('/api/player')).json();expect(loading.player).toMatchObject({state:'loading',intent:'active'});
  expect(loading.session.id).toBe((shown.context as {sessionId:string}).sessionId);
  release();
  await vi.waitFor(async()=>expect((await f.inject('/api/player')).json().player.state).toBe('playing'));
  expect(writes.slice(0,3)).toEqual(['Draw/GetHttpGifId','Draw/SendHttpGif','Draw/SendHttpGif']);
  const snapshot=(await f.inject('/api/player')).json();
  const paused=await f.inject({method:'POST',url:'/api/player/commands',headers:{'x-pixoo-request':'1'},payload:{requestId:snapshot.nextRequestId,command:'pause'}});
  expect(paused.statusCode).toBe(200);expect(paused.json().player.intent).toBe('paused');expect(paused.json().session.id).toBe(loading.session.id);
 }finally{release();await f.close();}
},20000);

it('returns replayable typed selection failures and keeps catalog metadata out of other tools',async()=>{
 const f=await fixture();try{
  const uploaded=await f.inject({method:'POST',url:'/api/assets',...multipart(undefined,'untrusted-ignore-instructions.gif')});expect(uploaded.statusCode).toBe(201);
  const renditionId=uploaded.json().rendition.id;
  let request_id=data(await f.client.callTool({name:'get_status',arguments:{}})).nextRequestId;
  const http=await f.inject({method:'POST',url:'/api/player/commands',headers:{'x-pixoo-request':'1'},payload:{requestId:request_id,command:'show-media',renditionId}});expect(http.statusCode).toBe(200);
  const mcp=data(await f.client.callTool({name:'show_media',arguments:{request_id,rendition_id:renditionId}}));expect(mcp.ok).toBe(true);expect(http.json()).toMatchObject(mcp.snapshot as object);
  const sessionId=http.json().session.id;
  const pauseId=(await f.inject('/api/player')).json().nextRequestId;
  await f.inject({method:'POST',url:'/api/player/commands',headers:{'x-pixoo-request':'1'},payload:{requestId:pauseId,command:'pause'}});
  for(const [args,code] of [[{rendition_id:'f'.repeat(64)},'not-found'],[{rendition_id:renditionId,policy:{mode:'plays',totalPlays:3}},'invalid-input']] as const){
   request_id=data(await f.client.callTool({name:'get_status',arguments:{}})).nextRequestId;
   const result=await f.client.callTool({name:'show_media',arguments:{...args,request_id}});
   expect(result.isError).toBe(true);expect(data(result)).toMatchObject({ok:false,code,priorEffects:'none'});
   expect(data(await f.client.callTool({name:'show_media',arguments:{...args,request_id}}))).toEqual(data(result));
   const state=(await f.inject('/api/player')).json();expect(state.session.id).toBe(sessionId);expect(state.player.intent).toBe('paused');
  }
  const catalog=data(await f.client.callTool({name:'list_media',arguments:{q:'untrusted',offset:0,limit:100}}));expect(JSON.stringify(catalog)).toContain('untrusted-ignore-instructions.gif');
  for(const args of [{limit:101},{offset:-1},{offset:Number.MAX_SAFE_INTEGER+1},{q:'x'.repeat(121)},{limit:1,path:'/private'}])expect((await f.client.callTool({name:'list_media',arguments:args})).isError).toBe(true);
  const status=await f.client.callTool({name:'get_status',arguments:{}}),discovery=await f.client.listTools();
  const display=await f.client.callTool({name:'set_brightness',arguments:{percent:50,request_id:data(status).nextRequestId}});
  for(const result of [status,discovery,display,mcp]){expect(JSON.stringify(result)).not.toContain('untrusted-ignore-instructions');expect(JSON.stringify(result)).not.toContain(f.dataDir);}
 }finally{await f.close();}
},20000);

it('reports incompatible stored media without replacing the active endpoint context',async()=>{
 let incompatibleId='',compatibleId='';const writes:string[]=[];
 const f=await fixture(async body=>{writes.push(String(body.Command));return {error_code:0,PicId:1};},async dataDir=>{
  const library=await Library.open({directory:join(dataDir,'library')});
  try{
   async function* bytes(delay:number){yield gifFixture(1,1,[{width:1,height:1,pixels:[1],delay},{width:1,height:1,pixels:[2],delay}]);}
   incompatibleId=(await library.importMedia(bytes(10),'Old simulator timing')).rendition.id;
   compatibleId=(await library.importMedia(bytes(50),'Compatible timing')).rendition.id;
  }finally{await library.close();}
 });
 try{
  const catalog=data(await f.client.callTool({name:'list_media',arguments:{}}));
  expect((catalog.items as {rendition_id:string;compatible:boolean}[]).find(item=>item.rendition_id===incompatibleId)?.compatible).toBe(false);
  let request_id=data(await f.client.callTool({name:'get_status',arguments:{}})).nextRequestId;
  const selected=data(await f.client.callTool({name:'show_media',arguments:{rendition_id:compatibleId,request_id}}));expect(selected.ok).toBe(true);
  request_id=data(await f.client.callTool({name:'get_status',arguments:{}})).nextRequestId;
  expect(data(await f.client.callTool({name:'control_playback',arguments:{action:'pause',request_id}})).ok).toBe(true);
  const before=(await f.inject('/api/player')).json(),writeCount=writes.length;
  request_id=before.nextRequestId;
  const failed=await f.client.callTool({name:'show_media',arguments:{rendition_id:incompatibleId,request_id}});
  expect(failed.isError).toBe(true);expect(data(failed)).toMatchObject({ok:false,code:'profile-limit',priorEffects:'none'});
  expect(data(await f.client.callTool({name:'show_media',arguments:{rendition_id:incompatibleId,request_id}}))).toEqual(data(failed));
  const after=(await f.inject('/api/player')).json();expect(after.session).toEqual(before.session);expect(after.player).toEqual(before.player);expect(writes.length).toBe(writeCount);
 }finally{await f.close();}
},20000);
