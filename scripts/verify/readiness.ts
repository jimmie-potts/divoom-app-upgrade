// Readiness and simulated-boundary checks for a Pixoo verification run.
import {readFile} from 'node:fs/promises';
import {basename} from 'node:path';
import {readFeedPauseControl} from '../../apps/server/src/verification-feed-pause.ts';
import {HUB_OWNER_ID,HUB_PAIRED,hubFeed,pixooFeed,readHubFeed,type HubRead} from './pairing.ts';
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
 const target=new URL(path,url),response=await fetch(target,{...(signal?{signal}:{}),headers:{accept:'application/json'}});
 // The full URL: the core redacts a bare route in a reason as if it were a file path.
 if(!response.ok)throw new Error(`${target.href} answered ${response.status}`);
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
 * than the one this run serves, except a paired Hub port on 127.0.0.1 that the
 * connecting process's own launch declared. Only a `hub-paired` launch declares one.
 * The guard is loaded in the process serving this port, and that process is
 * paired with exactly the `hub-feed` port in `hub-paired` and with no port in
 * any other scenario. The log spans the whole run, so a connection a paired
 * launch made stays accepted after a reseed to a standalone scenario.
 */
export async function checkNoPhysicalTransport(input:ProbeInput):Promise<CheckOutcome> {
 const record=await readTransportLog(transportLog(input.runtimeDir));
 if(record.blocked.length)return {outcome:'failed',reason:`${record.blocked.length} transport attempts blocked: ${record.blocked.map(describe).join(', ')}`};
 const other=record.entries.filter((e,index)=>e.event==='allowed'&&e.port!==input.port&&!(e.target==='paired'&&e.host==='127.0.0.1'&&declaredPairing(record.entries,e.pid,index)?.includes(e.port!)));
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

/** Pause between feed reads while the Hub may advance its revision or Pixoo may poll again. */
const pause=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
/** Why a read of the Hub did not serve the feed, as a clause. */
const unserved=(read:Exclude<HubRead,{kind:'served'}>)=>read.kind==='refused'?`the Hub refuses the feed token (${read.status})`:read.kind==='unreachable'?`the Hub is not reachable (${read.cause})`:`the Hub feed is unreadable: ${read.reason}`;
/**
 * How long after a launch a Hub that refuses the feed token or cannot be
 * reached still counts as a pairing in progress. The check runs right after
 * the `hub-paired` reseed, before the orchestrator configures the Hub; a later
 * `doctor` that still sees no current feed reports the pairing as broken.
 */
export const PAIRING_GRACE_MS=60000;
/** The server's uptime, from its own diagnostics. */
async function uptimeMs(url:string,signal?:AbortSignal):Promise<number> {
 const target=new URL('/api/diagnostics',url),response=await fetch(target,{...(signal?{signal}:{}),headers:{accept:'application/json'}});
 if(!response.ok)throw new Error(`${target.href} answered ${response.status}`);
 const {uptimeMs:value}=await response.json() as {uptimeMs?:unknown};
 if(typeof value!=='number')throw new Error(`${target.href} reports no uptime`);
 return value;
}
/**
 * In `hub-paired`: Pixoo's remote feed is current, from the Hub's owner, at
 * the revision the Hub serves. Pixoo's read refreshes the feed first; the
 * check then reads the Hub itself with the feed token.
 *
 * While this launch has never had a current feed, the check is `skipped` only
 * when the Hub refuses the token or cannot be reached, and only within
 * `graceMs` of the launch: a reseed before the Hub is configured must not
 * fail, and a pairing that never completes must. When the Hub serves a feed that Pixoo still
 * does not apply, it fails with the cause: another owner, a feed Pixoo
 * refuses, or an error status. A feed that was current and is now stale fails,
 * naming a Hub whose revisions restarted below Pixoo's, and a revision that
 * never settles fails. Skipped in every other scenario. Reads only; doctor
 * repeats it.
 */
export async function checkHubFeed(input:ProbeInput,graceMs=PAIRING_GRACE_MS):Promise<CheckOutcome> {
 if(input.scenario!==HUB_PAIRED)return {outcome:'skipped',reason:`the run is not paired with a Hub (scenario ${input.scenario??'unknown'})`};
 const pauseState=():CheckOutcome|undefined=>{
  const state=readFeedPauseControl(input.runtimeDir,'request');
  if(state.kind==='invalid'||(state.kind==='valid'&&state.value.runId!==basename(input.runtimeDir)))
   return {outcome:'failed',reason:'feed-pause.request is invalid for this run'};
  const release=readFeedPauseControl(input.runtimeDir,'release');
  if(release.kind==='invalid'||(release.kind==='valid'&&(state.kind!=='valid'||release.value.runId!==state.value.runId||release.value.nonce!==state.value.nonce)))
   return {outcome:'failed',reason:'feed-pause.release is invalid for this run'};
  if(state.kind==='absent')return undefined;
  return {outcome:'skipped',reason:'the Hub feed is paused for aggregate reset'};
 };
 const initial=pauseState();if(initial)return initial;
 let problem='';
 try{
  const hub=hubFeed(input.inputs);
  for(let attempt=0;attempt<5;attempt++){
   if(attempt)await pause(250);
   const pending=pauseState();if(pending)return pending;
   const pixoo=await pixooFeed(input.url,input.signal);
   const beforeHub=pauseState();if(beforeHub)return beforeHub;
   const read=await readHubFeed(input.runtimeDir,hub,input.signal);
   if(pixoo.connection==='unavailable'){
    if(read.kind==='refused'||read.kind==='unreachable'){
     const seen=read.kind==='refused'?`the Hub refuses the feed token (${read.status})`:`the Hub is not reachable (${read.cause})`,up=await uptimeMs(input.url,input.signal);
     if(up>=graceMs)return {outcome:'failed',reason:`${seen}, and this launch has had no current feed in ${Math.floor(up/1000)} s`};
     return {outcome:'skipped',reason:`${seen}; this launch has not had a current feed yet`};
    }
    if(read.kind==='error')return {outcome:'failed',reason:unserved(read)};
    if(read.view.ownerId!==HUB_OWNER_ID)return {outcome:'failed',reason:`the Hub serves owner ${String(read.view.ownerId)}, expected ${HUB_OWNER_ID}`};
    // Pixoo may not have polled since the Hub began accepting the token; the next read refreshes again.
    problem=`Pixoo refuses the feed the Hub serves at revision ${String(read.view.snapshot?.revision)}`;
    continue;
   }
   if(pixoo.connection!=='current'){
    const last=Number(pixoo.snapshot?.revision),stale=`the Hub feed is ${String(pixoo.connection)} at revision ${String(pixoo.snapshot?.revision)}`;
    if(read.kind!=='served')return {outcome:'failed',reason:`${stale}; ${unserved(read)}`};
    const served=Number(read.view.snapshot?.revision);
    if(read.view.ownerId===HUB_OWNER_ID&&served<last)return {outcome:'failed',reason:`${stale}; the Hub now serves revision ${served}, below it, so reseed this run hub-paired`};
    problem=read.view.ownerId===HUB_OWNER_ID?`${stale}; Pixoo refuses the feed the Hub serves at revision ${String(read.view.snapshot?.revision)}`:`${stale}; the Hub serves owner ${String(read.view.ownerId)}, expected ${HUB_OWNER_ID}`;
    continue;
   }
   if(pixoo.ownerId!==HUB_OWNER_ID)return {outcome:'failed',reason:`the feed owner is ${String(pixoo.ownerId)}, expected ${HUB_OWNER_ID}`};
   if(read.kind!=='served')return {outcome:'failed',reason:`Pixoo's feed is current, but ${unserved(read)}`};
   if(read.view.ownerId!==HUB_OWNER_ID)return {outcome:'failed',reason:`the Hub serves owner ${String(read.view.ownerId)}, expected ${HUB_OWNER_ID}`};
   if(pixoo.snapshot?.revision===read.view.snapshot?.revision&&typeof read.view.snapshot?.revision==='number')return {outcome:'passed'};
   problem=`Pixoo applied revision ${String(pixoo.snapshot?.revision)}, the Hub serves revision ${String(read.view.snapshot?.revision)}`;
  }
 }catch(error){return {outcome:'failed',reason:`the Hub feed is unreadable: ${reason(error)}`};}
 return {outcome:'failed',reason:problem};
}
