import {expect,it} from 'vitest';
import {createServer,type Server} from 'node:http';
import {once} from 'node:events';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {loadPlaybackConfig,PlaybackReader} from '../../apps/server/src/now-playing-source.js';

const token='p'.repeat(43);
const snapshot=(extra:Record<string,unknown>={})=>({apiVersion:'1.0',sourceId:'ht-a9',availability:'available',observedAtMs:Date.now(),ageMs:400,
 playback:{status:'playing',title:'Harvest Moon',artist:'Neil Young',controls:['pause']},...extra});
async function serve(handler:Parameters<typeof createServer>[1]):Promise<{server:Server;endpoint:string}>{
 const server=createServer(handler);server.listen(0,'127.0.0.1');await once(server,'listening');
 const address=server.address();if(!address||typeof address==='string')throw new Error('no address');
 return {server,endpoint:`http://127.0.0.1:${address.port}/api/playback/v1/snapshot`};
}
const close=(server:Server)=>{server.closeAllConnections();server.close();};

it('reads the configured source with its token and turns failures into stale evidence',async()=>{
 let mode='good',redirects=0;const calls:string[][]=[];
 const {server,endpoint}=await serve((request,response)=>{
  calls.push([request.method!,request.url!,request.headers.authorization??'']);
  if(request.url==='/moved'){redirects++;response.end('{}');return;}
  if(mode==='redirect'){response.writeHead(302,{location:'/moved'});response.end();return;}
  if(mode==='hang'){response.writeHead(200);response.write('{');return;}
  if(mode==='oversized'){response.end(' '.repeat(64*1024+1));return;}
  if(mode==='failed'){response.statusCode=403;response.end('{"error":"forbidden"}');return;}
  response.end(JSON.stringify(mode==='source'?snapshot({sourceId:'other'}):mode==='shape'?snapshot({availability:'fresh'}):snapshot()));
 });
 let now=1000;const reader=new PlaybackReader({version:1,endpoint,token,sourceId:'ht-a9'},{clock:()=>now,timeoutMs:200});
 try{
  expect(reader.status()).toEqual({source:'unavailable',view:{card:false}});
  await reader.refresh();
  expect(calls).toEqual([['GET','/api/playback/v1/snapshot',`Bearer ${token}`]]);
  expect(reader.status()).toEqual({source:'current',view:{card:true,status:'playing',title:'HARVEST MOON',artist:'NEIL YOUNG',stale:false}});
  for(mode of ['source','shape','failed','redirect','oversized','hang']){
   await reader.refresh();expect(reader.status()).toMatchObject({source:'stale',view:{card:true,stale:true}});
  }
  expect(redirects).toBe(0);
  now+=30_000;expect(reader.status()).toEqual({source:'stale',view:{card:false}});
  mode='good';await reader.refresh();expect(reader.status().view).toMatchObject({card:true,stale:false});
 }finally{reader.close();close(server);}
});

it('runs one read at a time and stops after close',async()=>{
 let requests=0,release=()=>{};
 const {server,endpoint}=await serve((_request,response)=>{requests++;release=()=>response.end(JSON.stringify(snapshot()));});
 const reader=new PlaybackReader({version:1,endpoint,token,sourceId:'ht-a9'},{clock:()=>0,timeoutMs:1000});
 try{
  const first=reader.refresh(),second=reader.refresh();expect(second).toBe(first);
  await new Promise(resolve=>setTimeout(resolve,50));expect(requests).toBe(1);release();await first;
  reader.close();await reader.refresh();expect(requests).toBe(1);
 }finally{reader.close();close(server);}
});

it('loads an optional private configuration and rejects unsafe endpoints',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'now-playing-config-'));
 try{
  expect(await loadPlaybackConfig(directory)).toBeUndefined();
  const good={version:1,endpoint:'http://127.0.0.1:8788/api/playback/v1/snapshot',token,sourceId:'ht-a9'};
  await writeFile(join(directory,'playback.json'),JSON.stringify(good));expect(await loadPlaybackConfig(directory)).toEqual(good);
  for(const bad of [{...good,endpoint:'http://localhost:8788/api/playback/v1/snapshot'},{...good,endpoint:'https://127.0.0.1:8788/api/playback/v1/snapshot'},
   {...good,endpoint:'http://127.0.0.1:8788/api/playback/v1/commands'},{...good,endpoint:'http://127.0.0.1/api/playback/v1/snapshot'},
   {...good,endpoint:'http://127.0.0.1:8788/api/playback/v1/snapshot?x=1'},{...good,token:'short'},{...good,sourceId:'bad id'},{...good,extra:true},{...good,version:2}]){
   await writeFile(join(directory,'playback.json'),JSON.stringify(bad));
   await expect(loadPlaybackConfig(directory)).rejects.toThrow('Playback configuration is invalid');
  }
  await writeFile(join(directory,'playback.json'),'not json');await expect(loadPlaybackConfig(directory)).rejects.toThrow('Playback configuration is invalid');
  await rm(join(directory,'playback.json'));await mkdir(join(directory,'playback.json'));await expect(loadPlaybackConfig(directory)).rejects.toThrow();
 }finally{await rm(directory,{recursive:true,force:true});}
});
