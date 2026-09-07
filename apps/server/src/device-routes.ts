import {writeFile,rename,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import type {FastifyInstance} from 'fastify';
import type {OperationResult} from '@pixoo/device';
import type {Player} from '@pixoo/playback';
import {SIMULATOR_PROFILE,PIXOO64_SMOKE_PROFILE} from '@pixoo/media';
import {deviceConfiguration,emptyRequest} from '@pixoo/core';
import {parse} from './validation.js';
import {ControlService,requireDisplaySuccess} from './control-service.js';
import {ApiError} from './security.js';
import type {RuntimeSelection} from './device-settings.js';
function result<T>(value:OperationResult<T>|undefined):T {
 if(!value)throw new ApiError('cancelled',409);
 if(!value.ok)throw new ApiError(value.code,value.code==='invalid-input'?400:503,{priorEffects:value.priorEffects});return value.value;
}
export async function deviceRoutes(app:FastifyInstance,directory:string,player:Player,changed:()=>void,runtime:RuntimeSelection,service:ControlService):Promise<void>{
 const path=join(directory,'device.json');let configuration=runtime.savedConfiguration;
 let tail=Promise.resolve();
 const status=()=>{const availability=player.getState().availability;return {configuration,activeConfiguration:runtime.activeConfiguration,
  restartRequired:runtime.mode==='device'&&JSON.stringify(configuration)!==JSON.stringify(runtime.activeConfiguration),mode:runtime.mode,
  connected:runtime.mode==='simulator'?false:availability==='unknown'?null:availability==='available',availability,
  activeProfile:runtime.mode==='device'?PIXOO64_SMOKE_PROFILE:SIMULATOR_PROFILE,profiles:[SIMULATOR_PROFILE,PIXOO64_SMOKE_PROFILE]};};
 app.get('/api/device',status);
 app.put('/api/device',request=>{
  const settings=parse(deviceConfiguration,request.body);
  const work=tail.then(async()=>{
   const temporary=join(directory,`.device-${randomUUID()}.tmp`);
   try{await writeFile(temporary,JSON.stringify({version:1,configuration:settings}),{flag:'wx',mode:0o600});await rename(temporary,path);configuration=settings;return status();}
   catch{throw new ApiError('storage-error',500);}finally{await rm(temporary,{force:true});}
  });tail=work.then(()=>{},()=>{});return work;
 });
 app.post('/api/device/probe',async request=>{
  parse(emptyRequest,request.body??{});
  return result(await player.probe());
 });
 app.patch('/api/device/display',async request=>{
  try{const outcome=await service.display(request.body);requireDisplaySuccess(outcome.operation);return outcome.snapshot;}finally{changed();}
 });
 app.addHook('onClose',()=>tail);
}
