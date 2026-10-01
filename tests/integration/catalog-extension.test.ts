import {expect,it} from 'vitest';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../../apps/server/src/app.js';
import {provisionCredential} from '../../apps/server/src/mcp-config.js';
import {multipart} from '../helpers/http-api.js';
const prefix='/controller/pixoo-integration/v1';
it('negotiates catalog reads without changing old snapshots or allocating a command',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'catalog-extension-'));
 await mkdir(join(dir,'agent-monitor'));
 await writeFile(join(dir,'agent-monitor/config.json'),JSON.stringify({version:1,mode:'embedded',ownerId:'owner',consumers:[{id:'pixoo',clearOnNewTurn:true}]}));
 await provisionCredential(join(dir,'agent-monitor'),'monitor',['read','control']);
 const token=await provisionCredential(dir,'reader',['read']);
 const app=createApp({dataDir:dir,monitorEnabled:true,controllerEnabled:true}),headers={authorization:`Bearer ${token}`};
 try{
  const before=(await app.inject({url:prefix+'/snapshot',headers})).json();
  const snapshot=await app.inject({url:prefix+'/snapshot?apiVersion=pixoo-integration%2F1.1',headers});
  expect(snapshot.statusCode,snapshot.body).toBe(200);expect(snapshot.json().apiVersion).toBe('pixoo-integration/1.1');
  expect(snapshot.json().catalogRevision).toBe(0);expect(snapshot.json().currentMedia).toBeNull();
  const part=multipart(undefined,'a'.repeat(116)+'.gif');
  const upload=await app.inject({method:'POST',url:'/api/assets',...part});expect(upload.statusCode,upload.body).toBe(201);
  const catalog=await app.inject({url:prefix+'/catalog/renditions',headers});expect(catalog.statusCode,catalog.body).toBe(200);
  expect(catalog.json()).toMatchObject({total:1,offset:0,limit:25,items:[{name:'a'.repeat(116)+'.gif'}]});
  expect(catalog.json().catalogRevision).toBeGreaterThan(0);
  const id=upload.json().rendition.id;
  const manifest=await app.inject({url:`${prefix}/renditions/${id}/preview.json`,headers});expect(manifest.statusCode,manifest.body).toBe(200);
  expect(manifest.json()).toMatchObject({renditionId:id,width:64,height:64,frameCount:1});
  const image=await app.inject({url:`${prefix}/renditions/${id}/preview.png`,headers});expect(image.statusCode,image.body).toBe(200);
  expect(image.rawPayload).toEqual((await app.inject(`/api/renditions/${id}/frames/0.png`)).rawPayload);
  expect(image.headers.etag).not.toBe(manifest.headers.etag);
  expect((await app.inject({url:`${prefix}/renditions/${id}/preview.png`,headers:{...headers,'if-none-match':String(image.headers.etag)}})).statusCode).toBe(304);
  expect((await app.inject({url:prefix+'/snapshot',headers})).json()).toEqual(before);
 }finally{await app.close();await rm(dir,{recursive:true,force:true});}
});

