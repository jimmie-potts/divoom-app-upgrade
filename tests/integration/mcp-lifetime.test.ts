import {expect,it,vi} from 'vitest';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type {Transport} from '@modelcontextprotocol/sdk/shared/transport.js';
import {createApp} from '../../apps/server/dist/app.js';
import {provisionCredential,revokeCredential} from '../../apps/server/src/mcp-config.js';
import {DeviceRequestError} from '../../packages/device/dist/http-transport.js';
class ProtocolTransport extends StreamableHTTPClientTransport {
 constructor(url:URL,token:string,private version:string){super(url,{requestInit:{headers:{authorization:`Bearer ${token}`}}});}
 override async send(message:Parameters<StreamableHTTPClientTransport['send']>[0],options?:Parameters<StreamableHTTPClientTransport['send']>[1]){
  return super.send('method' in message&&message.method==='initialize'?{...message,params:{...message.params,protocolVersion:this.version}}:message,options);
 }
}
function result(value:unknown){return (value as {structuredContent:{data:Record<string,unknown>}}).structuredContent.data;}
it.each(['2025-11-25','2025-06-18'])('keeps admitted work and authentication after cancellation using protocol %s',async version=>{
 const directory=await mkdtemp(join(tmpdir(),'pixoo-mcp-life-'));let release=()=>{},calls=0;
 const gate=new Promise<void>(resolve=>{release=resolve;});
 await writeFile(join(directory,'device.json'),JSON.stringify({version:1,configuration:{ip:'192.168.50.20',profile:'pixoo64-smoke-2026-09-06'}}));
 const token=await provisionCredential(directory,'codex',['read','control']);
 const app=createApp({dataDir:directory,mcpEnabled:true,mode:'device',deviceLockDirectoryForTests:directory,transportForTests:async()=>{calls++;await gate;throw new DeviceRequestError('timeout');}});
 const client=new Client({name:'lifetime',version:'1'});
 try{
  await app.listen({host:'127.0.0.1',port:0});const address=app.server.address();if(!address||typeof address==='string')throw new Error();
  const base=`http://127.0.0.1:${address.port}`;
  const transport=new ProtocolTransport(new URL(`${base}/mcp`),token,version);
  await client.connect(transport as Transport);
  const request_id=result(await client.callTool({name:'get_status',arguments:{}})).nextRequestId;
  const abort=new AbortController();const pending=client.callTool({name:'set_brightness',arguments:{percent:25,request_id}},undefined,{signal:abort.signal}).then(()=>null,error=>error);
  await vi.waitFor(()=>expect(calls).toBe(1));abort.abort();expect(await pending).not.toBeNull();
  release();
  const replay=await client.callTool({name:'set_brightness',arguments:{percent:25,request_id}});
  expect(result(replay)).toMatchObject({ok:false,requestId:request_id,code:'timeout',priorEffects:'possible',timing:{completedAtMs:expect.any(Number)}});
  expect(calls).toBe(1);
  expect(result(await client.callTool({name:'get_status',arguments:{}}))).toMatchObject({player:{intent:'paused'},display:{brightness:{acknowledged:null},transport:{priorEffects:'possible'}}});
  await revokeCredential(directory,'codex');await expect(client.callTool({name:'get_status',arguments:{}})).rejects.toThrow();
  await client.close();expect((await fetch(`${base}/api/health`)).status).toBe(200);
 }finally{release();await client.close();await app.close();await rm(directory,{recursive:true,force:true});}
},20000);
it('limits read credentials to status and catalogs and leaves disabled MCP unavailable',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'pixoo-mcp-read-'));const token=await provisionCredential(directory,'reader',['read']);
 const app=createApp({dataDir:directory,mcpEnabled:true});const client=new Client({name:'reader',version:'1'});
 try{
  await app.listen({host:'127.0.0.1',port:0});const address=app.server.address();if(!address||typeof address==='string')throw new Error();
  const base=`http://127.0.0.1:${address.port}`;
  await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`),{requestInit:{headers:{authorization:`Bearer ${token}`}}}) as Transport);
  expect((await client.listTools()).tools.map(t=>t.name)).toEqual(['get_status','list_media','list_playlists']);
  const before=result(await client.callTool({name:'get_status',arguments:{}}));
  expect((await client.callTool({name:'set_screen',arguments:{on:false,request_id:before.nextRequestId}})).isError).toBe(true);
  expect((await client.callTool({name:'control_playback',arguments:{action:'stop',request_id:before.nextRequestId}})).isError).toBe(true);
  expect(result(await client.callTool({name:'list_media',arguments:{}}))).toMatchObject({items:[],total:0});
  expect(result(await client.callTool({name:'get_status',arguments:{}})).nextRequestId).toBe(before.nextRequestId);
 }finally{await client.close();await app.close();}
 const disabled=createApp({dataDir:directory});try{expect((await disabled.inject('/mcp')).statusCode).toBe(404);}finally{await disabled.close();await rm(directory,{recursive:true,force:true});}
},20000);
