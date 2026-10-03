import {createHash} from 'node:crypto';
import {constants} from 'node:fs';
import {lstat,open,readdir,readlink,realpath} from 'node:fs/promises';
import {dirname,isAbsolute,join,resolve,sep} from 'node:path';

export const runtimeHash=(value:string|Uint8Array):string=>createHash('sha256').update(value).digest('hex');
export function canonicalRuntime(value:unknown):string {
 if(Array.isArray(value))return '['+value.map(canonicalRuntime).join(',')+']';
 if(value!==null&&typeof value==='object')return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonicalRuntime((value as Record<string,unknown>)[key])).join(',')+'}';
 const result=JSON.stringify(value);if(result===undefined)throw new Error('invalid-runtime-value');return result;
}
export interface RuntimeEntry {path:string;kind:'file'|'directory'|'link';mode:number;sha256?:string;target?:string}
export interface RuntimeInventory {entries:RuntimeEntry[];sha256:string}
export interface RuntimeRelease {kind:'release';sourceRevision:string;version:string;archiveSha256:string;manifestSha256:string}
export interface RuntimeLegacy {kind:'legacy';legacyId:string;sourceRevision:'unknown';contentSha256:string;manifestSha256:string}
export type RuntimeIdentity=RuntimeRelease|RuntimeLegacy;

export async function readRuntimeFile(path:string,maximum=8*1024*1024):Promise<Buffer> {
 const file=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
 try{
  const before=await file.stat();
  if(!before.isFile()||before.nlink!==1||before.size>maximum)throw new Error('unsafe-runtime-file');
  const bytes=await file.readFile(),after=await file.stat();
  if(bytes.length!==before.size||after.size!==before.size||after.mtimeMs!==before.mtimeMs||after.ctimeMs!==before.ctimeMs)throw new Error('runtime-file-changed');
  return bytes;
 }finally{await file.close();}
}

/** Hash regular files without following a replacement link or buffering a whole dependency. */
export async function runtimeFileHash(path:string,maximum=256*1024*1024):Promise<string> {
 const file=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
 try{
  const before=await file.stat();
  if(!before.isFile()||before.nlink!==1||before.size>maximum)throw new Error('unsafe-runtime-file');
  const hash=createHash('sha256'),buffer=Buffer.alloc(64*1024);let total=0;
  for(;;){const {bytesRead}=await file.read(buffer,0,buffer.length,null);if(!bytesRead)break;total+=bytesRead;
   if(total>maximum)throw new Error('runtime-file-changed');hash.update(buffer.subarray(0,bytesRead));}
  const after=await file.stat();
  if(total!==before.size||before.size!==after.size||before.mtimeMs!==after.mtimeMs||before.ctimeMs!==after.ctimeMs)throw new Error('runtime-file-changed');
  return hash.digest('hex');
 }finally{await file.close();}
}

/** Record every path, mode, file hash and internal link in an immutable runtime closure. */
export async function runtimeInventory(directory:string):Promise<RuntimeInventory> {
 const root=resolve(directory),stat=await lstat(root);
 if(!stat.isDirectory()||stat.isSymbolicLink()||await realpath(root)!==root)throw new Error('unsafe-runtime-root');
 const entries:RuntimeEntry[]=[];let total=0;
 const inside=(path:string)=>path===root||path.startsWith(root+sep);
 async function visit(prefix:string):Promise<void>{
  for(const name of (await readdir(join(root,prefix))).sort()){
   const path=prefix?prefix+'/'+name:name;
   if(path.length>4096||path.includes('\\')||entries.length>=100000)throw new Error('runtime-inventory-capacity');
   const absolute=join(root,path),info=await lstat(absolute),mode=info.mode&0o777;
   if(info.mode&0o7000)throw new Error('unsafe-runtime-mode');
   if(info.isSymbolicLink()){
    const target=await readlink(absolute);
    if(isAbsolute(target)||!inside(resolve(dirname(absolute),target)))throw new Error('unsafe-runtime-link');
    let resolved:string;try{resolved=await realpath(absolute);}catch{throw new Error('unsafe-runtime-link');}
    if(!inside(resolved))throw new Error('unsafe-runtime-link');
    entries.push({path,kind:'link',mode,target});
   }else if(info.isDirectory()){
    entries.push({path,kind:'directory',mode});await visit(path);
   }else if(info.isFile()){
    total+=info.size;if(total>1024*1024*1024)throw new Error('runtime-inventory-capacity');
    entries.push({path,kind:'file',mode,sha256:await runtimeFileHash(absolute)});
   }else throw new Error('unsafe-runtime-entry');
  }
 }
 await visit('');return {entries,sha256:runtimeHash(canonicalRuntime(entries))};
}

export async function verifyInventory(directory:string,expected:RuntimeInventory):Promise<void> {
 if(!/^[a-f0-9]{64}$/.test(expected.sha256)||runtimeHash(canonicalRuntime(expected.entries))!==expected.sha256)throw new Error('invalid-runtime-inventory');
 const actual=await runtimeInventory(directory);
 if(actual.sha256!==expected.sha256)throw new Error('runtime-inventory-changed');
}
