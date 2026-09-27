import {afterEach,expect,it} from 'vitest';
import {execFile} from 'node:child_process';
import {mkdtemp,readdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {createServer} from 'node:net';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {promisify} from 'node:util';
import {readFile} from 'node:fs/promises';
import {checkNoPhysicalTransport,checkSimulatorMode,failureCause,probeHealth,readTransportLog} from '../../scripts/verify/readiness.ts';
import {launchSpec,transportGuard,transportLog} from '../../scripts/verify/run-environment.ts';
import {seedScenario} from '../../scripts/verify/scenarios.ts';
import {launch,makeRun,StartError,type LaunchedRun} from '../helpers/verify-run.js';

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
 // The core gives the app a private HOME; the server and guard need nothing else from it.
 const environ=(await readFile(`/proc/${server.child.pid}/environ`,'utf8')).split('\0');
 expect(environ).toContain(`HOME=${join(run.runtimeDir,'home')}`);
 expect(environ.filter(entry=>entry.startsWith('PIXOO_')).sort()).toEqual(['PIXOO_DATA_DIR='+run.dataDir,'PIXOO_MODE=simulator','PIXOO_MONITOR_ENABLED=1','PIXOO_PORT=0']);
});
async function startFailure(spec:Parameters<typeof launch>[0],ambient:NodeJS.ProcessEnv):Promise<StartError> {
 const error=await launch(spec,ambient).then(()=>undefined,(caught:unknown)=>caught);
 if(!(error instanceof StartError))throw new Error(`expected a failed start, got ${String(error)}`);
 return error;
}

it('negative control: a launch that loses its simulator setting never starts, even with a saved device target',async()=>{
 const run=await hostileRun();
 const leaked={...run.spec,env:{...run.spec.env}};delete (leaked.env as Record<string,string|undefined>).PIXOO_MODE;
 const failed=await startFailure(leaked,run.ambient);
 expect(failed.message).toMatch(/exited 1: .*PIXOO_MODE=simulator/);
 expect(failureCause(failed.stderr.join('\n'))).toBe('pixoo-transport-guard: simulator mode required');
 expect(await readTransportLog(transportLog(run.runtimeDir))).toMatchObject({blocked:[],listening:[]});
});

/**
 * A test-only backstop loaded before the guard, beneath it: if the guard ever
 * lets a connection through, the backstop refuses anything but the ports this
 * test opened and records the hit, so a regression fails without reaching an
 * installed service.
 */
const backstop='data:text/javascript,'+encodeURIComponent(`
 import net from 'node:net';import {appendFileSync} from 'node:fs';import {syncBuiltinESMExports} from 'node:module';
 const allowed=new Set((process.env.TEST_BACKSTOP_ALLOW??'').split(',').filter(Boolean).map(Number));
 const connect=net.Socket.prototype.connect,listen=net.Server.prototype.listen;
 net.Server.prototype.listen=function(...args){this.once('listening',()=>allowed.add(this.address().port));return listen.apply(this,args);};
 net.Socket.prototype.connect=function(...args){
  const [first]=Array.isArray(args[0])?args[0]:args;const options=typeof first==='object'&&first?first:{};
  if(options.path!==undefined||!allowed.has(Number(options.port))){appendFileSync(process.env.TEST_BACKSTOP_LOG,JSON.stringify(options)+'\\n');process.nextTick(()=>this.destroy(new Error('backstop')));return this;}
  return connect.apply(this,args);
 };
 syncBuiltinESMExports();`);
/** Run a script under the transport guard (above the backstop) and return its JSON output. */
async function guarded(runtimeDir:string,script:string,extra:Record<string,string>={}){
 const backstopLog=join(runtimeDir,'backstop.jsonl');
 try{
  const {stdout}=await promisify(execFile)(process.execPath,['--import',backstop,'--import',pathToFileURL(transportGuard).href,'--input-type=module','-e',script],
   {env:{PATH:process.env.PATH,PIXOO_MODE:'simulator',APP_VERIFY_TRANSPORT_LOG:transportLog(runtimeDir),TEST_BACKSTOP_LOG:backstopLog,...extra},timeout:10000});
  return JSON.parse(stdout) as unknown;
 }finally{
  expect(await readFile(backstopLog,'utf8').catch(()=>''),'the guard let a connection reach the backstop').toBe('');
 }
}
const attempts=`
 import net from 'node:net';
 const tcp=(port,host='127.0.0.1')=>new Promise((resolve)=>{const socket=net.connect({port,host});socket.once('connect',()=>{socket.destroy();resolve('connected');});socket.once('error',()=>resolve('refused'));});
 const unix=(path)=>new Promise((resolve)=>{const socket=net.connect(path);socket.once('connect',()=>{socket.destroy();resolve('connected');});socket.once('error',()=>resolve('refused'));});`;
const guardContext=(runtimeDir:string,port:number)=>({runId:'r',root:process.cwd(),runtimeDir,dataDir:join(runtimeDir,'data'),scenario:'library-playlist',url:`http://127.0.0.1:${port}/`,port,signal:AbortSignal.timeout(1000)});

