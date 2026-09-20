import type {FastifyInstance,FastifyRequest} from 'fastify';
import {validate,type Identity} from '@jimmie-potts/device-contracts';
import {authenticateCredential,validateMcpConfiguration,MCP_DEVICE_ID} from './mcp-config.js';
import type {ControlService} from './control-service.js';
import {ApiError} from './security.js';
import {ControllerState,failureStatus} from './controller-state.js';
import {ControllerEvents} from './controller-events.js';

export type ControllerIdentity=Pick<Identity,'deviceId'|'controllerId'|'sourceId'>;
export const defaultControllerIdentity:ControllerIdentity={deviceId:MCP_DEVICE_ID,controllerId:'pixoo-controller',sourceId:'pixoo'};
export function controllerIdentity(value:ControllerIdentity=defaultControllerIdentity):ControllerIdentity{
 if(!validate('identity',{...value,controllerEpoch:'validation'}))throw new Error('Invalid controller identity');
 return Object.freeze({...value});
}
export const controllerPaths=new Set(['/controller/v1/snapshot','/controller/v1/commands','/controller/v1/events']);
export async function registerController(app:FastifyInstance,directory:string,service:ControlService,configured?:ControllerIdentity):Promise<void>{
 await validateMcpConfiguration(directory);
 const identity={...controllerIdentity(configured),controllerEpoch:service.commands.epoch};
 const state=new ControllerState(service,identity);
 async function authenticate(request:FastifyRequest){
  const authorization=request.headers.authorization;
  const bearer=typeof authorization==='string'&&authorization.startsWith('Bearer ')?authorization.slice(7):'';
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{
   const principal=await Promise.race([authenticateCredential(directory,bearer),new Promise<null>(resolve=>{timer=setTimeout(()=>resolve(null),1000);})]);
   if(!principal)throw new ApiError('unauthenticated',401);
   if(!principal.credential.scopes.includes(request.method==='POST'?'control':'read'))throw new ApiError('forbidden',403);
  }finally{if(timer)clearTimeout(timer);}
 }
 app.addHook('onRequest',async request=>{if(controllerPaths.has(request.url.split('?')[0]!))await authenticate(request);});
 const events=new ControllerEvents(state,authenticate);
 state.onChange=()=>events.publish();
 const unsubscribe=service.player.subscribe(()=>events.publish());
 app.addHook('onResponse',async request=>{
  if(!['GET','HEAD','OPTIONS'].includes(request.method)&&request.url.startsWith('/api/playlists')){await state.refreshCatalog();events.publish();}
 });
 app.get('/controller/v1/snapshot',async()=>{await state.refreshCatalog();events.publish();return events.snapshot();});
 app.post('/controller/v1/commands',async(request,reply)=>{
  const receipt=await state.execute(request.body);
  return reply.code(receipt.failure?failureStatus[receipt.failure.code]:200).send(receipt);
 });
 events.register(app);
 app.addHook('preClose',async()=>{unsubscribe();events.close();state.close();});
}
