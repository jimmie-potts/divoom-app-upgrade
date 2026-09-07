import {expect,it,vi} from 'vitest';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
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
import type {DeviceTransport} from '@pixoo/device';
import {provisionCredential,revokeCredential} from '../../apps/server/src/mcp-config.js';
async function fixture(transportForTests?:DeviceTransport){
 const dataDir=await mkdtemp(join(tmpdir(),'pixoo-mcp-'));
 const token=await provisionCredential(dataDir,'codex',['read','control']);
 if(transportForTests)await writeFile(join(dataDir,'device.json'),JSON.stringify({version:1,configuration:{ip:'192.168.50.20',profile:'pixoo64-smoke-2026-09-06'}}));
 const app=createApp({dataDir,mcpEnabled:true,...(transportForTests?{mode:'device' as const,transportForTests,deviceLockDirectoryForTests:dataDir}:{})});
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
  expect((await f.client.listTools()).tools.map(t=>t.name).sort()).toEqual(['get_status','set_brightness','set_screen']);
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
