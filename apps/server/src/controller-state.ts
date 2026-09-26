import type {MediaOperationEvent} from '@pixoo/playback';
import {randomUUID} from 'node:crypto';
import {admit,validate,type Capabilities,type Command,type Identity,type Receipt,type Request,type Snapshot,type Ticket,type FailureCode} from '@jimmie-potts/device-contracts';
import type {ControlService} from './control-service.js';
import type {CommandEvent} from './commands.js';
import {ApiError} from './security.js';

export const ticket=(value:string):Ticket=>{const [epoch,sequence]=value.split(':');return {epoch:epoch!,sequence:Number(sequence)};};
export const canonical=(value:unknown):unknown=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,canonical(item)])):value;
export const failureStatus:Record<FailureCode,number>={'unauthenticated':401,forbidden:403,'unsupported-capability':422,'invalid-request':400,'unknown-device':404,'revision-conflict':409,'stale-generation':409,'request-conflict':409,'request-expired':410,'request-order':409,capacity:429,'external-control':409,'transport-failure':503,'uncertain-result':503};
const safeFailure=(error:unknown):FailureCode=>{
 const code=(error as {code?:string})?.code;
 if(code==='revision-conflict')return code;
 if(code==='cancelled'||code==='stale-generation')return 'stale-generation';
 if(code==='busy')return 'capacity';
 if(['no-context','screen-off','unsupported-operation','not-found','invalid-input','invalid-playlist','profile-limit','unsupported'].includes(code??''))return 'invalid-request';
 return 'uncertain-result';
};
export class ControllerState {
 readonly feedEpoch=randomUUID();
 private pending=new Map<string,Snapshot['state']['pending'][number]>();
 private lastOutcome:Snapshot['state']['lastOutcome']={status:'unknown'};
 private lastSuccessfulSend:Snapshot['state']['lastSuccessfulSend']={status:'unknown'};
 private mediaOperations=new Map<number,{receipt:Receipt;release:()=>void;pending?:Snapshot['state']['pending'][number]}>();
 private earlyMediaOutcomes=new Map<string,Receipt>();
 private playbackOwner:{requestId:string;body:NonNullable<ControlService['playbackRequest']>;release:()=>void}|undefined;
 private playlists=new Map<string,number>();
 private catalogSignature:string|undefined;
 private refreshWork:Promise<void>|undefined;
 private unsubscribe:()=>void;
 onChange=()=>{};
 constructor(readonly service:ControlService,readonly identity:Identity){
  const commands=service.commands.subscribe(event=>this.observe(event)),media=service.player.subscribeMediaOperations(event=>this.observeMedia(event)),playback=service.player.subscribe(()=>this.observePlaybackOwner());
  this.unsubscribe=()=>{commands();media();playback();};
 }
 close(){this.unsubscribe();this.playbackOwner?.release();this.playbackOwner=undefined;for(const operation of this.mediaOperations.values())operation.release();this.mediaOperations.clear();}
 private generation=():Ticket=>({epoch:this.identity.controllerEpoch,sequence:this.service.player.getState().generation});
 private clock=(sampledAtMs=performance.now())=>({domain:'controller-monotonic' as const,epoch:this.identity.controllerEpoch,sampledAtMs});
 async refreshCatalog():Promise<void>{
  if(this.refreshWork)return this.refreshWork;
  this.refreshWork=(async()=>{
   if(!this.service.library)return;
   const page=await this.service.library.queryPlaylists({q:'',offset:0,limit:100});
   const entries=page.items.map(item=>[item.id,item.revision] as const),signature=JSON.stringify(entries);
   if(this.catalogSignature!==undefined&&signature!==this.catalogSignature)this.service.commands.changed();
   this.catalogSignature=signature;this.playlists=new Map(entries);
  })();
  try{await this.refreshWork;}finally{this.refreshWork=undefined;}
 }
 capabilities():Capabilities{return {power:{supported:true},brightness:{supported:true,minimum:0,maximum:100},media:{supported:true,actions:['pause','resume','stop','next','previous','clear'],playlistIds:[...this.playlists.keys()],renditionIds:[]},zones:{supported:false},scenes:{supported:false},preview:{supported:false},modes:{supported:false}};}
 snapshot(cursor:Ticket={epoch:this.feedEpoch,sequence:0}):Snapshot{
  const display=this.service.player.getDisplayEvidence();
  const observed=[display.screen.observed?.atMs,display.brightness.observed?.atMs].filter((v):v is number=>v!==undefined);
  return {apiVersion:'1.0',identity:{...this.identity},configurationRevision:this.service.commands.configurationRevision,generation:this.generation(),nextRequestId:ticket(this.service.commands.nextRequestId),cursor,
   sampleClock:this.clock(),serviceHealth:'ready',capabilities:this.capabilities(),limits:{maxPending:32,maxBodyBytes:65536,maxInFlight:32,maxReceipts:256,maxEvents:32,maxStreams:16,authenticationTimeoutMs:1000},
   state:{desired:{power:{status:'known',value:display.requestedScreenOn},brightness:display.requestedBrightness===null?{status:'unknown'}:{status:'known',value:display.requestedBrightness},mode:{status:'unknown'}},pending:structuredClone([...new Map([...this.pending,...[...this.mediaOperations.values()].flatMap(value=>value.pending?[[`${value.receipt.requestId.epoch}:${value.receipt.requestId.sequence}`,value.pending] as const]:[])]).values()]),lastSuccessfulSend:structuredClone(this.lastSuccessfulSend),lastOutcome:structuredClone(this.lastOutcome),externalControl:{status:'unknown'},
    observation:this.service.mode==='simulator'||!observed.length?{status:'unknown'}:{status:'known',clock:this.clock(Math.min(...observed)),evidenceAgeMs:Math.max(0,performance.now()-Math.min(...observed)),power:display.screen.observed?{status:'known',value:display.screen.observed.value}:{status:'unknown'},brightness:display.brightness.observed?{status:'known',value:display.brightness.observed.value}:{status:'unknown'}}}};
 }
 private base(requestId:Ticket):Receipt{return {apiVersion:'1.0',controllerId:this.identity.controllerId,deviceId:this.identity.deviceId,requestId,configurationRevision:this.service.commands.configurationRevision,generation:this.generation(),outcome:'queued',priorEffects:'none',completedOperations:[],uncertainOperations:[]};}
 private observePlaybackOwner():void{
  if(this.service.player.getState().intent!=='active'){this.playbackOwner?.release();this.playbackOwner=undefined;return;}
  const body=this.service.playbackRequest;
  if(!body||this.playbackOwner?.requestId===body.requestId)return;
  // Keep one slot between uploads so retries and automatic traversal cannot
  // exceed the shared bound while foreground commands occupy the other slots.
  this.playbackOwner?.release();
  this.playbackOwner={requestId:body.requestId,body,release:this.service.commands.retainPending(body.requestId)};
 }
 private observeMedia(event:MediaOperationEvent):void{
  if(event.phase==='pending'){
   const body=this.service.playbackRequest??this.playbackOwner?.body;if(!body)return;
   const receipt=this.base(ticket(body.requestId));receipt.generation={epoch:this.identity.controllerEpoch,sequence:event.generation};
   const existing=this.pending.get(body.requestId);
   const command:Command|undefined=existing?.command??(body.command==='start'?{kind:'media.start',playlistId:body.playlistId}:['resume','next','previous'].includes(body.command)?{kind:'media.control',action:body.command as 'resume'}:undefined);
   this.mediaOperations.set(event.operationId,{receipt,release:this.service.commands.retainPending(body.requestId),...(command?{pending:{requestId:receipt.requestId,command,generation:receipt.generation}}:{})});
  }else{
   const operation=this.mediaOperations.get(event.operationId);if(!operation)return;
   this.mediaOperations.delete(event.operationId);operation.release();
   const {receipt}=operation,result=event.result;
   if(result.ok){receipt.outcome='sent';receipt.priorEffects='confirmed-transmission';receipt.completedOperations=['media'];this.lastSuccessfulSend={status:'known',requestId:receipt.requestId,clock:this.clock(result.timing.completedAtMs),operationIds:['media']};}
   else{receipt.outcome=result.priorEffects==='possible'?'uncertain':result.code==='cancelled'||result.code==='stale-generation'?'cancelled':'failed';receipt.priorEffects=result.priorEffects;receipt.failure={code:result.priorEffects==='possible'?'uncertain-result':receipt.outcome==='cancelled'?'stale-generation':'transport-failure'};if(result.priorEffects==='possible')receipt.uncertainOperations=['media'];}
   const requestId=`${receipt.requestId.epoch}:${receipt.requestId.sequence}`;
   if(this.pending.has(requestId))this.earlyMediaOutcomes.set(requestId,receipt);
   this.lastOutcome={status:'known',receipt};
  }
  this.onChange();
 }
 private observe(event:CommandEvent){
  let command:Command|undefined;
  switch(event.kind){
   case 'controller':command=event.input;break;
   case 'display':command=event.input.brightness!==undefined?{kind:'brightness.set',percent:event.input.brightness}:{kind:'power.set',on:event.input.screenOn!};break;
   case 'player':{
    const body=event.input;
    switch(body.command){
     case 'start':command={kind:'media.start',playlistId:body.playlistId};break;
     case 'pause':case 'resume':case 'stop':case 'next':case 'previous':case 'clear':command={kind:'media.control',action:body.command};break;
     case 'show-media':case 'restart-with-changes':break;
     default:body satisfies never;
    }
    break;
   }
   case 'integration':break;
   default:event satisfies never;
  }
  if(!command){this.earlyMediaOutcomes.delete(event.requestId);return;}
  if(event.phase==='pending')this.pending.set(event.requestId,{requestId:ticket(event.requestId),command,generation:this.generation()});
  else{
   this.pending.delete(event.requestId);
   const media=this.earlyMediaOutcomes.get(event.requestId);this.earlyMediaOutcomes.delete(event.requestId);
   if(media)this.lastOutcome={status:'known',receipt:media};
   else if(event.kind==='controller'&&event.outcome==='success'&&validate('receipt',event.result))this.lastOutcome={status:'known',receipt:structuredClone(event.result)};
   else{
    const receipt=this.base(ticket(event.requestId));
    if(event.kind==='display'&&event.outcome==='success')this.operation(receipt,event.result.operation);
    else if(event.outcome==='failure'&&event.error)this.failed(receipt,event.error);
    this.lastOutcome={status:'known',receipt};
   }
  }
  this.onChange();
 }
 private operation(receipt:Receipt,operation:Awaited<ReturnType<ControlService['applyDisplay']>>['operation']):void{
  if(operation?.ok){receipt.outcome='sent';receipt.priorEffects='confirmed-transmission';receipt.completedOperations=['display'];this.lastSuccessfulSend={status:'known',requestId:receipt.requestId,clock:this.clock(operation.timing.completedAtMs),operationIds:['display']};}
  else if(operation){receipt.outcome=operation.priorEffects==='possible'?'uncertain':operation.code==='cancelled'||operation.code==='stale-generation'?'cancelled':'failed';receipt.priorEffects=operation.priorEffects;receipt.failure={code:operation.priorEffects==='possible'?'uncertain-result':receipt.outcome==='cancelled'?'stale-generation':'transport-failure'};if(operation.priorEffects==='possible')receipt.uncertainOperations=['display'];}
  else{receipt.outcome='cancelled';receipt.failure={code:'stale-generation'};}
 }
 private failed(receipt:Receipt,error:unknown):void{
  const code=safeFailure(error);receipt.failure={code};receipt.outcome=code==='uncertain-result'?'uncertain':'failed';
  if(code==='uncertain-result'){receipt.priorEffects='possible';receipt.uncertainOperations=['command'];}
 }
 async execute(input:unknown):Promise<Receipt>{
  if(!validate('request',input))throw new ApiError('invalid-request',400);
  const request=structuredClone(input as Request);
  if(request.deviceId!==this.identity.deviceId||request.controllerId!==this.identity.controllerId)throw new ApiError('unknown-device',404);
  const requestId=`${request.requestId.epoch}:${request.requestId.sequence}`;
  try{
   const retained=await this.service.commands.execute(requestId,['controller',canonical(request)],{kind:'controller',input:request.command},async()=>{
    const receipt=this.base(request.requestId);
    try{
     await this.refreshCatalog();
     const decision=admit({state:{controllerId:this.identity.controllerId,deviceId:this.identity.deviceId,epoch:this.identity.controllerEpoch,nextSequence:request.requestId.sequence,configurationRevision:this.service.commands.configurationRevision,generation:this.generation(),capabilities:this.capabilities(),maxBodyBytes:65536,maxInFlight:32,maxQueue:32,maxReceipts:256,inFlight:0,queueDepth:0,cache:[],pending:[]},auth:{credential:{kind:'machine',status:'active',declared:true,devices:[this.identity.deviceId],scopes:['control']},deviceId:this.identity.deviceId,scope:'control',hostAllowed:true,originPresent:false,originAllowed:true,fetchMetadataAllowed:true},request,bodyBytes:Buffer.byteLength(JSON.stringify(request))});
     if(decision.decision!=='queued')return decision.receipt??{...receipt,outcome:'failed' as const,failure:{code:decision.decision as FailureCode}};
     this.service.commands.changed();receipt.configurationRevision=this.service.commands.configurationRevision;
   const command=request.command;
     if(command.kind==='power.set'||command.kind==='brightness.set'){
      const result=await this.service.applyDisplay(command.kind==='power.set'?{requestId,screenOn:command.on}:{requestId,brightness:command.percent});this.operation(receipt,result.operation);
     }else if(command.kind==='media.start')await this.service.applyPlayback({requestId,command:'start',playlistId:command.playlistId,revision:this.playlists.get(command.playlistId)!});
     else if(command.kind==='media.control')await this.service.applyPlayback({requestId,command:command.action});
     receipt.generation=this.generation();
    }catch(error){this.failed(receipt,error);receipt.generation=this.generation();}
    return receipt;
   });
   return structuredClone(retained);
  }catch(error){if(error instanceof ApiError&&error.code==='busy')throw new ApiError('capacity',429);throw error;}
 }
}
