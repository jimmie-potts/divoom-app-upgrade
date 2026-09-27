// Readiness and simulated-boundary checks for a Pixoo verification run.
import {readFile} from 'node:fs/promises';
import {HUB_OWNER_ID,HUB_PAIRED,hubFeed,hubSessions,pixooFeed} from './pairing.ts';
import {transportLog} from './run-environment.ts';

export interface ProbeInput {
 url:string;port:number;runtimeDir:string;signal?:AbortSignal;
 /** The run's scenario and inputs; a check without them judges a standalone run. */
 scenario?:string;inputs?:Readonly<Record<string,string>>;
}
export type ProbeResult={ok:true}|{ok:false;reason:string};
export type CheckOutcome={outcome:'passed'}|{outcome:'failed'|'skipped';reason:string};

/**
 * The server's startup line, `Pixoo simulator listening on http://127.0.0.1:<port>`. A device line never counts as ready.
 * With `controller`, the line also announces the `controller` endpoint: the
 * native controller API a paired Hub calls, served on the same origin.
 */
export function readyLine(line:string,controller=false):{url:string;endpoints?:{controller:string}}|undefined {
 const match=/^Pixoo simulator listening on (http:\/\/127\.0\.0\.1:\d{1,5})$/.exec(line.trim());
 if(!match)return undefined;
 const url=`${match[1]}/`;
 return controller?{url,endpoints:{controller:url}}:{url};
}

/**
 * Known start failures, matched in the server's stderr and reported with fixed
 * text. The core appends the line to the failed receipt; stderr itself is never
 * copied, so nothing here can carry a path, token or other private value.
 */
const knownFailures:readonly [RegExp,string][]=[
 [/Pixoo transport guard: a verification run requires PIXOO_MODE=simulator/,'pixoo-transport-guard: simulator mode required'],
 [/Pixoo transport guard: APP_VERIFY_TRANSPORT_LOG is required/,'pixoo-transport-guard: transport log required'],
 [/^PIXOO_DATA_DIR must be outside source control$/,'pixoo-start-failed: data directory inside source control'],
 [/^listen EADDRINUSE: address already in use /,'pixoo-start-failed: port in use'],
 [/^ENOENT: no such file or directory, access '.*\/apps\/web\/dist\/index\.html'$/,'pixoo-start-failed: web build missing'],
];
/** The latest known start failure in a stderr tail, or undefined. */
export function failureCause(stderrTail:string):string|undefined {
 for(const line of stderrTail.split('\n').reverse()){
  const known=knownFailures.find(([pattern])=>pattern.test(line.trim()));
  if(known)return known[1];
 }
 return undefined;
}

async function json(url:string,path:string,signal?:AbortSignal):Promise<unknown> {
 const response=await fetch(new URL(path,url),{...(signal?{signal}:{}),headers:{accept:'application/json'}});
 if(!response.ok)throw new Error(`${path} answered ${response.status}`);
 return response.json();
}
const reason=(error:unknown)=>error instanceof Error?error.message:String(error);

/** Readiness: `GET /api/health` answers ready, in simulator mode, with no device connectivity. */
export async function probeHealth({url,signal}:ProbeInput):Promise<ProbeResult> {
 try{
  const health=await json(url,'/api/health',signal) as {status?:unknown;mode?:unknown;device?:{connected?:unknown}};
  if(health.status!=='ready')return {ok:false,reason:'health is not ready'};
  if(health.mode!=='simulator')return {ok:false,reason:`health reports ${String(health.mode)} mode`};
  if(health.device?.connected!==false)return {ok:false,reason:'health reports device connectivity'};
  return {ok:true};
 }catch(error){return {ok:false,reason:`health unreadable: ${reason(error)}`};}
}

/** Health and the device settings route agree that the simulator is active and no physical target is. */
export async function checkSimulatorMode(input:ProbeInput):Promise<CheckOutcome> {
 const health=await probeHealth(input);
 if(!health.ok)return {outcome:'failed',reason:health.reason};
 try{
  const device=await json(input.url,'/api/device',input.signal) as {mode?:unknown;connected?:unknown;activeConfiguration?:unknown};
  if(device.mode!=='simulator'||device.connected!==false||device.activeConfiguration!==null)return {outcome:'failed',reason:'device settings report an active physical target'};
  return {outcome:'passed'};
 }catch(error){return {outcome:'failed',reason:`device settings unreadable: ${reason(error)}`};}
}