import {vi} from 'vitest';
import sharp from 'sharp';
import {readFile} from 'node:fs/promises';
import {Library} from '@pixoo/library';
import {PIXOO64_SMOKE_PROFILE,SIMULATOR_PROFILE} from '@pixoo/media';
import {revokeCredential} from '../../apps/server/src/mcp-config.js';
import {gifFixture} from '../helpers/media-fixtures.js';
import {DeviceRequestError} from '../../packages/device/dist/http-transport.js';
async function setup(device=false,failUpload=false,frameCount=20,zeroDelay=false){
 const dir=await mkdtemp(join(tmpdir(),'catalog-more-'));
 await mkdir(join(dir,'agent-monitor'));await writeFile(join(dir,'agent-monitor/config.json'),JSON.stringify({version:1,mode:'embedded',ownerId:'owner',consumers:[{id:'pixoo',clearOnNewTurn:true}]}));
 await provisionCredential(join(dir,'agent-monitor'),'monitor',['read','control']);
 const token=await provisionCredential(dir,'reader',['read']),control=await provisionCredential(dir,'control',['control']);
 const library=await Library.open({directory:join(dir,'library')});
 const bytes=gifFixture(1,1,Array.from({length:frameCount},(_,i)=>({width:1,height:1,pixels:[i%3],delay:zeroDelay?0:i%2?12:7})));
 const imported=await library.importMedia((async function*(){yield bytes;})(),'animated.gif',{profile:{...SIMULATOR_PROFILE,maxFrames:Math.max(500,frameCount)}});await library.close();
 const calls:string[]=[];
 if(device)await writeFile(join(dir,'device.json'),JSON.stringify({version:1,configuration:{ip:'192.168.50.20',profile:PIXOO64_SMOKE_PROFILE.name}}));
 const app=createApp({dataDir:dir,controllerEnabled:true,monitorEnabled:true,...(device?{mode:'device' as const,transportForTests:async(body:Record<string,unknown>)=>{calls.push(String(body.Command));if(failUpload&&body.Command==='Draw/SendHttpGif')throw new DeviceRequestError('timeout');return {error_code:0,PicId:1};},deviceLockDirectoryForTests:dir}:{})});
 const headers={authorization:`Bearer ${token}`};
 const get=(path:string,extra:Record<string,string>={})=>app.inject({url:prefix+path,headers:{...headers,...extra}});
 return {app,dir,headers,get,control,calls,imported,async close(){await app.close();await rm(dir,{recursive:true,force:true});}};
}
it.each([false,true])('preserves complete variable-timing frames without touching the adapter (device=%s)',async device=>{
 const f=await setup(device);try{
  const before=(await f.get('/snapshot')).json();
  const page=(await f.get('/catalog/renditions')).json();expect(page.items[0].compatible).toBe(!device);
  const id=f.imported.rendition.id,manifest=(await f.get(`/renditions/${id}/preview.json`)).json();
  expect(manifest.frameCount).toBe(20);expect(manifest.durationMs).toBe(1900);
  expect(manifest.frames).toEqual(f.imported.rendition.frames.map(({index,delayMs})=>({index,delayMs})));
  for(let i=0;i<20;i++){
   const response=await f.get(`/renditions/${id}/frames/${i}.png`);expect(response.statusCode,response.body).toBe(200);
   const decoded=await sharp(response.rawPayload).removeAlpha().raw().toBuffer();
   expect(decoded).toEqual(await readFile(join(f.dir,'library/media/renditions',id,`${i}.rgb`)));
  }
  expect((await f.get('/snapshot')).json().nextRequestId).toBe(before.nextRequestId);expect(f.calls).toEqual([]);
 }finally{await f.close();}
});
it('authenticates every preview and conditional read, validates paging, and rejects deleted membership',async()=>{
 const f=await setup();try{
  const id=f.imported.rendition.id,path=`/renditions/${id}/preview.png`;
  expect((await f.app.inject(prefix+path)).statusCode).toBe(401);
  expect((await f.get(path,{authorization:`Bearer ${f.control}`})).statusCode).toBe(403);
  for(const suffix of ['?limit=0','?limit=101','?offset=-1','?offset=9007199254740992','?limit=1.2','?path=/private'])expect((await f.get('/catalog/renditions'+suffix)).statusCode).toBe(400);
  expect((await f.get('/catalog/renditions?limit=1&offset=1')).json()).toMatchObject({total:1,items:[],limit:1,offset:1});
  const image=await f.get(path),etag=String(image.headers.etag);
  expect(image.headers['cache-control']).toBe('private, max-age=31536000, immutable');
  expect((await f.get('/catalog/renditions')).headers['cache-control']).toBe('no-store');
  expect((await f.get(path,{'if-none-match':`W/${etag}`})).statusCode).toBe(304);
  expect((await f.get(`/renditions/${id}/frames/20.png`)).statusCode).toBe(400);
  expect((await f.get(`/renditions/${id}/frames/-1.png`)).statusCode).toBe(400);
  expect((await f.get(`/renditions/${'f'.repeat(64)}/preview.json`)).statusCode).toBe(404);
  const del=await f.app.inject({method:'DELETE',url:`/api/assets/${f.imported.asset.id}`,headers:{'x-pixoo-request':'1'}});expect(del.statusCode).toBe(204);
  expect((await f.get(path,{'if-none-match':etag})).statusCode).toBe(404);
  await revokeCredential(f.dir,'reader');expect((await f.get(path,{'if-none-match':etag})).statusCode).toBe(401);
 }finally{await f.close();}
});
it('authenticates resolved native routes even when static path segments are encoded',async()=>{
 const f=await setup();try{
  const id=f.imported.rendition.id;
  const paths=[`${prefix}/%63atalog/renditions`,`${prefix}/catalog/%72enditions`,`${prefix}/catalog/%70laylists`,
   `${prefix}/renditions/${id}/preview%2epng`,`${prefix}/renditions/${id}/preview%2ejson`,`${prefix}/renditions/${id}/frames/0%2epng`,
   `${prefix}/%73napshot?apiVersion=pixoo-integration%2F1.1`];
  for(const url of paths){
   expect((await f.app.inject({url})).statusCode,url).toBe(401);
   expect((await f.app.inject({method:'HEAD',url})).statusCode,url).toBe(401);
   expect((await f.app.inject({url,headers:{authorization:`Bearer ${f.control}`,'if-none-match':'*'}})).statusCode,url).toBe(403);
   const response=await f.app.inject({url,headers:f.headers});expect(response.statusCode,url).toBe(200);
   if(response.headers.etag){
    const conditional=await f.app.inject({url,headers:{...f.headers,'if-none-match':String(response.headers.etag)}});
    expect(conditional.statusCode,url).toBe(304);expect(conditional.headers['cache-control']).toBe('private, max-age=31536000, immutable');
   }
  }
  await revokeCredential(f.dir,'reader');
  for(const url of paths)expect((await f.app.inject({url,headers:{...f.headers,'if-none-match':'*'}})).statusCode,url).toBe(401);
 }finally{await f.close();}
});
it('revisions identify playlist edits and survive restart without advancing on failed edits or duplicate imports',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'catalog-revision-'));let library=await Library.open({directory:dir});
 try{
  expect(library.catalogRevision).toBe(0);
  const input=gifFixture(1,1,[{width:1,height:1,pixels:[1]}]);
  const imported=await library.importMedia((async function*(){yield input;})(),'owner label');
  const rev=library.catalogRevision;
  expect((await library.importMedia((async function*(){yield input;})(),'other filename')).asset.name).toBe('owner label');expect(library.catalogRevision).toBe(rev);
  const playlist=await library.createPlaylist('a'.repeat(120));expect(library.catalogRevision).toBeGreaterThan(rev);
  const before=await library.queryPlaylists({q:'',offset:0,limit:25},true);
  const edited=await library.replaceItems(playlist.id,1,[{renditionId:imported.rendition.id,playback:{mode:'duration',durationMs:30000}}]);
  const detail=await library.catalogPlaylist(playlist.id);expect(detail.catalogRevision).toBeGreaterThan(before.catalogRevision!);expect(detail.playlist.items[0]?.renditionId).toBe(imported.rendition.id);
  const failed=library.catalogRevision;await expect(library.renamePlaylist(playlist.id,1,'stale')).rejects.toMatchObject({code:'revision-conflict'});expect(library.catalogRevision).toBe(failed);
  await expect(library.renamePlaylist(playlist.id,edited.revision,'b'.repeat(121))).rejects.toMatchObject({code:'invalid-input'});expect(library.catalogRevision).toBe(failed);
  await library.close();library=await Library.open({directory:dir});expect(library.catalogRevision).toBe(failed);
 }finally{await library.close();await rm(dir,{recursive:true,force:true});}
});
it('serves stills and more than 256 effective colors with null still timing and honest GIF warnings',async()=>{
 const f=await setup();try{
  const rgb=Buffer.alloc(64*64*3);for(let i=0;i<4096;i++){rgb[i*3]=i%256;rgb[i*3+1]=Math.floor(i/256)*16;rgb[i*3+2]=i%17;}
  const fixtures=[await sharp(rgb,{raw:{width:64,height:64,channels:3}}).png().toBuffer(),await sharp(rgb,{raw:{width:64,height:64,channels:3}}).jpeg().toBuffer(),gifFixture(1,1,[{width:1,height:1,pixels:[1],delay:null}]),gifFixture(1,1,[{width:1,height:1,pixels:[1],delay:50},{width:1,height:1,pixels:[1],delay:50}])];
  for(const [n,bytes] of fixtures.entries()){
   const upload=await f.app.inject({method:'POST',url:'/api/assets',...multipart(bytes,`test-${n}`)});expect(upload.statusCode,upload.body).toBe(201);
   const rendition=upload.json().rendition,id=rendition.id;
   const manifest=(await f.get(`/renditions/${id}/preview.json`)).json();expect(manifest.frames).toEqual(rendition.frames.map(({index,delayMs}:{index:number;delayMs:number|null})=>({index,delayMs})));
   expect(manifest.warnings).toEqual(rendition.warnings);if(n<2)expect(manifest.durationMs).toBeNull();if(n===2)expect(manifest.warnings).toHaveLength(1);
   for(let i=0;i<manifest.frameCount;i++){
    const response=await f.get(`/renditions/${id}/frames/${i}.png`);expect(response.statusCode,response.body).toBe(200);
    const decoded=await sharp(response.rawPayload).removeAlpha().raw().toBuffer();expect(decoded).toEqual(await readFile(join(f.dir,'library/media/renditions',id,`${i}.rgb`)));
    if(n===0)expect(new Set(Array.from({length:4096},(_,i)=>decoded.subarray(i*3,i*3+3).toString('hex'))).size).toBeGreaterThan(256);
   }
  }
 }finally{await f.close();}
});
it('bounds queued preview work, cancels expired work and never sends a partial response',async()=>{
 const f=await setup();let release=()=>{};const held=new Promise<void>(resolve=>{release=resolve;});
 const original=Library.prototype.preview;
 let started=0;
 const spy=vi.spyOn(Library.prototype,'preview').mockImplementation(async function(this:Library,id,index,signal){started++;await held;if(signal?.aborted)throw new Error('cancelled test work');return original.call(this,id,index,signal);});
 try{
  const path=`/renditions/${f.imported.rendition.id}/preview.png`;
  const pending=Array.from({length:8},()=>f.get(path).then(response=>response));
  await vi.waitFor(()=>expect(started).toBe(8));
  expect((await f.get(path)).statusCode).toBe(429);
  const replies=await Promise.all(pending);expect(replies.every(response=>response.statusCode===504)).toBe(true);
  expect(replies.every(response=>response.headers['content-type']?.includes('application/json'))).toBe(true);
  expect((await f.get(path)).statusCode).toBe(429);
  release();await vi.waitFor(async()=>expect((await f.get(path)).statusCode).toBe(200));
 }finally{release();spy.mockRestore();await f.close();}
},15000);
it('reports captured playlist position and single-media identity without claiming physical output',async()=>{
 const f=await setup();try{
  const mutate={headers:{'x-pixoo-request':'1'}};
  const playlist=(await f.app.inject({method:'POST',url:'/api/playlists',...mutate,payload:{name:'Captured'}})).json();
  const saved=(await f.app.inject({method:'PUT',url:`/api/playlists/${playlist.id}/items`,...mutate,payload:{revision:1,items:[{renditionId:f.imported.rendition.id,playback:{mode:'duration',durationMs:30000}}]}})).json();
  const page=(await f.get('/catalog/playlists?limit=1')).json();expect(page).toMatchObject({total:1,limit:1,items:[{id:playlist.id,name:'Captured',revision:2,itemCount:1}]});
  const detail=await f.get(`/catalog/playlists/${playlist.id}`);expect(detail.statusCode,detail.body).toBe(200);expect(detail.json().playlist.items).toEqual(saved.items);expect(detail.json().catalogRevision).toBe(page.catalogRevision);
  const command=async(fields:Record<string,unknown>)=>{const player=(await f.app.inject('/api/player')).json();return f.app.inject({method:'POST',url:'/api/player/commands',...mutate,payload:{requestId:player.nextRequestId,...fields}});};
  expect((await command({command:'start',playlistId:playlist.id,revision:saved.revision})).statusCode).toBe(200);
  await vi.waitFor(async()=>expect((await f.get('/snapshot?apiVersion=pixoo-integration%2F1.1')).json().currentMedia).toMatchObject({renditionId:f.imported.rendition.id,playlistId:playlist.id,playlistRevision:2,itemIndex:0,itemCount:1,uncertain:false}));
  await f.app.inject({method:'PATCH',url:`/api/playlists/${playlist.id}`,...mutate,payload:{revision:2,name:'Edited after capture'}});
  expect((await f.get('/snapshot?apiVersion=pixoo-integration%2F1.1')).json().currentMedia.playlistRevision).toBe(2);
  expect((await command({command:'pause'})).statusCode).toBe(200);
  expect((await f.get('/snapshot?apiVersion=pixoo-integration%2F1.1')).json().currentMedia.intent).toBe('paused');
  expect((await command({command:'show-media',renditionId:f.imported.rendition.id})).statusCode).toBe(200);
  await vi.waitFor(async()=>expect((await f.get('/snapshot?apiVersion=pixoo-integration%2F1.1')).json().currentMedia).toMatchObject({playlistId:null,playlistRevision:null,renditionId:f.imported.rendition.id}));
 }finally{await f.close();}
});
it('keeps all 500 admitted frames and rejects a corrupt requested representation',async()=>{
 const f=await setup();try{
  const bytes=gifFixture(1,1,Array.from({length:500},(_,i)=>({width:1,height:1,pixels:[i%4],delay:2+i%3})));
  const upload=await f.app.inject({method:'POST',url:'/api/assets',...multipart(bytes,'full-allowance.gif')});expect(upload.statusCode,upload.body).toBe(201);
  const id=upload.json().rendition.id,manifest=(await f.get(`/renditions/${id}/preview.json`)).json();
  expect(manifest.frames).toHaveLength(500);expect(manifest.frameCount).toBe(500);
  const frame=await f.get(`/renditions/${id}/frames/499.png`);expect(frame.statusCode,frame.body).toBe(200);
  await writeFile(join(f.dir,'library/media/renditions',id,'499.png'),'broken');
  const corrupt=await f.get(`/renditions/${id}/frames/499.png`,{'if-none-match':String(frame.headers.etag)});
  expect(corrupt.statusCode).toBe(500);expect(corrupt.json().error.code).toBe('cache-corrupt');expect(corrupt.headers['cache-control']).toBe('no-store');
 }finally{await f.close();}
},15000);
it('checks cancellation after waiting for the library owner and before reading frames',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'catalog-cancel-')),library=await Library.open({directory:dir});
 let release=()=>{};const gate=new Promise<void>(resolve=>{release=resolve;});
 try{
  const bytes=gifFixture(1,1,[{width:1,height:1,pixels:[1]}]);
  const imported=await library.importMedia((async function*(){yield bytes;})(),'one');
  const held=library.importMedia((async function*(){await gate;yield bytes;})(),'one');
  const controller=new AbortController();
  const pending=library.preview(imported.rendition.id,0,controller.signal).catch(error=>error);
  controller.abort(new DOMException('deadline','TimeoutError'));release();await held;
  expect(await pending).toMatchObject({code:'timeout'});
 }finally{release();await library.close();await rm(dir,{recursive:true,force:true});}
});

