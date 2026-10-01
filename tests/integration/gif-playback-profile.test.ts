import {afterEach,expect,it,vi} from 'vitest';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../../apps/server/src/app.js';
import {gifFixture} from '../helpers/media-fixtures.js';
import {multipart} from '../helpers/http-api.js';
import {canonicalProfile,PIXOO64_GIF_PROFILE,PIXOO64_SMOKE_PROFILE} from '../../packages/media/src/contracts.js';
const cleanup:(()=>Promise<unknown>)[]=[];
afterEach(async()=>{for(const close of cleanup.splice(0).reverse())await close();});
const headers={'x-pixoo-request':'1'};
it('explicitly selects the observed GIF profile and preserves all admitted frames while rejecting outside bounds before replacement',async()=>{
 const dataDir=await mkdtemp(join(tmpdir(),'gif-profile-'));cleanup.push(()=>rm(dataDir,{recursive:true,force:true}));
 const deviceLockDirectoryForTests=await mkdtemp(join(tmpdir(),'gif-lock-'));cleanup.push(()=>rm(deviceLockDirectoryForTests,{recursive:true,force:true}));
 await writeFile(join(dataDir,'device.json'),JSON.stringify({version:1,configuration:{ip:'192.168.50.20',profile:'pixoo64-gif-2026-09-30'}}));
 const requests:Record<string,unknown>[]=[];
 const app=createApp({dataDir,mode:'device',deviceLockDirectoryForTests,transportForTests:async body=>{requests.push(body);return {error_code:0,PicId:1};}});cleanup.push(()=>app.close());
 const device=await app.inject('/api/device');expect(device.statusCode).toBe(200);
 expect(device.json().activeProfile).toMatchObject({name:'pixoo64-gif-2026-09-30',maxFrames:20,minDelayMs:100,maxDelayMs:800,uniformTiming:false});
 expect(requests).toEqual([]);
 const imported=async(delays:number[])=>{
  const response=await app.inject({method:'POST',url:'/api/assets',...multipart(gifFixture(1,1,delays.map((delay,i)=>({width:1,height:1,pixels:[i%4],delay:delay/10}))))});
  expect(response.statusCode).toBe(201);expect(response.json().rendition.profile.name).toBe('simulator-v1');return response.json().rendition;
 };
 const delays=Array.from({length:20},(_,i)=>[100,200,500,800][i%4]!);
 const rendition=await imported(delays);expect(requests).toEqual([]);
 const playlist=(await app.inject({method:'POST',url:'/api/playlists',headers,payload:{name:'Qualified GIF'}})).json();
 await app.inject({method:'PUT',url:`/api/playlists/${playlist.id}/items`,headers,payload:{revision:1,items:[{renditionId:rendition.id}]}});
 const command=async(payload:Record<string,unknown>)=>app.inject({method:'POST',url:'/api/player/commands',headers,payload:{requestId:(await app.inject('/api/player')).json().nextRequestId,...payload}});
 expect((await command({command:'start',playlistId:playlist.id})).statusCode).toBe(200);
 await vi.waitFor(async()=>expect((await app.inject('/api/player')).json().player.state).toBe('playing'));
 const frames=requests.filter(r=>r.Command==='Draw/SendHttpGif');expect(frames).toHaveLength(20);
 expect(frames.map(r=>r.PicSpeed)).toEqual(delays);expect(frames.map(r=>r.PicOffset)).toEqual(delays.map((_,i)=>i));expect(frames.every(r=>r.PicNum===20)).toBe(true);
 const session=(await app.inject('/api/player')).json().session;
 for(const invalidDelays of [Array<number>(21).fill(100),[50],[810]]){
  const invalid=await imported(invalidDelays);const before=requests.length;
  const replacement=await command({command:'show-media',renditionId:invalid.id});
  expect(replacement.statusCode).toBe(422);expect(replacement.json().error.code).toBe('profile-limit');
  expect(requests).toHaveLength(before);expect((await app.inject('/api/player')).json().session).toEqual(session);
 }
 await command({command:'stop'});
 const saved=await app.inject({method:'PUT',url:'/api/device',headers,payload:{ip:'192.168.50.20',profile:PIXOO64_SMOKE_PROFILE.name}});
 expect(saved.json()).toMatchObject({activeProfile:PIXOO64_GIF_PROFILE,restartRequired:true});
 await app.close();const before=requests.length;
 const reopened=createApp({dataDir,mode:'device',deviceLockDirectoryForTests,transportForTests:async body=>{requests.push(body);return {error_code:0};}});cleanup.push(()=>reopened.close());
 expect((await reopened.inject('/api/device')).json()).toMatchObject({activeProfile:PIXOO64_SMOKE_PROFILE,restartRequired:false});
 expect((await reopened.inject('/api/player')).json().player.state).toBe('paused');expect(requests).toHaveLength(before);
});
it('accepts only the exact shipped evidence for each observed profile',()=>{
 for(const profile of [PIXOO64_SMOKE_PROFILE,PIXOO64_GIF_PROFILE]){
  expect(canonicalProfile(profile)).toEqual(profile);
  expect(()=>canonicalProfile({...profile,maxFrames:21})).toThrow();
  expect(()=>canonicalProfile({...profile,minDelayMs:10})).toThrow();
 }
});
it('stopping a twenty-frame upload aborts the in-flight frame and submits no later frames',async()=>{
 const dataDir=await mkdtemp(join(tmpdir(),'gif-stop-'));cleanup.push(()=>rm(dataDir,{recursive:true,force:true}));
 const deviceLockDirectoryForTests=await mkdtemp(join(tmpdir(),'gif-lock-'));cleanup.push(()=>rm(deviceLockDirectoryForTests,{recursive:true,force:true}));
 await writeFile(join(dataDir,'device.json'),JSON.stringify({version:1,configuration:{ip:'192.168.50.20',profile:PIXOO64_GIF_PROFILE.name}}));
 const requests:Record<string,unknown>[]=[];let requestSignal:AbortSignal|undefined;
 let release!:()=>void;const waiting=new Promise<void>(resolve=>{release=resolve;});
 const app=createApp({dataDir,mode:'device',deviceLockDirectoryForTests,transportForTests:async(body,signal)=>{requests.push(body);if(body.Command==='Draw/SendHttpGif'){requestSignal=signal;await waiting;}return {error_code:0,PicId:1};}});
 cleanup.push(()=>app.close());cleanup.push(async()=>{release();});
 const rendition=(await app.inject({method:'POST',url:'/api/assets',...multipart(gifFixture(1,1,Array.from({length:20},()=>({width:1,height:1,pixels:[1],delay:10}))))})).json().rendition;
 const command=async(command:string)=>app.inject({method:'POST',url:'/api/player/commands',headers,payload:{requestId:(await app.inject('/api/player')).json().nextRequestId,command,...(command==='show-media'?{renditionId:rendition.id}:{})}});
 expect((await command('show-media')).statusCode).toBe(200);
 await vi.waitFor(()=>expect(requestSignal).toBeDefined());
 const stopping=command('stop');await vi.waitFor(()=>expect(requestSignal!.aborted).toBe(true));release();
 expect((await stopping).statusCode).toBe(200);await app.close();
 expect(requests.map(r=>r.Command)).toEqual(['Draw/GetHttpGifId','Draw/SendHttpGif']);
});