export interface TransportEntry {
 at:string;pid:number;event:'armed'|'listening'|'blocked'|'allowed'|'fork'|'worker';api?:string;
 host?:string;port?:number;socketPath?:string;program?:string;module?:string;address?:string;target?:'own'|'paired';removed?:string[];paired?:number[];
}
export interface TransportRecord {entries:TransportEntry[];armed:TransportEntry[];listening:TransportEntry[];blocked:TransportEntry[];allowed:TransportEntry[];forks:TransportEntry[];workers:TransportEntry[]}
/** The guard's log for the whole run, in the order it was written; a missing log reads as empty, so it never passes the listening check. */
export async function readTransportLog(path:string):Promise<TransportRecord> {
 let text='';
 try{text=await readFile(path,'utf8');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
 const entries=text.split('\n').filter(Boolean).map(line=>JSON.parse(line) as TransportEntry);
 const only=(event:TransportEntry['event'])=>entries.filter(e=>e.event===event);
 return {entries,armed:only('armed'),listening:only('listening'),blocked:only('blocked'),allowed:only('allowed'),forks:only('fork'),workers:only('worker')};
}
/** The paired ports process `pid` declared when its guard was armed, as of entry `index`; undefined when no guard was armed in it. */
function declaredPairing(entries:readonly TransportEntry[],pid:number,index:number):readonly number[]|undefined {
 for(let i=index;i>=0;i--){const entry=entries[i]!;if(entry.event==='armed'&&entry.pid===pid)return entry.paired??[];}
 return undefined;
}
const portList=(ports:readonly number[])=>ports.length?ports.join(', '):'no port';
/** Where an attempt went: host and port, a Unix socket or a program name. URL paths and query strings are never recorded. */
function describe(e:TransportEntry):string {
 const where=e.socketPath??e.program??(e.host!==undefined?`${e.host}:${e.port}`:undefined);
 return where===undefined?`${e.api}`:`${e.api} ${where}`;
}

/**
 * Nothing outside the run was attempted or reached: no blocked attempt (a
 * device, another host, an installed loopback service, a Unix or UDP socket,
 * a spawned or replaced process), and no connection to a local port other
 * than the one this run serves, except a paired Hub port that the connecting
 * process's own launch declared. Only a `hub-paired` launch declares one.
 * The guard is loaded in the process serving this port, and that process is
 * paired with exactly the `hub-feed` port in `hub-paired` and with no port in
 * any other scenario. The log spans the whole run, so a connection a paired
 * launch made stays accepted after a reseed to a standalone scenario.
 */
export async function checkNoPhysicalTransport(input:ProbeInput):Promise<CheckOutcome> {
 const record=await readTransportLog(transportLog(input.runtimeDir));
 if(record.blocked.length)return {outcome:'failed',reason:`${record.blocked.length} transport attempts blocked: ${record.blocked.map(describe).join(', ')}`};
 const other=record.entries.filter((e,index)=>e.event==='allowed'&&e.port!==input.port&&!(e.target==='paired'&&declaredPairing(record.entries,e.pid,index)?.includes(e.port!)));
 if(other.length)return {outcome:'failed',reason:`${other.length} connection${other.length===1?'':'s'} to another local port: ${other.map(e=>`${e.host}:${e.port}`).join(', ')}`};
 const serving=record.listening.at(-1);
 if(!serving||serving.port!==input.port)return {outcome:'failed',reason:`the transport guard is not recorded in the process serving port ${input.port}`};
 const pairing=[...declaredPairing(record.entries,serving.pid,record.entries.lastIndexOf(serving))??[]].sort((a,b)=>a-b);
 let expected:number[]=[];
 if(input.scenario===HUB_PAIRED){
  try{expected=[hubFeed(input.inputs).port];}catch(error){return {outcome:'failed',reason:reason(error)};}
 }
 if(pairing.join()!==expected.join())return {outcome:'failed',reason:`the process serving port ${input.port} is paired with ${portList(pairing)}; ${input.scenario??'a standalone run'} expects ${portList(expected)}`};
 return {outcome:'passed'};
}

/** Pause between feed reads while the Hub may advance its revision. */
const pause=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
/**
 * In `hub-paired`: Pixoo's remote feed is current, from the Hub's owner, at
 * the revision the Hub serves. Pixoo's read refreshes the feed first. A launch
 * whose feed has not yet been current (the Hub does not accept the feed token
 * yet, or is not reachable yet) is `skipped`, so a reseed before the Hub is
 * configured does not fail; a feed that was current and is now stale fails.
 * Skipped in every other scenario. Reads only; doctor repeats it.
 */
export async function checkHubFeed(input:ProbeInput):Promise<CheckOutcome> {
 if(input.scenario!==HUB_PAIRED)return {outcome:'skipped',reason:`the run is not paired with a Hub (scenario ${input.scenario??'unknown'})`};
 let problem='';
 try{
  const hub=hubFeed(input.inputs);
  for(let attempt=0;attempt<5;attempt++){
   if(attempt)await pause(250);
   const pixoo=await pixooFeed(input.url,input.signal);
   if(pixoo.connection==='unavailable')return {outcome:'skipped',reason:'the Hub feed has not been current since this launch; the Hub may not accept the feed token yet'};
   if(pixoo.connection!=='current')return {outcome:'failed',reason:`the Hub feed is ${String(pixoo.connection)} at revision ${String(pixoo.snapshot?.revision)}`};
   if(pixoo.ownerId!==HUB_OWNER_ID)return {outcome:'failed',reason:`the feed owner is ${String(pixoo.ownerId)}, expected ${HUB_OWNER_ID}`};
   const served=await hubSessions(input.runtimeDir,hub,input.signal);
   if(served.ownerId!==HUB_OWNER_ID)return {outcome:'failed',reason:`the Hub reports owner ${String(served.ownerId)}, expected ${HUB_OWNER_ID}`};
   if(pixoo.snapshot?.revision===served.snapshot?.revision&&typeof served.snapshot?.revision==='number')return {outcome:'passed'};
   problem=`Pixoo applied revision ${String(pixoo.snapshot?.revision)}, the Hub serves revision ${String(served.snapshot?.revision)}`;
  }
 }catch(error){return {outcome:'failed',reason:`the Hub feed is unreadable: ${reason(error)}`};}
 return {outcome:'failed',reason:problem};
}
