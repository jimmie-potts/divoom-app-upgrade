import {expect,it} from 'vitest';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {mkdtemp,rm,mkdir,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../../apps/server/src/app.js';
import {provisionCredential} from '../../apps/server/src/mcp-config.js';
const headers={'x-pixoo-request':'1'},prefix='/api/integration/v1',token='p'.repeat(43);
async function setup(){
 const directory=await mkdtemp(join(tmpdir(),'now-playing-api-'));await mkdir(join(directory,'agent-monitor'));
 await writeFile(join(directory,'agent-monitor','config.json'),JSON.stringify({version:1,mode:'embedded',ownerId:'owner',consumers:[{id:'pixoo',clearOnNewTurn:true}]}));
 await provisionCredential(join(directory,'agent-monitor'),'writer',['read','control']);
 return directory;
}
it('reports an unconfigured reader, persists the Media setting and leaves the native integration snapshot unchanged',async()=>{
 const directory=await setup(),native=await provisionCredential(directory,'native',['read','control']);
 let app=createApp({dataDir:directory,monitorEnabled:true,controllerEnabled:true});
 try{
  const before=(await app.inject({url:'/controller/pixoo-integration/v1/snapshot',headers:{authorization:`Bearer ${native}`}})).json();
  const view=(await app.inject(prefix+'/view')).json();
  expect(view.nowPlaying).toEqual({configured:false,setting:{version:1,media:'off'},source:'unavailable',view:{card:false},showing:'none',takeover:null,lastTakeover:null,card:null});
  expect((await app.inject({method:'POST',url:prefix+'/now-playing',payload:{media:'whole'}})).statusCode).toBe(403);
  for(const payload of [{media:'always'},{media:'whole',extra:1},{}])expect((await app.inject({method:'POST',url:prefix+'/now-playing',headers,payload})).statusCode).toBe(400);
  const saved=await app.inject({method:'POST',url:prefix+'/now-playing',headers,payload:{media:'whole'}});
  expect(saved.statusCode).toBe(200);expect(saved.json()).toMatchObject({configured:false,setting:{version:1,media:'whole'}});
  expect(JSON.parse(await readFile(join(directory,'agent-monitor','now-playing.json'),'utf8'))).toEqual({version:1,media:'whole'});
  const after=(await app.inject({url:'/controller/pixoo-integration/v1/snapshot',headers:{authorization:`Bearer ${native}`}})).json();
  expect(Object.keys(after).sort()).toEqual(Object.keys(before).sort());expect(after.configuration).toEqual(before.configuration);
  expect(JSON.stringify(after)).not.toMatch(/nowPlaying|whole/);
  await app.close();app=createApp({dataDir:directory,monitorEnabled:true});
  expect((await app.inject(prefix+'/view')).json().nowPlaying.setting).toEqual({version:1,media:'whole'});
 }finally{await app.close();await rm(directory,{recursive:true,force:true});}
});
it('reads the configured hub snapshot with its token and shows the card state and exact preview',async()=>{
 const directory=await setup();const calls:string[]=[];
 const hub=createServer((request,response)=>{calls.push(`${request.url} ${request.headers.authorization}`);response.end(JSON.stringify({apiVersion:'1.0',sourceId:'ht-a9',availability:'available',observedAtMs:Date.now(),ageMs:300,playback:{status:'paused',title:'Harvest Moon',artist:'Neil Young',controls:['next','previous']}}));});
 hub.listen(0,'127.0.0.1');await once(hub,'listening');const address=hub.address() as {port:number};
 await writeFile(join(directory,'agent-monitor','playback.json'),JSON.stringify({version:1,endpoint:`http://127.0.0.1:${address.port}/api/playback/v1/snapshot`,token,sourceId:'ht-a9'}));
 const app=createApp({dataDir:directory,monitorEnabled:true});
 try{
  const state=(await app.inject(prefix+'/view')).json().nowPlaying;
  expect(state).toMatchObject({configured:true,source:'current',view:{card:true,status:'paused',title:'HARVEST MOON',artist:'NEIL YOUNG',stale:false},showing:'none',takeover:null});
  expect(state.card).toHaveLength(12288);
  expect(calls[0]).toBe(`/api/playback/v1/snapshot Bearer ${token}`);
  expect(JSON.stringify((await app.inject(prefix+'/snapshot')).json())).not.toMatch(/HARVEST|token|playback/i);
 }finally{await app.close();hub.closeAllConnections();hub.close();await rm(directory,{recursive:true,force:true});}
});
it('refuses to start with an invalid playback configuration',async()=>{
 const directory=await setup();
 await writeFile(join(directory,'agent-monitor','playback.json'),JSON.stringify({version:1,endpoint:'http://192.168.1.20:8788/api/playback/v1/snapshot',token,sourceId:'ht-a9'}));
 const app=createApp({dataDir:directory,monitorEnabled:true});
 try{await expect(app.ready()).rejects.toThrow('Playback configuration is invalid');}
 finally{await app.close().catch(()=>{});await rm(directory,{recursive:true,force:true});}
});
