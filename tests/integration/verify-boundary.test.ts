import {afterEach,expect,it} from 'vitest';
import {execFile} from 'node:child_process';
import {mkdtemp,readFile,readdir,rm,symlink,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import dgram from 'node:dgram';
import {createServer} from 'node:net';
import {basename,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {promisify} from 'node:util';
import sharp from 'sharp';
import {checkNoPhysicalTransport,checkSimulatorMode,failureCause,probeHealth,readTransportLog} from '../../scripts/verify/readiness.ts';
import {launchSpec,transportGuard,transportLog} from '../../scripts/verify/run-environment.ts';
import {seedScenario} from '../../scripts/verify/scenarios.ts';
import {launch,makeRun,StartError,type LaunchedRun} from '../helpers/verify-run.js';

const cleanup:(()=>Promise<unknown>)[]=[];
afterEach(async()=>{for(const close of cleanup.splice(0).reverse())await close();});
/** These tests start real server processes; CI hosts need more than the 5 s default. */
const SPAWNS=30000;
async function temporary(prefix:string){const path=await mkdtemp(join(tmpdir(),prefix));cleanup.push(()=>rm(path,{recursive:true,force:true}));return path;}
function started(run:LaunchedRun){cleanup.push(()=>run.stop());return run;}
const header={'x-pixoo-request':'1','content-type':'application/json'};
async function command(url:string,body:Record<string,unknown>){
 const {nextRequestId}=await (await fetch(new URL('/api/player',url))).json() as {nextRequestId:string};
 const response=await fetch(new URL('/api/player/commands',url),{method:'POST',headers:header,body:JSON.stringify({requestId:nextRequestId,...body})});
 expect(response.status).toBe(200);
}
/**
 * The owner's shell selects device mode, a real data directory, the installed
 * port, MCP and the native controller, and the run's own data holds a saved
 * device target, as after Save configuration in Settings. A leak of any of
 * these would reach the owner's state or the device, or open routes the run
 * never configured.
 */
async function hostileRun(){
 const ownerHome=await temporary('verify-owner-home-'),ownerData=await temporary('verify-owner-data-');
 // An inherited preload that would run before the guard if NODE_OPTIONS reached the server.
 const preloadMarker=join(ownerData,'..',`${basename(ownerData)}-preload-ran`),preload=join(ownerHome,'..',`${basename(ownerHome)}-preload.mjs`);
 await writeFile(preload,`import {writeFileSync} from 'node:fs';writeFileSync(${JSON.stringify(preloadMarker)},'');`);
 cleanup.push(()=>rm(preload,{force:true}));cleanup.push(()=>rm(preloadMarker,{force:true}));
 const run=await makeRun();cleanup.push(run.remove);
 await seedScenario({...run,scenario:'library-playlist'},{home:ownerHome,ambient:{PIXOO_DATA_DIR:ownerData}});
 await writeFile(join(run.dataDir,'device.json'),JSON.stringify({version:1,configuration:{ip:'192.168.255.254',profile:'pixoo64-smoke-2026-09-06'}}));
 const ambient={...process.env,HOME:ownerHome,TMPDIR:join(run.runtimeDir,'tmp'),PIXOO_MODE:'device',PIXOO_DATA_DIR:ownerData,PIXOO_PORT:'8787',NODE_OPTIONS:`--import=${pathToFileURL(preload).href}`,
  PIXOO_MCP_ENABLED:'1',PIXOO_CONTROLLER_ENABLED:'1',PIXOO_CONTROLLER_DEVICE_ID:'owner-pixoo',PIXOO_DEVICE_IP:'192.168.255.254'};
 return {...run,ownerHome,ownerData,preloadMarker,ambient,spec:launchSpec({...run,port:0,node:process.execPath})};
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
 // An upload renders in the media worker, which the server forks; the guard follows it.
 const form=new FormData();form.append('file',new Blob([new Uint8Array(await sharp({create:{width:4,height:4,channels:3,background:'red'}}).png().toBuffer())],{type:'image/png'}),'boundary.png');
 const upload=await fetch(new URL('/api/assets',server.url),{method:'POST',headers:{'x-pixoo-request':'1'},body:form});
 expect(upload.status).toBe(201);
 expect(await checkNoPhysicalTransport(ctx)).toEqual({outcome:'passed'});
 const record=await readTransportLog(transportLog(run.runtimeDir));
 expect(record).toMatchObject({blocked:[],allowed:[],listening:[{pid:server.child.pid,port:server.port}],forks:[expect.objectContaining({pid:server.child.pid,module:'worker.js'})]});
 const worker=record.armed.find(entry=>entry.pid!==server.child.pid);
 expect(worker,'the forked media worker ran under the guard').toBeDefined();
 // Inherited Pixoo settings the launch did not set were removed before the server read its configuration.
 expect(record.armed.find(entry=>entry.pid===server.child.pid)?.removed).toEqual(['PIXOO_CONTROLLER_DEVICE_ID','PIXOO_CONTROLLER_ENABLED','PIXOO_DEVICE_IP','PIXOO_MCP_ENABLED']);
 expect((await fetch(new URL('/mcp',server.url),{method:'POST',headers:header,body:'{}'})).status).toBe(404);
 expect((await fetch(new URL('/controller/v1/snapshot',server.url))).status).toBe(404);
 expect(await readdir(run.ownerData)).toEqual([]);
 expect(await readdir(run.ownerHome)).toEqual([]);
 await expect(readFile(run.preloadMarker),'an inherited NODE_OPTIONS preload ran before the guard').rejects.toMatchObject({code:'ENOENT'});
 // The core gives the app a private HOME; the server and guard need nothing else from it.
 const environ=(await readFile(`/proc/${server.child.pid}/environ`,'utf8')).split('\0');
 expect(environ).toContain(`HOME=${join(run.runtimeDir,'home')}`);
 expect(environ).toEqual(expect.arrayContaining(['PIXOO_DATA_DIR='+run.dataDir,'PIXOO_MODE=simulator','PIXOO_MONITOR_ENABLED=1','PIXOO_PORT=0']));
},SPAWNS);
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
},SPAWNS);

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
 // A script file, never `-e`: a fork that inherits execArgv would otherwise re-run the script.
 const file=join(runtimeDir,`probe-${Math.random().toString(16).slice(2,10)}.mjs`);await writeFile(file,script);
 try{
  const {stdout}=await promisify(execFile)(process.execPath,['--import',backstop,'--import',pathToFileURL(transportGuard).href,file],
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
},SPAWNS);

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
  expect.objectContaining({api:'net.connect',socketPath:join(runtimeDir,'absent.sock')}),
  expect.objectContaining({api:'net.connect',host:'127.0.0.1',port:8787}),
 ]);
 expect(await checkNoPhysicalTransport(guardContext(runtimeDir,otherPort))).toMatchObject({outcome:'failed',reason:expect.stringMatching(/6 transport attempts blocked: net\.connect 127\.0\.0\.1:8788/)});
},SPAWNS);

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
},SPAWNS);

