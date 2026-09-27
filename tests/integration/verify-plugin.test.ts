import {afterEach,expect,it} from 'vitest';
import {execFile} from 'node:child_process';
import {mkdir,mkdtemp,readFile,readdir,rm,stat,writeFile} from 'node:fs/promises';
import {createServer} from 'node:net';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {promisify} from 'node:util';
import {checkNoPhysicalTransport,failureCause} from '../../scripts/verify/readiness.ts';
import {launchSpec} from '../../scripts/verify/run-environment.ts';
import {PLAYLIST,seedScenario} from '../../scripts/verify/scenarios.ts';
import {launch,makeRun,StartError,type LaunchedRun} from '../helpers/verify-run.js';

const cleanup:(()=>Promise<unknown>)[]=[];
afterEach(async()=>{for(const close of cleanup.splice(0).reverse())await close();});
/** These tests start real server processes; CI hosts need more than the 5 s default. */
const SPAWNS=30000;
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

it('loads every plug-in module under plain Node type stripping and registers its scenarios, inputs, checks, steps and fresh flags',async()=>{
 const script=`const p=(await import(${JSON.stringify(pathToFileURL(join(process.cwd(),'scripts/verify/plugin.ts')).href)})).default;
  console.log(JSON.stringify({app:p.app,defaultScenario:p.defaultScenario,scenarios:Object.keys(p.scenarios),checks:p.checks.map(c=>c.id+(c.doctor?':doctor':'')),steps:Object.keys(p.captureSteps),
   inputs:Object.fromEntries(Object.entries(p.inputs).map(([name,input])=>[name,input.required??false])),
   required:Object.fromEntries(Object.entries(p.scenarios).map(([name,scenario])=>[name,scenario.requiredInputs??[]])),
   fresh:Object.entries(p.captureSteps).filter(([,step])=>step.fresh).map(([name])=>name),
   pinned:Object.fromEntries(Object.entries(p.captureSteps).map(([name,step])=>[name,step.scenario??null])),
   cause:typeof p.readiness.failureCause,
   components:p.components.map(c=>c.id+':'+c.kind),artifact:p.build.artifact,version:p.build.version}));`;
 const {stdout}=await promisify(execFile)(process.execPath,['--input-type=module','-e',script],{env:{PATH:process.env.PATH},timeout:20000});
 const standalone='library-playlist';
 expect(JSON.parse(stdout)).toEqual({app:'pixoo',defaultScenario:'library-playlist',scenarios:['library-playlist','empty','hub-paired'],checks:['simulator-mode:doctor','no-physical-transport:doctor','hub-feed:doctor'],
  steps:['library-selection','playlist-progression','playback-controls','monitor-media','lost-response-recovery','hub-sessions','device-boundary','control-wrong-frame','control-duplicate-next','control-select-media-resumes','control-hub-feed-stale','control-retry-new-identity'],
  inputs:{'hub-feed':false},required:{'library-playlist':[],empty:[],'hub-paired':['hub-feed']},
  fresh:['playlist-progression','playback-controls','monitor-media','lost-response-recovery','control-wrong-frame','control-duplicate-next','control-select-media-resumes','control-hub-feed-stale','control-retry-new-identity'],
  pinned:{'library-selection':standalone,'playlist-progression':standalone,'playback-controls':standalone,'monitor-media':standalone,'lost-response-recovery':standalone,'hub-sessions':'hub-paired','device-boundary':null,
   'control-wrong-frame':standalone,'control-duplicate-next':standalone,'control-select-media-resumes':standalone,'control-hub-feed-stale':'hub-paired','control-retry-new-identity':standalone},
  cause:'function',
  components:['pixoo-server:actual','web-ui:actual','controller-api:actual','device-transport:simulated','media:simulated','agent-sessions:simulated'],artifact:{route:'/'},version:'0.0.0'});
},SPAWNS);

it('announces the controller endpoint from a hub-paired launch onward, and never before',async()=>{
 const {default:plugin}=await import('../../scripts/verify/plugin.ts');
 const run=await makeRun();cleanup.push(run.remove);
 const line='Pixoo simulator listening on http://127.0.0.1:41705',node=process.execPath,inputs={'hub-feed':'http://127.0.0.1:41999/'};
 const announce=async(scenario:string,endpointPorts:Record<string,number>)=>{
  await plugin.launch({...run,port:41705,node,scenario,inputs,endpointPorts});
  return plugin.readiness.line(line);
 };
 expect(await announce('library-playlist',{})).toEqual({url:'http://127.0.0.1:41705/'});
 const paired=await announce('hub-paired',{});
 expect(paired).toEqual({url:'http://127.0.0.1:41705/',endpoints:{controller:'http://127.0.0.1:41705/'}});
 // The core holds a recorded endpoint to its port, so every later scenario of that run announces it again.
 expect(await announce('library-playlist',{controller:41705})).toEqual(paired);
 expect(await announce('empty',{controller:41705})).toEqual(paired);
 expect(plugin.readiness.line('Pixoo device listening on http://127.0.0.1:41705')).toBeUndefined();
},SPAWNS);

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
},SPAWNS);

