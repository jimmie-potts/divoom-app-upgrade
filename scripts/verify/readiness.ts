// Readiness and simulated-boundary checks for a Pixoo verification run.
import {readFile} from 'node:fs/promises';
import {transportLog} from './run-environment.ts';

export interface ProbeInput {url:string;port:number;runtimeDir:string;signal?:AbortSignal}
export type ProbeResult={ok:true}|{ok:false;reason:string};
export type CheckOutcome={outcome:'passed'}|{outcome:'failed'|'skipped';reason:string};

/** The server's startup line, `Pixoo simulator listening on http://127.0.0.1:<port>`. A device line never counts as ready. */
export function readyLine(line:string):{url:string}|undefined {
 const match=/^Pixoo simulator listening on (http:\/\/127\.0\.0\.1:\d{1,5})$/.exec(line.trim());
 return match?{url:`${match[1]}/`}:undefined;
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

export interface TransportEntry {at:string;pid:number;event:'armed'|'listening'|'blocked'|'allowed';api?:string;host?:string;port?:number;path?:string;address?:string;target?:'own'|'paired'}
export interface TransportRecord {armed:TransportEntry[];listening:TransportEntry[];blocked:TransportEntry[];allowed:TransportEntry[]}
/** The guard's log for the whole run; a missing log reads as empty, so it never passes the listening check. */
export async function readTransportLog(path:string):Promise<TransportRecord> {
 let text='';
 try{text=await readFile(path,'utf8');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
 const entries=text.split('\n').filter(Boolean).map(line=>JSON.parse(line) as TransportEntry);
 const only=(event:TransportEntry['event'])=>entries.filter(e=>e.event===event);
 return {armed:only('armed'),listening:only('listening'),blocked:only('blocked'),allowed:only('allowed')};
}
const describe=(e:TransportEntry)=>e.path??`${e.host}:${e.port}`;

/**
 * Nothing outside the run was attempted or reached: no blocked attempt (a
 * device, another host, an installed loopback service, a Unix or UDP socket),
 * no connection to a local port other than the one this run serves, and the
 * guard is loaded in the process serving this port.
 */
export async function checkNoPhysicalTransport(input:ProbeInput):Promise<CheckOutcome> {
 const record=await readTransportLog(transportLog(input.runtimeDir));
 if(record.blocked.length)return {outcome:'failed',reason:`${record.blocked.length} transport attempts blocked: ${record.blocked.map(e=>`${e.api} ${describe(e)}`).join(', ')}`};
 const other=record.allowed.filter(e=>e.port!==input.port);
 if(other.length)return {outcome:'failed',reason:`${other.length} connection${other.length===1?'':'s'} to another local port: ${other.map(describe).join(', ')}`};
 const serving=record.listening.at(-1);
 if(!serving||serving.port!==input.port)return {outcome:'failed',reason:`the transport guard is not recorded in the process serving port ${input.port}`};
 return {outcome:'passed'};
}