/** A listener this test owns, counting every connection or datagram it receives. */
async function owned(kind:'tcp'|'udp'){
 let received=0;
 if(kind==='tcp'){
  const server=createServer(socket=>{received++;socket.destroy();});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));cleanup.push(()=>new Promise(resolve=>server.close(resolve)));
  return {port:(server.address() as {port:number}).port,received:()=>received};
 }
 const socket=dgram.createSocket('udp4');socket.on('message',()=>received++);
 await new Promise<void>(resolve=>socket.bind(0,'127.0.0.1',resolve));cleanup.push(()=>new Promise<void>(resolve=>socket.close(()=>resolve())));
 return {port:socket.address().port,received:()=>received};
}

it('runs a fork under the guard even with replaced execArgv and env, and refuses every other spawn',async()=>{
 const runtimeDir=await temporary('verify-guard-'),listener=await owned('tcp');
 const child=join(runtimeDir,'child.mjs');
 await writeFile(child,`import net from 'node:net';
  const socket=net.connect({port:${listener.port},host:'127.0.0.1'});
  socket.once('connect',()=>{socket.destroy();process.send('connected');});socket.once('error',()=>process.send('refused'));`);
 const connect=`require('node:net').connect(${listener.port},'127.0.0.1')`;
 const result=await guarded(runtimeDir,`
  import {fork,spawn,spawnSync,exec,execSync,execFile,execFileSync} from 'node:child_process';
  // Exactly the media worker's options: they replace execArgv and env.
  const forked=await new Promise(resolve=>{
   const c=fork(${JSON.stringify(child)},{stdio:['ignore','ignore','ignore','ipc'],execArgv:['--max-old-space-size=256'],env:{PATH:process.env.PATH},serialization:'advanced'});
   c.once('message',resolve);c.once('exit',code=>resolve('exited '+code));
  });
  const node=process.execPath,code=${JSON.stringify(connect)};
  const spawns={};
  for(const [name,call] of Object.entries({
   spawn:()=>spawn(node,['-e',code]),spawnSync:()=>spawnSync(node,['-e',code]),
   exec:()=>exec(node+' -e "'+code+'"'),execSync:()=>execSync(node+' -e "'+code+'"'),
   execFile:()=>execFile(node,['-e',code]),execFileSync:()=>execFileSync(node,['-e',code]),
  })){try{call();spawns[name]='started';}catch{spawns[name]='refused';}}
  console.log(JSON.stringify({forked,spawns}));`) as {forked:string;spawns:Record<string,string>};
 expect(result).toEqual({forked:'refused',spawns:{spawn:'refused',spawnSync:'refused',exec:'refused',execSync:'refused',execFile:'refused',execFileSync:'refused'}});
 await new Promise(resolve=>setTimeout(resolve,300));
 expect(listener.received(),'nothing reached the test-owned listener').toBe(0);
 const record=await readTransportLog(transportLog(runtimeDir));
 const parent=record.forks[0]?.pid;
 expect(record.forks).toEqual([expect.objectContaining({module:'child.mjs'})]);
 expect(record.armed.map(entry=>entry.pid)).toEqual(expect.arrayContaining([parent,expect.any(Number)]));
 expect(record.blocked).toEqual(expect.arrayContaining([
  expect.objectContaining({api:'net.connect',host:'127.0.0.1',port:listener.port}),
  ...['spawn','spawnSync','exec','execSync','execFile','execFileSync'].map(name=>expect.objectContaining({api:`child_process.${name}`,program:'node'})),
 ]));
 expect(record.blocked.find(entry=>entry.api==='net.connect')?.pid).not.toBe(parent);
 expect(await checkNoPhysicalTransport(guardContext(runtimeDir,1))).toMatchObject({outcome:'failed',reason:expect.stringMatching(/7 transport attempts blocked: /)});
},SPAWNS);