it('negative control: the guard observes and blocks the physical transport path and any other outbound connection',async()=>{
 const runtimeDir=await temporary('verify-guard-');
 const outcomes=await guarded(runtimeDir,`
  import {createDeviceTransport} from ${JSON.stringify(pathToFileURL(join(process.cwd(),'packages/device/dist/http-transport.js')).href)};
  const outcomes=[];
  for (const attempt of [
   ()=>createDeviceTransport('192.168.255.254')({Command:'Channel/GetIndex'},AbortSignal.timeout(2000)),
   ()=>fetch('http://10.255.255.254:8080/post',{signal:AbortSignal.timeout(2000)}),
  ]) { try { await attempt(); outcomes.push('sent'); } catch { outcomes.push('refused'); } }
  console.log(JSON.stringify(outcomes));`);
 expect(outcomes).toEqual(['refused','refused']);
 const record=await readTransportLog(transportLog(runtimeDir));
 expect(record.blocked).toEqual([expect.objectContaining({api:'http.request',host:'192.168.255.254',port:80}),expect.objectContaining({api:'net.connect',host:'10.255.255.254',port:8080})]);
 expect(await checkNoPhysicalTransport(guardContext(runtimeDir,1))).toMatchObject({outcome:'failed',reason:expect.stringMatching(/2 transport attempts blocked/)});
});

it('refuses and logs loopback connections to installed services, other local ports and Unix sockets',async()=>{
 const runtimeDir=await temporary('verify-guard-');
 // A real listener proves the refusal is the guard's, not an absent service.
 const other=createServer(socket=>socket.destroy());await new Promise<void>(resolve=>other.listen(0,'127.0.0.1',resolve));cleanup.push(()=>new Promise(resolve=>other.close(resolve)));
 const otherPort=(other.address() as {port:number}).port;
 const outcomes=await guarded(runtimeDir,`${attempts}
  console.log(JSON.stringify([await tcp(8788),await tcp(41230,'localhost'),await tcp(${otherPort}),await tcp(${otherPort},'::1'),await unix(${JSON.stringify(join(runtimeDir,'absent.sock'))}),
   await fetch('http://127.0.0.1:8787/api/health').then(()=>'connected',()=>'refused')]));`);
 expect(outcomes).toEqual(['refused','refused','refused','refused','refused','refused']);
 const {blocked}=await readTransportLog(transportLog(runtimeDir));
 expect(blocked).toEqual([
  expect.objectContaining({api:'net.connect',host:'127.0.0.1',port:8788}),
  expect.objectContaining({api:'net.connect',host:'localhost',port:41230}),
  expect.objectContaining({api:'net.connect',host:'127.0.0.1',port:otherPort}),
  expect.objectContaining({api:'net.connect',host:'::1',port:otherPort}),
  expect.objectContaining({api:'net.connect',path:join(runtimeDir,'absent.sock')}),
  expect.objectContaining({api:'net.connect',host:'127.0.0.1',port:8787}),
 ]);
 expect(await checkNoPhysicalTransport(guardContext(runtimeDir,otherPort))).toMatchObject({outcome:'failed',reason:expect.stringMatching(/6 transport attempts blocked: net\.connect 127\.0\.0\.1:8788/)});
});

it('allows only the process\'s own listening port, and records a declared paired port as another target',async()=>{
 const runtimeDir=await temporary('verify-guard-');
 const paired=createServer(socket=>socket.destroy());await new Promise<void>(resolve=>paired.listen(0,'127.0.0.1',resolve));cleanup.push(()=>new Promise(resolve=>paired.close(resolve)));
 const pairedPort=(paired.address() as {port:number}).port;
 const own=await guarded(runtimeDir,`${attempts}
  const server=net.createServer(socket=>socket.destroy());await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const port=server.address().port;const result=[port,await tcp(port),await tcp(port,'localhost')];server.close();console.log(JSON.stringify(result));`) as [number,string,string];
 expect(own.slice(1)).toEqual(['connected','connected']);
 let record=await readTransportLog(transportLog(runtimeDir));
 expect(record.blocked).toEqual([]);
 expect(record.allowed).toEqual([expect.objectContaining({port:own[0],target:'own'}),expect.objectContaining({port:own[0],target:'own'})]);
 expect(await checkNoPhysicalTransport(guardContext(runtimeDir,own[0]))).toEqual({outcome:'passed'});
 // A paired port (reserved for a later hub-paired scenario) is reachable only when declared, and never passes as the run's own traffic.
 expect(await guarded(runtimeDir,`${attempts} console.log(JSON.stringify(await tcp(${pairedPort})));`,{APP_VERIFY_PAIRED_PORTS:String(pairedPort),TEST_BACKSTOP_ALLOW:String(pairedPort)})).toBe('connected');
 record=await readTransportLog(transportLog(runtimeDir));
 expect(record.allowed.at(-1)).toMatchObject({port:pairedPort,target:'paired'});
 expect(await checkNoPhysicalTransport(guardContext(runtimeDir,own[0]))).toMatchObject({outcome:'failed',reason:expect.stringMatching(new RegExp(`1 connection to another local port: 127\\.0\\.0\\.1:${pairedPort}`))});
});

it('refuses to start with an invalid or installed paired port',async()=>{
 const runtimeDir=await temporary('verify-guard-');
 for(const value of ['8788','abc','0','70000','1234,'])
  await expect(guarded(runtimeDir,'console.log(1)',{APP_VERIFY_PAIRED_PORTS:value}),value).rejects.toMatchObject({stderr:expect.stringContaining('APP_VERIFY_PAIRED_PORTS')});
});

it('refuses to start the server when the transport guard has no log',async()=>{
 const run=await hostileRun();
 const spec={...run.spec,env:{...run.spec.env}};delete (spec.env as Record<string,string|undefined>).APP_VERIFY_TRANSPORT_LOG;
 const failed=await startFailure(spec,run.ambient);
 expect(failed.message).toMatch(/exited 1: .*APP_VERIFY_TRANSPORT_LOG/);
 expect(failureCause(failed.stderr.join('\n'))).toBe('pixoo-transport-guard: transport log required');
});
