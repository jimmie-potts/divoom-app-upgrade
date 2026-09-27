import {afterEach,expect,it} from 'vitest';
import {execFile} from 'node:child_process';
import {mkdir,rm} from 'node:fs/promises';
import {createServer} from 'node:net';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {promisify} from 'node:util';
import {checkNoPhysicalTransport} from '../../scripts/verify/readiness.ts';
import {launchSpec} from '../../scripts/verify/run-environment.ts';
import {PLAYLIST,seedScenario} from '../../scripts/verify/scenarios.ts';
import {launch,makeRun,type LaunchedRun} from '../helpers/verify-run.js';

const cleanup:(()=>Promise<unknown>)[]=[];
afterEach(async()=>{for(const close of cleanup.splice(0).reverse())await close();});
const header={'x-pixoo-request':'1','content-type':'application/json'};
const names=async(url:string)=>(await (await fetch(new URL('/api/playlists',url))).json() as {name:string}[]).map(p=>p.name).sort();
async function started(scenario:string,port=0){
 const run=await makeRun(`pixoo-20260927T000000Z-${Math.random().toString(16).slice(2,8)}`);cleanup.push(run.remove);
 await seedScenario({...run,scenario});
 const server=await launch(launchSpec({...run,port,node:process.execPath}),{...process.env,PIXOO_MODE:'device'});cleanup.push(()=>server.stop());
 return {...run,server};
}
/** What the core does for `scenario` and `handoff --reset`: stop, empty data/, seed, relaunch on the recorded port. */
async function reseed(run:Awaited<ReturnType<typeof started>>,scenario:string):Promise<LaunchedRun> {
 const port=run.server.port;await run.server.stop();
 await rm(run.dataDir,{recursive:true,force:true});await mkdir(run.dataDir,{mode:0o700});
 await seedScenario({...run,scenario});
 const server=await launch(launchSpec({...run,port,node:process.execPath}),{...process.env,PIXOO_MODE:'device'});cleanup.push(()=>server.stop());
 return server;
}

it('loads every plug-in module under plain Node type stripping and registers its scenarios, checks and steps',async()=>{
 const script=`const p=(await import(${JSON.stringify(pathToFileURL(join(process.cwd(),'scripts/verify/plugin.ts')).href)})).default;
  console.log(JSON.stringify({app:p.app,defaultScenario:p.defaultScenario,scenarios:Object.keys(p.scenarios),checks:p.checks.map(c=>c.id),steps:Object.keys(p.captureSteps),
   components:p.components.map(c=>c.id+':'+c.kind),artifact:p.build.artifact,version:p.build.version}));`;
 const {stdout}=await promisify(execFile)(process.execPath,['--input-type=module','-e',script],{env:{PATH:process.env.PATH},timeout:20000});
 expect(JSON.parse(stdout)).toEqual({app:'pixoo',defaultScenario:'library-playlist',scenarios:['library-playlist','empty'],checks:['simulator-mode','no-physical-transport'],
  steps:['library-selection','playlist-progression','playback-controls','monitor-media','lost-response-recovery','device-boundary','control-wrong-frame','control-duplicate-next','control-select-media-resumes','control-retry-new-identity'],
  components:['pixoo-server:actual','web-ui:actual','device-transport:simulated','media:simulated','agent-sessions:simulated'],artifact:{route:'/'},version:'0.0.0'});
});

it('keeps two concurrent runs apart and reseeds one on its recorded port without touching the other',async()=>{
 const first=await started('library-playlist'),second=await started('library-playlist');
 expect(first.server.port).not.toBe(second.server.port);
 expect(await (await fetch(new URL('/api/playlists',first.server.url),{method:'POST',headers:header,body:JSON.stringify({name:'Only in the first run'})})).status).toBe(201);
 expect(await names(first.server.url)).toEqual(['Only in the first run',PLAYLIST]);
 expect(await names(second.server.url)).toEqual([PLAYLIST]);
 const reseeded=await reseed(first,'empty');
 expect(reseeded.port).toBe(first.server.port);
 expect(await names(reseeded.url)).toEqual([]);
 expect(await names(second.server.url)).toEqual([PLAYLIST]);
 const ctx=(run:typeof first,server:LaunchedRun)=>({...run,url:server.url,port:server.port});
 expect(await checkNoPhysicalTransport(ctx(first,reseeded))).toEqual({outcome:'passed'});
 expect(await checkNoPhysicalTransport(ctx(second,second.server))).toEqual({outcome:'passed'});
});

it('fails a relaunch on an occupied recorded port and names the port',async()=>{
 const blocker=createServer();await new Promise<void>(resolve=>blocker.listen(0,'127.0.0.1',resolve));cleanup.push(()=>new Promise(resolve=>blocker.close(resolve)));
 const port=(blocker.address() as {port:number}).port;
 await expect(started('empty',port)).rejects.toThrow(new RegExp(`exited 1: .*EADDRINUSE.*${port}`));
});
