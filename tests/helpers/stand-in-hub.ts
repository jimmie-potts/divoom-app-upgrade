import {createServer,type Server} from 'node:http';
import {chmod,writeFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {join} from 'node:path';
import {MemoryStorage,createAgentState} from '@jimmie-potts/agent-state';
import {HUB_OWNER_ID,pairingTokens} from '../../scripts/verify/pairing.ts';

/** The synthetic lifecycle source the #495 orchestrator posts to the Hub run. */
export const HUB_SOURCE={provider:'codex',client:'cli',hostId:'verify-host',sourceId:'verify-source'} as const;
export const HUB_SESSION={title:'Hub-fed verification task',project:'VERIFY-HUB',projectId:'verify-hub-project',sessionId:'hub-session-1'} as const;

/**
 * Stands in for the paired Hub run in source tests: the real agent-state owner
 * behind the Hub's `GET /api/monitor/v1/sessions`, as `verify-owner` with the
 * Hub's consumers, requiring the run's feed token. `feed` switches between
 * rejecting the token (as a Hub that is not configured for this run yet),
 * accepting it, and dropping connections (an unreachable Hub).
 */
export async function standInHub(feedToken:string){
 const owner=await createAgentState({storage:new MemoryStorage(),ownerId:HUB_OWNER_ID,consumers:[{id:'dashboard',clearOnNewTurn:false},{id:'nanoleaf',clearOnNewTurn:true},{id:'pixoo',clearOnNewTurn:true}]});
 let feed:'reject'|'accept'|'drop'='reject',sequence=0;
 const reads={accepted:0,rejected:0,dropped:0},paths:string[]=[];
 const server:Server=createServer((request,response)=>{
  const url=new URL(request.url??'/','http://127.0.0.1');paths.push(`${request.method} ${url.pathname}`);
  const send=(status:number,value:unknown)=>{response.writeHead(status,{'content-type':'application/json'});response.end(JSON.stringify(value));};
  if(feed==='drop'){reads.dropped++;request.socket.destroy();return;}
  if(request.method!=='GET'||url.pathname!=='/api/monitor/v1/sessions')return send(404,{error:{code:'not-found'}});
  if(feed==='reject'||request.headers.authorization!==`Bearer ${feedToken}`){reads.rejected++;return send(401,{error:{code:'unauthorized'}});}
  reads.accepted++;
  const version=url.searchParams.get('snapshotVersion')??'1.0';
  send(200,{apiVersion:'1.0',ownerId:HUB_OWNER_ID,connection:'current',snapshot:owner.snapshot(version as '1.2'),admissionRejected:0,nextRequestId:`hub-request-${sequence}`,matches:[]});
 });
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const port=(server.address() as {port:number}).port;
 return {
  origin:`http://127.0.0.1:${port}/`,port,reads,paths,
  setFeed(value:typeof feed){feed=value;},
  revision:()=>owner.snapshot('1.2').revision,
  /** One synthetic lifecycle event from the orchestrator's source. */
  async event(kind:'session.started'|'turn.ended',extra:Record<string,unknown>={}){
   const outcome=await owner.ingest({apiVersion:'1.1',title:{value:HUB_SESSION.title,source:'provider'},project:HUB_SESSION.project,projectId:HUB_SESSION.projectId,
    identity:{...HUB_SOURCE,sessionId:HUB_SESSION.sessionId},turn:{status:'known',id:'hub-turn-1'},parent:{status:'top-level'},
    ordering:{status:'known',epoch:'hub',sequence:++sequence},observedAtMs:Date.now(),event:{kind},...extra});
   if(!outcome.ok)throw new Error(`the stand-in Hub refused the event: ${outcome.code}`);
   return outcome;
  },
  async close(){await new Promise<void>(resolve=>{server.close(()=>resolve());server.closeAllConnections();});await owner.shutdown();},
 };
}
export type StandInHub=Awaited<ReturnType<typeof standInHub>>;

/** A 43-character base64url token, as the orchestrator generates. */
export const pairingToken=()=>randomBytes(32).toString('base64url');
/** Write both pairing tokens into the run directory as the orchestrator does: 0600, one token, no newline. */
export async function writePairingTokens(runtimeDir:string,tokens:{feed:string;controller:string}):Promise<void> {
 for(const [key,name] of Object.entries(pairingTokens) as [keyof typeof pairingTokens,string][]){
  const path=join(runtimeDir,name);await writeFile(path,tokens[key],{mode:0o600});await chmod(path,0o600);
 }
}