it('fails a relaunch on an occupied recorded port and names the cause',async()=>{
 const blocker=createServer();await new Promise<void>(resolve=>blocker.listen(0,'127.0.0.1',resolve));cleanup.push(()=>new Promise(resolve=>blocker.close(resolve)));
 const port=(blocker.address() as {port:number}).port;
 const failed=await started('empty',port).then(()=>undefined,(caught:unknown)=>caught);
 expect(failed).toBeInstanceOf(StartError);
 expect((failed as StartError).message).toMatch(new RegExp(`exited 1: .*EADDRINUSE.*${port}`));
 expect(failureCause((failed as StartError).stderr.join('\n'))).toBe('pixoo-start-failed: port in use');
},SPAWNS);

it('leaves only a disabled, digest-only seed credential in the monitor store',async()=>{
 for(const scenario of ['library-playlist','empty']){
  const run=await makeRun(`pixoo-20260927T000000Z-${Math.random().toString(16).slice(2,8)}`);cleanup.push(run.remove);
  await seedScenario({...run,scenario});
  const path=join(run.dataDir,'agent-monitor','mcp-credentials.json');
  expect(JSON.parse(await readFile(path,'utf8')),scenario).toEqual({version:1,principals:[{id:'verify-seed',enabled:false,digest:expect.stringMatching(/^[a-f0-9]{64}$/),scopes:['control']}]});
  expect((await stat(path)).mode&0o777,scenario).toBe(0o600);
 }
},SPAWNS);

const wrapper=join(process.cwd(),'scripts','verify.mjs');
const stubNode=(version:string)=>'data:text/javascript,'+encodeURIComponent(`Object.defineProperty(process.versions,'node',{value:${JSON.stringify(version)}});`);
it('refuses Node outside 24.5 through 24.x with one JSON line and exit status 3, before loading anything',async()=>{
 const state=await mkdtemp(join(tmpdir(),'verify-node-state-'));cleanup.push(()=>rm(state,{recursive:true,force:true}));
 for(const version of ['22.22.1','24.4.9','25.0.0']){
  const result=await promisify(execFile)(process.execPath,['--import',stubNode(version),wrapper,'start'],{env:{PATH:process.env.PATH,APP_VERIFY_STATE_ROOT:state},timeout:10000}).then(()=>undefined,(error:{code:number;stdout:string;stderr:string})=>error);
  expect(result?.code,version).toBe(3);
  const lines=result!.stdout.trim().split('\n');
  expect(lines,version).toHaveLength(1);
  expect(JSON.parse(lines[0]!),version).toMatchObject({operation:'start',ok:false,error:'node-version',detail:expect.stringContaining(`Node ${version} cannot run the Pixoo adapter`)});
  expect(result!.stderr,version).toBe('');
 }
 expect(await readdir(state)).toEqual([]);
 const {stdout}=await promisify(execFile)(process.execPath,['--import',stubNode('24.5.0'),wrapper,'help'],{timeout:20000});
 expect(JSON.parse(stdout)).toMatchObject({operation:'help',app:'pixoo'});
},SPAWNS);

// `help` and `start` run before the core's prepare builds the checkout, so the plug-in must load without any build output.
// A resolve hook makes every module under this checkout's apps/*/dist and packages/*/dist unresolvable.
async function withoutBuild():Promise<string> {
 const directory=await mkdtemp(join(tmpdir(),'verify-no-build-'));cleanup.push(()=>rm(directory,{recursive:true,force:true}));
 const built=new RegExp(`^${pathToFileURL(process.cwd()).href.replace(/[.*+?^${}()|[\]\\/]/g,'\\$&')}/(apps|packages)/[^/]+/dist/`);
 await writeFile(join(directory,'hooks.mjs'),`const built=${built};
export async function resolve(specifier,context,next){
 const result=await next(specifier,context);
 if(built.test(result.url))throw Object.assign(new Error('Cannot find module '+result.url),{code:'ERR_MODULE_NOT_FOUND'});
 return result;
}
`);
 await writeFile(join(directory,'register.mjs'),`import {register} from 'node:module';\nregister(${JSON.stringify(pathToFileURL(join(directory,'hooks.mjs')).href)});\n`);
 return pathToFileURL(join(directory,'register.mjs')).href;
}
it('answers help as one JSON line when no build output exists',async()=>{
 const hook=await withoutBuild();
 const {stdout,stderr}=await promisify(execFile)(process.execPath,['--import',hook,wrapper,'help'],{timeout:20000});
 expect(stdout.trim().split('\n')).toHaveLength(1);
 expect(JSON.parse(stdout)).toMatchObject({operation:'help',app:'pixoo',defaultScenario:'library-playlist'});
 expect(stderr).toBe('');
 // The same hook makes a built module unresolvable, so the check cannot pass by accident.
 await expect(promisify(execFile)(process.execPath,['--import',hook,'--input-type=module','-e',`await import(${JSON.stringify(pathToFileURL(join(process.cwd(),'apps/server/dist/config.js')).href)})`],{timeout:10000})).rejects.toMatchObject({stderr:expect.stringContaining('ERR_MODULE_NOT_FOUND')});
},SPAWNS);
