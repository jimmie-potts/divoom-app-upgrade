import {afterEach,expect,it} from 'vitest';
import {mkdtemp,rm,writeFile,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createApp} from '../../apps/server/src/app.js';
import {readBuild} from '../../apps/server/src/build.js';
import {buildIdentitySchema,diagnosticsSchema,healthSchema} from '@pixoo/core';

const roots:string[]=[];
afterEach(async()=>{for(const root of roots.splice(0))await rm(root,{recursive:true,force:true});});
async function fixture(){const root=await mkdtemp(join(tmpdir(),'pixoo-identity-'));roots.push(root);return root;}
it('freezes one startup identity across health and diagnostics after newer metadata lands',async()=>{
 const root=await fixture(),file=join(root,'build.json');
 const older={sourceRevision:'a'.repeat(40),version:'0.0.0'},newer={sourceRevision:'b'.repeat(40),version:'0.0.0'};
 await writeFile(file,JSON.stringify(older));
 const app=createApp({dataDir:join(root,'old-data'),buildFile:pathToFileURL(file)});
 try{
  await app.ready();await writeFile(file,JSON.stringify(newer));
  expect(healthSchema.parse((await app.inject('/api/health')).json()).build).toEqual(older);
  expect(diagnosticsSchema.parse((await app.inject('/api/diagnostics')).json()).build).toEqual(older);
  const next=createApp({dataDir:join(root,'new-data'),buildFile:pathToFileURL(file)});
  try{
   expect(healthSchema.parse((await next.inject('/api/health')).json()).build).toEqual(newer);
   expect(diagnosticsSchema.parse((await next.inject('/api/diagnostics')).json()).build).toEqual(newer);
  }finally{await next.close();}
 }finally{await app.close();}
});
it('uses unknown provenance for missing, malformed, oversized and linked metadata',async()=>{
 const root=await fixture(),file=join(root,'build.json'),url=pathToFileURL(file);
 const unknown={sourceRevision:'unknown',version:'0.0.0'};
 expect(readBuild(url)).toEqual(unknown);
 for(const value of ['{',JSON.stringify({sourceRevision:'a'.repeat(39),version:'0.0.0'}),JSON.stringify({sourceRevision:'a'.repeat(40),version:'0.0.0',privatePath:'private'}),' '.repeat(4097)]){
  await writeFile(file,value);expect(readBuild(url)).toEqual(unknown);
 }
 await writeFile(file,JSON.stringify({sourceRevision:'a'.repeat(40),version:'0.0.0'}));
 const linked=join(root,'linked.json');await symlink(file,linked);expect(readBuild(pathToFileURL(linked))).toEqual(unknown);
 expect(Object.isFrozen(readBuild(url))).toBe(true);
 expect(buildIdentitySchema.safeParse({sourceRevision:'a'.repeat(40)+'\n',version:'0.0.0'}).success).toBe(false);
});
