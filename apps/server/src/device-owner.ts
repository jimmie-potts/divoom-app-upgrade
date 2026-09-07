import {createHash} from 'node:crypto';
import {lstat,mkdir,open} from 'node:fs/promises';
import {join} from 'node:path';
import {homedir} from 'node:os';
import {DatabaseSync} from 'node:sqlite';
import {privatePath} from './config.js';
import {ApiError} from './security.js';
export async function acquireDeviceOwner(ip:string,directoryForTests?:string):Promise<()=>void>{
 const directory=await privatePath(directoryForTests??(process.platform==='win32'
  ?join(homedir(),'AppData','Local','PixooPlaylistControllerDeviceLocks')
  :join(homedir(),'.local','share','pixoo-playlist-controller-device-locks')));
 await mkdir(directory,{recursive:true,mode:0o700});
 const path=join(directory,`${createHash('sha256').update(ip).digest('hex')}.sqlite`);
 let owner:DatabaseSync|undefined;
 try{
  for(const suffix of ['','-journal','-wal','-shm']){
   try{if(!(await lstat(path+suffix)).isFile())throw new Error();}
   catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
  }
  try{const file=await open(path,'wx',0o600);await file.close();}catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;}
  owner=new DatabaseSync(path,{timeout:0,allowExtension:false});
  owner.exec('PRAGMA journal_mode=DELETE; CREATE TABLE IF NOT EXISTS owner(id INTEGER PRIMARY KEY); BEGIN EXCLUSIVE');
  let released=false;return ()=>{if(!released){released=true;owner!.close();}};
 }catch(error){owner?.close();throw new ApiError(String((error as Error).message).includes('locked')?'busy':'storage-error',503);}
}
