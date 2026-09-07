import {writeFile,rename,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import type {FastifyInstance} from 'fastify';
import type {OperationResult} from '@pixoo/device';
import type {Player} from '@pixoo/playback';
import {SIMULATOR_PROFILE,PIXOO64_SMOKE_PROFILE} from '@pixoo/media';
import {deviceConfiguration,displayCommand,emptyRequest} from '@pixoo/core';
import {Commands} from './commands.js';
import {parse} from './validation.js';
import {ApiError} from './security.js';
import type {RuntimeSelection} from './device-settings.js';
function result<T>(value:OperationResult<T>|undefined):T {
 if(!value)throw new ApiError('cancelled',409);
 if(!value.ok)throw new ApiError(value.code,value.code==='invalid-input'?400:503,{priorEffects:value.priorEffects});return value.value;
}
export async function deviceRoutes(app:FastifyInstance,directory:string,player:Player,commands:Commands,snapshot:()=>unknown,changed:()=>void,runtime:RuntimeSelection):Promise<void>{
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
 app.patch('/api/device/display',request=>{
  const body=parse(displayCommand,request.body);
  return commands.execute(body.requestId,['display',body],async()=>{
   result(body.screenOn!==undefined?await player.setScreen(body.screenOn):await player.setBrightness(body.brightness!));return snapshot();
  }).finally(changed);
 });
 app.addHook('onClose',()=>tail);
}
