import {afterEach,expect,it} from 'vitest';
import {execFile} from 'node:child_process';
import {mkdtemp,readdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {promisify} from 'node:util';
import {checkNoPhysicalTransport,checkSimulatorMode,probeHealth,readTransportLog} from '../../scripts/verify/readiness.ts';
import {launchSpec,transportGuard,transportLog} from '../../scripts/verify/run-environment.ts';
import {seedScenario} from '../../scripts/verify/scenarios.ts';
import {launch,makeRun,type LaunchedRun} from '../helpers/verify-run.js';

const cleanup:(()=>Promise<unknown>)[]=[];
afterEach(async()=>{for(const close of cleanup.splice(0).reverse())await close();});
async function temporary(prefix:string){const path=await mkdtemp(join(tmpdir(),prefix));cleanup.push(()=>rm(path,{recursive:true,force:true}));return path;}
function started(run:LaunchedRun){cleanup.push(()=>run.stop());return run;}
const header={'x-pixoo-request':'1','content-type':'application/json'};
async function command(url:string,body:Record<string,unknown>){
 const {nextRequestId}=await (await fetch(new URL('/api/player',url))).json() as {nextRequestId:string};
 const response=await fetch(new URL('/api/player/commands',url),{method:'POST',headers:header,body:JSON.stringify({requestId:nextRequestId,...body})});
 expect(response.status).toBe(200);
}
/**
 * The owner's shell selects device mode, a real data directory and the
 * installed port, and the run's own data holds a saved device target, as
 * after Save configuration in Settings. A leak of any of these would reach
 * the owner's state or the device.
 */
async function hostileRun(){
 const ownerHome=await temporary('verify-owner-home-'),ownerData=await temporary('verify-owner-data-');
 const run=await makeRun();cleanup.push(run.remove);
 await seedScenario({...run,scenario:'library-playlist'},{home:ownerHome,ambient:{PIXOO_DATA_DIR:ownerData}});
 await writeFile(join(run.dataDir,'device.json'),JSON.stringify({version:1,configuration:{ip:'192.168.255.254',profile:'pixoo64-smoke-2026-09-06'}}));
 const ambient={...process.env,HOME:ownerHome,TMPDIR:join(run.runtimeDir,'tmp'),PIXOO_MODE:'device',PIXOO_DATA_DIR:ownerData,PIXOO_PORT:'8787',NODE_OPTIONS:''};
 return {...run,ownerHome,ownerData,ambient,spec:launchSpec({...run,port:0,node:process.execPath})};
}
const context=(run:{runId:string;root:string;runtimeDir:string;dataDir:string},url:string)=>({...run,scenario:'library-playlist',url,port:Number(new URL(url).port),signal:AbortSignal.timeout(5000)});

it('keeps a run in simulator mode under ambient device settings and records no physical transport while driving playback',async()=>{
 const run=await hostileRun();
 const server=started(await launch(run.spec,run.ambient));
 const ctx=context(run,server.url);
 expect(await probeHealth(ctx)).toEqual({ok:true});
 expect(await checkSimulatorMode(ctx)).toEqual({outcome:'passed'});
 const playlists=await (await fetch(new URL('/api/playlists',server.url))).json() as {id:string}[];
 await command(server.url,{command:'start',playlistId:playlists[0]!.id});
 await command(server.url,{command:'next'});
 const probe=await fetch(new URL('/api/device/probe',server.url),{method:'POST',headers:header,body:'{}'});
 expect(await probe.json()).toMatchObject({mode:'simulator',connected:false});
 expect(await checkNoPhysicalTransport(ctx)).toEqual({outcome:'passed'});
 expect(await readTransportLog(transportLog(run.runtimeDir))).toMatchObject({blocked:[],listening:[{pid:server.child.pid,port:server.port}]});
 expect(await readdir(run.ownerData)).toEqual([]);
 expect(await readdir(run.ownerHome)).toEqual([]);
});

it('negative control: a launch that loses its simulator setting never starts, even with a saved device target',async()=>{
 const run=await hostileRun();
 const leaked={...run.spec,env:{...run.spec.env}};delete (leaked.env as Record<string,string|undefined>).PIXOO_MODE;
 await expect(launch(leaked,run.ambient)).rejects.toThrow(/exited 1: .*PIXOO_MODE=simulator/);
 expect(await readTransportLog(transportLog(run.runtimeDir))).toMatchObject({blocked:[],listening:[]});
});

it('negative control: the guard observes and blocks the physical transport path and any other outbound connection',async()=>{
 const runtimeDir=await temporary('verify-guard-'),log=transportLog(runtimeDir);
 const script=`
  import {createDeviceTransport} from ${JSON.stringify(pathToFileURL(join(process.cwd(),'packages/device/dist/http-transport.js')).href)};
  const outcomes=[];
  for (const attempt of [
   ()=>createDeviceTransport('192.168.255.254')({Command:'Channel/GetIndex'},AbortSignal.timeout(2000)),
   ()=>fetch('http://10.255.255.254:8080/post',{signal:AbortSignal.timeout(2000)}),
  ]) { try { await attempt(); outcomes.push('sent'); } catch { outcomes.push('refused'); } }
  console.log(JSON.stringify(outcomes));`;
 const {stdout}=await promisify(execFile)(process.execPath,['--import',pathToFileURL(transportGuard).href,'--input-type=module','-e',script],
  {env:{PATH:process.env.PATH,PIXOO_MODE:'simulator',APP_VERIFY_TRANSPORT_LOG:log},timeout:10000});
 expect(JSON.parse(stdout)).toEqual(['refused','refused']);
 const record=await readTransportLog(log);
 expect(record.blocked).toEqual([expect.objectContaining({api:'http.request',host:'192.168.255.254',port:80}),expect.objectContaining({api:'net.connect',host:'10.255.255.254',port:8080})]);
 const ctx={runId:'r',root:process.cwd(),runtimeDir,dataDir:join(runtimeDir,'data'),scenario:'library-playlist',url:'http://127.0.0.1:1/',port:1,signal:AbortSignal.timeout(1000)};
 expect(await checkNoPhysicalTransport(ctx)).toMatchObject({outcome:'failed',reason:expect.stringMatching(/2 physical transport attempts/)});
});

it('refuses to start the server when the transport guard has no log',async()=>{
 const run=await hostileRun();
 const spec={...run.spec,env:{...run.spec.env}};delete (spec.env as Record<string,string|undefined>).APP_VERIFY_TRANSPORT_LOG;
 await expect(launch(spec,run.ambient)).rejects.toThrow(/exited 1: .*APP_VERIFY_TRANSPORT_LOG/);
});
