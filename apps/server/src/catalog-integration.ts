import {createHash} from 'node:crypto';
import type {FastifyInstance,FastifyRequest,FastifyReply} from 'fastify';
import {z} from 'zod';
import {catalogVersion,catalogCapability,maximumPreviewManifestBytes,type CurrentMedia,type PreviewManifest,apiHash,apiId} from '@pixoo/core';
import type {ControlService} from './control-service.js';
import {parse} from './validation.js';
import {ApiError} from './security.js';
const prefix='/controller/pixoo-integration/v1';
const query=z.object({offset:z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0),limit:z.coerce.number().int().min(1).max(100).default(25)}).strict();
export function catalogSnapshot(service:ControlService){
 const state=service.player.getState(),session=service.player.getSession();
 const index=session?.playlist.items.findIndex(item=>item.id===state.itemId)??-1;
 const item=index<0?undefined:session?.playlist.items[index];
 const currentMedia:CurrentMedia|null=item&&session?{renditionId:item.renditionId,itemId:item.id,playlistId:state.playlistId,playlistRevision:state.playlistRevision,
  itemIndex:index,itemCount:session.playlist.items.length,state:state.state,intent:state.intent,generation:state.generation,
  uncertain:service.player.getDisplayEvidence().transport?.priorEffects==='possible'}:null;
 return {...service.integrationSnapshot(),apiVersion:catalogVersion,catalogRevision:service.library!.catalogRevision,
  capabilities:{...service.integrationSnapshot().capabilities,catalog:catalogCapability},currentMedia};
}
export function registerCatalogIntegration(app:FastifyInstance,service:ControlService):void {
 const library=service.library!;
 let admitted=0;
 // Keep admission occupied until underlying work settles, even after its HTTP deadline.
 async function read<T>(request:FastifyRequest,reply:FastifyReply,work:(signal:AbortSignal)=>Promise<T>):Promise<T>{
  if(admitted>=8)throw new ApiError('capacity',429);admitted++;
  const cancelled=new AbortController(),deadline=AbortSignal.timeout(5000),signal=AbortSignal.any([cancelled.signal,deadline]);
  const abort=()=>cancelled.abort();request.raw.once('aborted',abort);
  const close=()=>{if(!reply.raw.writableFinished)abort();};reply.raw.once('close',close);
  let rejectAbort:()=>void=()=>{};
  const interrupted=new Promise<never>((_resolve,reject)=>{rejectAbort=()=>reject(new ApiError(deadline.aborted?'timeout':'cancelled',deadline.aborted?504:409));signal.addEventListener('abort',rejectAbort,{once:true});});
  const pending=Promise.resolve().then(()=>work(signal));
  void pending.finally(()=>{admitted--;signal.removeEventListener('abort',rejectAbort);request.raw.off('aborted',abort);reply.raw.off('close',close);}).catch(()=>{});
  return Promise.race([pending,interrupted]);
 }
 app.get(prefix+'/catalog/renditions',(request,reply)=>read(request,reply,async signal=>({apiVersion:catalogVersion,...await library.queryMedia({q:'',...parse(query,request.query)},service.profile,service.stillDelayMs,true,signal)})));
 app.get(prefix+'/catalog/playlists',(request,reply)=>read(request,reply,async signal=>({apiVersion:catalogVersion,...await library.queryPlaylists({q:'',...parse(query,request.query)},true,signal)})));
 app.get<{Params:{id:string}}>(prefix+'/catalog/playlists/:id',(request,reply)=>read(request,reply,async signal=>({apiVersion:catalogVersion,...await library.catalogPlaylist(parse(apiId,request.params.id),signal)})));
 async function preview(request:FastifyRequest<{Params:{id:string;index?:string}}>,reply:FastifyReply,format:'json'|'png',first=false){
  return read(request,reply,async signal=>{
   const id=parse(apiHash,request.params.id),raw=request.params.index;
   if(!first&&format==='png'&&(!raw||!/^(0|[1-9][0-9]{0,3})$/.test(raw)))throw new ApiError('invalid-request',400);
   const loaded=await library.preview(id,format==='json'?null:first?0:Number(raw),signal),rendition=loaded.rendition;
   const manifest:PreviewManifest={apiVersion:catalogVersion,renditionId:id,width:64,height:64,frameCount:rendition.frames.length,durationMs:rendition.effectiveDurationMs,
    frames:rendition.frames.map(({index,delayMs})=>({index,delayMs})),warnings:rendition.warnings};
   const bytes=format==='json'?Buffer.from(JSON.stringify(manifest)):loaded.bytes!;
   if(format==='json'&&bytes.length>maximumPreviewManifestBytes)throw new ApiError('cache-corrupt',500);
   const etag='"'+createHash('sha256').update(bytes).digest('hex')+'"';
   reply.header('etag',etag).header('cache-control','private, max-age=31536000, immutable');
   // The same representation can use a weak validator in a GET conditional request.
   const validators=request.headers['if-none-match']?.split(',').map(value=>value.trim().replace(/^W\//,''));
   if(validators?.includes(etag)||validators?.includes('*'))return reply.code(304).send();
   return reply.type(format==='json'?'application/json':'image/png').send(bytes);
  });
 }
 app.get<{Params:{id:string}}>(prefix+'/renditions/:id/preview.json',(request,reply)=>preview(request,reply,'json'));
 app.get<{Params:{id:string}}>(prefix+'/renditions/:id/preview.png',(request,reply)=>preview(request,reply,'png',true));
 app.get<{Params:{id:string;index:string}}>(prefix+'/renditions/:id/frames/:index.png',(request,reply)=>preview(request,reply,'png'));
}
