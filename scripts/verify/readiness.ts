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

export interface TransportEntry {at:string;pid:number;event:'armed'|'listening'|'blocked';api?:string;host?:string;port?:number;path?:string;address?:string}
export interface TransportRecord {armed:TransportEntry[];listening:TransportEntry[];blocked:TransportEntry[]}
/** The guard's log for the whole run; a missing log reads as empty, so it never passes the listening check. */
export async function readTransportLog(path:string):Promise<TransportRecord> {
 let text='';
 try{text=await readFile(path,'utf8');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
 const entries=text.split('\n').filter(Boolean).map(line=>JSON.parse(line) as TransportEntry);
 return {armed:entries.filter(e=>e.event==='armed'),listening:entries.filter(e=>e.event==='listening'),blocked:entries.filter(e=>e.event==='blocked')};
}

/** No physical transport attempt in the run so far, and the guard is loaded in the process serving this port. */
export async function checkNoPhysicalTransport(input:ProbeInput):Promise<CheckOutcome> {
 const record=await readTransportLog(transportLog(input.runtimeDir));
 if(record.blocked.length)return {outcome:'failed',reason:`${record.blocked.length} physical transport attempts blocked: ${record.blocked.map(e=>`${e.api} ${e.host}:${e.port}`).join(', ')}`};
 const serving=record.listening.at(-1);
 if(!serving||serving.port!==input.port)return {outcome:'failed',reason:`the transport guard is not recorded in the process serving port ${input.port}`};
 return {outcome:'passed'};
}
