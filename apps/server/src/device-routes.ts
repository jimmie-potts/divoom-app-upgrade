import {lstat,readFile,writeFile,rename,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import type {FastifyInstance} from 'fastify';
import type {OperationResult} from '@pixoo/device';
import type {Player} from '@pixoo/playback';
import {SIMULATOR_PROFILE,PIXOO64_SMOKE_PROFILE} from '@pixoo/media';
import {deviceConfiguration,displayCommand,emptyRequest,type DeviceConfiguration} from '@pixoo/core';
import {Commands} from './commands.js';
import {parse} from './validation.js';
import {ApiError} from './security.js';
function result<T>(value:OperationResult<T>|undefined):T {
 if(!value)throw new ApiError('cancelled',409);
 if(!value.ok)throw new ApiError(value.code,value.code==='invalid-input'?400:503,{priorEffects:value.priorEffects});return value.value;
}
export async function deviceRoutes(app:FastifyInstance,directory:string,player:Player,commands:Commands,snapshot:()=>unknown,changed:()=>void):Promise<void>{
 const path=join(directory,'device.json');let configuration:DeviceConfiguration|null=null;
 try{
  const info=await lstat(path);if(!info.isFile()||info.isSymbolicLink()||info.size>4096)throw new ApiError('storage-error',500);
  const stored:unknown=JSON.parse(await readFile(path,'utf8'));
  if(!stored||typeof stored!=='object'||!('version'in stored)||stored.version!==1||!('configuration'in stored))throw new ApiError('storage-error',500);
  configuration=parse(deviceConfiguration,stored.configuration);
 }catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw new ApiError('storage-error',500);}
 let tail=Promise.resolve();
 const status=()=>({configuration,mode:'simulator',connected:false,availability:player.getState().availability,activeProfile:SIMULATOR_PROFILE,profiles:[SIMULATOR_PROFILE,PIXOO64_SMOKE_PROFILE]});
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
