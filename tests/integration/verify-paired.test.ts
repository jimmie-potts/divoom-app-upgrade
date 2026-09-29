import {afterEach,expect,it} from 'vitest';
import {createHash} from 'node:crypto';
import {chmod,mkdir,readFile,readdir,rm,stat,symlink,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {HUB_PAIRED,pairingTokens} from '../../scripts/verify/pairing.ts';
import {checkHubFeed,checkNoPhysicalTransport,readTransportLog,type ProbeInput} from '../../scripts/verify/readiness.ts';
import {launchSpec,transportLog} from '../../scripts/verify/run-environment.ts';
import {PLAYLIST,seedScenario} from '../../scripts/verify/scenarios.ts';
import {HUB_SESSION,pairingToken,standInHub,writePairingTokens,type StandInHub} from '../helpers/stand-in-hub.js';
import {launch,listenLoopback,makeRun,type LaunchedRun} from '../helpers/verify-run.js';

// The hub-paired scenario against a stand-in for the paired Hub run: the real
// agent-state owner behind the Hub's session feed, and this test as the Hub's
// controller caller. The Pixoo server is the actual build, launched exactly as
// a run launches it, under the transport guard.
const cleanup:(()=>Promise<unknown>)[]=[];
afterEach(async()=>{for(const close of cleanup.splice(0).reverse())await close();});
/** These tests start real server processes; CI hosts need more than the 5 s default. */
const SPAWNS=60000;
const sha256=(value:string)=>createHash('sha256').update(value).digest('hex');
const pause=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
async function eventually<T>(read:()=>Promise<T>,accept:(value:T)=>boolean,timeoutMs=10000):Promise<T> {
 const deadline=Date.now()+timeoutMs;let value=await read();
 while(!accept(value)&&Date.now()<deadline){await pause(150);value=await read();}
 return value;
}
async function pairedRun(){
 const run=await makeRun(`pixoo-20260927T000000Z-${Math.random().toString(16).slice(2,8)}`);cleanup.push(run.remove);
 const tokens={feed:pairingToken(),controller:pairingToken()};
 await writePairingTokens(run.runtimeDir,tokens);
 return {...run,tokens};
}
async function files(directory:string):Promise<string[]> {
 const found:string[]=[];
 for(const entry of await readdir(directory,{withFileTypes:true,recursive:true}))if(entry.isFile())found.push(join(entry.parentPath,entry.name));
 return found;
}

it('seeds hub-paired as a remote consumer of verify-owner with only the digest of the Hub\'s controller token',async()=>{
 const run=await pairedRun(),inputs={'hub-feed':'http://127.0.0.1:41999/'};
 await seedScenario({...run,scenario:HUB_PAIRED,inputs});
 const config=join(run.dataDir,'agent-monitor','config.json');
 expect(JSON.parse(await readFile(config,'utf8'))).toEqual({version:1,mode:'remote',ownerId:'verify-owner',endpoint:'http://127.0.0.1:41999/api/monitor/v1',token:run.tokens.feed});
 const store=join(run.dataDir,'mcp-credentials.json');
 expect(JSON.parse(await readFile(store,'utf8'))).toEqual({version:1,principals:[{id:'hub',enabled:true,digest:sha256(run.tokens.controller),scopes:['read','control']}]});
 expect(JSON.parse(await readFile(join(run.dataDir,'agent-monitor','mcp-credentials.json'),'utf8')).principals).toEqual([expect.objectContaining({id:'verify-seed',enabled:false})]);
 for(const path of [config,store])expect((await stat(path)).mode&0o777,path).toBe(0o600);
 // No embedded owner state, and the feed token only in the private remote configuration the existing source reads.
 await expect(stat(join(run.dataDir,'agent-monitor','state'))).rejects.toMatchObject({code:'ENOENT'});
 for(const path of await files(run.dataDir)){
  const bytes=await readFile(path);
  expect(bytes.includes(run.tokens.controller),path).toBe(false);
  if(path!==config)expect(bytes.includes(run.tokens.feed),path).toBe(false);
 }
});

it('refuses a hub-paired seed with a fixed line that names the problem and never a token, before writing anything',async()=>{
 const run=await pairedRun(),inputs={'hub-feed':'http://127.0.0.1:41999/'};
 const refused=async(given:Readonly<Record<string,string>>,pattern:RegExp)=>{
  const error=await seedScenario({...run,scenario:HUB_PAIRED,inputs:given}).then(()=>undefined,(caught:unknown)=>caught as Error);
  expect(error?.message,String(pattern)).toMatch(pattern);
  expect(error?.message).not.toContain(run.tokens.feed);expect(error?.message).not.toContain(run.tokens.controller);
  expect(await readdir(run.dataDir),String(pattern)).toEqual([]);
 };
 await refused({},/^hub-paired needs --input hub-feed=/);
 await refused({'hub-feed':'http://127.0.0.1:8788/'},/installed port 8788/);
 await refused({'hub-feed':'http://localhost:41999/'},/must be exactly http:\/\/127\.0\.0\.1:<port>\//);
 const feed=join(run.runtimeDir,pairingTokens.feed),controller=join(run.runtimeDir,pairingTokens.controller);
 await chmod(feed,0o640);await refused(inputs,/^hub-feed-token must be private to its owner/);await chmod(feed,0o600);
 await writeFile(controller,`${run.tokens.controller}\n`);await refused(inputs,/^hub-controller-token must hold one 43-character base64url token/);
 await rm(controller);await refused(inputs,/^hub-paired needs hub-controller-token: /);
 await symlink(feed,controller);await refused(inputs,/^hub-paired needs hub-controller-token: /);
 await rm(controller);await rm(feed);await refused(inputs,/^hub-paired needs hub-feed-token: /);
});

/** Stop, empty data/, seed and relaunch on the recorded port, as the core's reseed does. */
async function reseed(run:Awaited<ReturnType<typeof pairedRun>>,server:LaunchedRun,scenario:string,inputs:Readonly<Record<string,string>>):Promise<LaunchedRun> {
 const port=server.port;await server.stop();
 await rm(run.dataDir,{recursive:true,force:true});await mkdir(run.dataDir,{mode:0o700});
 await seedScenario({...run,scenario,inputs});
 const next=await launch(launchSpec({...run,port,node:process.execPath,scenario,inputs}),{...process.env,PIXOO_MODE:'device'});cleanup.push(()=>next.stop());
 return next;
}
async function controller(server:LaunchedRun,path:string,token:string,body?:unknown){
 return fetch(new URL(path,server.url),{method:body===undefined?'GET':'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
}
const pixooView=async(server:LaunchedRun)=>(await fetch(new URL('/api/integration/v1/sessions',server.url))).json() as Promise<{connection:string;ownerId:string;snapshot:{revision:number;sessions:{title?:{value:string};project?:string}[]}|null}>;

const pauseControl=(runId:string,nonce='0123456789abcdef0123456789abcdef')=>({version:1,runId,nonce});
const controlFile=(runtimeDir:string,name:'request'|'release'|'ack')=>join(runtimeDir,`feed-pause.${name}`);
const privateControl=(runtimeDir:string,name:'request'|'release',value:unknown)=>
 writeFile(controlFile(runtimeDir,name),JSON.stringify(value),{mode:0o600});

it('requires a matching release before a paused seed writes data, then consumes it after success',async()=>{
 const run=await pairedRun(),inputs={'hub-feed':'http://127.0.0.1:41999/'};
 const request=pauseControl(run.runId);
 await privateControl(run.runtimeDir,'request',request);
 await expect(seedScenario({...run,scenario:HUB_PAIRED,inputs})).rejects.toThrow('matching feed-pause.release');
 expect(await readdir(run.dataDir)).toEqual([]);
 await privateControl(run.runtimeDir,'release',{...request,nonce:'f'.repeat(32)});
 await expect(seedScenario({...run,scenario:HUB_PAIRED,inputs})).rejects.toThrow('matching feed-pause.release');
 expect(await readdir(run.dataDir)).toEqual([]);
 await privateControl(run.runtimeDir,'release',request);
 await expect(seedScenario({...run,scenario:'empty',inputs})).rejects.toThrow('hub-paired reseed');
 expect(await readdir(run.dataDir)).toEqual([]);
 await seedScenario({...run,scenario:HUB_PAIRED,inputs});
 for(const name of ['request','release','ack'] as const)
  await expect(stat(controlFile(run.runtimeDir,name))).rejects.toMatchObject({code:'ENOENT'});
 expect(await readFile(join(run.dataDir,'agent-monitor','config.json'),'utf8')).toContain('"mode":"remote"');
});

it('fails closed on invalid or linked pause controls and never clears them',async()=>{
 const run=await pairedRun(),inputs={'hub-feed':'http://127.0.0.1:41999/'};
 const path=controlFile(run.runtimeDir,'request');
 await writeFile(path,'{"version":1}',{mode:0o600});
 await expect(seedScenario({...run,scenario:HUB_PAIRED,inputs})).rejects.toThrow('feed-pause.request is invalid');
 expect(await readdir(run.dataDir)).toEqual([]);
 await rm(path);await symlink(controlFile(run.runtimeDir,'release'),path);
 await expect(seedScenario({...run,scenario:HUB_PAIRED,inputs})).rejects.toThrow('feed-pause.request is invalid');
 expect(await readdir(run.dataDir)).toEqual([]);
 await rm(path);await privateControl(run.runtimeDir,'request',pauseControl('another-run'));
 await expect(seedScenario({...run,scenario:HUB_PAIRED,inputs})).rejects.toThrow('feed-pause.request names another run');
 expect(await readdir(run.dataDir)).toEqual([]);
});

it('does not probe the Hub while paused and reports malformed controls as failed',async()=>{
 const run=await pairedRun(),hub=await standInHub(run.tokens.feed);cleanup.push(()=>hub.close());
 const input={...run,url:'http://127.0.0.1:1/',port:1,scenario:HUB_PAIRED,inputs:{'hub-feed':hub.origin}};
 await privateControl(run.runtimeDir,'request',pauseControl(run.runId));
 expect(await checkHubFeed(input)).toEqual({outcome:'skipped',reason:'the Hub feed is paused for aggregate reset'});
 expect(hub.reads.accepted+hub.reads.rejected+hub.reads.dropped).toBe(0);
 await writeFile(controlFile(run.runtimeDir,'request'),'bad json',{mode:0o600});
 expect(await checkHubFeed(input)).toEqual({outcome:'failed',reason:'feed-pause.request is invalid for this run'});
 expect(hub.reads.accepted+hub.reads.rejected+hub.reads.dropped).toBe(0);
});

it('drains a held Hub feed before acknowledging and keeps local routes responsive',async()=>{
 const run=await pairedRun(),hub=await standInHub(run.tokens.feed);
 cleanup.push(()=>hub.close());
 await hub.event('session.started');
 const inputs={'hub-feed':hub.origin};
 await seedScenario({...run,scenario:HUB_PAIRED,inputs});
 hub.setFeed('accept');
 const server=await launch(launchSpec({...run,port:0,node:process.execPath,scenario:HUB_PAIRED,inputs}),process.env);
 cleanup.push(()=>server.stop());
 expect((await eventually(()=>pixooView(server),view=>view.connection==='current')).connection).toBe('current');
 const held=hub.holdNextRead();
 const pending=fetch(new URL('/api/integration/v1/sessions',server.url));
 const request={version:1,runId:run.runId,nonce:'0123456789abcdef0123456789abcdef'};
 const requestPath=join(run.runtimeDir,'feed-pause.request'),ackPath=join(run.runtimeDir,'feed-pause.ack');
 try{
  await held.entered;
  await writeFile(requestPath,JSON.stringify(request),{mode:0o600});
  await pause(150);
  await expect(stat(ackPath)).rejects.toMatchObject({code:'ENOENT'});
  expect((await fetch(new URL('/api/health',server.url))).status).toBe(200);
  expect((await controller(server,'/controller/v1/snapshot',run.tokens.controller)).status).toBe(200);
 }finally{held.release();await pending;}
 const ack=await eventually(async()=>{
  try{return JSON.parse(await readFile(ackPath,'utf8')) as Record<string,unknown>;}
  catch{return {};}
 },value=>value.nonce===request.nonce);
 expect(ack).toEqual({...request,pid:server.child.pid});
 expect((await stat(ackPath)).mode&0o777).toBe(0o600);
 const accepted=hub.reads.accepted;
 for(let i=0;i<3;i++){
  expect((await fetch(new URL('/',server.url))).status).toBe(200);
  expect((await controller(server,'/controller/v1/snapshot',run.tokens.controller)).status).toBe(200);
  expect((await pixooView(server)).connection).toBe('stale');
 }
 await pause(1200);
 expect(hub.reads.accepted).toBe(accepted);
 await rm(requestPath);
 expect(await eventually(()=>Promise.resolve(hub.reads.accepted),count=>count>accepted)).toBeGreaterThan(accepted);
},SPAWNS);

it('invalid live controls block admission, release alone stays paused and a new nonce is acknowledged',async()=>{
 const run=await pairedRun(),hub=await standInHub(run.tokens.feed);cleanup.push(()=>hub.close());
 const inputs={'hub-feed':hub.origin};await seedScenario({...run,scenario:HUB_PAIRED,inputs});hub.setFeed('accept');
 const server=await launch(launchSpec({...run,port:0,node:process.execPath,scenario:HUB_PAIRED,inputs}),process.env);cleanup.push(()=>server.stop());
 expect((await eventually(()=>pixooView(server),view=>view.connection==='current')).connection).toBe('current');
 const request=pauseControl(run.runId),path=controlFile(run.runtimeDir,'request'),ackPath=controlFile(run.runtimeDir,'ack');
 await privateControl(run.runtimeDir,'request',request);
 const ack=()=>readFile(ackPath,'utf8').then(value=>JSON.parse(value) as {nonce?:string;pid?:number}).catch(()=>({} as {nonce?:string;pid?:number}));
 expect((await eventually(ack,value=>value.nonce===request.nonce)).pid).toBe(server.child.pid);
 const calls=hub.reads.accepted;
 for(const kind of ['malformed','oversized','nonprivate','linked','wrong-run']){
  await rm(path);await rm(ackPath,{force:true});
  if(kind==='linked')await symlink(controlFile(run.runtimeDir,'release'),path);
  else if(kind==='malformed')await writeFile(path,'{',{mode:0o600});
  else if(kind==='oversized')await writeFile(path,JSON.stringify(request)+' '.repeat(4096),{mode:0o600});
  else await privateControl(run.runtimeDir,'request',kind==='wrong-run'?pauseControl('another-run'):request);
  if(kind==='nonprivate')await chmod(path,0o640);
  expect((await fetch(server.url)).status).toBe(200);
  expect((await pixooView(server)).connection).toBe('stale');
  await pause(50);
  expect(hub.reads.accepted).toBe(calls);
  await expect(stat(ackPath)).rejects.toMatchObject({code:'ENOENT'});
 }
 await rm(path);const next=pauseControl(run.runId,'b'.repeat(32));
 await privateControl(run.runtimeDir,'request',next);await privateControl(run.runtimeDir,'release',next);
 expect((await eventually(ack,value=>value.nonce===next.nonce)).pid).toBe(server.child.pid);
 await pause(1200);expect(hub.reads.accepted).toBe(calls);
 await rm(path);expect(await eventually(async()=>hub.reads.accepted,count=>count>calls)).toBeGreaterThan(calls);
},SPAWNS);

it('ordinary server startup ignores inherited verification pause variables',async()=>{
 const run=await pairedRun(),hub=await standInHub(run.tokens.feed);cleanup.push(()=>hub.close());
 const inputs={'hub-feed':hub.origin};await seedScenario({...run,scenario:HUB_PAIRED,inputs});hub.setFeed('accept');
 await privateControl(run.runtimeDir,'request',pauseControl(run.runId));
 const spec=launchSpec({...run,port:0,node:process.execPath,scenario:HUB_PAIRED,inputs});
 // Keep simulator/loopback configuration, but omit the explicit verification preload.
 spec.argv=[spec.argv[0]!,spec.argv.at(-1)!];
 const server=await launch(spec,process.env);cleanup.push(()=>server.stop());
 expect((await eventually(()=>pixooView(server),view=>view.connection==='current')).connection).toBe('current');
 await expect(stat(controlFile(run.runtimeDir,'ack'))).rejects.toMatchObject({code:'ENOENT'});
},SPAWNS);

it('pairs with a Hub run: tolerates a rejected and a dropped feed, shows its sessions, and answers its controller calls with one write',async()=>{
 const run=await pairedRun(),hub:StandInHub=await standInHub(run.tokens.feed);cleanup.push(()=>hub.close());
 await hub.event('session.started');
 const inputs={'hub-feed':hub.origin};
 await seedScenario({...run,scenario:HUB_PAIRED,inputs});
 // The owner's shell names another controller identity and a device; the guard removes both, so the defaults apply.
 const ambient={...process.env,PIXOO_MODE:'device',PIXOO_CONTROLLER_ID:'owner-controller',PIXOO_CONTROLLER_DEVICE_ID:'owner-pixoo',PIXOO_DEVICE_IP:'192.168.255.254'};
 let server=await launch(launchSpec({...run,port:0,node:process.execPath,scenario:HUB_PAIRED,inputs}),ambient);cleanup.push(()=>server.stop());
 const context=(scenario=HUB_PAIRED):ProbeInput=>({...run,url:server.url,port:server.port,scenario,inputs,signal:AbortSignal.timeout(10000)});

 // The Hub is not configured for this run yet: the feed stays unavailable, the check is skipped, and nothing fails.
 await eventually(()=>Promise.resolve(hub.reads.rejected),count=>count>0);
 expect(await pixooView(server)).toMatchObject({connection:'unavailable',ownerId:'verify-owner',snapshot:null});
 expect(await checkHubFeed(context())).toEqual({outcome:'skipped',reason:'the Hub refuses the feed token (401); this launch has not had a current feed yet'});
 expect(await checkNoPhysicalTransport(context())).toEqual({outcome:'passed'});

 // Once the Hub accepts the feed token, Pixoo shows its sessions at its revision, and follows the next event.
 hub.setFeed('accept');
 expect((await eventually(()=>checkHubFeed(context()),outcome=>outcome.outcome==='passed')).outcome).toBe('passed');
 expect((await pixooView(server)).snapshot?.sessions).toEqual([expect.objectContaining({title:expect.objectContaining({value:HUB_SESSION.title}),project:HUB_SESSION.project})]);
 await hub.event('turn.ended');
 const followed=await eventually(()=>pixooView(server),view=>view.snapshot?.revision===hub.revision());
 expect(followed.snapshot?.revision).toBe(hub.revision());
 expect(await checkHubFeed(context())).toEqual({outcome:'passed'});

 // The Hub's controller calls reach the real controller API under its registered credential, with the default identity.
 const snapshot=await (await controller(server,'/controller/v1/snapshot',run.tokens.controller)).json() as {identity:Record<string,string>;nextRequestId:unknown;configurationRevision:number;generation:unknown};
 expect(snapshot.identity).toMatchObject({controllerId:'pixoo-controller',deviceId:'pixoo-local',sourceId:'pixoo'});
 expect((await controller(server,'/controller/pixoo-integration/v1/snapshot',run.tokens.controller)).status).toBe(200);
 for(const token of [run.tokens.feed,pairingToken()])expect((await controller(server,'/controller/v1/snapshot',token)).status).toBe(401);
 const writer=async()=>((await (await fetch(new URL('/api/device/simulator',server.url))).json()) as {writer:{setBrightness:{admitted:number;succeeded:number}}}).writer.setBrightness;
 expect(await writer()).toEqual({admitted:0,succeeded:0});
 const command={apiVersion:'1.0',controllerId:'pixoo-controller',deviceId:'pixoo-local',requestId:snapshot.nextRequestId,expectedConfigurationRevision:snapshot.configurationRevision,expectedGeneration:snapshot.generation,command:{kind:'brightness.set',percent:25}};
 const receipt=await (await controller(server,'/controller/v1/commands',run.tokens.controller,command)).json() as {outcome:string};
 expect(receipt.outcome).not.toBe('failed');
 expect(await eventually(writer,count=>count.succeeded===1)).toEqual({admitted:1,succeeded:1});
 // The same request again replays its receipt; nothing more reaches the writer.
 expect(await (await controller(server,'/controller/v1/commands',run.tokens.controller,command)).json()).toEqual(receipt);
 await pause(300);expect(await writer()).toEqual({admitted:1,succeeded:1});

 // An unreachable Hub turns the feed stale and fails the check; it recovers to current without a restart.
 hub.setFeed('drop');
 expect(await eventually(()=>checkHubFeed(context()),outcome=>outcome.outcome==='failed')).toEqual({outcome:'failed',reason:expect.stringMatching(/^the Hub feed is stale at revision \d+; the Hub is not reachable \(connection reset\)$/)});
 hub.setFeed('accept');
 expect((await eventually(()=>checkHubFeed(context()),outcome=>outcome.outcome==='passed')).outcome).toBe('passed');

 // Only this run's port and the declared Hub port were reached; Pixoo only read the Hub's feed.
 const record=await readTransportLog(transportLog(run.runtimeDir));
 expect(record.blocked).toEqual([]);
 expect(new Set(record.allowed.map(entry=>`${entry.target}:${entry.port}`))).toEqual(new Set([`paired:${hub.port}`]));
 const armed=record.armed.find(entry=>entry.pid===server.child.pid);
 expect(armed).toMatchObject({paired:[hub.port],removed:['PIXOO_CONTROLLER_DEVICE_ID','PIXOO_CONTROLLER_ID','PIXOO_DEVICE_IP']});
 expect(new Set(hub.paths)).toEqual(new Set(['GET /api/monitor/v1/sessions']));
 expect(await checkNoPhysicalTransport(context())).toEqual({outcome:'passed'});
 expect(await checkNoPhysicalTransport(context('library-playlist'))).toMatchObject({outcome:'failed',reason:`the process serving port ${server.port} is paired with ${hub.port}; library-playlist expects no port`});

 // A reseed to a standalone scenario ends the pairing: no controller API, an embedded owner, and the earlier feed reads stay accepted.
 server=await reseed(run,server,'library-playlist',inputs);
 expect((await controller(server,'/controller/v1/snapshot',run.tokens.controller)).status).toBe(404);
 expect(await pixooView(server)).toMatchObject({connection:'current',ownerId:'verify-owner',snapshot:{sessions:[expect.anything()]}});
 expect((await (await fetch(new URL('/api/playlists',server.url))).json() as {name:string}[]).map(playlist=>playlist.name)).toEqual([PLAYLIST]);
 expect(await checkHubFeed(context('library-playlist'))).toMatchObject({outcome:'skipped'});
 expect(await checkNoPhysicalTransport(context('library-playlist'))).toEqual({outcome:'passed'});
 expect(await checkNoPhysicalTransport(context())).toMatchObject({outcome:'failed',reason:`the process serving port ${server.port} is paired with no port; hub-paired expects ${hub.port}`});
},SPAWNS);

it('names routes by their full URL in reasons, which the core\'s redaction keeps',async()=>{
 const {createServer}=await import('node:http');
 const failing=createServer((_request,response)=>{response.writeHead(500,{'content-type':'application/json'});response.end('{}');});
 const origin=`http://127.0.0.1:${await listenLoopback(failing)}`;cleanup.push(()=>new Promise(resolve=>failing.close(resolve)));
 const {probeHealth}=await import('../../scripts/verify/readiness.ts');
 const run=await pairedRun(),context={...run,url:`${origin}/`,port:1,scenario:HUB_PAIRED,inputs:{'hub-feed':`${origin}/`}};
 expect(await probeHealth(context)).toEqual({ok:false,reason:`health unreadable: ${origin}/api/health answered 500`});
 expect(await checkHubFeed(context)).toEqual({outcome:'failed',reason:`the Hub feed is unreadable: ${origin}/api/integration/v1/sessions answered 500`});
});

it('skips hub-feed only while the Hub refuses the token or is unreachable, and fails with the cause when Pixoo refuses what the Hub serves',async()=>{
 const run=await pairedRun(),hub:StandInHub=await standInHub(run.tokens.feed);cleanup.push(()=>hub.close());
 await hub.event('session.started');
 const inputs={'hub-feed':hub.origin};
 await seedScenario({...run,scenario:HUB_PAIRED,inputs});
 hub.setFeed('drop');
 let server=await launch(launchSpec({...run,port:0,node:process.execPath,scenario:HUB_PAIRED,inputs}),process.env);cleanup.push(()=>server.stop());
 const check=()=>checkHubFeed({...run,url:server.url,port:server.port,scenario:HUB_PAIRED,inputs,signal:AbortSignal.timeout(10000)});
 // Not yet reachable, then refusing the token: the pairing may still be in progress, so the check is skipped.
 expect(await check()).toEqual({outcome:'skipped',reason:'the Hub is not reachable (connection reset); this launch has not had a current feed yet'});
 hub.setFeed('reject');
 expect(await check()).toEqual({outcome:'skipped',reason:'the Hub refuses the feed token (401); this launch has not had a current feed yet'});
 // Past the grace period a pairing that never completed is broken, not in progress.
 expect(await checkHubFeed({...run,url:server.url,port:server.port,scenario:HUB_PAIRED,inputs,signal:AbortSignal.timeout(10000)},0))
  .toEqual({outcome:'failed',reason:expect.stringMatching(/^the Hub refuses the feed token \(401\), and this launch has had no current feed in \d+ s$/)});
 // The Hub accepts the token but serves what Pixoo refuses: each fails with its cause, never as a token problem.
 hub.setFeed('accept');
 hub.serve({owner:'other-owner'});
 expect(await check()).toEqual({outcome:'failed',reason:'the Hub serves owner other-owner, expected verify-owner'});
 hub.serve({malformed:true});
 expect(await check()).toEqual({outcome:'failed',reason:`Pixoo refuses the feed the Hub serves at revision ${hub.revision()}`});
 hub.serve({status:500});
 expect(await check()).toMatchObject({outcome:'failed',reason:expect.stringMatching(/^the Hub feed is unreadable: http:\/\/127\.0\.0\.1:\d+\/api\/monitor\/v1\/sessions answered 500$/)});
 expect((await pixooView(server)).connection).toBe('unavailable');
 hub.serve({});
 expect((await eventually(check,outcome=>outcome.outcome==='passed')).outcome).toBe('passed');
 // A Hub that advances on every read never settles at one revision within the retries.
 hub.serve({advance:true});
 expect(await check()).toEqual({outcome:'failed',reason:expect.stringMatching(/^Pixoo applied revision \d+, the Hub serves revision \d+$/)});
 hub.serve({});
 expect((await eventually(check,outcome=>outcome.outcome==='passed')).outcome).toBe('passed');
 // A Hub reseed restarts its revisions below what Pixoo applied: Pixoo stays stale until it is paired again.
 const applied=(await pixooView(server)).snapshot!.revision;
 await hub.reset();
 expect(await eventually(check,outcome=>outcome.outcome==='failed')).toEqual({outcome:'failed',
  reason:`the Hub feed is stale at revision ${applied}; the Hub now serves revision ${hub.revision()}, below it, so reseed this run hub-paired`});
 const request=pauseControl(run.runId);
 await privateControl(run.runtimeDir,'request',request);
 await privateControl(run.runtimeDir,'release',request);
 server=await reseed(run,server,HUB_PAIRED,inputs);
 expect((await eventually(check,outcome=>outcome.outcome==='passed')).outcome).toBe('passed');
 expect((await pixooView(server)).snapshot?.revision).toBe(hub.revision());
 expect((await readTransportLog(transportLog(run.runtimeDir))).blocked).toEqual([]);
},SPAWNS);