it('reports transport uncertainty after a failed media upload instead of claiming visible output',async()=>{
 const f=await setup(true,true);try{
  const bytes=gifFixture(1,1,[{width:1,height:1,pixels:[1],delay:50}]);
  const upload=await f.app.inject({method:'POST',url:'/api/assets',...multipart(bytes,'smoke.gif')});expect(upload.statusCode,upload.body).toBe(201);
  const player=(await f.app.inject('/api/player')).json();
  const command=await f.app.inject({method:'POST',url:'/api/player/commands',headers:{'x-pixoo-request':'1'},payload:{requestId:player.nextRequestId,command:'show-media',renditionId:upload.json().rendition.id}});expect(command.statusCode,command.body).toBe(200);
  await vi.waitFor(async()=>expect((await f.get('/snapshot?apiVersion=pixoo-integration%2F1.1')).json().currentMedia).toMatchObject({renditionId:upload.json().rendition.id,uncertain:true,intent:'paused'}));
  const before=f.calls.length;await f.get('/catalog/renditions');await f.get(`/renditions/${upload.json().rendition.id}/preview.png`);expect(f.calls).toHaveLength(before);
 }finally{await f.close();}
});

it('previews persisted custom-profile renditions up to1000 frames and bounds large warning manifests',async()=>{
 const f=await setup(false,false,1000,true);try{
  const manifest=await f.get(`/renditions/${f.imported.rendition.id}/preview.json`);expect(manifest.statusCode,manifest.body).toBe(200);
  expect(manifest.json().frames).toHaveLength(1000);expect(manifest.json().warnings).toHaveLength(1000);
  expect(manifest.rawPayload.length).toBeGreaterThan(65536);expect(manifest.rawPayload.length).toBeLessThanOrEqual(128*1024);
  expect((await f.get(`/renditions/${f.imported.rendition.id}/frames/999.png`)).statusCode).toBe(200);
 }finally{await f.close();}
},20000);