it('honors fork options passed after an undefined args list, and still guards the child',async()=>{
 const runtimeDir=await temporary('verify-guard-'),listener=await owned('tcp'),marker=join(runtimeDir,'preload-ran');
 const preload=join(runtimeDir,'preload.mjs');await writeFile(preload,`import {writeFileSync} from 'node:fs';writeFileSync(${JSON.stringify(marker)},'');`);
 const child=join(runtimeDir,'child.mjs');
 await writeFile(child,`import net from 'node:net';
  process.stdout.write('child-stdout');
  const socket=net.connect({port:${listener.port},host:'127.0.0.1'});
  const report=connected=>process.send({connected,marker:process.env.MARKER,execArgv:process.execArgv});
  socket.once('connect',()=>{socket.destroy();report(true);});socket.once('error',()=>report(false));`);
 const result=await guarded(runtimeDir,`
  import {fork} from 'node:child_process';
  const c=fork(${JSON.stringify(child)},undefined,{stdio:['ignore','pipe','ignore','ipc'],execArgv:['--max-old-space-size=200'],
   env:{PATH:process.env.PATH,MARKER:'set',NODE_OPTIONS:${JSON.stringify(`--import=${pathToFileURL(preload).href}`)}}});
  let stdout='';c.stdout.on('data',chunk=>stdout+=chunk);
  const message=await new Promise(resolve=>{c.once('message',resolve);c.once('exit',code=>resolve({exited:code}));});
  await new Promise(resolve=>c.once('close',resolve));
  console.log(JSON.stringify({...message,stdout}));`) as {connected:boolean;marker:string;execArgv:string[];stdout:string};
 expect(result).toMatchObject({connected:false,marker:'set',stdout:'child-stdout'});
 expect(result.execArgv).toEqual(['--import',pathToFileURL(transportGuard).href,'--max-old-space-size=200']);
 expect(listener.received()).toBe(0);
 await expect(readFile(marker),'an inherited NODE_OPTIONS preload ran in the fork').rejects.toMatchObject({code:'ENOENT'});
 const record=await readTransportLog(transportLog(runtimeDir));
 expect(record.forks).toEqual([expect.objectContaining({module:'child.mjs'})]);
 expect(record.blocked).toEqual([expect.objectContaining({api:'net.connect',host:'127.0.0.1',port:listener.port})]);
 expect(record.blocked[0]!.pid).not.toBe(record.forks[0]!.pid);
},SPAWNS);

