import {lstat,open} from 'node:fs/promises';
import {validateHostedFileConfig,type HostedFileConfig} from '@pixoo/device';
import {join} from 'node:path';
import {deviceConfiguration,type DeviceConfiguration} from '@pixoo/core';
import {DEVICE_PROFILES,SIMULATOR_PROFILE} from '@pixoo/media';
import {ApiError} from './security.js';
export type RuntimeMode='simulator'|'device';
export async function readHostedSettings(directory:string):Promise<HostedFileConfig>{
 const path=join(directory,'hosted-gif.json'),info=await lstat(path);
 if(!info.isFile()||info.isSymbolicLink()||info.size>4096)throw new Error('Invalid hosted GIF settings');
 const file=await open(path,'r');
 try{
  const opened=await file.stat();if(opened.ino!==info.ino||opened.dev!==info.dev)throw new Error('Invalid hosted GIF settings');
  const bytes=Buffer.alloc(4097);const {bytesRead}=await file.read(bytes,0,bytes.length,0);
  if(bytesRead>4096)throw new Error('Invalid hosted GIF settings');
  const config:unknown=JSON.parse(bytes.subarray(0,bytesRead).toString());
  if(!config||typeof config!=='object'||Object.keys(config).sort().join(',')!=='bind,origin,port')throw new Error('Invalid hosted GIF settings');
  return validateHostedFileConfig(config as HostedFileConfig);
 }finally{await file.close();}
}
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
 if(mode==='device'&&(!saved||!DEVICE_PROFILES.some(profile=>profile.name===saved.profile)))throw new Error('Device mode requires private device.json with a supported observed profile');
 return Object.freeze({mode,savedConfiguration:saved,activeConfiguration:mode==='device'?saved:null});
}
export function playbackProfile(runtime:RuntimeSelection){
 if(runtime.mode==='simulator')return SIMULATOR_PROFILE;
 const profile=DEVICE_PROFILES.find(profile=>profile.name===runtime.activeConfiguration?.profile);
 if(!profile)throw new Error('Device mode requires a supported observed profile');
 return profile;
}
export async function loadRuntimeSelection(directory:string,mode:RuntimeMode):Promise<Readonly<RuntimeSelection>>{
 return selectRuntime(mode,await readDeviceSettings(directory));
}
