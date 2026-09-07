import {z} from 'zod';
import {requestIdentity} from '@pixoo/core';
import {PlaybackError} from '@pixoo/playback';
import {bindServiceTools,createDeviceRegistry,type JsonSchema,type ServiceExtension} from '@jimmie-potts/device-mcp';
import {ControlService} from './control-service.js';
import {ApiError} from './security.js';
import {MCP_DEVICE_ID} from './mcp-config.js';
const time=z.number().nonnegative().max(Number.MAX_SAFE_INTEGER),id=z.string().max(128),nullableTime=time.nullable();
const codes=['invalid-input','closed','busy','storage-error','no-context','screen-off','offline','upload-failed','cancelled','timeout','stale-generation','http-error','device-error','protocol-error','external-control','operation-failed','request-conflict','request-expired','request-order','probe-failed','invalid-timing','decode-failed','cache-corrupt','profile-limit'] as const;
const code=z.enum(codes);
const evidenceValue=<T extends z.ZodType>(value:T)=>z.object({value,atMs:time}).strict().nullable();
const brightness=z.object({acknowledged:evidenceValue(z.number().int().min(0).max(100)),observed:evidenceValue(z.number().int().min(0).max(100))}).strict();
const screen=z.object({acknowledged:evidenceValue(z.boolean()),observed:evidenceValue(z.boolean())}).strict();
const player=z.object({state:z.enum(['idle','loading','playing','paused','reconnecting','error']),intent:z.enum(['active','paused','stopped']),availability:z.enum(['unknown','available','offline']),generation:z.number().int().nonnegative(),sessionId:id.nullable(),playlistId:id.nullable(),playlistRevision:z.number().int().positive().nullable(),itemId:id.nullable(),estimatedReadyAtMs:nullableTime,dwellDeadlineMs:nullableTime,timing:z.literal('estimated'),requestedScreenOn:z.boolean(),lastError:z.object({code,itemId:id.optional(),priorEffects:z.enum(['none','possible']).optional()}).strict().nullable()}).strict();
const snapshot=z.object({sampledAtMs:time,serverId:id,nextRequestId:requestIdentity,player}).strict();
const status=z.object({ready:z.literal(true),mode:z.enum(['simulator','device']),connected:z.boolean().nullable(),serverId:id,nextRequestId:requestIdentity,sampledAtMs:time,display:z.object({requestedBrightness:z.number().int().min(0).max(100).nullable(),requestedScreenOn:z.boolean(),brightness,screen,transport:z.object({source:z.enum(['brightness','screen','probe','upload']),atMs:time,ok:z.boolean(),priorEffects:z.enum(['none','possible'])}).strict().nullable()}).strict(),player}).strict();
const timing=z.object({submittedAtMs:time,startedAtMs:nullableTime,completedAtMs:time,queueMs:time,serviceMs:time}).strict();
const outcome=z.object({ok:z.boolean(),requestId:requestIdentity,timing:timing.nullable(),priorEffects:z.enum(['none','possible']),code:code.nullable(),snapshot:snapshot.nullable(),retry:z.literal('never-automatically')}).strict();
const schema=(value:z.ZodType)=>z.toJSONSchema(value) as JsonSchema;
function safePlayer(value:ReturnType<ControlService['status']>['player']){
 return {...value,lastError:value.lastError?{...value.lastError,code:code.safeParse(value.lastError.code).success?value.lastError.code:'operation-failed'}:null};
}
export function createLocalTools(service:ControlService,changed:()=>void){
 const read:ServiceExtension={inputSchema:schema(z.object({}).strict()),outputSchema:schema(status),scope:'read',description:'Read application readiness and dated transport evidence. Null values are unavailable; acknowledged writes are not visual confirmation. This call never probes the display.',annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:true},async invoke(){const value=service.status();return {data:status.parse({...value,player:safePlayer(value.player)})};}};
 const write=(kind:'brightness'|'screen'):ServiceExtension=>({inputSchema:schema(kind==='brightness'?z.object({percent:z.number().int().min(0).max(100),request_id:requestIdentity}).strict():z.object({on:z.boolean(),request_id:requestIdentity}).strict()),outputSchema:schema(outcome),scope:'control',description:kind==='brightness'?'Request brightness through the existing writer using the exact next request_id from status. Reuse that identity only for the same intent; never automatically retry uncertain effects.':'Request screen power through the existing writer. Off pauses playback; on never resumes it. Use the exact next request_id from status and never automatically replay uncertain effects.',annotations:{readOnlyHint:false,destructiveHint:true,idempotentHint:true,openWorldHint:true},async invoke(args){
  const requestId=args.request_id as string;
  try{
   const result=await service.display(kind==='brightness'?{requestId,brightness:args.percent}:{requestId,screenOn:args.on});
   const operation=result.operation;
   const safeSnapshot={sampledAtMs:result.snapshot.sampledAtMs,serverId:result.snapshot.serverId,nextRequestId:result.snapshot.nextRequestId,player:safePlayer(result.snapshot.player)};
   const data=outcome.parse({ok:operation?.ok??false,requestId,timing:operation?.timing??null,priorEffects:operation&&!operation.ok?operation.priorEffects:'none',code:operation?(operation.ok?null:operation.code):'cancelled',snapshot:safeSnapshot,retry:'never-automatically'});
   return {data,isError:!data.ok};
  }catch(error){
   if(!(error instanceof ApiError||error instanceof PlaybackError))throw error;
   const parsed=code.safeParse(error.code);if(!parsed.success)throw error;
   return {data:outcome.parse({ok:false,requestId,timing:null,priorEffects:error.code==='storage-error'?'possible':'none',code:parsed.data,snapshot:null,retry:'never-automatically'}),isError:true};
  }finally{changed();}
 }});
 const registry=createDeviceRegistry([{controllerId:'pixoo-controller',deviceId:MCP_DEVICE_ID,extensions:{get_status:read,set_brightness:write('brightness'),set_screen:write('screen')}}]);
 return {registry,tools:bindServiceTools(registry,{deviceId:MCP_DEVICE_ID,bindings:['get_status','set_brightness','set_screen'].map(name=>({extension:name,name}))})};
}