it('runs worker threads under the guard even when execArgv or env is replaced',async()=>{
 const runtimeDir=await temporary('verify-guard-'),listener=await owned('tcp');
 const worker=join(runtimeDir,'worker.mjs');
 await writeFile(worker,`import net from 'node:net';import {parentPort} from 'node:worker_threads';
  const socket=net.connect({port:${listener.port},host:'127.0.0.1'});
  socket.once('connect',()=>{socket.destroy();parentPort.postMessage('connected');});socket.once('error',()=>parentPort.postMessage('refused'));`);
 const result=await guarded(runtimeDir,`
  import {Worker} from 'node:worker_threads';
  const run=options=>new Promise(resolve=>{const w=new Worker(${JSON.stringify(worker)},options);w.once('message',value=>{resolve(value);w.terminate();});w.once('error',error=>resolve('error '+error.message));});
  console.log(JSON.stringify([await run({}),await run({execArgv:[]}),await run({execArgv:[],env:{}})]));`);
 expect(result).toEqual(['refused','refused','refused']);
 expect(listener.received()).toBe(0);
 const record=await readTransportLog(transportLog(runtimeDir));
 expect(record.workers).toHaveLength(3);
 expect(record.blocked).toEqual(Array.from({length:3},()=>expect.objectContaining({api:'net.connect',host:'127.0.0.1',port:listener.port})));
},SPAWNS);

it('refuses eval workers without logging their source, and forks of any program but Node',async()=>{
 const runtimeDir=await temporary('verify-guard-'),listener=await owned('tcp'),marker=join(runtimeDir,'other-program-ran');
 const otherProgram=join(runtimeDir,'fake-node.sh');
 await writeFile(otherProgram,`#!/bin/sh\ntouch ${JSON.stringify(marker)}\n`,{mode:0o755});
 const nodeAlias=join(runtimeDir,'node-alias');await symlink(process.execPath,nodeAlias);
 const child=join(runtimeDir,'child.mjs');
 await writeFile(child,`import net from 'node:net';const s=net.connect({port:${listener.port},host:'127.0.0.1'});s.once('connect',()=>{s.destroy();process.send('connected');});s.once('error',()=>process.send('refused'));`);
 const result=await guarded(runtimeDir,`
  import {Worker} from 'node:worker_threads';import {fork} from 'node:child_process';
  const outcomes={};
  try{new Worker("/* EVAL-SOURCE-CANARY */ require('node:net').connect(${listener.port},'127.0.0.1')",{eval:true});outcomes.evalWorker='started';}catch{outcomes.evalWorker='refused';}
  try{fork(${JSON.stringify(child)},[],{execPath:${JSON.stringify(otherProgram)},stdio:'ignore'});outcomes.otherProgram='started';}catch{outcomes.otherProgram='refused';}
  // Node itself through another path to the same binary is still a guarded fork.
  outcomes.nodeAlias=await new Promise(resolve=>{const c=fork(${JSON.stringify(child)},[],{execPath:${JSON.stringify(nodeAlias)}});c.once('message',resolve);c.once('exit',code=>resolve('exited '+code));});
  console.log(JSON.stringify(outcomes));`);
 expect(result).toEqual({evalWorker:'refused',otherProgram:'refused',nodeAlias:'refused'});
 await new Promise(resolve=>setTimeout(resolve,300));
 expect(listener.received()).toBe(0);
 await expect(readFile(marker),'the other program ran').rejects.toMatchObject({code:'ENOENT'});
 const record=await readTransportLog(transportLog(runtimeDir));
 expect(record.blocked).toEqual([
  expect.objectContaining({api:'Worker(eval)',module:'<eval>'}),
  expect.objectContaining({api:'child_process.fork',program:'fake-node.sh'}),
  expect.objectContaining({api:'net.connect',host:'127.0.0.1',port:listener.port}),
 ]);
 expect(record.forks).toEqual([expect.objectContaining({module:'child.mjs'})]);
 expect(await readFile(transportLog(runtimeDir),'utf8')).not.toContain('EVAL-SOURCE-CANARY');
},SPAWNS);

