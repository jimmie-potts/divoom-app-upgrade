import {afterEach,expect,it} from 'vitest';
import {createHash} from 'node:crypto';
import {chmod,mkdir,readFile,readdir,rm,stat,symlink,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {HUB_PAIRED,pairingTokens} from '../../scripts/verify/pairing.ts';
import {checkHubFeed,checkNoPhysicalTransport,readTransportLog,type ProbeInput} from '../../scripts/verify/readiness.ts';
import {launchSpec,transportLog} from '../../scripts/verify/run-environment.ts';
import {PLAYLIST,seedScenario} from '../../scripts/verify/scenarios.ts';
import {HUB_SESSION,pairingToken,standInHub,writePairingTokens,type StandInHub} from '../helpers/stand-in-hub.js';
import {launch,makeRun,type LaunchedRun} from '../helpers/verify-run.js';

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
 expect(await checkHubFeed(context())).toEqual({outcome:'skipped',reason:expect.stringMatching(/not been current since this launch/)});
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
 expect(await eventually(()=>checkHubFeed(context()),outcome=>outcome.outcome==='failed')).toEqual({outcome:'failed',reason:expect.stringMatching(/^the Hub feed is stale at revision \d+$/)});
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
