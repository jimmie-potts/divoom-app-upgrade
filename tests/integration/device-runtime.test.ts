import {afterEach,expect,it,vi} from 'vitest';
import {mkdtemp,writeFile,rm,mkdir,symlink,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {pathToFileURL} from 'node:url';
import {multipart} from '../helpers/http-api.js';
import {gifFixture} from '../helpers/media-fixtures.js';
import {createApp} from '../../apps/server/src/app.js';
import {loadConfig} from '../../apps/server/src/config.js';
import {sendJson} from '../../packages/device/dist/http-transport.js';
import {PIXOO64_SMOKE_PROFILE} from '@pixoo/media';
import {deviceServer} from '../helpers/http-device-server.js';
const headers={'x-pixoo-request':'1'};
const configuration={ip:'192.168.50.20',profile:'pixoo64-smoke-2026-09-06'} as const;
const cleanup:(()=>Promise<unknown>)[]=[];
afterEach(async()=>{for(const close of cleanup.splice(0).reverse())await close();});
async function directory(){const path=await mkdtemp(join(tmpdir(),'pixoo-runtime-'));cleanup.push(()=>rm(path,{recursive:true,force:true}));return path;}
async function settings(path:string,value:unknown=configuration){await writeFile(join(path,'device.json'),JSON.stringify({version:1,configuration:value}));}
async function appFixture(reply?:Parameters<typeof deviceServer>[0]){
 const dataDir=await directory(),deviceLockDirectoryForTests=await directory();await settings(dataDir);
 const server=await deviceServer(reply??((_body,res)=>res.end(JSON.stringify({error_code:0,SelectIndex:3,PicId:1,Brightness:30,LightSwitch:1}))));cleanup.push(()=>server.close());
 const app=createApp({dataDir,mode:'device',deviceLockDirectoryForTests,transportForTests:(body,signal)=>sendJson('127.0.0.1',server.port,body,signal)});cleanup.push(()=>app.close());
 return {app,server,dataDir,deviceLockDirectoryForTests};
}
it('requires explicit device mode and one immutable validated startup snapshot',async()=>{
 const dataDir=await directory(),context={root:join(dataDir,'source'),home:dataDir};await mkdir(context.root);
 await expect(loadConfig({PIXOO_DATA_DIR:dataDir,PIXOO_MODE:'device'},context)).rejects.toThrow();
 await settings(dataDir);
 const simulated=await loadConfig({PIXOO_DATA_DIR:dataDir},context);expect(simulated.mode).toBe('simulator');expect(simulated.activeConfiguration).toBeNull();
 const selected=await loadConfig({PIXOO_DATA_DIR:dataDir,PIXOO_MODE:'device'},context);
 expect(selected.activeConfiguration).toEqual(configuration);expect(Object.isFrozen(selected.activeConfiguration)).toBe(true);
 await settings(dataDir,{...configuration,ip:'192.168.50.21'});expect(selected.activeConfiguration).toEqual(configuration);
 await settings(dataDir,{...configuration,profile:'simulator-v1'});
 await expect(loadConfig({PIXOO_DATA_DIR:dataDir,PIXOO_MODE:'device'},context)).rejects.toThrow();
 await writeFile(join(dataDir,'device.json'),'invalid');
 await expect(loadConfig({PIXOO_DATA_DIR:dataDir},context)).rejects.toThrow();
});
it('keeps device connection unknown without requests and saves next-start settings without retargeting',async()=>{
 const {app,server}=await appFixture();
 expect((await app.inject('/api/device')).json()).toMatchObject({mode:'device',connected:null,availability:'unknown',configuration,activeConfiguration:configuration,restartRequired:false,activeProfile:PIXOO64_SMOKE_PROFILE});
 expect((await app.inject('/api/health')).json()).toMatchObject({mode:'device',device:{connected:null}});
 const diagnostics=await app.inject('/api/diagnostics');expect(diagnostics.json()).toMatchObject({mode:'device',device:{connected:null,availability:'unknown'}});expect(diagnostics.body).not.toContain(configuration.ip);
 expect(server.requests).toEqual([]);
 const saved={...configuration,ip:'192.168.50.21'};
 expect((await app.inject({method:'PUT',url:'/api/device',headers,payload:saved})).json()).toMatchObject({configuration:saved,activeConfiguration:configuration,restartRequired:true});expect(server.requests).toEqual([]);
 expect((await app.inject({method:'POST',url:'/api/device/probe',headers,payload:{}})).json()).toMatchObject({mode:'device',connected:true});
 expect((await app.inject('/api/device')).json().connected).toBe(true);
 expect(server.requests.map(r=>r.Command)).toEqual(['Channel/GetIndex','Channel/GetAllConf']);
 for(const control of [{brightness:20},{screenOn:false},{screenOn:true}]){
  const requestId=(await app.inject('/api/player')).json().nextRequestId;
  expect((await app.inject({method:'PATCH',url:'/api/device/display',headers,payload:{requestId,...control}})).statusCode).toBe(200);
 }
 expect(server.requests.map(r=>r.Command)).toEqual(['Channel/GetIndex','Channel/GetAllConf','Channel/SetBrightness','Channel/OnOffScreen','Channel/OnOffScreen']);
});
it('refuses a second backend for the same target across data directories and releases after close',async()=>{
 const {app,server,deviceLockDirectoryForTests}=await appFixture();await app.ready();
 const other=await directory();await settings(other);
 const options={dataDir:other,mode:'device' as const,deviceLockDirectoryForTests,transportForTests:async()=>({error_code:0})};
 const competing=createApp(options);cleanup.push(()=>competing.close());expect(await competing.ready().then(()=>'ready',(error:Error)=>error.message)).toContain('busy');
 expect(server.requests).toEqual([]);
 await app.close();const replacement=createApp(options);cleanup.push(()=>replacement.close());await replacement.ready();
});
it('uses the validated config snapshot even if settings change before application startup',async()=>{
 const dataDir=await directory(),deviceLockDirectoryForTests=await directory();await settings(dataDir);
 const runtime=await loadConfig({PIXOO_DATA_DIR:dataDir,PIXOO_MODE:'device'},{root:join(dataDir,'source')});
 await settings(dataDir,{...configuration,ip:'192.168.50.21'});
 const app=createApp({dataDir,runtime,deviceLockDirectoryForTests,transportForTests:async()=>({error_code:0})});cleanup.push(()=>app.close());
 expect((await app.inject('/api/device')).json()).toMatchObject({activeConfiguration:configuration,configuration});
});
it('applies smoke limits at import and uploads complete frames before a queued brightness control',async()=>{
 let release=()=>{};
 const {app,server}=await appFixture((body,res)=>{
  if(body.Command==='Draw/SendHttpGif'&&body.PicOffset===0)release=()=>res.end('{"error_code":0}');
  else res.end(JSON.stringify({error_code:0,PicId:1}));
 });
 cleanup.push(async()=>{release();});
 const invalid=await app.inject({method:'POST',url:'/api/assets',...multipart(gifFixture(1,1,[{width:1,height:1,pixels:[1],delay:10}]))});
 expect(invalid.statusCode).toBe(422);expect(server.requests).toEqual([]);
 const uploaded=await app.inject({method:'POST',url:'/api/assets',...multipart(gifFixture(1,1,[{width:1,height:1,pixels:[1],delay:50},{width:1,height:1,pixels:[2],delay:50}]))});
 expect(uploaded.statusCode).toBe(201);expect(uploaded.json().rendition.profile).toEqual(PIXOO64_SMOKE_PROFILE);
 const {asset,rendition}=uploaded.json();
 const rerender=await app.inject({method:'POST',url:`/api/assets/${asset.id}/renditions`,headers,payload:{transform:{fit:'crop',scaling:'nearest',background:[1,2,3]}}});
 expect(rerender.statusCode).toBe(200);expect(rerender.json().rendition.profile).toEqual(PIXOO64_SMOKE_PROFILE);
 const playlist=(await app.inject({method:'POST',url:'/api/playlists',headers,payload:{name:'Smoke'}})).json();
 await app.inject({method:'PUT',url:`/api/playlists/${playlist.id}/items`,headers,payload:{revision:1,items:[{renditionId:rendition.id}]}});
 const requestId=(await app.inject('/api/player')).json().nextRequestId;
 expect((await app.inject({method:'POST',url:'/api/player/commands',headers,payload:{requestId,command:'start',playlistId:playlist.id}})).statusCode).toBe(200);
 await vi.waitFor(()=>expect(server.requests.some(r=>r.Command==='Draw/SendHttpGif')).toBe(true));
 const controlId=(await app.inject('/api/player')).json().nextRequestId;
 const control=app.inject({method:'PATCH',url:'/api/device/display',headers,payload:{requestId:controlId,brightness:25}}).then(response=>response);
 await vi.waitFor(async()=>expect((await app.inject('/api/player')).json().nextRequestId).not.toBe(controlId));
 expect(server.requests.map(r=>r.Command)).toEqual(['Draw/GetHttpGifId','Draw/SendHttpGif']);release();
 expect((await control).statusCode).toBe(200);
 expect(server.requests.map(r=>r.Command)).toEqual(['Draw/GetHttpGifId','Draw/SendHttpGif','Draw/SendHttpGif','Channel/SetBrightness']);
 expect(server.requests.filter(r=>r.Command==='Draw/SendHttpGif')).toMatchObject([{PicNum:2,PicOffset:0,PicSpeed:500},{PicNum:2,PicOffset:1,PicSpeed:500}]);
});
it('holds target ownership until cancelled in-flight transport has settled without shutdown writes',async()=>{
 const dataDir=await directory(),deviceLockDirectoryForTests=await directory();await settings(dataDir);
 let release!:()=>void,entered!:()=>void;
 const waiting=new Promise<void>(resolve=>{release=resolve;}),started=new Promise<void>(resolve=>{entered=resolve;});
 const requests:string[]=[];let requestSignal:AbortSignal|undefined;
 const app=createApp({dataDir,mode:'device',deviceLockDirectoryForTests,transportForTests:async(body,signal)=>{
  requests.push(String(body.Command));if(body.Command==='Draw/SendHttpGif'){requestSignal=signal;entered();await waiting;}return {error_code:0,PicId:1};
 }});cleanup.push(()=>app.close());cleanup.push(async()=>{release();});
 const uploaded=(await app.inject({method:'POST',url:'/api/assets',...multipart(gifFixture(1,1,[{width:1,height:1,pixels:[1],delay:50},{width:1,height:1,pixels:[2],delay:50}]))})).json();
 const playlist=(await app.inject({method:'POST',url:'/api/playlists',headers,payload:{name:'Drain'}})).json();
 await app.inject({method:'PUT',url:`/api/playlists/${playlist.id}/items`,headers,payload:{revision:1,items:[{renditionId:uploaded.rendition.id}]}});
 const requestId=(await app.inject('/api/player')).json().nextRequestId;
 await app.inject({method:'POST',url:'/api/player/commands',headers,payload:{requestId,command:'start',playlistId:playlist.id}});await started;
 let closed=false;const closing=app.close().then(()=>{closed=true;});
 await vi.waitFor(()=>expect(requestSignal?.aborted).toBe(true));expect(closed).toBe(false);
 const other=await directory();await settings(other);
 const options={dataDir:other,mode:'device' as const,deviceLockDirectoryForTests,transportForTests:async()=>({error_code:0})};
 const competing=createApp(options);cleanup.push(()=>competing.close());expect(await competing.ready().then(()=>'ready',(error:Error)=>error.message)).toContain('busy');
 release();await closing;expect(requests).toEqual(['Draw/GetHttpGifId','Draw/SendHttpGif']);
 const replacement=createApp(options);cleanup.push(()=>replacement.close());await replacement.ready();
});
it('enforces target ownership across processes and permits recovery after owner exit',async()=>{
 const dataDir=await directory(),deviceLockDirectoryForTests=await directory();await settings(dataDir);
 const module=pathToFileURL(resolve('apps/server/dist/app.js')).href;
 const child=spawn(process.execPath,['--input-type=module','-e',`
  import {createApp} from ${JSON.stringify(module)};
  const app=createApp({dataDir:${JSON.stringify(dataDir)},mode:'device',deviceLockDirectoryForTests:${JSON.stringify(deviceLockDirectoryForTests)},transportForTests:async()=>({error_code:0})});
  await app.ready();process.send('ready');setInterval(()=>{},1000);
 `],{stdio:['ignore','ignore','pipe','ipc']});
 const stop=async()=>{if(child.exitCode===null&&child.signalCode===null){const exited=once(child,'exit');child.kill('SIGKILL');await exited;}};cleanup.push(stop);
 await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Child readiness deadline')),5000);
  child.once('message',()=>{clearTimeout(timer);resolve();});child.once('error',error=>{clearTimeout(timer);reject(error);});child.once('exit',code=>{clearTimeout(timer);reject(new Error(`Child exited: ${code}`));});
 });
 const other=await directory();await settings(other);
 const options={dataDir:other,mode:'device' as const,deviceLockDirectoryForTests,transportForTests:async()=>({error_code:0})};
 const competing=createApp(options);cleanup.push(()=>competing.close());expect(await competing.ready().then(()=>'ready',(error:Error)=>error.message)).toContain('busy');
 const different=await directory();await settings(different,{...configuration,ip:'192.168.50.21'});
 const independent=createApp({...options,dataDir:different});cleanup.push(()=>independent.close());await independent.ready();
 await stop();const replacement=createApp(options);cleanup.push(()=>replacement.close());await replacement.ready();
});
it('keeps saved hardware settings in simulator mode without using an injected transport',async()=>{
 const dataDir=await directory();await settings(dataDir);let requests=0;
 const app=createApp({dataDir,transportForTests:async()=>{requests++;throw new Error('Simulator contacted device');}});cleanup.push(()=>app.close());
 expect((await app.inject('/api/device')).json()).toMatchObject({mode:'simulator',configuration,activeConfiguration:null,connected:false});
 expect((await app.inject({method:'POST',url:'/api/device/probe',headers,payload:{}})).json()).toMatchObject({mode:'simulator',available:true,connected:false});
 const requestId=(await app.inject('/api/player')).json().nextRequestId;
 expect((await app.inject({method:'PATCH',url:'/api/device/display',headers,payload:{requestId,brightness:10}})).statusCode).toBe(200);expect(requests).toBe(0);
});
it.each(['missing','malformed','oversized','symlink','public-target','unsupported-profile'])('rejects %s settings before acquiring ownership or creating the library',async invalid=>{
 const dataDir=await directory(),deviceLockDirectoryForTests=await directory();
 if(invalid==='malformed')await writeFile(join(dataDir,'device.json'),'broken');
 if(invalid==='oversized')await writeFile(join(dataDir,'device.json'),' '.repeat(4097));
 if(invalid==='public-target')await settings(dataDir,{...configuration,ip:'8.8.8.8'});
 if(invalid==='unsupported-profile')await settings(dataDir,{...configuration,profile:'simulator-v1'});
 if(invalid==='symlink'){const target=join(dataDir,'actual.json');await writeFile(target,JSON.stringify({version:1,configuration}));await symlink(target,join(dataDir,'device.json'));}
 let requests=0;
 const app=createApp({dataDir,mode:'device',deviceLockDirectoryForTests,transportForTests:async()=>{requests++;return {error_code:0};}});cleanup.push(()=>app.close());
 expect(await app.ready().then(()=>true,()=>false)).toBe(false);expect(requests).toBe(0);expect(await readdir(deviceLockDirectoryForTests)).toEqual([]);expect(await readdir(dataDir)).not.toContain('library');
});
it('releases target ownership when opening the library fails',async()=>{
 const dataDir=await directory(),deviceLockDirectoryForTests=await directory();await settings(dataDir);await writeFile(join(dataDir,'library'),'not a directory');
 const options={dataDir,mode:'device' as const,deviceLockDirectoryForTests,transportForTests:async()=>({error_code:0})};
 const failed=createApp(options);cleanup.push(()=>failed.close());expect(await failed.ready().then(()=>true,()=>false)).toBe(false);
 const other=await directory();await settings(other);
 const working=createApp({...options,dataDir:other});cleanup.push(()=>working.close());await working.ready();
});
it('persists a possible physical write paused across application restart and resumes only on fresh intent',async()=>{
 let fail=true;
 const {app,server,dataDir,deviceLockDirectoryForTests}=await appFixture((body,res)=>{
  if(fail&&body.Command==='Draw/SendHttpGif'){fail=false;res.destroy();}
  else res.end(JSON.stringify({error_code:0,PicId:1}));
 });
 const uploaded=(await app.inject({method:'POST',url:'/api/assets',...multipart(gifFixture(1,1,[{width:1,height:1,pixels:[1],delay:50}]))})).json();
 const playlist=(await app.inject({method:'POST',url:'/api/playlists',headers,payload:{name:'Uncertain'}})).json();
 await app.inject({method:'PUT',url:`/api/playlists/${playlist.id}/items`,headers,payload:{revision:1,items:[{renditionId:uploaded.rendition.id}]}});
 const requestId=(await app.inject('/api/player')).json().nextRequestId;
 await app.inject({method:'POST',url:'/api/player/commands',headers,payload:{requestId,command:'start',playlistId:playlist.id}});
 await vi.waitFor(async()=>expect((await app.inject('/api/player')).json().player).toMatchObject({state:'paused',intent:'paused',lastError:{code:'offline',priorEffects:'possible'}}));
 expect((await app.inject('/api/device')).json().connected).toBe(false);
 expect(server.requests.map(r=>r.Command)).toEqual(['Draw/GetHttpGifId','Draw/SendHttpGif']);
 await app.close();
 const reopened=createApp({dataDir,mode:'device',deviceLockDirectoryForTests,transportForTests:(body,signal)=>sendJson('127.0.0.1',server.port,body,signal)});cleanup.push(()=>reopened.close());
 const restored=(await reopened.inject('/api/player')).json();
 expect(restored.player).toMatchObject({state:'paused',intent:'paused',lastError:{code:'offline',priorEffects:'possible'}});
 expect((await reopened.inject('/api/device')).json().connected).toBeNull();
 expect(server.requests.map(r=>r.Command)).toEqual(['Draw/GetHttpGifId','Draw/SendHttpGif']);
 expect((await reopened.inject({method:'POST',url:'/api/player/commands',headers,payload:{requestId:restored.nextRequestId,command:'resume'}})).statusCode).toBe(200);
 await vi.waitFor(async()=>expect((await reopened.inject('/api/player')).json().player).toMatchObject({state:'playing',lastError:null}));
 expect(server.requests.map(r=>r.Command)).toEqual(['Draw/GetHttpGifId','Draw/SendHttpGif','Draw/GetHttpGifId','Draw/SendHttpGif']);
});
