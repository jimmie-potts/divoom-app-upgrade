import {expect,it,vi} from 'vitest';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type {Transport} from '@modelcontextprotocol/sdk/shared/transport.js';
import {createApp} from '../../apps/server/dist/app.js';
import {provisionCredential} from '../../apps/server/src/mcp-config.js';
it('bounds sessions, releases a deleted session and closes connected clients on shutdown',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'pixoo-mcp-sessions-')),token=await provisionCredential(directory,'codex',['read','control']);
 const app=createApp({dataDir:directory,mcpEnabled:true});const clients:Client[]=[],transports:StreamableHTTPClientTransport[]=[];
 try{
  await app.listen({host:'127.0.0.1',port:0});const address=app.server.address();if(!address||typeof address==='string')throw new Error();const base=`http://127.0.0.1:${address.port}`;
  const connect=async()=>{const client=new Client({name:'sessions',version:'1'}),transport=new StreamableHTTPClientTransport(new URL(`${base}/mcp`),{requestInit:{headers:{authorization:`Bearer ${token}`}}});clients.push(client);transports.push(transport);await client.connect(transport as Transport);return client;};
  for(let n=0;n<16;n++)await connect();
  await expect(connect()).rejects.toThrow();
  await transports[0]!.terminateSession();await clients[0]!.close();
  const replacement=await connect();expect((await replacement.listTools()).tools).toHaveLength(8);
  expect((await fetch(`${base}/api/health`)).status).toBe(200);
  await app.close();await expect(replacement.listTools()).rejects.toThrow();
 }finally{await Promise.all(clients.map(client=>client.close()));await app.close();await rm(directory,{recursive:true,force:true});}
},20000);
it('closes an in-flight tool delivery before awaiting the existing device writer',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'pixoo-mcp-shutdown-'));let release=()=>{},calls=0;const gate=new Promise<void>(resolve=>{release=resolve;});
 await writeFile(join(directory,'device.json'),JSON.stringify({version:1,configuration:{ip:'192.168.50.20',profile:'pixoo64-smoke-2026-09-06'}}));
 const token=await provisionCredential(directory,'codex',['read','control']);
 const app=createApp({dataDir:directory,mcpEnabled:true,mode:'device',deviceLockDirectoryForTests:directory,transportForTests:async()=>{calls++;await gate;return {error_code:0};}}),client=new Client({name:'shutdown',version:'1'});
 try{
  await app.listen({host:'127.0.0.1',port:0});const address=app.server.address();if(!address||typeof address==='string')throw new Error();
  await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${address.port}/mcp`),{requestInit:{headers:{authorization:`Bearer ${token}`}}}) as Transport);
  const status=await client.callTool({name:'get_status',arguments:{}}),request_id=(status.structuredContent as {data:{nextRequestId:string}}).data.nextRequestId;
  const pending=client.callTool({name:'set_brightness',arguments:{request_id,percent:44}}).catch(()=>null);
  await vi.waitFor(()=>expect(calls).toBe(1));const closing=app.close();release();await closing;await pending;expect(calls).toBe(1);
 }finally{release();await client.close();await app.close();await rm(directory,{recursive:true,force:true});}
},20000);
