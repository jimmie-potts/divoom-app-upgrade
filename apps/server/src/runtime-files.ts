import {constants} from 'node:fs';
import {chmod,lstat,mkdir,open,realpath,rename,rm} from 'node:fs/promises';
import {dirname,isAbsolute,join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {canonicalRuntime,readRuntimeFile,runtimeInventory} from './runtime-release.js';

export function runtimeAssert(value:unknown,code:string):asserts value {if(!value)throw new Error(code);}
export async function runtimeExists(path:string):Promise<boolean>{try{await lstat(path);return true;}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return false;throw error;}}
export async function runtimeOwned(path:string,directory=false,privateMode=false):Promise<void>{
 runtimeAssert(isAbsolute(path)&&resolve(path)===path&&await realpath(path)===path,'runtime-path-not-canonical');
 const info=await lstat(path);runtimeAssert(info.uid===process.getuid!()&&(directory?info.isDirectory():info.isFile()&&info.nlink===1)&&!(info.mode&(privateMode?0o077:0o022)),'runtime-path-ownership');
}
export async function runtimeDirectory(path:string):Promise<void>{
 if(!await runtimeExists(path))await mkdir(path,{mode:0o700});await runtimeOwned(path,true,true);
}
export async function runtimeSync(path:string):Promise<void>{const file=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);try{await file.sync();}finally{await file.close();}}
export async function runtimeWrite(path:string,value:unknown):Promise<void>{
 await runtimeOwned(dirname(path),true);
 if(await runtimeExists(path))await runtimeOwned(path,false);
 const temporary=path+'.'+randomUUID()+'.tmp';
 try{const file=await open(temporary,'wx',0o600);try{await file.writeFile(canonicalRuntime(value)+'\n');await file.sync();}finally{await file.close();}
  await rename(temporary,path);await runtimeSync(dirname(path));
 }finally{await rm(temporary,{force:true});}
}
export async function runtimeJson(path:string):Promise<unknown>{return JSON.parse((await readRuntimeFile(path)).toString());}
export async function withRuntimeLock<T>(root:string,work:()=>Promise<T>,inspection=false):Promise<T>{
 await runtimeOwned(root,true,true);const path=join(root,'operation-lock.sqlite');
 if(!await runtimeExists(path)){
  runtimeAssert(!inspection,'runtime-lock-missing');const file=await open(path,'wx',0o600);await file.close();
 }
 await runtimeOwned(path,false,true);const db=new DatabaseSync(path,{timeout:0,allowExtension:false,readOnly:inspection});
 try{db.exec(inspection?'BEGIN':'PRAGMA journal_mode=DELETE; BEGIN EXCLUSIVE');
  // Materialize the shared SQLite read lock, rather than a deferred BEGIN alone.
  if(inspection)db.prepare('SELECT count(*) FROM sqlite_master').get();
  return await work();
 }finally{db.close();}
}

/** Keep inode-bound handles until restoration; no chmod of a substituted pathname. */
export async function runtimeFence<T>(paths:string[],record:string,work:()=>Promise<T>):Promise<T>{
 const handles:Awaited<ReturnType<typeof open>>[]=[],modes:number[]=[];
 let result:T|undefined,failure:unknown,failed=false,restorationFailed=false;
 try{
  const facts=[];
  for(const path of [...new Set(paths)]){
   await runtimeOwned(path,true);const handle=await open(path,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);
   const info=await handle.stat().catch(async error=>{await handle.close();throw error;});handles.push(handle);modes.push(info.mode&0o777);
   facts.push({path,inode:info.ino,device:info.dev,mode:info.mode&0o777,inventorySha256:(await runtimeInventory(path)).sha256});
  }
  await runtimeWrite(record,facts);
  for(let index=0;index<handles.length;index++){await handles[index]!.chmod(modes[index]!&~0o111);await handles[index]!.sync();}
  result=await work();
 }catch(error){failed=true;failure=error;
 }finally{
  for(let index=0;index<handles.length;index++)try{await handles[index]!.chmod(modes[index]!);await handles[index]!.sync();}catch{restorationFailed=true;}
  for(const handle of handles)await handle.close();
 }
 if(restorationFailed)throw new Error('runtime-fence-restoration-uncertain');if(failed)throw failure;return result as T;
}
export async function runtimePrivateFile(path:string):Promise<void>{await chmod(path,0o600);await runtimeSync(path);}
