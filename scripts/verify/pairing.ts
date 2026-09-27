// The hub-paired convention for the integrated verification preview (Hub
// #495). A paired run reads the Hub run's session feed as a remote owner and
// serves its native controller API to that Hub. The Hub run's origin arrives
// as the non-secret run input `hub-feed`; the two tokens arrive as private
// files the orchestrator writes into the run directory after `start` and
// before the `hub-paired` reseed. A token is never an input, never logged and
// never part of an error message. Node runs this file directly with type
// stripping, so it uses erasable TypeScript only.
import {constants} from 'node:fs';
import {lstat,open} from 'node:fs/promises';
import {join} from 'node:path';
import {installedPorts} from './installed-ports.ts';

export const HUB_PAIRED='hub-paired';
/** The input naming the Hub run's origin, exactly `http://127.0.0.1:<port>/`. Pixoo appends its paths. */
export const HUB_FEED_INPUT='hub-feed';
/** The Hub run's agent-state owner. Pixoo's remote source refuses a feed from any other owner. */
export const HUB_OWNER_ID='verify-owner';
/** The principal the Hub's controller credential is registered as, with read and control scopes. */
export const HUB_CONTROLLER_PRINCIPAL='hub';
/**
 * Files in the run directory, each holding one 43-character base64url token
 * and nothing else, mode 0600. The feed token is what Pixoo presents to the
 * Hub's session feed; the controller token is what the Hub presents to
 * Pixoo's controller API.
 */
export const pairingTokens={feed:'hub-feed-token',controller:'hub-controller-token'} as const;
export type PairingToken=typeof pairingTokens[keyof typeof pairingTokens];

export interface HubFeed {
 /** `http://127.0.0.1:<port>/` of the Hub run. */
 origin:string;
 port:number;
 /** The remote monitor endpoint Pixoo's configuration names: `<origin>api/monitor/v1`. */
 monitorEndpoint:string;
}

/** The Hub run named by `hub-feed`: a loopback origin on a port that is not an installed service's. */
export function hubFeed(inputs:Readonly<Record<string,string>>|undefined):HubFeed {
 const value=inputs?.[HUB_FEED_INPUT];
 if(value===undefined)throw new Error(`${HUB_PAIRED} needs --input ${HUB_FEED_INPUT}=http://127.0.0.1:<port>/ naming the Hub run`);
 const match=/^http:\/\/127\.0\.0\.1:([1-9]\d{0,4})\/$/.exec(value),port=Number(match?.[1]);
 if(!match||port>65535)throw new Error(`${HUB_FEED_INPUT} must be exactly http://127.0.0.1:<port>/ with a port from 1 through 65535`);
 if(installedPorts.includes(port))throw new Error(`${HUB_FEED_INPUT} names installed port ${port}; a run pairs only with a disposable Hub run`);
 return {origin:value,port,monitorEndpoint:`${value}api/monitor/v1`};
}

/** Whether a launch serves the controller endpoint: in hub-paired, and after it, because the core holds a recorded endpoint to its port. */
export function announcesController(context:{scenario?:string;endpointPorts?:Readonly<Record<string,number>>}):boolean {
 return context.scenario===HUB_PAIRED||Object.hasOwn(context.endpointPorts??{},'controller');
}

const TOKEN=/^[A-Za-z0-9_-]{43}$/;
/**
 * One pairing token from the run directory. Every failure is a fixed line
 * naming only the file: a missing file or link, a file others can read, or
 * content other than one 43-character base64url token.
 */
export async function readPairingToken(runtimeDir:string,name:PairingToken):Promise<string> {
 const path=join(runtimeDir,name),missing=()=>new Error(`${HUB_PAIRED} needs ${name}: a private file in the run directory holding one token, written after start`);
 let text:string;
 try{
  if(!(await lstat(path)).isFile())throw missing();
  const handle=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  try{
   const info=await handle.stat();
   if(!info.isFile())throw missing();
   if(info.mode&0o077)throw new Error(`${name} must be private to its owner (mode 0600)`);
   if(info.size>64)throw new Error(`${name} must hold one 43-character base64url token and nothing else`);
   text=await handle.readFile('utf8');
  }finally{await handle.close();}
 }catch(error){
  if(error instanceof Error&&error.message.startsWith(name))throw error;
  throw missing();
 }
 if(!TOKEN.test(text))throw new Error(`${name} must hold one 43-character base64url token and nothing else`);
 return text;
}

