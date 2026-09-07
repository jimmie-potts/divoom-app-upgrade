import {lstat,open} from 'node:fs/promises';
import {join} from 'node:path';
import {deviceConfiguration,type DeviceConfiguration} from '@pixoo/core';
import {PIXOO64_SMOKE_PROFILE} from '@pixoo/media';
import {ApiError} from './security.js';
export type RuntimeMode='simulator'|'device';
export interface RuntimeSelection {
 readonly mode:RuntimeMode;
 readonly savedConfiguration:Readonly<DeviceConfiguration>|null;
 readonly activeConfiguration:Readonly<DeviceConfiguration>|null;
}
export async function readDeviceSettings(directory:string):Promise<Readonly<DeviceConfiguration>|null>{
 try{
  const path=join(directory,'device.json'),info=await lstat(path);
  if(!info.isFile()||info.isSymbolicLink()||info.size>4096)throw new Error();
  const file=await open(path,'r');
  try{
   const opened=await file.stat();if(!opened.isFile()||opened.ino!==info.ino||opened.dev!==info.dev)throw new Error();
   const bytes=Buffer.alloc(4097);let size=0;
   while(size<bytes.length){const chunk=await file.read(bytes,size,bytes.length-size,null);if(!chunk.bytesRead)break;size+=chunk.bytesRead;}
   if(size>4096)throw new Error();
   const stored:unknown=JSON.parse(bytes.subarray(0,size).toString('utf8'));
   if(!stored||typeof stored!=='object'||!('version'in stored)||stored.version!==1||!('configuration'in stored))throw new Error();
   return Object.freeze(deviceConfiguration.parse(stored.configuration));
  }finally{await file.close();}
 }catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return null;throw new ApiError('storage-error',500);}
}
export function selectRuntime(mode:RuntimeMode,savedConfiguration:Readonly<DeviceConfiguration>|null):Readonly<RuntimeSelection>{
 if(mode!=='simulator'&&mode!=='device')throw new Error('PIXOO_MODE must be simulator or device');
 const saved=savedConfiguration===null?null:Object.freeze(deviceConfiguration.parse(savedConfiguration));
 if(mode==='device'&&(!saved||saved.profile!==PIXOO64_SMOKE_PROFILE.name))throw new Error('Device mode requires private device.json with the dated smoke profile');
 return Object.freeze({mode,savedConfiguration:saved,activeConfiguration:mode==='device'?saved:null});
}
export async function loadRuntimeSelection(directory:string,mode:RuntimeMode):Promise<Readonly<RuntimeSelection>>{
 return selectRuntime(mode,await readDeviceSettings(directory));
}