it('refuses ChildProcess#spawn and process.execve and records each',async()=>{
 const runtimeDir=await temporary('verify-guard-'),listener=await owned('tcp');
 const child=join(runtimeDir,'connect.mjs');
 await writeFile(child,`import net from 'node:net';net.connect({port:${listener.port},host:'127.0.0.1'}).once('connect',s=>process.exit(0));`);
 const result=await guarded(runtimeDir,`
  import {ChildProcess} from 'node:child_process';
  const outcomes={};
  try{new ChildProcess().spawn({file:process.execPath,args:[process.execPath,${JSON.stringify(child)}],stdio:['ignore','ignore','ignore']});outcomes.childProcess='started';}catch{outcomes.childProcess='refused';}
  try{process.execve(process.execPath,[process.execPath,${JSON.stringify(child)}]);outcomes.execve='replaced';}catch{outcomes.execve='refused';}
  console.log(JSON.stringify(outcomes));`);
 expect(result).toEqual({childProcess:'refused',execve:'refused'});
 await new Promise(resolve=>setTimeout(resolve,300));
 expect(listener.received()).toBe(0);
 const {blocked}=await readTransportLog(transportLog(runtimeDir));
 expect(blocked).toEqual([expect.objectContaining({api:'ChildProcess.spawn',program:'node'}),expect.objectContaining({api:'process.execve',program:'node'})]);
},SPAWNS);

it('refuses UDP from new dgram.Socket and records HTTP attempts by host and port only',async()=>{
 const runtimeDir=await temporary('verify-guard-'),udp=await owned('udp'),tcp=await owned('tcp');
 const result=await guarded(runtimeDir,`
  import dgram from 'node:dgram';import http from 'node:http';
  const outcomes=[];
  const attempt=async(call)=>{try{await call();outcomes.push('sent');}catch{outcomes.push('refused');}};
  await attempt(()=>{const s=new dgram.Socket('udp4');s.send(Buffer.from('x'),${udp.port},'127.0.0.1');});
  await attempt(()=>new dgram.Socket('udp4').bind(0));
  await attempt(()=>new dgram.Socket('udp4').connect(${udp.port},'127.0.0.1'));
  await attempt(()=>http.request('http://192.168.255.254/post?token=sk-FAKE-1'));
  await attempt(()=>new Promise((resolve,reject)=>{const r=new http.ClientRequest('http://127.0.0.1:${tcp.port}/private/path?token=sk-FAKE-2');r.once('response',resolve);r.once('error',reject);r.end();}));
  console.log(JSON.stringify(outcomes));`);
 expect(result).toEqual(['refused','refused','refused','refused','refused']);
 await new Promise(resolve=>setTimeout(resolve,300));
 expect([udp.received(),tcp.received()]).toEqual([0,0]);
 const {blocked}=await readTransportLog(transportLog(runtimeDir));
 expect(blocked).toEqual([
  expect.objectContaining({api:'dgram.send'}),expect.objectContaining({api:'dgram.bind'}),expect.objectContaining({api:'dgram.connect'}),
  expect.objectContaining({api:'http.request',host:'192.168.255.254',port:80}),
  expect.objectContaining({api:'net.connect',host:'127.0.0.1',port:tcp.port}),
 ]);
 const text=await readFile(transportLog(runtimeDir),'utf8');
 expect(text).not.toMatch(/sk-FAKE|\/post|\/private|null/);
 const check=await checkNoPhysicalTransport(guardContext(runtimeDir,1));
 expect(check).toEqual({outcome:'failed',reason:`5 transport attempts blocked: dgram.send, dgram.bind, dgram.connect, http.request 192.168.255.254:80, net.connect 127.0.0.1:${tcp.port}`});
},SPAWNS);

it('refuses to start with an invalid or installed paired port',async()=>{
 const runtimeDir=await temporary('verify-guard-');
 for(const value of ['8788','abc','0','70000','1234,'])
  await expect(guarded(runtimeDir,'console.log(1)',{APP_VERIFY_PAIRED_PORTS:value}),value).rejects.toMatchObject({stderr:expect.stringContaining('APP_VERIFY_PAIRED_PORTS')});
},SPAWNS);

it('refuses to start the server when the transport guard has no log',async()=>{
 const run=await hostileRun();
 const spec={...run.spec,env:{...run.spec.env}};delete (spec.env as Record<string,string|undefined>).APP_VERIFY_TRANSPORT_LOG;
 const failed=await startFailure(spec,run.ambient);
 expect(failed.message).toMatch(/exited 1: .*APP_VERIFY_TRANSPORT_LOG/);
 expect(failureCause(failed.stderr.join('\n'))).toBe('pixoo-transport-guard: transport log required');
},SPAWNS);
