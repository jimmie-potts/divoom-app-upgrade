import {randomUUID} from 'node:crypto';
import {createHostDiagnostics,type HostDiagnostics,type HostOperation} from '@jimmie-potts/bunny-observability/host';
import type {FastifyInstance} from 'fastify';
import type {WorkerDiagnostics} from '@pixoo/media';

export interface Diagnostics {runtime:HostDiagnostics;worker?:WorkerDiagnostics}
const flag=(value:string|undefined)=>{
 if(value!==undefined&&value!=='0'&&value!=='1')throw new Error('Invalid diagnostics flag');
 return value==='1';
};
export async function createDiagnostics(env:NodeJS.ProcessEnv,localSink?:NonNullable<Parameters<typeof createHostDiagnostics>[0]>['localSink']):Promise<Diagnostics>{
 const enabled=flag(env.PIXOO_OBSERVABILITY_ENABLED);
 if(!enabled)return {runtime:await createHostDiagnostics()};
 const tracing=flag(env.PIXOO_OBSERVABILITY_TRACING),samplingRatio=Number(env.PIXOO_OBSERVABILITY_SAMPLE_RATIO??'.1');
 const collectorOrigin=env.PIXOO_OBSERVABILITY_COLLECTOR;
 const runtime=await createHostDiagnostics({enabled:true,tracing,samplingRatio,...(collectorOrigin?{collectorOrigin}:{}),...(localSink?{localSink}:{}),
  resource:{'service.name':'pixoo','service.namespace':'bunny','service.version':'0.0.0','service.instance.id':randomUUID(),'deployment.environment.name':'development'}});
 return {runtime,worker:{}};
}
const object=(value:unknown):Record<string,unknown>=>value!==null&&typeof value==='object'?value as Record<string,unknown>:{};
export function diagnosticOutcome(value:unknown,status=200):string{
 const item=object(value),failure=object(item.failure),operation=object(item.operation),data=object(item.data),details=object(item.details);
 if(details.priorEffects==='possible'||item.priorEffects==='possible'||operation.priorEffects==='possible'||data.priorEffects==='possible'||failure.code==='uncertain-result'||item.code==='uncertain-result')return 'uncertain';
 for(const candidate of [item,operation,data]){
  if(['cancelled','failed','rejected','queued','uncertain','timeout'].includes(String(candidate.outcome)))return String(candidate.outcome);
  if(candidate.code==='cancelled'||candidate.code==='timeout')return candidate.code;
 }
 if(item.outcome==='sent')return 'transport-acknowledged';
 if(item.ok===false||operation.ok===false||data.ok===false||item.isError===true||item.failure||status>=400)return 'rejected';
 return 'succeeded';
}
/** Preserve returned and thrown domain outcomes without exposing their contents. */
export async function diagnose<T>(runtime:HostDiagnostics,operation:HostOperation,action:()=>T|Promise<T>,status:()=>number=()=>200):Promise<T>{
 const result=await runtime.run({...operation,outcome:value=>{
  const result=value as {value?:T;error?:unknown;failed:boolean};
  const outcome=diagnosticOutcome(result.failed?result.error:result.value,status());
  return result.failed&&outcome==='succeeded'?'failed':outcome;
 }},async()=>{try{return {value:await action(),failed:false};}catch(error){return {error,failed:true};}});
 if(result.failed)throw result.error;
 return result.value as T;
}
export function registerDiagnostics(app:FastifyInstance,diagnostics:Diagnostics,authenticated:boolean){
 const host=diagnostics.runtime;
 app.addHook('onRoute',route=>{
  const path=route.url;
  if(!path.startsWith('/api/')||(path.endsWith('/events')||path.endsWith('/changes')||path.endsWith('/frames/:index.png')))return;
  const handler=route.handler;
  const scope=(path.startsWith('/api/media')||path.startsWith('/api/assets')||path.startsWith('/api/renditions'))?'bunny.media':path.startsWith('/api/player')?'bunny.playback':(path.startsWith('/api/monitor')||path.startsWith('/api/integration'))?'bunny.state':'bunny.http';
  const operation=scope==='bunny.media'?'media':scope==='bunny.playback'?'playback':scope==='bunny.state'?'snapshot':'status';
  route.handler=function(request,reply){
   return diagnose(host,{scope,operation,root:true,spanName:'bunny.command.request',traceparent:request.headers.traceparent,authenticated,owned:true},()=>handler.call(this,request,reply),()=>reply.statusCode);
  };
 });
 app.addHook('onReady',async()=>{host.event('process.started','bunny.host',{'bunny.operation':'startup'});});
 const close=app.close.bind(app);let closing:Promise<void>|undefined;
 app.close=((callback?: (error?:Error)=>void)=>{
  closing??=(async()=>{
   try{await close();host.event('process.stopped','bunny.host',{'bunny.operation':'shutdown'});}
   catch(error){host.event('process.failed','bunny.host',{'bunny.operation':'shutdown'},'ERROR');throw error;}
   finally{await host.shutdown();}
  })();
  if(callback){void closing.then(()=>callback(),error=>callback(error));return;}
  return closing;
 }) as typeof app.close;
}
