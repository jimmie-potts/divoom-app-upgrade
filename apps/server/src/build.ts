import {constants,openSync,closeSync,fstatSync,readSync} from 'node:fs';
import {buildIdentitySchema,type BuildIdentity} from '@pixoo/core';

const unknown=():BuildIdentity=>Object.freeze({sourceRevision:'unknown',version:'0.0.0'});

/** Capture this release's metadata once per application startup, never from Git. */
export function readBuild(path:URL=new URL('../dist/build.json',import.meta.url)):BuildIdentity {
 let descriptor:number|undefined;
 try {
  descriptor=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  if(!fstatSync(descriptor).isFile())return unknown();
  const bytes=Buffer.alloc(4097),length=readSync(descriptor,bytes,0,bytes.length,0);
  if(length===bytes.length)return unknown();
  const result=buildIdentitySchema.safeParse(JSON.parse(bytes.subarray(0,length).toString('utf8')));
  return result.success?Object.freeze(result.data):unknown();
 }catch{return unknown();}
 finally{if(descriptor!==undefined)closeSync(descriptor);}
}