/** The feed envelope both sides serve: Pixoo's `/api/integration/v1/sessions` and the Hub's `/api/monitor/v1/sessions`. */
export interface FeedView {ownerId?:unknown;connection?:unknown;snapshot?:{revision?:unknown;sessions?:unknown[]}|null}

async function feed(url:URL,headers:Record<string,string>,signal?:AbortSignal):Promise<FeedView> {
 const response=await fetch(url,{headers:{accept:'application/json',...headers},redirect:'error',...(signal?{signal}:{})});
 // The full URL without its query: the core redacts a bare route in a reason as if it were a file path.
 if(!response.ok)throw new Error(`${url.origin}${url.pathname} answered ${response.status}`);
 return await response.json() as FeedView;
}
/** Pixoo's view of its remote feed. The read refreshes it from the Hub first, as the Monitor tab does. */
export function pixooFeed(url:string,signal?:AbortSignal):Promise<FeedView> {
 return feed(new URL('/api/integration/v1/sessions',url),{},signal);
}
/** What the Hub answered the run's feed token: its feed, a refusal of the token, no connection, or another status. */
export type HubRead={kind:'served';view:FeedView}|{kind:'refused';status:number}|{kind:'unreachable';cause:string}|{kind:'error';reason:string};
/** What a failed connection saw, from undici's cause code; never the error text, which could carry a URL with a token. */
function connectionCause(error:unknown):string {
 const code=(error as {cause?:{code?:unknown}})?.cause?.code;
 if(code==='ECONNREFUSED')return 'connection refused';
 if(code==='ECONNRESET'||code==='UND_ERR_SOCKET')return 'connection reset';
 return typeof code==='string'&&/^[A-Z_]{1,40}$/.test(code)?code:'no connection';
}
/**
 * Read the Hub's own feed with the run's feed token, as Pixoo's remote source
 * reads it, and classify the answer. A failed connection is `unreachable`;
 * an abort of `signal` and an unreadable token file still throw.
 */
export async function readHubFeed(runtimeDir:string,hub:HubFeed,signal?:AbortSignal):Promise<HubRead> {
 const token=await readPairingToken(runtimeDir,pairingTokens.feed),url=new URL('api/monitor/v1/sessions?snapshotVersion=1.2',hub.origin);
 let response:Response;
 try{response=await fetch(url,{headers:{accept:'application/json',authorization:`Bearer ${token}`,'x-pixoo-request':'1'},redirect:'error',...(signal?{signal}:{})});}
 catch(error){if(signal?.aborted)throw error;return {kind:'unreachable',cause:connectionCause(error)};}
 if(response.status===401||response.status===403){await response.body?.cancel();return {kind:'refused',status:response.status};}
 // The full URL without its query: the core redacts a bare route in a reason as if it were a file path.
 if(!response.ok){await response.body?.cancel();return {kind:'error',reason:`${url.origin}${url.pathname} answered ${response.status}`};}
 try{return {kind:'served',view:await response.json() as FeedView};}
 catch{return {kind:'error',reason:`${url.origin}${url.pathname} answered with a body that is not JSON`};}
}
/** The Hub's feed, or an error naming why the Hub did not serve it. */
export async function hubSessions(runtimeDir:string,hub:HubFeed,signal?:AbortSignal):Promise<FeedView> {
 const read=await readHubFeed(runtimeDir,hub,signal);
 if(read.kind==='served')return read.view;
 throw new Error(read.kind==='refused'?`the Hub refuses the feed token (${read.status})`:read.kind==='unreachable'?`the Hub is not reachable (${read.cause})`:read.reason);
}
