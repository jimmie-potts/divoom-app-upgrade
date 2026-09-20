import {LibraryError} from '@pixoo/library';
import {MediaError} from '@pixoo/media';
import {PlaybackError} from '@pixoo/playback';
import type {FastifyInstance,FastifyRequest} from 'fastify';
export class ApiError extends Error {
 constructor(readonly code:string,readonly status=400,readonly details?:Record<string,unknown>){super(code);this.name='ApiError';}
}
const monitorRejections=new WeakMap<object,number>();
export const rejectedMonitorRequests=(app:FastifyInstance):number=>monitorRejections.get(app.server)??0;
export type Authenticate=(request:FastifyRequest)=>boolean|Promise<boolean>;
export function security(app:FastifyInstance,authenticate?:Authenticate,mcpEnabled=false):void {
 const requests=new Set<FastifyRequest>();
 app.addHook('onResponse',async request=>{requests.delete(request);});
 app.addHook('onRequestAbort',async request=>{requests.delete(request);});
 app.addHook('onRequest',async(request,reply)=>{
  if(requests.size>=32){
   if(request.method==='POST'&&request.url.split('?')[0]==='/api/monitor/v1/events')monitorRejections.set(app.server,Math.min(Number.MAX_SAFE_INTEGER,rejectedMonitorRequests(app)+1));
   throw new ApiError('busy',503);
  }requests.add(request);
  const release=()=>{requests.delete(request);reply.raw.off('finish',release);reply.raw.off('close',release);};
  reply.raw.once('finish',release);reply.raw.once('close',release);
  const address=app.server.address(),port=typeof address==='object'&&address?address.port:80;
  const host=request.headers.host;
  const authorities=['localhost','127.0.0.1'].map(name=>port===80?name:`${name}:${port}`);
  if(port===80)authorities.push('localhost:80','127.0.0.1:80');
  if(!host||!authorities.includes(host))throw new ApiError('forbidden',403);
  const origin=request.headers.origin;
  if(origin!==undefined&&origin!==new URL(`http://${host}`).origin)throw new ApiError('forbidden',403);
  if(request.headers['sec-fetch-site']==='cross-site')throw new ApiError('forbidden',403);
  if(!(mcpEnabled&&request.url==='/mcp')&&!['GET','HEAD','OPTIONS'].includes(request.method)&&origin===undefined&&request.headers['x-pixoo-request']!=='1')throw new ApiError('forbidden',403);
  if((request.routeOptions.url?.startsWith('/api/')||request.url.split('?')[0]!.startsWith('/api/'))&&authenticate&&!(await authenticate(request)))throw new ApiError('unauthorized',401);
 });
 app.addHook('onSend',async(_request,reply,payload)=>{reply.header('x-content-type-options','nosniff');reply.header('cache-control','no-store');return payload;});
 app.setErrorHandler((error,_request,reply)=>{
  const value=error as {code?:string;statusCode?:number;details?:Record<string,unknown>};
  let code='internal-error',status=500,details:Record<string,unknown>|undefined;
  if(error instanceof ApiError){code=error.code;status=error.status;details=error.details;}
  else if(error instanceof LibraryError||error instanceof MediaError||error instanceof PlaybackError){code=error.code;status=knownErrors[code]??500;if(error instanceof LibraryError)details=error.details;}
  else if(value.code?.startsWith('FST_')){status=value.statusCode===413?413:400;code=status===413?'upload-limit':'invalid-input';}
  reply.code(status).send({error:{code,message:messages[code]??'The request could not be completed.',...(details?{details}: {})}});
 });
 app.setNotFoundHandler((_request,reply)=>reply.code(404).send({error:{code:'not-found',message:'The requested resource does not exist.'}}));
}
const knownErrors:Record<string,number>={
 'invalid-input':400,'not-found':404,'revision-conflict':409,'asset-referenced':409,'checkpoint-owned':409,busy:503,closed:503,
 'storage-error':500,'database-error':500,'catalog-corrupt':500,'cleanup-pending':500,'migration-error':500,
 unsupported:415,'upload-limit':413,'pixel-limit':422,'profile-limit':422,timeout:504,cancelled:409,'decode-failed':422,'cache-corrupt':500,
 'no-context':409,'screen-off':409,
};
const messages:Record<string,string>={forbidden:'This request is not allowed from this origin or host.',unauthorized:'Authentication is required.',
 'invalid-input':'Check the request fields and values.','revision-conflict':'Reload the current playlist revision before editing.',
 'asset-referenced':'Remove playlist and retained session references before deleting this asset.',
 'upload-limit':'The upload exceeds the allowed size or part count.',busy:'The server is busy. Retry later.',
 'request-conflict':'This request ID was used for a different command.','request-expired':'Resync player state; this request ID cannot execute.',
 'request-order':'Reload player state and use nextRequestId.','no-context':'Start a playlist before resuming.',
};
