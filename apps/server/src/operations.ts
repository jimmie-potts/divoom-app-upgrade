import {createHash} from 'node:crypto';
import {createReadStream,createWriteStream} from 'node:fs';
import {lstat,mkdir,open,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {Library} from '@pixoo/library';
import {deviceConfiguration} from '@pixoo/core';
import {privatePath,within} from './config.js';

export const INCOMPLETE='.pixoo-incomplete';
const BACKUP='.pixoo-backup';
const MAX_FILES=100_000,MAX_FILE_BYTES=512*1024*1024,MAX_TOTAL_BYTES=20*1024*1024*1024;
const MAX_MANIFEST_BYTES=32*1024*1024;
interface Entry {path:string;size:number;sha256:string}
interface Manifest {format:'pixoo-backup';version:1;files:Entry[]}
export class OperationsError extends Error {
 constructor(readonly code:string){super(code);this.name='OperationsError';}
}
const fail=(code='invalid-backup'):never=>{throw new OperationsError(code);};
const errno=(error:unknown)=>(error as NodeJS.ErrnoException)?.code;
async function absent(path:string):Promise<void>{
 try{await lstat(path);}catch(error){if(errno(error)==='ENOENT')return;throw error;}
 fail('destination-exists');
}
export async function assertRuntimeDirectory(path:string):Promise<void>{
 for(const marker of [INCOMPLETE,BACKUP]){
  try{await lstat(join(path,marker));}catch(error){if(errno(error)==='ENOENT')continue;throw error;}
  fail('incomplete-or-backup-directory');
 }
}
async function paths(source:string,destination:string):Promise<[string,string]>{
 const from=await privatePath(source),to=await privatePath(destination);
 if(within(from,to)||within(to,from))fail('overlapping-directories');
 await absent(to);
 if(!(await lstat(from)).isDirectory())fail('source-missing');
 return [from,to];
}
async function reserve(path:string):Promise<void>{
 // The parent must exist. No recursive creation or deletion of user directories.
 await mkdir(path,{mode:0o700});
 await writeFile(join(path,INCOMPLETE),'Incomplete Pixoo operation. Do not use as runtime data.\n',{flag:'wx',mode:0o600});
}
async function regular(root:string,path:string,max=MAX_FILE_BYTES):Promise<number>{
 const parts=path.split('/');
 for(let i=1;i<parts.length;i++)if(!(await lstat(join(root,...parts.slice(0,i)))).isDirectory())fail();
 const info=await lstat(join(root,...parts));
 if(!info.isFile() || info.size>max)fail();
 return info.size;
}
async function digest(root:string,path:string):Promise<Entry>{
 const size=await regular(root,path),hash=createHash('sha256');let count=0;
 for await(const chunk of createReadStream(join(root,path))){
  count+=(chunk as Buffer).length;if(count>size)fail();hash.update(chunk as Buffer);
 }
 if(count!==size)fail();
 return {path,size,sha256:hash.digest('hex')};
}
async function copyEntry(source:string,target:string,entry:Entry):Promise<void>{
 if(await regular(source,entry.path)!==entry.size)fail();
 const destination=join(target,entry.path),hash=createHash('sha256');let size=0;
 await mkdir(dirname(destination),{recursive:true,mode:0o700});
 await pipeline(createReadStream(join(source,entry.path)),new Transform({transform(chunk:Buffer,_encoding,done){
  size+=chunk.length;
  if(size>entry.size){done(new OperationsError('invalid-backup'));return;}
  hash.update(chunk);done(null,chunk);
 }}),createWriteStream(destination,{flags:'wx',mode:0o600}));
 if(size!==entry.size || hash.digest('hex')!==entry.sha256)fail();
 const file=await open(destination,'r+');try{await file.sync();}finally{await file.close();}
}
async function settings(root:string):Promise<boolean>{
 try{
  await regular(root,'device.json',4096);
  const value=JSON.parse(await readFile(join(root,'device.json'),'utf8')) as {version?:unknown;configuration?:unknown};
  if(!value || value.version!==1 || !deviceConfiguration.safeParse(value.configuration).success)fail('invalid-settings');
  return true;
 }catch(error){if(errno(error)==='ENOENT')return false;throw error;}
}
const allowedPath=(path:string)=>path==='library/catalog.sqlite'||path==='device.json'||
 /^library\/media\/originals\/[a-f0-9]{64}$/.test(path)||
 /^library\/media\/renditions\/[a-f0-9]{64}\/(manifest\.json|(?:0|[1-9]\d{0,3})\.(?:rgb|png))$/.test(path);
function manifest(value:unknown):Manifest {
 if(!value||typeof value!=='object')return fail();
 const m=value as Manifest;
 if(m.format!=='pixoo-backup'||m.version!==1||Object.keys(m).sort().join(',')!=='files,format,version'||
    !Array.isArray(m.files)||!m.files.length||m.files.length>MAX_FILES)fail();
 const seen=new Set<string>();let total=0;
 for(const entry of m.files){
  if(!entry||typeof entry!=='object'||Object.keys(entry).sort().join(',')!=='path,sha256,size'||
     typeof entry.path!=='string'||!allowedPath(entry.path)||seen.has(entry.path)||
     !Number.isSafeInteger(entry.size)||entry.size<0||entry.size>MAX_FILE_BYTES||
     typeof entry.sha256!=='string'||!/^[a-f0-9]{64}$/.test(entry.sha256))fail();
  seen.add(entry.path);total+=entry.size;
 }
 if(total>MAX_TOTAL_BYTES||!seen.has('library/catalog.sqlite'))fail('backup-limit');
 if(m.files.find(file=>file.path==='library/catalog.sqlite')!.size<100)fail();
 return m;
}
async function verifyTree(root:string,files:Entry[]):Promise<void>{
 const expected=new Set(['manifest.json',BACKUP,...files.map(file=>file.path)]),directories=new Set<string>();
 for(const path of expected){const parts=path.split('/');for(let i=1;i<parts.length;i++)directories.add(parts.slice(0,i).join('/'));}
 const pending=[''];let count=0;
 while(pending.length){
  const dir=pending.pop()!;
  for(const entry of await readdir(join(root,dir),{withFileTypes:true})){
   if(++count>MAX_FILES*4+2)fail('backup-limit');
   const path=dir?`${dir}/${entry.name}`:entry.name;
   if(entry.isDirectory()&&directories.has(path))pending.push(path);
   else if(entry.isFile()&&expected.delete(path))continue;
   else fail();
  }
 }
 if(expected.size)fail();
}
export async function backupData(source:string,destination:string):Promise<void>{
 const [from,to]=await paths(source,destination);await assertRuntimeDirectory(from);
 // Require a real existing catalog; a typo must not initialize a new library.
 if(await regular(from,'library/catalog.sqlite')<100)fail('invalid-catalog');
 const library=await Library.open({directory:join(from,'library')});
 try{
  const inventory=(await library.verifyStorage()).map(path=>`library/${path}`);
  if(await settings(from))inventory.push('device.json');
  if(inventory.length+1>MAX_FILES)fail('backup-limit');
  await reserve(to);await mkdir(join(to,'library'),{mode:0o700});
  await library.snapshotDatabase(join(to,'library','catalog.sqlite'));
  const files=[await digest(to,'library/catalog.sqlite')];let total=files[0]!.size;
  for(const path of inventory){
   const entry=await digest(from,path);total+=entry.size;if(total>MAX_TOTAL_BYTES)fail('backup-limit');
   await copyEntry(from,to,entry);files.push(entry);
  }
  const data=JSON.stringify(manifest({format:'pixoo-backup',version:1,files}));
  if(Buffer.byteLength(data)>MAX_MANIFEST_BYTES)fail('backup-limit');
  await writeFile(join(to,'manifest.json'),data,{flag:'wx',mode:0o600});
  await writeFile(join(to,BACKUP),'Pixoo private backup version 1\n',{flag:'wx',mode:0o600});
  await rm(join(to,INCOMPLETE));
 }finally{await library.close();}
}
export async function restoreData(source:string,destination:string):Promise<void>{
 const [from,to]=await paths(source,destination);
 await absent(join(from,INCOMPLETE));
 await regular(from,'manifest.json',MAX_MANIFEST_BYTES);
 const m=manifest(JSON.parse(await readFile(join(from,'manifest.json'),'utf8')) as unknown);
 await verifyTree(from,m.files);
 await reserve(to);
 for(const entry of m.files)await copyEntry(from,to,entry);
 await settings(to);
 const library=await Library.open({directory:join(to,'library')});
 try{
  const expected=(await library.verifyStorage()).map(path=>`library/${path}`);
  expected.push('library/catalog.sqlite');if(await settings(to))expected.push('device.json');
  if(JSON.stringify(expected.sort())!==JSON.stringify(m.files.map(file=>file.path).sort()))fail();
 }finally{await library.close();}
 await rm(join(to,INCOMPLETE));
}
